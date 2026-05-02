const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logAudit } = require('../utils/auditTrail');

const getAllAgents = async (req, res) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAgent = async (req, res) => {
  try {
    const { code, name } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama Agent wajib diisi' });
    }

    // Check existing
    const existing = await prisma.agent.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Kode Agent sudah terdaftar' });
    }

    const newAgent = await prisma.agent.create({
      data: { code, name }
    });

    await logAudit(prisma, {
      nik: null,
      tableName: 'agents',
      action: 'CREATE',
      oldData: null,
      newData: newAgent,
      changedBy: 'HR_ADMIN'
    });

    res.status(201).json({ success: true, message: 'Agent berhasil ditambahkan', data: newAgent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama Agent wajib diisi' });
    }

    const oldData = await prisma.agent.findUnique({ where: { id: parseInt(id) } });
    if (!oldData) return res.status(404).json({ success: false, message: 'Agent tidak ditemukan' });

    const updated = await prisma.agent.update({
      where: { id: parseInt(id) },
      data: { name }
    });

    await logAudit(prisma, {
      nik: null,
      tableName: 'agents',
      action: 'UPDATE',
      oldData,
      newData: updated,
      changedBy: 'HR_ADMIN'
    });

    res.json({ success: true, message: 'Agent berhasil diperbarui', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllAgents,
  createAgent,
  updateAgent
};
