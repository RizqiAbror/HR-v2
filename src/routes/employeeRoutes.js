const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { importEmployees } = require('../controllers/employeeController');

router.post('/import', upload.single('file'), importEmployees);

module.exports = router;
