-- CreateTable
CREATE TABLE `agents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `agents_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nik` VARCHAR(50) NOT NULL,
    `agentId` INTEGER NOT NULL,
    `namaKaryawan` VARCHAR(200) NOT NULL,
    `nomorKtp` VARCHAR(20) NULL,
    `npwp` VARCHAR(25) NULL,
    `statusPerkawinan` VARCHAR(20) NULL,
    `jabatan` VARCHAR(100) NOT NULL,
    `statusTk` VARCHAR(10) NOT NULL,
    `level` VARCHAR(30) NOT NULL,
    `divisi` VARCHAR(100) NULL,
    `jointDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `emailKantor` VARCHAR(200) NOT NULL,
    `emailPribadi` VARCHAR(200) NULL,
    `namaAtasan` VARCHAR(200) NULL,
    `emailAtasan` VARCHAR(200) NULL,
    `gajiPokok` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `allowance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `namaBank` VARCHAR(100) NULL,
    `noRekening` VARCHAR(50) NULL,
    `namaRekening` VARCHAR(200) NULL,
    `pkwtAttachmentUrl` VARCHAR(500) NULL,
    `statusKaryawan` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_nik_key`(`nik`),
    UNIQUE INDEX `employees_emailKantor_key`(`emailKantor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_quotas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nik` VARCHAR(50) NOT NULL,
    `tahun` INTEGER NOT NULL,
    `jumlahCuti` INTEGER NOT NULL DEFAULT 12,
    `cutiTerpakai` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_quotas_nik_tahun_key`(`nik`, `tahun`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestNo` VARCHAR(50) NOT NULL,
    `nik` VARCHAR(50) NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `tanggalPengajuan` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tanggalMulai` DATETIME(3) NOT NULL,
    `tanggalAkhir` DATETIME(3) NOT NULL,
    `jumlahHari` INTEGER NOT NULL,
    `alasan` TEXT NOT NULL,
    `attachmentUrl` VARCHAR(500) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING_ATASAN',
    `approvedByAtasan` VARCHAR(100) NULL,
    `approvedAtAtasan` DATETIME(3) NULL,
    `catatanAtasan` TEXT NULL,
    `approvedByHr` VARCHAR(100) NULL,
    `approvedAtHr` DATETIME(3) NULL,
    `catatanHr` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_requests_requestNo_key`(`requestNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `national_holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal` DATETIME(3) NOT NULL,
    `keterangan` VARCHAR(200) NOT NULL,
    `tahun` INTEGER NOT NULL,

    UNIQUE INDEX `national_holidays_tanggal_key`(`tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `agents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_quotas` ADD CONSTRAINT `leave_quotas_nik_fkey` FOREIGN KEY (`nik`) REFERENCES `employees`(`nik`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_nik_fkey` FOREIGN KEY (`nik`) REFERENCES `employees`(`nik`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `leave_quotas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
