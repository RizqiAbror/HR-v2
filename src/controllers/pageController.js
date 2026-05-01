const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const showDashboard = (req, res) => {
  try {
    res.render('dashboard', { pageTitle: 'Dashboard' });
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
        tanggalPengajuan: {
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

    const historyRequests = await prisma.leaveRequest.findMany({
      where: {
        status: {
          in: ['APPROVED', 'REJECTED', 'CANCELLED']
        }
      },
      include: {
        employee: { select: { nik: true, namaKaryawan: true } },
        quota: { select: { tahun: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });

    const stats = { totalPending, totalApproved, totalRejected };

    // STATISTIK DASHBOARD (TUGAS 3)
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // 1. Total karyawan cuti hari ini (Cek di tabel detail tanggal)
    const onLeaveToday = await prisma.leaveRequestDetail.count({
      where: {
        tanggal: today,
        leaveRequest: { status: 'APPROVED' }
      }
    });

    // 2. Top Agents bulan ini (group by agent via employee)
    const topAgents = await prisma.$queryRaw`
      SELECT a.name as agentName, COUNT(DISTINCT lr.id) as totalCuti
      FROM leave_requests lr
      JOIN leave_request_details lrd ON lr.id = lrd.leaveRequestId
      JOIN employees e ON lr.nik = e.nik
      JOIN agents a ON e.agentId = a.id
      WHERE lr.status = 'APPROVED' 
      AND MONTH(lrd.tanggal) = MONTH(CURRENT_DATE())
      AND YEAR(lrd.tanggal) = YEAR(CURRENT_DATE())
      GROUP BY a.name
      ORDER BY totalCuti DESC
      LIMIT 5
    `;

    const dashboardStats = { onLeaveToday, topAgents };

    const agents = await prisma.agent.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true }
    });

    res.render('cuti/index', { pageTitle: 'Manajemen Cuti', requests, historyRequests, stats, agents, dashboardStats });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showCutiForm = async (req, res) => {
  try {
    // Ambil semua karyawan yang aktif untuk dipilih oleh Admin
    const employees = await prisma.employee.findMany({
      where: { statusKaryawan: 'ACTIVE' },
      select: { nik: true, namaKaryawan: true, agent: { select: { name: true } } },
      orderBy: { namaKaryawan: 'asc' }
    });

    res.render('cuti/form', { pageTitle: 'Input Cuti Karyawan', employees });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

const showAuditLogs = async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    res.render('audit/index', { pageTitle: '🛡️ Audit Trail', logs });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

module.exports = {
  showDashboard,
  showCutiIndex,
  showCutiForm,
  showAuditLogs
};
