const generateKuotaTahunan = async (tahun, prisma) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { statusKaryawan: 'ACTIVE' }
    });

    let dibuat = 0;
    let dilewati = 0;

    for (const emp of employees) {
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
          jumlahCuti: 12,
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
