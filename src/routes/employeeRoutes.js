const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getAllEmployees,
  getEmployeeByNik,
  createEmployee,
  updateEmployee,
  uploadPKWT,
  downloadTemplate,
  importExcel,
  generateNik
} = require('../controllers/employeeController');

// Konfigurasi Multer untuk PKWT
const pkwtStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/pkwt'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + (req.params.nik || 'unknown') + '-pkwt' + ext);
  }
});
const uploadPKWTHandler = multer({ 
  storage: pkwtStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau PDF'));
  }
});

// Konfigurasi Multer untuk Temp Excel
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/temp'));
  },
  filename: (req, file, cb) => {
    cb(null, 'import-' + Date.now() + '-' + file.originalname);
  }
});
const uploadExcelHandler = multer({ 
  storage: tempStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx')) cb(null, true);
    else cb(new Error('Format file tidak didukung. Gunakan file Excel (.xlsx)'));
  }
});

router.get('/', getAllEmployees);
router.get('/template', downloadTemplate);
router.get('/generate-nik', generateNik);
router.get('/:nik', getEmployeeByNik);
router.post('/', createEmployee);
router.patch('/:nik', updateEmployee);
router.post('/:nik/pkwt', (req, res, next) => {
  uploadPKWTHandler.single('pkwt')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, uploadPKWT);

router.post('/import', (req, res, next) => {
  uploadExcelHandler.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, importExcel);

module.exports = router;
