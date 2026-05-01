const express = require('express');
const router = express.Router();
const { showDashboard, showCutiIndex, showCutiForm, showAuditLogs } = require('../controllers/pageController');

router.get('/', showDashboard);
router.get('/cuti', showCutiIndex);
router.get('/cuti/form', showCutiForm);
router.get('/audit', showAuditLogs);

module.exports = router;
