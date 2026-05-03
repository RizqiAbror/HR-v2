const { PrismaClient } = require('@prisma/client');
const { hitungHariCuti } = require('../utils/hitungHariCuti');
const { generateKuotaTahunan } = require('../utils/generateKuotaCuti');
const { logAudit } = require('../utils/auditTrail');
const multer = require('multer');
const path   = require('path');

const prisma = new PrismaClient();

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/surat-cuti'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + (req.body.nik || 'unknown') + '-surat' + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau PDF'));
  }
});

const getSisaCuti = async (req, res) => {
  try {
    const { nik, tahun } = req.query;
    if (!nik || !tahun) {
      return res.status(400).json({ success: false, message: 'Parameter nik dan tahun wajib diisi' });
    }

    const quota = await prisma.leaveQuota.findUnique({
      where: {
        nik_tahun: {
          nik: nik,
          tahun: parseInt(tahun),
        },
      },
    });

    if (!quota) {
      return res.status(404).json({ success: false, message: 'Data kuota tidak ditemukan' });
    }

    const sisaCuti = quota.jumlahCuti - quota.cutiTerpakai;
    return res.json({ success: true, data: { ...quota, sisaCuti } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const getRiwayatCuti = async (req, res) => {
  try {
    const { nik } = req.query;
    if (!nik) {
      return res.status(400).json({ success: false, message: 'Parameter nik wajib diisi' });
    }

    const results = await prisma.leaveRequest.findMany({
      where: { nik },
      orderBy: { tanggalPengajuan: 'desc' },
      include: {
        quota: {
          select: { tahun: true },
        },
      },
    });

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const submitCuti = async (req, res) => {
  try {
    const { nik, tanggalMulai, tanggalAkhir, alasan } = req.body;

    if (!nik || !tanggalMulai || !tanggalAkhir || !alasan) {
        return res.status(400).json({ success: false, message: 'Data pengajuan belum lengkap' });
    }

    const start = new Date(tanggalMulai);
    const end = new Date(tanggalAkhir);

    const jumlahHari = await hitungHariCuti(start, end, prisma);

    if (jumlahHari <= 0) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal tidak mengandung hari kerja' });
    }

    const startYear = start.getFullYear();

    const quota = await prisma.leaveQuota.findUnique({
      where: {
        nik_tahun: {
          nik: nik,
          tahun: startYear,
        },
      },
    });

    if (!quota) {
      return res.status(404).json({ success: false, message: 'Kuota cuti tahun ini belum tersedia' });
    }

    const sisaCuti = quota.jumlahCuti - quota.cutiTerpakai;
    if (quota.cutiTerpakai + jumlahHari > quota.jumlahCuti) {
      return res.status(400).json({ success: false, message: `Sisa cuti tidak mencukupi. Sisa: ${sisaCuti} hari, dibutuhkan: ${jumlahHari} hari` });
    }

    // CEK OVERLAP TANGGAL
    const overlapRequest = await prisma.leaveRequest.findFirst({
      where: {
        nik: nik,
        status: { in: ['PENDING_ATASAN', 'PENDING_HR', 'APPROVED'] },
        tanggalMulai: { lte: end },
        tanggalAkhir: { gte: start }
      }
    });

    if (overlapRequest) {
      return res.status(400).json({ 
        success: false, 
        message: `Terdapat pengajuan cuti yang bentrok dengan tanggal ini (Request No: ${overlapRequest.requestNo})` 
      });
    }

    let attachmentUrl = null;
    if (req.file) {
      attachmentUrl = '/uploads/surat-cuti/' + req.file.filename;
    }

    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const requestNo = `LV-${startYear}-${randomDigits}`;

    const newRequest = await prisma.leaveRequest.create({
      data: {
        requestNo,
        nik,
        quotaId: quota.id,
        tanggalMulai: start,
        tanggalAkhir: end,
        jumlahHari,
        alasan,
        status: 'PENDING_HR',
        attachmentUrl
      },
    });

    // Logging Audit Trail
    await logAudit(prisma, {
      nik,
      tableName: 'leave_requests',
      action: 'CREATE',
      oldData: null,
      newData: newRequest,
      changedBy: 'HR_ADMIN'
    });

    return res.json({ 
      success: true, 
      message: 'Pengajuan cuti berhasil disubmit', 
      data: newRequest
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const approveCuti = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, approvedBy, catatan } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action tidak valid' });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) },
      include: { quota: true },
    });

    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Pengajuan cuti tidak ditemukan' });
    }

    if (leaveRequest.status !== 'PENDING_HR') {
      return res.status(400).json({ success: false, message: 'Status tidak valid untuk persetujuan HR' });
    }

    let statusBaru = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    let updateData = {
      status: statusBaru,
      approvedAtHr: new Date(),
      approvedByHr: approvedBy || 'HR_ADMIN'
    };

    if (action === 'REJECT' && catatan) {
      updateData.catatanHr = catatan;
    }

    let updatedReq;

    if (statusBaru === 'APPROVED') {
      const result = await prisma.$transaction(async (tx) => {
        const currentQuota = await tx.leaveQuota.findUnique({
          where: { id: leaveRequest.quotaId }
        });
        
        if ((currentQuota.cutiTerpakai + leaveRequest.jumlahHari) > currentQuota.jumlahCuti) {
          throw new Error('Sisa cuti tidak mencukupi saat diproses (mungkin sudah terpakai di pengajuan lain).');
        }

        const updated = await tx.leaveRequest.update({
          where: { id: parseInt(id) },
          data: updateData,
        });

        await tx.leaveQuota.update({
          where: { id: leaveRequest.quotaId },
          data: {
            cutiTerpakai: {
              increment: leaveRequest.jumlahHari,
            },
          },
        });

        return updated;
      });
      updatedReq = result;
    } else {
      updatedReq = await prisma.leaveRequest.update({
        where: { id: parseInt(id) },
        data: updateData,
      });
    }

    // Logging Audit Trail
    await logAudit(prisma, {
      nik: leaveRequest.nik,
      tableName: 'leave_requests',
      action: 'UPDATE',
      oldData: { status: leaveRequest.status },
      newData: { status: updatedReq.status },
      changedBy: updateData.approvedByHr
    });

    return res.json({ success: true, message: 'Status berhasil diupdate', data: updatedReq });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const cancelCuti = async (req, res) => {
  try {
    const { id } = req.params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) },
    });

    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Pengajuan cuti tidak ditemukan' });
    }

    if (leaveRequest.status !== 'PENDING_HR') {
      return res.status(400).json({ success: false, message: 'Pengajuan tidak dapat dibatalkan karena sudah diproses' });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED' },
    });

    // Logging Audit Trail
    await logAudit(prisma, {
      nik: leaveRequest.nik,
      tableName: 'leave_requests',
      action: 'UPDATE',
      oldData: { status: leaveRequest.status },
      newData: { status: updated.status },
      changedBy: 'HR_ADMIN'
    });

    return res.json({ success: true, message: 'Pengajuan cuti berhasil dibatalkan' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const hitungHari = async (req, res) => {
  try {
    const { tanggalMulai, tanggalAkhir } = req.body;
    if (!tanggalMulai || !tanggalAkhir) {
      return res.status(400).json({ success: false, message: 'Parameter tanggalMulai dan tanggalAkhir wajib diisi' });
    }
    const result = await hitungHariCuti(new Date(tanggalMulai), new Date(tanggalAkhir), prisma);
    return res.json({ success: true, hari: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const triggerGenerateKuota = async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.SESSION_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const tahun = parseInt(req.body.tahun) || new Date().getFullYear();
    const result = await generateKuotaTahunan(tahun, prisma);

    return res.json({ success: true, message: 'Generate kuota selesai', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const cutiBersamaMassal = async (req, res) => {
  try {
    const { tanggalMulai, tanggalAkhir, keterangan } = req.body;
    
    if (!tanggalMulai || !tanggalAkhir || !keterangan) {
      return res.status(400).json({ success: false, message: 'Tanggal dan keterangan wajib diisi' });
    }

    const start = new Date(tanggalMulai);
    const end = new Date(tanggalAkhir);
    const tahun = start.getFullYear();

    const jumlahHari = await hitungHariCuti(start, end, prisma);

    if (jumlahHari <= 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada hari kerja efektif untuk dipotong' });
    }

    const employees = await prisma.employee.findMany({
      where: { statusKaryawan: 'ACTIVE' },
      select: { nik: true }
    });

    let berhasil = 0;
    let gagal = 0;

    for (const emp of employees) {
      try {
        await prisma.$transaction(async (tx) => {
          const quota = await tx.leaveQuota.findUnique({
            where: { nik_tahun: { nik: emp.nik, tahun: tahun } }
          });

          if (!quota) throw new Error('Kuota tidak ditemukan');
          
          if (quota.cutiTerpakai + jumlahHari > quota.jumlahCuti) {
            throw new Error('Sisa cuti tidak cukup');
          }

          const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const requestNo = `CB-${tahun}-${randomDigits}-${emp.nik.slice(-3)}`;

          const newRequest = await tx.leaveRequest.create({
            data: {
              requestNo,
              nik: emp.nik,
              quotaId: quota.id,
              tanggalMulai: start,
              tanggalAkhir: end,
              jumlahHari,
              alasan: `[CUTI BERSAMA] ${keterangan}`,
              status: 'APPROVED',
              approvedByHr: 'SYSTEM_MASSAL',
              approvedAtHr: new Date()
            }
          });

          await tx.leaveQuota.update({
            where: { id: quota.id },
            data: { cutiTerpakai: { increment: jumlahHari } }
          });

          await logAudit(tx, {
            nik: emp.nik,
            tableName: 'leave_requests',
            action: 'CREATE_MASSAL',
            oldData: null,
            newData: newRequest,
            changedBy: 'HR_ADMIN'
          });
        });
        berhasil++;
      } catch (err) {
        gagal++;
        console.error(`Gagal potong cuti bersama untuk ${emp.nik}:`, err.message);
      }
    }

    return res.json({ 
      success: true, 
      message: `Eksekusi Cuti Bersama selesai. Berhasil: ${berhasil}, Gagal/Skip: ${gagal}`,
      data: { berhasil, gagal }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

module.exports = {
  getSisaCuti,
  getRiwayatCuti,
  submitCuti,
  approveCuti,
  cancelCuti,
  hitungHari,
  upload,
  triggerGenerateKuota,
  cutiBersamaMassal
};
