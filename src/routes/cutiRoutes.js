const express = require('express');
const router = express.Router();
const {
  getSisaCuti,
  getRiwayatCuti,
  submitCuti,
  approveCuti,
  cancelCuti,
  hitungHari
} = require('../controllers/cutiController');

router.get('/sisa', getSisaCuti);
router.get('/riwayat/:nik', getRiwayatCuti);
router.get('/hitung', hitungHari);
router.post('/submit', submitCuti);
router.patch('/approve/:id', approveCuti);
router.patch('/cancel/:id', cancelCuti);

module.exports = router;
