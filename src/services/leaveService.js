const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Memproses Cuti Bersama secara massal untuk semua karyawan di bawah Agent tertentu.
 */
const processCutiBersama = async (tanggal, keterangan, agentId, adminName) => {
  const dateObj = new Date(tanggal);
  const currentYear = dateObj.getFullYear();

  // VALIDASI SENIOR 1: Cek apakah hari Minggu
  if (dateObj.getDay() === 0) {
    throw new Error('Cuti bersama tidak bisa diinput pada hari Minggu.');
  }

  // VALIDASI SENIOR 2: Cek apakah sudah ada di Libur Nasional (yang bukan cuti bersama)
  const existingHoliday = await prisma.nationalHoliday.findUnique({
    where: { tanggal: dateObj }
  });

  if (existingHoliday && !existingHoliday.isCutiBersama) {
    throw new Error(`Tanggal tersebut sudah terdaftar sebagai Hari Libur Nasional: ${existingHoliday.keterangan}. Tidak perlu potong cuti.`);
  }

  const agent = await prisma.agent.findUnique({ where: { id: parseInt(agentId) } });
  if (!agent) throw new Error('Agent tidak ditemukan.');

  const employees = await prisma.employee.findMany({
    where: { agentId: parseInt(agentId), statusKaryawan: 'ACTIVE' }
  });

  if (employees.length === 0) return { affected: 0 };

  const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const requestNoPrefix = `CB-${currentYear}-${randomDigits}`;

  return await prisma.$transaction(async (tx) => {
    let affectedCount = 0;

    // Pastikan tanggal tercatat sebagai Cuti Bersama di NationalHoliday
    await tx.nationalHoliday.upsert({
      where: { tanggal: dateObj },
      update: { isCutiBersama: true, keterangan: keterangan },
      create: { tanggal: dateObj, keterangan: keterangan, isCutiBersama: true, tahun: currentYear }
    });

    for (const emp of employees) {
      const quota = await tx.leaveQuota.findUnique({
        where: { nik_tahun: { nik: emp.nik, tahun: currentYear } }
      });

      let quotaId = quota?.id;
      if (!quota) {
        const newQuota = await tx.leaveQuota.create({
          data: { nik: emp.nik, tahun: currentYear, jumlahCuti: 12, cutiTerpakai: 0 }
        });
        quotaId = newQuota.id;
      }

      await tx.leaveQuota.update({
        where: { id: quotaId },
        data: { cutiTerpakai: { increment: 1 } }
      });

      // ARSITEKTUR FINAL: Menggunakan details untuk menyimpan tanggal
      await tx.leaveRequest.create({
        data: {
          requestNo: `${requestNoPrefix}-${emp.id}`,
          nik: emp.nik,
          quotaId: quotaId,
          jumlahHari: 1,
          alasan: `CUTI BERSAMA - ${keterangan}`,
          status: 'APPROVED',
          approvedByHr: adminName,
          approvedAtHr: new Date(),
          catatanHr: 'Otomatis via Fitur Cuti Bersama',
          details: {
            create: { tanggal: dateObj }
          }
        }
      });
      affectedCount++;
    }

    // AUDIT TRAIL
    await tx.auditLog.create({
      data: {
        tableName: 'leave_quotas',
        action: 'BULK_LEAVE',
        description: `Admin ${adminName} melakukan pemotongan cuti massal untuk Agent ${agent.name} (${affectedCount} karyawan). Tanggal: ${dateObj.toLocaleDateString('id-ID')}`,
        executedBy: adminName
      }
    });

    return { affected: affectedCount };
  });
};

module.exports = {
  processCutiBersama
};
