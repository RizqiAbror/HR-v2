const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/attachments'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const {
  getSisaCuti,
  getRiwayatCuti,
  submitCuti,
  approveCuti,
  cancelCuti,
  hitungHari,
  adminSubmitCuti,
  bulkLeaveSubmit,
  triggerAnnualReset
} = require('../controllers/cutiController');

router.get('/sisa', getSisaCuti);
router.get('/riwayat/:nik', getRiwayatCuti);
router.get('/hitung', hitungHari);
router.get('/trigger-annual-reset', triggerAnnualReset); 

// Menggunakan upload.single('attachment')
router.post('/submit', upload.single('attachment'), submitCuti);
router.post('/admin-submit', upload.single('attachment'), adminSubmitCuti);
router.post('/bulk-submit', bulkLeaveSubmit);
router.patch('/approve/:id', approveCuti);
router.patch('/cancel/:id', cancelCuti);

module.exports = router;
