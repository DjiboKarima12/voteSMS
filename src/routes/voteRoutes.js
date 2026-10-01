const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const voteController = require('../controllers/voteController');
const db = require('../config/db');

// Configuration Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'candidat-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Routes Admin
router.get('/admin/candidats', voteController.getVotes);
router.post('/admin/candidats', upload.single('photo'), voteController.saveAdminCandidat);
router.put('/admin/candidats/:id', upload.single('photo'), voteController.saveAdminCandidat);
router.delete('/admin/candidats/:id', voteController.deleteCandidat);

// Routes Publiques / API
router.get('/candidats', voteController.getVotes);

// Route des catégories
// Route pour récupérer les catégories dynamiquement à partir des IDs de la table candidats
router.get('/categories', async (req, res) => {
    try {
        // Remplacez 'categories' par le nom exact de votre table si c'est différent (ex: 'categorie')
        // et 'nom' par le nom de la colonne du libellé (ex: 'libelle', 'titre')
        const [rows] = await db.query('SELECT id, nom FROM categories');
        res.json(rows);
    } catch (e) {
        console.error("Erreur categories:", e);
        res.json([]);
    }
});
router.post('/voter', async (req, res) => {
    const { code_vote, nombre_votes } = req.body;
    const nb = parseInt(nombre_votes) || 1;
    try {
        await db.query('UPDATE candidats SET nombre_votes = nombre_votes + ? WHERE code_vote = ? OR code_sms = ?', [nb, code_vote, code_vote]);
        res.json({ success: true, message: 'Vote enregistré avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erreur lors du vote' });
    }
});

// Route pour enregistrer un vote web
router.post('/voter', async (req, res) => {
    const { code_vote } = req.body;
    try {
        await db.query('UPDATE candidats SET nombre_votes = nombre_votes + 1 WHERE code_vote = ? OR code_sms = ?', [code_vote, code_vote]);
        res.json({ success: true, message: 'Vote enregistré avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erreur lors du vote' });
    }
});

router.get('/results', voteController.getVotes);
router.get('/votes', voteController.getVotes);
router.get('/stats', voteController.getStats);
router.post('/sms', voteController.handleSmsVote);

module.exports = router;
