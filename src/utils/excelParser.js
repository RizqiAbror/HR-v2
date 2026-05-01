const ExcelJS = require('exceljs');

const parseEmployeeExcel = async (filePath, originalName) => {
  const workbook = new ExcelJS.Workbook();
  const lowerName = originalName.toLowerCase();
  
  if (lowerName.endsWith('.csv')) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  // Ambil sheet pertama
  const worksheet = lowerName.endsWith('.csv') ? workbook.worksheets[0] : workbook.getWorksheet(1);
  const data = [];

  // Looping baris, asumsikan baris 1 adalah header
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Skip baris pertama (header)
      data.push({
        namaKaryawan: row.getCell(1).value,
        nomorKtp: row.getCell(2).value?.toString(),
        statusPerkawinan: row.getCell(3).value?.toString(),
        nik: row.getCell(4).value?.toString(),
        agentName: row.getCell(5).value?.toString(),
        jabatan: row.getCell(6).value?.toString(),
        statusTk: row.getCell(7).value?.toString() || 'PKWT',
        jointDate: row.getCell(8).value ? new Date(row.getCell(8).value) : new Date(),
        endDate: row.getCell(9).value ? new Date(row.getCell(9).value) : null,
        gajiPokok: parseFloat(row.getCell(10).value) || 0,
        allowance: parseFloat(row.getCell(11).value) || 0,
        jkk: parseFloat(row.getCell(12).value) || 0,
        jkm: parseFloat(row.getCell(13).value) || 0,
        jht: parseFloat(row.getCell(14).value) || 0,
        kesehatan: parseFloat(row.getCell(15).value) || 0,
        pph21: parseFloat(row.getCell(16).value) || 0,
        bonus: parseFloat(row.getCell(17).value) || 0,
        namaBank: row.getCell(18).value?.toString(),
        nomorRekening: row.getCell(19).value?.toString(),
        namaRekening: row.getCell(20).value?.toString(),
        attachmentPkwt: row.getCell(21).value?.toString(),
        statusKaryawan: 'ACTIVE'
      });
    }
  });

  return data;
};

module.exports = { parseEmployeeExcel };
