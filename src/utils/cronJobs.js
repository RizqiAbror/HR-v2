const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { generateKuotaTahunan } = require('./generateKuotaCuti');

const prisma = new PrismaClient();

const initCronJobs = () => {
  // Jadwalkan cron: Menit Jam Tanggal Bulan Hari
  // '0 0 1 1 *' = Jam 00:00, Tanggal 1, Bulan Januari
  cron.schedule('0 0 1 1 *', async () => {
    console.log('[CRON] Menjalankan generate kuota cuti tahunan...');
    try {
      const tahun = new Date().getFullYear();
      const result = await generateKuotaTahunan(tahun, prisma);
      console.log('[CRON] Selesai:', result);
    } catch (error) {
      console.error('[CRON] Error:', error);
    }
  });
};

module.exports = { initCronJobs };
