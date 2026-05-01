const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { processCutiBersama } = require('../services/leaveService');
const prisma = new PrismaClient();

/**
 * Sinkronisasi Libur Nasional dari CSV dan terapkan Cuti Bersama otomatis.
 */
const syncHolidaysFromCSV = async () => {
  const filePath = path.join(__dirname, '../../data master/Master HR Project  v2Local - Libur Nasional.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error('File Libur Nasional tidak ditemukan.');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').slice(1); // Skip header

  const agents = await prisma.agent.findMany({ where: { status: 'ACTIVE' } });

  for (const line of lines) {
    if (!line.trim()) continue;
    const [tahun, bulan, tanggal, keterangan, jumlahHari] = line.split(',');

    if (keterangan && keterangan.toLowerCase().includes('cuti bersama')) {
      const dateStr = `${tahun}-${bulan.padStart(2, '0')}-${tanggal.padStart(2, '0')}`;
      const dateObj = new Date(dateStr);

      console.log(`Memproses Cuti Bersama: ${keterangan} (${dateStr})`);

      for (const agent of agents) {
        try {
          await processCutiBersama(dateObj, keterangan, agent.id, 'SYSTEM_SYNC');
          console.log(`- Berhasil diterapkan untuk Agent: ${agent.name}`);
        } catch (err) {
          console.error(`- Gagal untuk Agent ${agent.name}: ${err.message}`);
        }
      }
    } else {
      // Input sebagai libur nasional biasa
      const dateStr = `${tahun}-${bulan.padStart(2, '0')}-${tanggal.padStart(2, '0')}`;
      const dateObj = new Date(dateStr);
      
      await prisma.nationalHoliday.upsert({
        where: { tanggal: dateObj },
        update: { keterangan, isCutiBersama: false, tahun: parseInt(tahun) },
        create: { tanggal: dateObj, keterangan, isCutiBersama: false, tahun: parseInt(tahun) }
      });
    }
  }
};

module.exports = { syncHolidaysFromCSV };
