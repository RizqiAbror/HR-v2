const express = require('express');
const router = express.Router();
const { 
  showDashboard, showCutiIndex, showCutiForm, showCutiDetail, showCutiRekap, showRiwayatCuti,
  showEmployeeIndex, showEmployeeDetail, showEmployeeForm,
  showAgentIndex, showAuditLogs, showLiburNasional 
} = require('../controllers/pageController');
const { isHRAdmin, isLoggedIn } = require('../middlewares/auth');

router.get('/', isLoggedIn, isHRAdmin, showDashboard);
router.get('/cuti', isLoggedIn, isHRAdmin, showCutiIndex);
router.get('/cuti/form', isLoggedIn, isHRAdmin, showCutiForm);   // HARUS di atas /cuti/:id
router.get('/cuti/rekap', isLoggedIn, isHRAdmin, showCutiRekap); // HARUS di atas /cuti/:id
router.get('/cuti/riwayat/:nik', isLoggedIn, isHRAdmin, showRiwayatCuti); // HARUS di atas /cuti/:id
router.get('/cuti/:id', isLoggedIn, isHRAdmin, showCutiDetail);

// ── EMPLOYEE PAGES ──
router.get('/employee', isLoggedIn, isHRAdmin, showEmployeeIndex);
router.get('/employee/form', isLoggedIn, isHRAdmin, showEmployeeForm);
router.get('/employee/:nik', isLoggedIn, isHRAdmin, showEmployeeDetail);
router.get('/employee/:nik/edit', isLoggedIn, isHRAdmin, showEmployeeForm);

// ── AGENT PAGES ──
router.get('/agent', isLoggedIn, isHRAdmin, showAgentIndex);

// ── AUDIT PAGES ──
router.get('/audit-trail', isLoggedIn, isHRAdmin, showAuditLogs);

// ── LIBUR NASIONAL ──
router.get('/libur-nasional', isLoggedIn, isHRAdmin, showLiburNasional);

module.exports = router;
