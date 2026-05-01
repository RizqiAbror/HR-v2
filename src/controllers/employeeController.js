const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { parseEmployeeExcel } = require('../utils/excelParser');
const { validateNIK } = require('../utils/validators');
const fs = require('fs');

const importEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File excel tidak ditemukan' });
    }

    const adminNik = req.body.adminNik || 'ADMIN';
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    const data = await parseEmployeeExcel(filePath, originalName);

    let upsertCount = 0;
    const currentYear = new Date().getFullYear();

    await prisma.$transaction(async (tx) => {
      // Ambil seluruh Agent untuk pemetaan
      const agents = await tx.agent.findMany();
      const agentMap = {};
      agents.forEach(a => { agentMap[a.name.toLowerCase().trim()] = a.id; });

      for (const row of data) {
        if (!row.nik || !row.namaKaryawan) continue;

        // VALIDASI NIK (Instruksi Pak Budi)
        if (!validateNIK(row.nik)) {
          console.warn(`NIK tidak valid: ${row.nik}. Lewati.`);
          continue;
        }

        let agentId = null;
        // ... (agent logic stays same)
        if (row.agentName) {
          const aName = row.agentName.toLowerCase().trim();
          agentId = agentMap[aName];
          if (!agentId) {
             const baseCode = row.agentName.trim().substring(0, 3).toUpperCase();
             const randomNum = Math.floor(Math.random() * 1000).toString().padStart(4, '0');
             const newAgent = await tx.agent.create({
               data: { name: row.agentName.trim(), code: `${baseCode}${randomNum}`, status: 'ACTIVE' }
             });
             agentId = newAgent.id;
             agentMap[aName] = agentId;
          }
        }

        // AUDIT TRAIL DEPTH: Cek perubahan Status TK & Keuangan
        const existingEmp = await tx.employee.findUnique({ where: { nik: row.nik } });
        if (existingEmp) {
          const sensitiveFields = ['statusTk', 'gajiPokok', 'allowance', 'jkk', 'jkm', 'jht', 'pph21'];
          const changes = {};
          const oldData = {};
          const newData = {};
          let isChanged = false;

          sensitiveFields.forEach(field => {
            if (existingEmp[field] !== row[field] && row[field] !== undefined) {
              oldData[field] = existingEmp[field];
              newData[field] = row[field];
              isChanged = true;
            }
          });

          if (isChanged) {
            await tx.auditLog.create({
              data: {
                tableName: 'employees',
                action: 'UPDATE_FINANCIAL_INFO',
                description: `Perubahan data sensitif untuk NIK ${row.nik}`,
                oldData: oldData,
                newData: newData,
                executedBy: adminNik
              }
            });
          }
        }

        // Upsert Employee dengan SEMUA KOLOM BD
        await tx.employee.upsert({
          where: { nik: row.nik },
          update: {
            namaKaryawan: row.namaKaryawan,
            agentId: agentId,
            nomorKtp: row.nomorKtp,
            statusPerkawinan: row.statusPerkawinan,
            jabatan: row.jabatan,
            statusTk: row.statusTk,
            endDate: row.endDate,
            statusKaryawan: row.statusKaryawan,
            gajiPokok: row.gajiPokok,
            allowance: row.allowance,
            jkk: row.jkk,
            jkm: row.jkm,
            jht: row.jht,
            kesehatan: row.kesehatan,
            pph21: row.pph21,
            bonus: row.bonus,
            namaBank: row.namaBank,
            nomorRekening: row.nomorRekening,
            namaRekening: row.namaRekening,
            attachmentPkwt: row.attachmentPkwt
          },
          create: {
            nik: row.nik,
            namaKaryawan: row.namaKaryawan,
            agentId: agentId,
            nomorKtp: row.nomorKtp,
            statusPerkawinan: row.statusPerkawinan,
            jabatan: row.jabatan,
            statusTk: row.statusTk || 'PKWT',
            level: row.jabatan || 'Staff',
            divisi: row.divisi || 'General',
            jointDate: row.jointDate || new Date(),
            endDate: row.endDate,
            emailKantor: `${row.nik.toLowerCase().replace(/[^a-z0-9]/g, '')}@perusahaan.com`,
            gajiPokok: row.gajiPokok,
            allowance: row.allowance,
            jkk: row.jkk,
            jkm: row.jkm,
            jht: row.jht,
            kesehatan: row.kesehatan,
            pph21: row.pph21,
            bonus: row.bonus,
            namaBank: row.namaBank,
            nomorRekening: row.nomorRekening,
            namaRekening: row.namaRekening,
            attachmentPkwt: row.attachmentPkwt
          }
        });

        // Upsert Leave Quotas
        await tx.leaveQuota.upsert({
          where: { nik_tahun: { nik: row.nik, tahun: currentYear } },
          update: {}, // Biarkan utuh jika sudah ada
          create: {
            nik: row.nik,
            tahun: currentYear,
            jumlahCuti: 12,
            cutiTerpakai: 0
          }
        });

        upsertCount++;
      }

      // Catat di AuditTrail
      await tx.auditLog.create({
        data: {
          tableName: 'employees',
          action: 'IMPORT_EMPLOYEES',
          description: `Admin mengimport ${upsertCount} data karyawan baru / update via Excel`,
          executedBy: adminNik
        }
      });
    }, {
      timeout: 20000 // Beri waktu lebih untuk transaksi excel
    });

    // Hapus file sementara
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return res.json({ success: true, message: `Berhasil mengimport/memperbarui ${upsertCount} karyawan.` });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ success: false, message: 'Server error saat import', error: error.message });
  }
};

module.exports = { importEmployees };
