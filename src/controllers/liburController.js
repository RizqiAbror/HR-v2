const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../utils/auditTrail');

const getAll = async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const holidays = await prisma.nationalHoliday.findMany({
      where: { tahun: tahun },
      orderBy: { tanggal: 'asc' }
    });
    res.json({ success: true, data: holidays });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const { tanggal, keterangan } = req.body;
    
    if (!tanggal || !keterangan) {
      return res.status(400).json({ success: false, message: 'Tanggal dan Keterangan wajib diisi' });
    }

    const tglObj = new Date(tanggal);
    const tahun = tglObj.getFullYear();

    // Cek duplikat
    const existing = await prisma.nationalHoliday.findUnique({
      where: { tanggal: tglObj }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Tanggal libur tersebut sudah terdaftar' });
    }

    const newHoliday = await prisma.nationalHoliday.create({
      data: { tanggal: tglObj, keterangan, tahun }
    });

    // Log Audit
    await logAudit({
      nik: null,
      tableName: 'national_holidays',
      action: 'CREATE',
      oldData: null,
      newData: newHoliday,
      changedBy: req.session.user ? req.session.user.nik : 'SYSTEM'
    });

    res.status(201).json({ success: true, data: newHoliday });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const existing = await prisma.nationalHoliday.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Data libur tidak ditemukan' });
    }

    await prisma.nationalHoliday.delete({ where: { id } });

    // Log Audit
    await logAudit({
      nik: null,
      tableName: 'national_holidays',
      action: 'DELETE',
      oldData: existing,
      newData: null,
      changedBy: req.session.user ? req.session.user.nik : 'SYSTEM'
    });

    res.json({ success: true, message: 'Berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAll,
  create,
  remove
};
