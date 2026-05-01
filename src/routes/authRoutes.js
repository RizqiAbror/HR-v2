const express = require('express');
const router = express.Router();
const { showLogin, handleLogin, handleLogout } = require('../controllers/authController');

router.get('/login', showLogin);
router.post('/login', handleLogin);
router.get('/logout', handleLogout);

module.exports = router;
