const express = require('express');
const router = express.Router();
const { showDashboard, showCutiIndex, showCutiForm } = require('../controllers/pageController');

router.get('/', showDashboard);
router.get('/cuti', showCutiIndex);
router.get('/cuti/form', showCutiForm);

module.exports = router;
