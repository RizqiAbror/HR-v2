const express = require('express');
const router = express.Router();
const {
  getAllAgents,
  createAgent,
  updateAgent
} = require('../controllers/agentController');

router.get('/', getAllAgents);
router.post('/', createAgent);
router.patch('/:id', updateAgent);

module.exports = router;
