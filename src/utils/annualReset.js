const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Men-generate kuota cuti tahunan (12 hari) untuk semua karyawan aktif.
 * Digunakan saat pergantian tahun.
 */
const generateAnnualQuota = async (tahunBaru) => {
  const employees = await prisma.employee.findMany({
    where: { 
      // Ambil yang statusnya masih aktif atau tidak null
      statusKaryawan: 'ACTIVE' 
    }
  });

  let createdCount = 0;

  // Gunakan loop untuk upsert satu-satu (menjamin integritas data)
  for (const emp of employees) {
    // 1. FILTER RESIGN DATE (End Date)
    // Jika karyawan memiliki endDate dan sudah lewat dari awal tahun baru, lewati (jangan beri kuota)
    const awalTahunBaru = new Date(`${tahunBaru}-01-01`);
    if (emp.endDate && new Date(emp.endDate) < awalTahunBaru) {
      continue; 
    }

    // 2. LOGIKA PRORATE (Berdasarkan Join Date)
    let jatahCuti = 12; // Default full 1 tahun
    const joinYear = emp.jointDate.getFullYear();

    if (joinYear === parseInt(tahunBaru)) {
      // Jika masuk di tahun yang sama dengan tahun generate, hitung prorate (1 bulan = 1 hari)
      // getMonth() dimulai dari 0 (Januari = 0). Jika masuk Januari, dapat 12-0 = 12 hari.
      // Jika masuk Agustus (Bulan ke-7, index 7), dapat 12-7 = 5 hari.
      jatahCuti = 12 - emp.jointDate.getMonth();
    } else if (joinYear > parseInt(tahunBaru)) {
      // Jika join date di masa depan (tahun depan), tidak dapat jatah tahun ini
      jatahCuti = 0;
    }

    if (jatahCuti <= 0) continue;

    await prisma.leaveQuota.upsert({
      where: {
        nik_tahun: {
          nik: emp.nik,
          tahun: parseInt(tahunBaru)
        }
      },
      update: {}, // Jangan ubah apapun jika sudah ada (mencegah reset saldo yang mungkin sudah terpakai)
      create: {
        nik: emp.nik,
        tahun: parseInt(tahunBaru),
        jumlahCuti: jatahCuti,
        cutiTerpakai: 0
      }
    });
    createdCount++;
  }

  return createdCount;
};

module.exports = { generateAnnualQuota };
