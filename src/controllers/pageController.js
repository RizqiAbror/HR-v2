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
    const { nik } = req.query;
    
    if (!nik) {
      return res.redirect('/cuti');
    }

    const employee = await prisma.employee.findUnique({
      where: { nik: nik },
      select: { nik: true, namaKaryawan: true }
    });

    if (!employee) {
      return res.redirect('/cuti');
    }

    const currentYear = new Date().getFullYear();
    
    const quotaDb = await prisma.leaveQuota.findUnique({
      where: {
        nik_tahun: {
          nik: nik,
          tahun: currentYear
        }
      }
    });

    let quota = null;
    if (quotaDb) {
      quota = {
        jumlahCuti: quotaDb.jumlahCuti,
        cutiTerpakai: quotaDb.cutiTerpakai,
        sisa_cuti: quotaDb.jumlahCuti - quotaDb.cutiTerpakai
      };
    } else {
      quota = {
        jumlahCuti: 0,
        cutiTerpakai: 0,
        sisa_cuti: 0
      };
    }

    res.render('cuti/form', { pageTitle: 'Ajukan Cuti', employee, quota });
  } catch (error) {
    res.status(500).send('Server error: ' + error.message);
  }
};

module.exports = {
  showDashboard,
  showCutiIndex,
  showCutiForm
};
