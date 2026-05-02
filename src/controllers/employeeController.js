const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { logAudit } = require('../utils/auditTrail');

const prisma = new PrismaClient();

const getAllEmployees = async (req, res) => {
  try {
    const { agentCode, status, search } = req.query;
    
    const where = {};
    if (agentCode) where.agent = { code: agentCode };
    if (status) where.statusKaryawan = status;
    if (search) {
      where.OR = [
        { namaKaryawan: { contains: search } },
        { nik: { contains: search } }
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { agent: true },
      orderBy: { namaKaryawan: 'asc' }
    });

    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getEmployeeByNik = async (req, res) => {
  try {
    const { nik } = req.params;
    const employee = await prisma.employee.findUnique({
      where: { nik },
      include: { 
        agent: true,
        leaveQuotas: { orderBy: { tahun: 'desc' } }
      }
    });

    if (!employee) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createEmployee = async (req, res) => {
  try {
    const data = req.body;
    
    // Cek duplikat
    const existingNik = await prisma.employee.findUnique({ where: { nik: data.nik } });
    if (existingNik) return res.status(400).json({ success: false, message: 'NIK sudah terdaftar' });
    
    const existingEmail = await prisma.employee.findUnique({ where: { emailKantor: data.emailKantor } });
    if (existingEmail) return res.status(400).json({ success: false, message: 'Email kantor sudah terdaftar' });

    const newEmployee = await prisma.employee.create({
      data: {
        ...data,
        agentId: parseInt(data.agentId),
        gajiPokok: parseFloat(data.gajiPokok || 0),
        jointDate: new Date(data.jointDate),
        endDate: data.endDate ? new Date(data.endDate) : null
      }
    });

    // Auto-insert leave_quotas tahun berjalan
    const tahun = new Date().getFullYear();
    await prisma.leaveQuota.create({
      data: {
        nik: newEmployee.nik,
        tahun: tahun,
        jumlahCuti: 12,
        cutiTerpakai: 0
      }
    });

    await logAudit(prisma, {
      nik: newEmployee.nik,
      tableName: 'employees',
      action: 'CREATE',
      oldData: null,
      newData: newEmployee,
      changedBy: 'HR_ADMIN'
    });

    res.status(201).json({ success: true, message: 'Karyawan berhasil ditambahkan', data: newEmployee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { nik } = req.params;
    const data = req.body;

    const oldData = await prisma.employee.findUnique({ where: { nik } });
    if (!oldData) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    const updated = await prisma.employee.update({
      where: { nik },
      data: {
        ...data,
        agentId: data.agentId ? parseInt(data.agentId) : undefined,
        gajiPokok: data.gajiPokok ? parseFloat(data.gajiPokok) : undefined,
        jointDate: data.jointDate ? new Date(data.jointDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : (data.endDate === null ? null : undefined)
      }
    });

    await logAudit(prisma, {
      nik,
      tableName: 'employees',
      action: 'UPDATE',
      oldData,
      newData: updated,
      changedBy: 'HR_ADMIN'
    });

    res.json({ success: true, message: 'Data berhasil diperbarui', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const uploadPKWT = async (req, res) => {
  try {
    const { nik } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });

    const filePath = `/uploads/pkwt/${req.file.filename}`;
    await prisma.employee.update({
      where: { nik },
      data: { pkwtAttachmentUrl: filePath }
    });

    await logAudit(prisma, {
      nik,
      tableName: 'employees',
      action: 'UPDATE_PKWT',
      oldData: null,
      newData: { pkwtAttachmentUrl: filePath },
      changedBy: 'HR_ADMIN'
    });

    res.json({ success: true, message: 'PKWT berhasil diupload', url: filePath });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data Karyawan');
    
    // Ambil data agent terbaru untuk dropdown
    const agents = await prisma.agent.findMany({ select: { code: true } });
    const agentCodes = agents.map(a => a.code);

    // Sheet bantuan untuk list dropdown (bisa disembunyikan)
    const listSheet = workbook.addWorksheet('Lists');
    listSheet.state = 'veryHidden';
    
    // Isi data list untuk dropdown
    const kawinList = ['TK/0', 'K/0', 'K/1', 'K/2', 'K/3'];
    const tkList = ['PKWT', 'PKM'];
    const levelList = ['Staff', 'Supervisor A', 'Supervisor B', 'Manager A', 'Manager B', 'Manager C', 'BOD'];
    
    kawinList.forEach((v, i) => listSheet.getCell(`A${i+1}`).value = v);
    agentCodes.forEach((v, i) => listSheet.getCell(`B${i+1}`).value = v);
    tkList.forEach((v, i) => listSheet.getCell(`C${i+1}`).value = v);
    levelList.forEach((v, i) => listSheet.getCell(`D${i+1}`).value = v);

    const headers = [
      'Nama Karyawan', 'Nomor KTP', 'Status Perkawinan', 
      'Kode Agent', 'Jabatan', 'Status TK (PKWT/PKM)', 'Level', 
      'Email Kantor', 'Email Pribadi', 'Nama Atasan', 'Email Atasan', 
      'Joint Date (YYYY-MM-DD)', 'Gaji Pokok', 'Nama Bank', 
      'No Rekening', 'Nama Rekening'
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Row 2: Information
    const infoRow = sheet.addRow(['NIK akan digenerate otomatis oleh sistem', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    sheet.mergeCells('A2:P2');
    infoRow.getCell(1).font = { italic: true, color: { argb: 'FF0000' } };

    // Tambahkan 100 baris dengan data validation (dropdown)
    for (let i = 3; i <= 102; i++) {
      // Column C (Status Perkawinan) - Lists!$A$1:$A$5
      sheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Lists!$A$1:$A$${kawinList.length}`]
      };
      
      // Column D (Kode Agent) - Lists!$B$1:$B$...
      if (agentCodes.length > 0) {
        sheet.getCell(`D${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Lists!$B$1:$B$${agentCodes.length}`]
        };
      }

      // Column F (Status TK) - Lists!$C$1:$C$2
      sheet.getCell(`F${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Lists!$C$1:$C$${tkList.length}`]
      };

      // Column G (Level) - Lists!$D$1:$D$7
      sheet.getCell(`G${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Lists!$D$1:$D$${levelList.length}`]
      };
    }

    // Contoh baris dummy (di Row 3)
    sheet.addRow([
      'Contoh Nama', '1234567890123456', 'TK/0', 
      agentCodes[0] || 'PDG', 'Staff IT', 'PKWT', 'Staff', 
      'contoh@kalapa.com', 'pribadi@gmail.com', 'Pak Budi', 'budi@kalapa.com', 
      '2025-01-01', 5000000, 'BCA', 
      '12345678', 'Contoh Nama'
    ]);

    sheet.columns.forEach(col => col.width = 22);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=template_import_employee.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const generateNikHelper = async (agentId, jointDate, prismaTx) => {
  const agent = await prismaTx.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error('Agent tidak ditemukan');

  const dateObj = new Date(jointDate);
  const year = dateObj.getFullYear().toString().slice(-2);
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `${agent.code}_${year}_${month}_`;

  const lastEmployee = await prismaTx.employee.findFirst({
    where: { nik: { startsWith: prefix } },
    orderBy: { nik: 'desc' }
  });

  let sequence = 1;
  if (lastEmployee) {
    const parts = lastEmployee.nik.split('_');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(3, '0')}`;
};

const importExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.getWorksheet(1);
    
    let total = 0, berhasil = 0, diperbarui = 0, gagal = 0;
    const errors = [];
    const emailsSeen = new Set();

    // Pre-fetch all agents
    const agents = await prisma.agent.findMany();
    const agentMap = agents.reduce((acc, a) => { acc[a.code] = a.id; return acc; }, {});

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const namaKaryawan = row.getCell(1).text.trim();
      
      // Skip header atau baris info atau baris kosong
      if (!namaKaryawan || namaKaryawan === 'Nama Karyawan' || namaKaryawan.includes('NIK akan digenerate')) continue;

      total++;
      try {
        const agentCode = row.getCell(4).text.trim();
        const agentId = agentMap[agentCode];
        if (!agentId) throw new Error(`Kode Agent '${agentCode}' tidak ditemukan`);

        const jointDateRaw = row.getCell(12).text.trim();
        const jointDate = new Date(jointDateRaw);
        if (isNaN(jointDate.getTime())) throw new Error(`Format tanggal '${jointDateRaw}' salah (Gunakan YYYY-MM-DD)`);

        const email = row.getCell(8).text.trim();
        if (emailsSeen.has(email)) throw new Error(`Email '${email}' duplikat dalam file`);
        emailsSeen.add(email);

        const employeeData = {
          namaKaryawan,
          nomorKtp: row.getCell(2).text.trim(),
          statusPerkawinan: row.getCell(3).text.trim(),
          agentId,
          jabatan: row.getCell(5).text.trim(),
          statusTk: row.getCell(6).text.trim(),
          level: row.getCell(7).text.trim(),
          emailKantor: email,
          emailPribadi: row.getCell(9).text.trim(),
          namaAtasan: row.getCell(10).text.trim(),
          emailAtasan: row.getCell(11).text.trim(),
          jointDate,
          gajiPokok: parseFloat(row.getCell(13).value || 0),
          namaBank: row.getCell(14).text.trim(),
          noRekening: row.getCell(15).text.trim(),
          namaRekening: row.getCell(16).text.trim()
        };

        // UPSERT LOGIC
        const result = await prisma.$transaction(async (tx) => {
          const existing = await tx.employee.findFirst({ where: { emailKantor: email } });
          
          if (existing) {
            const updated = await tx.employee.update({ where: { id: existing.id }, data: employeeData });
            
            await logAudit(tx, {
              nik: existing.nik,
              tableName: 'employees',
              action: 'UPDATE',
              oldData: existing,
              newData: updated,
              changedBy: 'IMPORT_SYSTEM'
            });
            diperbarui++;
            return updated;
          } else {
            const newNik = await generateNikHelper(agentId, jointDate, tx);
            const created = await tx.employee.create({ data: { ...employeeData, nik: newNik } });
            
            // Auto-insert leave_quotas
            const tahun = jointDate.getFullYear();
            await tx.leaveQuota.create({ data: { nik: newNik, tahun, jumlahCuti: 12, cutiTerpakai: 0 } });

            await logAudit(tx, {
              nik: newNik,
              tableName: 'employees',
              action: 'CREATE',
              oldData: null,
              newData: created,
              changedBy: 'IMPORT_SYSTEM'
            });
            berhasil++;
            return created;
          }
        });

      } catch (err) {
        gagal++;
        errors.push(`Baris ${i} (${namaKaryawan || 'N/A'}): ${err.message}`);
      }
    }

    fs.unlinkSync(req.file.path);
    res.json({ success: true, data: { total, berhasil, diperbarui, gagal, errors } });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: error.message });
  }
};

const generateNik = async (req, res) => {
  try {
    const { agentId, jointDate } = req.query;
    
    if (!agentId || !jointDate) {
      return res.status(400).json({ success: false, message: 'Agent ID dan Joint Date wajib diisi' });
    }

    const newNik = await generateNikHelper(parseInt(agentId), jointDate, prisma);
    res.json({ success: true, nik: newNik });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeByNik,
  createEmployee,
  updateEmployee,
  uploadPKWT,
  downloadTemplate,
  importExcel,
  generateNik
};
