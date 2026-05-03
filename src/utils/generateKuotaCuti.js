const generateKuotaTahunan = async (tahun, prisma) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { statusKaryawan: 'ACTIVE' }
    });

    let dibuat = 0;
    let dilewati = 0;

    for (const emp of employees) {
      // 1. Cek tahun bergabung (jointDate)
      const jointYear = emp.jointDate.getFullYear();
      
      // Jika karyawan bergabung setelah tahun kuota yang sedang di-generate, lewati
      if (jointYear > tahun) {
        dilewati++;
        continue;
      }

      // 2. Hitung jumlah cuti (Prorata jika bergabung di tahun yang sama)
      let jumlahCuti = 12;
      if (jointYear === tahun) {
        // getMonth() mengembalikan 0 (Jan) sampai 11 (Des)
        // Jika masuk Januari (0) -> 12 - 0 = 12 hari
        // Jika masuk Juli (6) -> 12 - 6 = 6 hari
        const jointMonth = emp.jointDate.getMonth();
        jumlahCuti = 12 - jointMonth;
      }

      const existingQuota = await prisma.leaveQuota.findUnique({
        where: {
          nik_tahun: {
            nik: emp.nik,
            tahun: tahun
          }
        }
      });

      if (existingQuota) {
        dilewati++;
        continue;
      }

      await prisma.leaveQuota.create({
        data: {
          nik: emp.nik,
          tahun: tahun,
          jumlahCuti: jumlahCuti,
          cutiTerpakai: 0
        }
      });
      dibuat++;
    }

    return {
      tahun,
      total: employees.length,
      dibuat,
      dilewati
    };
  } catch (error) {
    console.error('[generateKuotaTahunan] Error:', error);
    throw error;
  }
};

module.exports = { generateKuotaTahunan };
