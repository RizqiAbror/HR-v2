const { PrismaClient } = require('@prisma/client');
const { hitungHariCuti } = require('../utils/hitungHariCuti');
const { processCutiBersama } = require('../services/leaveService');
const { generateAnnualQuota } = require('../utils/annualReset');
const prisma = new PrismaClient();

const getSisaCuti = async (req, res) => {
  try {
    const { nik, tahun } = req.query;
    const year = tahun ? parseInt(tahun) : new Date().getFullYear();

    const quota = await prisma.leaveQuota.findUnique({
      where: { nik_tahun: { nik, tahun: year } },
    });

    if (!quota) return res.json({ success: true, sisa_cuti: 0 });
    return res.json({ success: true, sisa_cuti: quota.jumlahCuti - quota.cutiTerpakai });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getRiwayatCuti = async (req, res) => {
  try {
    const { nik } = req.params;
    const results = await prisma.leaveRequest.findMany({
      where: { nik: nik },
      orderBy: { createdAt: 'desc' },
      include: {
        quota: { select: { tahun: true } },
        details: true
      },
    });
    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const submitCuti = async (req, res) => {
  try {
    let { nik, dates, alasan, jenisCuti } = req.body;
    
    // Parse dates jika dikirim sebagai string JSON (karena multipart)
    if (typeof dates === 'string') dates = JSON.parse(dates);
    if (!jenisCuti) jenisCuti = 'TAHUNAN';

    if (!nik || !dates || !Array.isArray(dates) || dates.length === 0 || !alasan) {
        return res.status(400).json({ success: false, message: 'Data belum lengkap' });
    }

    const jumlahHari = await hitungHariCuti(dates, prisma);
    const startYear = new Date(dates[0]).getFullYear();

    const quota = await prisma.leaveQuota.findUnique({
      where: { nik_tahun: { nik, tahun: startYear } },
    });

    if (!quota) return res.status(404).json({ success: false, message: 'Kuota belum tersedia' });

    // Validasi jatah HANYA jika jenisnya TAHUNAN
    if (jenisCuti === 'TAHUNAN') {
      if (quota.cutiTerpakai + jumlahHari > quota.jumlahCuti) {
        return res.status(400).json({ success: false, message: 'Sisa cuti tidak mencukupi' });
      }
    }

    const attachmentUrl = req.file ? `/uploads/attachments/${req.file.filename}` : null;
    const requestNo = `LV-${startYear}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const newRequest = await prisma.$transaction(async (tx) => {
      return await tx.leaveRequest.create({
        data: {
          requestNo,
          nik,
          quotaId: quota.id,
          jenisCuti,
          jumlahHari,
          alasan,
          attachmentUrl,
          details: { create: dates.map(d => ({ tanggal: new Date(d) })) }
        },
      });
    });

    return res.json({ success: true, message: 'Submit berhasil', data: newRequest });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const approveCuti = async (req, res) => {
  try {
    const { id, action, role, approvedBy, catatan } = req.body;
    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id: parseInt(id) } });
    if (!leaveRequest) return res.status(404).json({ success: false, message: 'Not found' });

    let statusBaru = '';
    let updateData = {};

    if (role === 'ATASAN') {
      statusBaru = action === 'APPROVE' ? 'PENDING_HR' : 'REJECTED';
      updateData = { status: statusBaru, approvedByAtasan: approvedBy, approvedAtAtasan: new Date(), catatanAtasan: catatan };
    } else if (role === 'HR') {
      statusBaru = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      updateData = { status: statusBaru, approvedByHr: approvedBy, approvedAtHr: new Date(), catatanHr: catatan };
    }

    if (statusBaru === 'APPROVED') {
      await prisma.$transaction(async (tx) => {
        await tx.leaveRequest.update({ where: { id: parseInt(id) }, data: updateData });
        
        // POTONG KUOTA HANYA JIKA TAHUNAN
        if (leaveRequest.jenisCuti === 'TAHUNAN') {
          await tx.leaveQuota.update({
            where: { id: leaveRequest.quotaId },
            data: { cutiTerpakai: { increment: leaveRequest.jumlahHari } },
          });
        }

        await tx.auditLog.create({
          data: {
            tableName: 'leave_quotas',
            action: 'APPROVE_CUTI',
            description: `Approve ${leaveRequest.jenisCuti} (${leaveRequest.jumlahHari} hari) untuk NIK ${leaveRequest.nik}`,
            executedBy: approvedBy || 'SYSTEM'
          }
        });
      });
      return res.json({ success: true, message: 'Approved' });
    } else {
      await prisma.leaveRequest.update({ where: { id: parseInt(id) }, data: updateData });
      return res.json({ success: true, message: 'Status updated' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const cancelCuti = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.leaveRequest.update({ where: { id: parseInt(id) }, data: { status: 'CANCELLED' } });
    return res.json({ success: true, message: 'Cancelled' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const bulkLeaveSubmit = async (req, res) => {
  try {
    const { tanggal, keterangan, agentId, adminNik } = req.body;
    const result = await processCutiBersama(tanggal, keterangan, agentId, adminNik || 'ADMIN');
    return res.json({ success: true, message: `Berhasil untuk ${result.affected} karyawan` });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const adminSubmitCuti = async (req, res) => {
  try {
    let { nik, dates, alasan, jenisCuti, adminNik } = req.body;
    if (typeof dates === 'string') dates = JSON.parse(dates);
    if (!jenisCuti) jenisCuti = 'TAHUNAN';

    const jumlahHari = await hitungHariCuti(dates, prisma);
    const startYear = new Date(dates[0]).getFullYear();
    const quota = await prisma.leaveQuota.findUnique({ where: { nik_tahun: { nik, tahun: startYear } } });
    
    if (!quota) throw new Error('Quota not found');

    const attachmentUrl = req.file ? `/uploads/attachments/${req.file.filename}` : null;
    const requestNo = `LV-${startYear}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    await prisma.$transaction(async (tx) => {
      // Admin submit langsung Approved dan potong jatah (jika TAHUNAN)
      if (jenisCuti === 'TAHUNAN') {
        await tx.leaveQuota.update({
          where: { id: quota.id },
          data: { cutiTerpakai: { increment: jumlahHari } }
        });
      }

      await tx.leaveRequest.create({
        data: {
          requestNo, nik, quotaId: quota.id, jenisCuti, jumlahHari, alasan, attachmentUrl,
          status: 'APPROVED', approvedByHr: adminNik, approvedAtHr: new Date(),
          details: { create: dates.map(d => ({ tanggal: new Date(d) })) }
        },
      });
    });

    return res.json({ success: true, message: 'Admin submit success' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const hitungHari = async (req, res) => {
  try {
    const { mulai, akhir, dates } = req.query;
    let inputDates = [];
    if (dates) inputDates = JSON.parse(dates);
    else if (mulai && akhir) {
      let current = new Date(mulai);
      while (current <= new Date(akhir)) {
        inputDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
    const count = await hitungHariCuti(inputDates, prisma);
    return res.json({ success: true, jumlah_hari: count });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const triggerAnnualReset = async (req, res) => {
  try {
    const { year } = req.query;
    const count = await generateAnnualQuota(year);
    return res.json({ success: true, message: `Reset ${count} success` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSisaCuti, getRiwayatCuti, submitCuti, approveCuti, cancelCuti,
  bulkLeaveSubmit, adminSubmitCuti, hitungHari, triggerAnnualReset
};
