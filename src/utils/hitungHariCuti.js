/**
 * Menghitung jumlah hari kerja dari daftar tanggal yang dipilih.
 * @param {Array} dates - Daftar tanggal dalam format string atau Date object.
 * @param {Object} prisma - Instance PrismaClient.
 */
const hitungHariCuti = async (dates, prisma) => {
  if (!Array.isArray(dates) || dates.length === 0) return 0;

  // Normalisasi dates ke string format YYYY-MM-DD
  const uniqueDates = [...new Set(dates.map(d => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }))];

  // Ambil tahun-tahun yang terlibat
  const years = [...new Set(uniqueDates.map(d => parseInt(d.split('-')[0])))];

  const holidaysDb = await prisma.nationalHoliday.findMany({
    where: { tahun: { in: years } }
  });

  const holidayDates = new Set(
    holidaysDb.map(h => {
      const d = new Date(h.tanggal);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  );

  let totalHariKerja = 0;
  uniqueDates.forEach(dateStr => {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0 = Minggu, 6 = Sabtu

    // Jika bukan Sabtu/Minggu dan bukan hari libur nasional
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      totalHariKerja++;
    }
  });

  return totalHariKerja;
};

module.exports = { hitungHariCuti };
