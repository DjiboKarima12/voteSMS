const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');

// Routes appelées par admin.html
router.get('/admin/candidats', voteController.getVotes);
router.post('/admin/candidats', voteController.saveAdminCandidat);
router.put('/admin/candidats/:id', voteController.saveAdminCandidat);
router.delete('/admin/candidats/:id', voteController.deleteCandidat);

// Routes appelées par dashboard.html et le système SMS
router.get('/results', voteController.getVotes);
router.get('/votes', voteController.getVotes);
router.get('/stats', voteController.getStats);
router.post('/sms', voteController.handleSmsVote);
router.get('/', voteController.getVotes);

module.exports = router;
