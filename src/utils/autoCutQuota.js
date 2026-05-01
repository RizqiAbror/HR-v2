const applyCutiBersama = async (tanggal, keterangan, agentId, adminName, prisma) => {
  const currentYear = tanggal.getFullYear();

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error('Agent tidak ditemukan');

  const employees = await prisma.employee.findMany({
    where: { agentId: agentId, statusKaryawan: 'ACTIVE' }
  });

  if (employees.length === 0) return;

  const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const requestNoPrefix = `CB-${currentYear}-${randomDigits}`;

  await prisma.$transaction(async (tx) => {
    let affectedCount = 0;
    
    for (const emp of employees) {
      const quota = await tx.leaveQuota.findUnique({
        where: { nik_tahun: { nik: emp.nik, tahun: currentYear } }
      });

      if (quota && quota.cutiTerpakai < quota.jumlahCuti) {
        await tx.leaveQuota.update({
          where: { id: quota.id },
          data: { cutiTerpakai: { increment: 1 } }
        });

        await tx.leaveRequest.create({
          data: {
            requestNo: `${requestNoPrefix}-${emp.id}`,
            nik: emp.nik,
            quotaId: quota.id,
            tanggalMulai: tanggal,
            tanggalAkhir: tanggal,
            jumlahHari: 1,
            alasan: `CUTI BERSAMA - ${keterangan}`,
            status: 'APPROVED',
            approvedByHr: adminName,
            approvedAtHr: new Date(),
            catatanHr: 'Otomatis via Cuti Bersama'
          }
        });
        affectedCount++;
      }
    }

    await tx.auditLog.create({
      data: {
        tableName: 'leave_quotas',
        action: 'BULK_LEAVE',
        description: `Admin ${adminName} melakukan pemotongan cuti massal untuk Agent ${agent.name} (${affectedCount} karyawan). Tanggal: ${tanggal.toLocaleDateString('id-ID')}`,
        executedBy: adminName
      }
    });
  });
};

module.exports = { applyCutiBersama };
