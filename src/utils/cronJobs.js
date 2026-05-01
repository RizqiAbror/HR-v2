const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Jalankan setiap 1 Januari jam 00:00 (0 0 1 1 *)
cron.schedule('0 0 1 1 *', async () => {
  console.log('Running annual leave quota generation...');
  const currentYear = new Date().getFullYear();

  try {
    // Ambil semua karyawan aktif
    const employees = await prisma.employee.findMany({
      where: { statusKaryawan: 'ACTIVE' }
    });

    let generatedCount = 0;

    for (const emp of employees) {
      // Cek apakah sudah ada kuota tahun ini untuk menghindari duplikasi
      const existing = await prisma.leaveQuota.findUnique({
        where: {
          nik_tahun: { nik: emp.nik, tahun: currentYear }
        }
      });

      if (!existing) {
        await prisma.leaveQuota.create({
          data: {
            nik: emp.nik,
            tahun: currentYear,
            jumlahCuti: 12,
            cutiTerpakai: 0
          }
        });
        
        // Catat di tabel audit
        await prisma.auditLog.create({
          data: {
            tableName: 'leave_quotas',
            action: 'GENERATE_QUOTA',
            description: `Generate kuota tahunan (12 hari) untuk NIK: ${emp.nik} tahun ${currentYear}`,
            executedBy: 'SYSTEM'
          }
        });
        generatedCount++;
      }
    }
    console.log(`Annual leave quota generation completed. ${generatedCount} quotas generated.`);
  } catch (error) {
    console.error('Error generating annual leave quotas:', error);
  }
});
