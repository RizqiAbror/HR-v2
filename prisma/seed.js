const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Hapus data lama
  await prisma.user.deleteMany();
  await prisma.leaveRequestDetail.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveQuota.deleteMany();
  await prisma.nationalHoliday.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.agent.deleteMany();

  console.log('Old data deleted.');

  // 2. Insert Agents
  const agentKtp = await prisma.agent.create({
    data: { name: 'PT Kalapa Teknologi Putera', code: 'KTP', status: 'ACTIVE' },
  });
  const agentPdg = await prisma.agent.create({
    data: { name: 'PDG Project', code: 'PDG', status: 'ACTIVE' },
  });

  // 3. Insert Employees
  const emp1 = await prisma.employee.create({
    data: {
      nik: 'KTP_25_01_001',
      agentId: agentKtp.id,
      namaKaryawan: 'Budi Santoso',
      jabatan: 'Manager',
      statusTk: 'PKM',
      divisi: 'Management',
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
      divisi: 'HR',
      emailKantor: 'siti@kalapa.com',
      jointDate: new Date('2024-03-01'),
      gajiPokok: 6000000,
    },
  });

  // 4. Create Users
  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  
  await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      role: 'SUPERADMIN',
      nik: emp1.nik
    }
  });

  await prisma.user.create({
    data: {
      username: 'siti',
      password: hashedPassword,
      role: 'HR_ADMIN',
      nik: emp2.nik
    }
  });

  console.log('Users created (Pass: adminpassword).');

  // 5. Quotas
  await prisma.leaveQuota.createMany({
    data: [
      { nik: emp1.nik, tahun: 2025, jumlahCuti: 12, cutiTerpakai: 0 },
      { nik: emp2.nik, tahun: 2025, jumlahCuti: 12, cutiTerpakai: 0 },
      // Tambahan 2026
      { nik: emp1.nik, tahun: 2026, jumlahCuti: 12, cutiTerpakai: 0 },
      { nik: emp2.nik, tahun: 2026, jumlahCuti: 12, cutiTerpakai: 0 },
    ],
  });

  // 6. Holidays
  await prisma.nationalHoliday.createMany({
    data: [
      { tanggal: new Date('2025-01-01'), keterangan: 'Tahun Baru 2025', tahun: 2025 },
      { tanggal: new Date('2025-08-17'), keterangan: 'Kemerdekaan RI 2025', tahun: 2025 },
      { tanggal: new Date('2025-12-25'), keterangan: 'Natal 2025', tahun: 2025 },
      { tanggal: new Date('2026-01-01'), keterangan: 'Tahun Baru 2026', tahun: 2026 },
      { tanggal: new Date('2026-08-17'), keterangan: 'Kemerdekaan RI 2026', tahun: 2026 },
      { tanggal: new Date('2026-12-25'), keterangan: 'Natal 2026', tahun: 2026 },
    ],
  });

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
