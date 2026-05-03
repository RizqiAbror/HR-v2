const express = require('express');
const router = express.Router();
const {
  getSisaCuti,
  getRiwayatCuti,
  submitCuti,
  approveCuti,
  cancelCuti,
  hitungHari,
  upload,
  triggerGenerateKuota,
  cutiBersamaMassal
} = require('../controllers/cutiController');

router.get('/sisa', getSisaCuti);
router.get('/riwayat/:nik', getRiwayatCuti);
router.post('/hitung', hitungHari);
router.post('/submit', (req, res, next) => {
  upload.single('suratCuti')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, submitCuti);
router.patch('/approve/:id', approveCuti);
router.patch('/cancel/:id', cancelCuti);
router.post('/generate-kuota', triggerGenerateKuota);
router.post('/massal', cutiBersamaMassal);

module.exports = router;
