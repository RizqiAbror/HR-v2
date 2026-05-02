const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const showDashboard = async (req, res) => {
  try {
    const totalEmployee = await prisma.employee.count();
    const pendingLeave = await prisma.leaveRequest.count({
      where: { status: { in: ['PENDING_ATASAN', 'PENDING_HR'] } }
    });
    const totalAgent = await prisma.agent.count();

    res.render('dashboard', { 
      pageTitle: 'Dashboard',
      stats: { totalEmployee, pendingLeave, totalAgent }
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showCutiIndex = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const requests = await prisma.leaveRequest.findMany({
      where: {
        status: {
          in: ['PENDING_ATASAN', 'PENDING_HR']
        }
      },
      include: {
        employee: {
          select: { nik: true, namaKaryawan: true }
        },
        quota: {
          select: { tahun: true }
        }
      },
      orderBy: {
        tanggalPengajuan: 'desc'
      }
    });

    const statusCounts = await prisma.leaveRequest.groupBy({
      by: ['status'],
      where: {
        tanggalMulai: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`)
        }
      },
      _count: {
        id: true
      }
    });

    let totalPending = 0;
    let totalApproved = 0;
    let totalRejected = 0;

    statusCounts.forEach(stat => {
      if (stat.status === 'PENDING_ATASAN' || stat.status === 'PENDING_HR') {
        totalPending += stat._count.id;
      } else if (stat.status === 'APPROVED') {
        totalApproved += stat._count.id;
      } else if (stat.status === 'REJECTED') {
        totalRejected += stat._count.id;
      }
    });

    const stats = { totalPending, totalApproved, totalRejected };

    res.render('cuti/index', { pageTitle: 'Manajemen Cuti', requests, stats });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showCutiForm = async (req, res) => {
  try {
    const nik = req.query.nik;

    const employees = await prisma.employee.findMany({
      orderBy: { namaKaryawan: 'asc' },
      include: { agent: true }
    });

    let selectedEmployee = null;
    let quota = null;
    const tahun = new Date().getFullYear();

    if (nik) {
      selectedEmployee = employees.find(e => e.nik === nik);
      if (selectedEmployee) {
        const quotaDb = await prisma.leaveQuota.findUnique({
          where: {
            nik_tahun: {
              nik: nik,
              tahun: tahun
            }
          }
        });
        if (quotaDb) {
          quota = {
            jumlah_cuti: quotaDb.jumlahCuti,
            cuti_terpakai: quotaDb.cutiTerpakai,
            sisa_cuti: quotaDb.jumlahCuti - quotaDb.cutiTerpakai
          };
        }
      }
    }

    res.render('cuti/form', { 
      pageTitle: 'Input Pengajuan Cuti', 
      employees, 
      selectedEmployee, 
      quota, 
      tahun 
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showCutiDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).send('ID tidak valid');
    }

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
        quota: {
          select: { tahun: true, jumlahCuti: true }
        }
      }
    });

    if (!request) {
      return res.status(404).send('Pengajuan tidak ditemukan');
    }

    res.render('cuti/detail', { pageTitle: 'Detail Pengajuan', request });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showCutiRekap = async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const agentCode = req.query.agent || null;

    const whereClause = {
      tahun: tahun
    };

    if (agentCode) {
      whereClause.employee = {
        agent: {
          code: agentCode
        }
      };
    }

    const quotas = await prisma.leaveQuota.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            agent: true
          }
        }
      },
      orderBy: {
        employee: {
          namaKaryawan: 'asc'
        }
      }
    });

    const agents = await prisma.agent.findMany({
      orderBy: { name: 'asc' }
    });

    const formattedQuotas = quotas.map(q => ({
      ...q,
      sisa_cuti: q.jumlahCuti - q.cutiTerpakai
    }));

    res.render('cuti/rekap', { 
      pageTitle: 'Rekap Kuota Cuti', 
      quotas: formattedQuotas, 
      agents, 
      tahun, 
      agentCode 
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showRiwayatCuti = async (req, res) => {
  try {
    const nik = req.params.nik;

    const employee = await prisma.employee.findUnique({
      where: { nik: nik },
      include: { agent: true }
    });

    if (!employee) {
      return res.status(404).render('error', { 
        pageTitle: 'Tidak Ditemukan', 
        message: 'Karyawan tidak ditemukan' 
      });
    }

    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

    const requests = await prisma.leaveRequest.findMany({
      where: { nik: nik },
      include: { quota: { select: { tahun: true } } },
      orderBy: { tanggalPengajuan: 'desc' }
    });

    const quota = await prisma.leaveQuota.findUnique({
      where: {
        nik_tahun: {
          nik: nik,
          tahun: tahun
        }
      }
    });

    const sisa_cuti = quota ? (quota.jumlahCuti - quota.cutiTerpakai) : 0;

    res.render('cuti/riwayat', { 
      pageTitle: 'Riwayat Cuti', 
      employee, 
      requests, 
      quota, 
      sisa_cuti, 
      tahun 
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

// ── EMPLOYEE PAGES ──

const showEmployeeIndex = async (req, res) => {
  try {
    const { agent, search } = req.query;
    const where = {};
    if (agent) where.agent = { code: agent };
    if (search) {
      where.OR = [
        { namaKaryawan: { contains: search } },
        { nik: { contains: search } }
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { agent: true },
      orderBy: { namaKaryawan: 'asc' }
    });

    const agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } });

    res.render('employee/index', { 
      pageTitle: 'Data Karyawan', 
      employees, 
      agents, 
      agentCode: agent || null, 
      search: search || null 
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showEmployeeDetail = async (req, res) => {
  try {
    const { nik } = req.params;
    const employee = await prisma.employee.findUnique({
      where: { nik },
      include: { 
        agent: true,
        leaveQuotas: { orderBy: { tahun: 'desc' } }
      }
    });

    if (!employee) return res.status(404).render('error', { pageTitle: 'Not Found', message: 'Karyawan tidak ditemukan' });

    res.render('employee/detail', { 
      pageTitle: 'Detail Karyawan', 
      employee, 
      tahunIni: new Date().getFullYear() 
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showEmployeeForm = async (req, res) => {
  try {
    const { nik } = req.params;
    const mode = nik ? 'edit' : 'create';
    
    let employee = null;
    if (nik) {
      employee = await prisma.employee.findUnique({ where: { nik } });
    }

    const agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } });

    res.render('employee/form', { 
      pageTitle: mode === 'edit' ? 'Edit Karyawan' : 'Tambah Karyawan', 
      employee, 
      agents, 
      mode 
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

// ── AGENT PAGES ──
const showAgentIndex = async (req, res) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { employees: true }
        }
      }
    });

    res.render('agent/index', { 
      pageTitle: 'Data Agent (Project)', 
      agents 
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

// ── LIBUR NASIONAL ──
const showLiburNasional = async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const holidays = await prisma.nationalHoliday.findMany({
      where: { tahun: tahun },
      orderBy: { tanggal: 'asc' }
    });

    res.render('libur/index', { pageTitle: 'Libur Nasional', holidays, tahun });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

// ── AUDIT PAGES ──
const showAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const nik = req.query.nik || null;
    const tableName = req.query.table || null;
    const action = req.query.action || null;

    const where = {};
    if (nik) where.nik = { contains: nik };
    if (tableName) where.tableName = tableName;
    if (action) where.action = action;

    const total = await prisma.auditLog.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    res.render('audit/index', { 
      pageTitle: 'Audit Trail', 
      logs,
      page,
      totalPages,
      nik,
      tableName,
      action
    });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

module.exports = {
  showDashboard,
  showCutiIndex,
  showCutiForm,
  showCutiDetail,
  showCutiRekap,
  showRiwayatCuti,
  showEmployeeIndex,
  showEmployeeDetail,
  showEmployeeForm,
  showAgentIndex,
  showLiburNasional,
  showAuditLogs
};
