const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Hapus data lama (urutan dari bawah ke atas)
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveQuota.deleteMany();
  await prisma.nationalHoliday.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.agent.deleteMany();

  console.log('Old data deleted.');

  // 2. Insert 2 agents
  const agentKtp = await prisma.agent.create({
    data: { name: 'PT Kalapa Teknologi Putera', code: 'KTP', status: 'ACTIVE' },
  });
  const agentPdg = await prisma.agent.create({
    data: { name: 'PDG Project', code: 'PDG', status: 'ACTIVE' },
  });

  console.log('Agents created.');

  // 3. Insert 3 employees
  const emp1 = await prisma.employee.create({
    data: {
      nik: 'KTP_25_01_001',
      agentId: agentKtp.id,
      namaKaryawan: 'Budi Santoso',
      jabatan: 'Manager',
      statusTk: 'PKM',
      level: 'Manager',
      emailKantor: 'budi@kalapa.com',
      jointDate: new Date('2023-01-01'),
      gajiPokok: 15000000,
    },
  });

  const emp2 = await prisma.employee.create({
    data: {
      nik: 'KTP_25_01_002',
      agentId: agentKtp.id,
      namaKaryawan: 'Siti Rahayu',
      jabatan: 'Staff Admin',
      statusTk: 'PKWT',
      level: 'Staff',
      emailKantor: 'siti@kalapa.com',
      jointDate: new Date('2024-03-01'),
      gajiPokok: 6000000,
    },
  });

  const emp3 = await prisma.employee.create({
    data: {
      nik: 'PDG_25_01_001',
      agentId: agentPdg.id,
      namaKaryawan: 'Andi Pratama',
      jabatan: 'Supervisor',
      statusTk: 'PKWT',
      level: 'Supervisor',
      emailKantor: 'andi@pdg.com',
      jointDate: new Date('2024-06-01'),
      gajiPokok: 9000000,
    },
  });

  console.log('Employees created.');

  // Insert Leave Quotas for 2025 & 2026
  await prisma.leaveQuota.createMany({
    data: [
      { nik: emp1.nik, tahun: 2025, jumlahCuti: 12, cutiTerpakai: 0 },
      { nik: emp2.nik, tahun: 2025, jumlahCuti: 12, cutiTerpakai: 0 },
      { nik: emp3.nik, tahun: 2025, jumlahCuti: 12, cutiTerpakai: 0 },
      // Tambahan 2026
      { nik: emp1.nik, tahun: 2026, jumlahCuti: 12, cutiTerpakai: 0 },
      { nik: emp2.nik, tahun: 2026, jumlahCuti: 12, cutiTerpakai: 0 },
      { nik: emp3.nik, tahun: 2026, jumlahCuti: 12, cutiTerpakai: 0 },
    ],
  });

  console.log('Leave quotas created.');

  // 4. Insert national_holidays untuk tahun 2025 & 2026
  await prisma.nationalHoliday.createMany({
    data: [
      // 2025
      { tanggal: new Date('2025-01-01'), keterangan: 'Tahun Baru 2025', tahun: 2025 },
      { tanggal: new Date('2025-08-17'), keterangan: 'Kemerdekaan RI 2025', tahun: 2025 },
      { tanggal: new Date('2025-12-25'), keterangan: 'Natal 2025', tahun: 2025 },
      // 2026
      { tanggal: new Date('2026-01-01'), keterangan: 'Tahun Baru 2026', tahun: 2026 },
      { tanggal: new Date('2026-05-01'), keterangan: 'Hari Buruh 2026', tahun: 2026 },
      { tanggal: new Date('2026-08-17'), keterangan: 'Kemerdekaan RI 2026', tahun: 2026 },
      { tanggal: new Date('2026-12-25'), keterangan: 'Natal 2026', tahun: 2026 },
    ],
  });

  console.log('National holidays created.');
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
