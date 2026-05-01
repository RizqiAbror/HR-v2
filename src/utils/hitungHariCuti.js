const hitungHariCuti = async (tanggalMulai, tanggalAkhir, prisma) => {
  // Pastikan tanggal diset ke tengah malam untuk akurasi perhitungan
  const start = new Date(tanggalMulai);
  const end = new Date(tanggalAkhir);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start > end) return 0;

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  // Query hari libur nasional di rentang tahun yang relevan
  const holidaysDb = await prisma.nationalHoliday.findMany({
    where: {
      tahun: {
        in: startYear === endYear ? [startYear] : [startYear, endYear],
      },
    },
  });

  // Buat Set berisi tanggal hari libur (format YYYY-MM-DD) agar pencarian O(1)
  const holidayDates = new Set(
    holidaysDb.map((h) => {
      const d = new Date(h.tanggal);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  );

  let totalHariKerja = 0;
  let currentDate = new Date(start);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay(); // 0 = Minggu, 6 = Sabtu
    const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

    // Jika bukan hari libur akhir pekan (Sabtu/Minggu) dan bukan hari libur nasional
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateString)) {
      totalHariKerja++;
    }

    // Lanjut ke hari berikutnya
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalHariKerja;
};

module.exports = { hitungHariCuti };
