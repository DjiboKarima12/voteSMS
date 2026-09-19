const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');

router.post('/moov/sms-callback', voteController.handleMoovSms);
router.get('/moov/sms-callback', voteController.handleMoovSms);
router.get('/winners', voteController.getWinners);

module.exports = router;