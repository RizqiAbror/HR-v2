const { PrismaClient } = require('@prisma/client');
const { hitungHariCuti } = require('../utils/hitungHariCuti');

const prisma = new PrismaClient();

const getSisaCuti = async (req, res) => {
  try {
    const { nik } = req.query;
    const tahun = req.query.tahun ? parseInt(req.query.tahun) : new Date().getFullYear();

    if (!nik) {
      return res.status(400).json({ success: false, message: 'NIK harus diisi' });
    }

    const quota = await prisma.leaveQuota.findUnique({
      where: {
        nik_tahun: {
          nik: nik,
          tahun: tahun,
        },
      },
      include: {
        employee: {
          select: { namaKaryawan: true },
        },
      },
    });

    if (!quota) {
      return res.status(404).json({ success: false, message: 'Data kuota cuti tidak ditemukan' });
    }

    const sisa_cuti = quota.jumlahCuti - quota.cutiTerpakai;

    return res.json({
      success: true,
      data: {
        nik: quota.nik,
        nama_karyawan: quota.employee.namaKaryawan,
        tahun: quota.tahun,
        jumlah_cuti: quota.jumlahCuti,
        cuti_terpakai: quota.cutiTerpakai,
        sisa_cuti: sisa_cuti,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const getRiwayatCuti = async (req, res) => {
  try {
    const { nik } = req.params;

    const results = await prisma.leaveRequest.findMany({
      where: { nik: nik },
      orderBy: { createdAt: 'desc' },
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

    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const requestNo = `LV-${startYear}-${randomDigits}`;

    const newRequest = await prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.create({
        data: {
          requestNo,
          nik,
          quotaId: quota.id,
          tanggalMulai: start,
          tanggalAkhir: end,
          jumlahHari,
          alasan,
          status: 'PENDING_ATASAN',
        },
      });

      return result;
    });

    return res.json({ 
      success: true, 
      message: 'Pengajuan cuti berhasil disubmit', 
      data: {
        id: newRequest.id,
        request_no: newRequest.requestNo,
        nik: newRequest.nik,
        tanggal_mulai: newRequest.tanggalMulai,
        tanggal_akhir: newRequest.tanggalAkhir,
        jumlah_hari: newRequest.jumlahHari,
        alasan: newRequest.alasan,
        status: newRequest.status,
        created_at: newRequest.createdAt
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const approveCuti = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, approvedBy, catatan, role } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action tidak valid' });
    }
    if (!['ATASAN', 'HR'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid' });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) },
      include: { quota: true },
    });

    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Pengajuan cuti tidak ditemukan' });
    }

    if (role === 'ATASAN' && leaveRequest.status !== 'PENDING_ATASAN') {
      return res.status(400).json({ success: false, message: 'Aksi tidak valid untuk status pengajuan ini' });
    }
    if (role === 'HR' && leaveRequest.status !== 'PENDING_HR') {
      return res.status(400).json({ success: false, message: 'Aksi tidak valid untuk status pengajuan ini' });
    }

    let statusBaru = '';
    let updateData = {};

    if (role === 'ATASAN') {
      statusBaru = action === 'APPROVE' ? 'PENDING_HR' : 'REJECTED';
      updateData = {
        status: statusBaru,
        approvedByAtasan: approvedBy,
        approvedAtAtasan: new Date(),
        catatanAtasan: catatan,
      };
    } else if (role === 'HR') {
      statusBaru = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      updateData = {
        status: statusBaru,
        approvedByHr: approvedBy,
        approvedAtHr: new Date(),
        catatanHr: catatan,
      };
    }

    if (statusBaru === 'APPROVED') {
      const [updatedReq] = await prisma.$transaction([
        prisma.leaveRequest.update({
          where: { id: parseInt(id) },
          data: updateData,
        }),
        prisma.leaveQuota.update({
          where: { id: leaveRequest.quotaId },
          data: {
            cutiTerpakai: {
              increment: leaveRequest.jumlahHari,
            },
          },
        })
      ]);

      return res.json({ success: true, message: 'Status berhasil diupdate', data: updatedReq });
    } else {
      const updated = await prisma.leaveRequest.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      return res.json({ success: true, message: 'Status berhasil diupdate', data: updated });
    }
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

    if (leaveRequest.status !== 'PENDING_ATASAN') {
      return res.status(400).json({ success: false, message: 'Pengajuan tidak dapat dibatalkan karena sudah diproses' });
    }

    await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED' },
    });

    return res.json({ success: true, message: 'Pengajuan cuti berhasil dibatalkan' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server', error: error.message });
  }
};

const hitungHari = async (req, res) => {
  try {
    const { mulai, akhir } = req.query;
    if (!mulai || !akhir) {
      return res.status(400).json({ success: false, message: 'Parameter mulai dan akhir wajib diisi' });
    }
    const result = await hitungHariCuti(new Date(mulai), new Date(akhir), prisma);
    return res.json({ success: true, jumlah_hari: result });
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
};
