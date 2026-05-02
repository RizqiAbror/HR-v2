const express = require('express');
const router  = express.Router();
const { showLogin, doLogin, doLogout } = require('../controllers/authController');

router.get('/login',  showLogin);
router.post('/login', doLogin);
router.get('/logout', doLogout);

module.exports = router;
