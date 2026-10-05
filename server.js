const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser les requêtes JSON et URL-encoded
app.use(express.json());

// Montage des routes de vote et de paiement MyNITA
const voteRoutes = require('./src/routes/voteRoutes');
app.use('/api', voteRoutes);

app.use(express.urlencoded({ extended: true }));

// Configuration de Multer pour l'upload des photos
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Configuration de la connexion à la base de données MySQL
const db = mysql.createPool({
    host: 'localhost',
    user: 'root', // ou 'votesms_user'
    password: 'Kimi@12',
    database: 'vote_platform',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 1. Servir les fichiers statiques du dossier public (HTML, CSS, JS, uploads)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Rediriger la racine '/' vers le tableau de bord ou login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/vote', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

// -------------------------------------------------------------
// ROUTES API ADMIN - CANDIDATS
// -------------------------------------------------------------

// Obtenir tous les candidats
app.get('/api/admin/candidats', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                c.*, 
                cat.nom AS category_name 
            FROM candidats c
            LEFT JOIN categories cat ON c.category_id = cat.id
            ORDER BY c.id ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Ajouter un nouveau candidat avec photo
app.post('/api/admin/candidats', upload.single('photo'), async (req, res) => {
    const { code_sms, category_id, nom } = req.body;
    const photo = req.file ? `/uploads/${req.file.filename}` : null;

    if (!code_sms || !category_id || !nom) {
        return res.status(400).json({ success: false, message: 'Tous les champs obligatoires sont requis.' });
    }

    try {
        await db.query(
            'INSERT INTO candidats (code_sms, category_id, nom, photo) VALUES (?, ?, ?, ?)',
            [code_sms.trim(), category_id, nom.trim(), photo]
        );
        res.json({ success: true, message: 'Candidat ajouté avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Modifier un candidat existant (avec ou sans nouvelle photo)
app.put('/api/admin/candidats/:id', upload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const { code_sms, category_id, nom } = req.body;

    try {
        // Vérifier si une nouvelle photo a été envoyée
        if (req.file) {
            const photo = `/uploads/${req.file.filename}`;
            await db.query(
                'UPDATE candidats SET code_sms = ?, category_id = ?, nom = ?, photo = ? WHERE id = ?',
                [code_sms.trim(), category_id, nom.trim(), photo, id]
            );
        } else {
            await db.query(
                'UPDATE candidats SET code_sms = ?, category_id = ?, nom = ? WHERE id = ?',
                [code_sms.trim(), category_id, nom.trim(), id]
            );
        }
        res.json({ success: true, message: 'Candidat mis à jour avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Supprimer un candidat
app.delete('/api/admin/candidats/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Optionnel : Récupérer et supprimer le fichier image du disque
        const [rows] = await db.query('SELECT photo FROM candidats WHERE id = ?', [id]);
        if (rows.length > 0 && rows[0].photo) {
            const filePath = path.join(__dirname, 'public', rows[0].photo);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await db.query('DELETE FROM candidats WHERE id = ?', [id]);
        res.json({ success: true, message: 'Candidat supprimé avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Route publique pour récupérer tous les candidats (sans protection admin)
app.get('/api/candidats', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM candidats ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error("Erreur /api/candidats:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});
// Route pour récupérer les catégories dynamiquement depuis les candidats ou une table
app.get('/api/categories', async (req, res) => {
    try {
        // On récupère les catégories uniques ou une liste fixe selon votre structure
        const [rows] = await db.query('SELECT id, nom FROM categories');
        res.json(rows);
    } catch (err) {
        console.error("Erreur /api/categories:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});
// Démarrage du serveur

// Routes API pour les statistiques et le podium
app.get('/api/stats', async (req, res) => {
    try {
        const [totalVotesRows] = await db.query('SELECT COUNT(*) as total FROM votes');
        const [topCandidats] = await db.query(`
            SELECT c.*, cat.nom AS category_name, COUNT(v.id) as nombre_votes 
            FROM candidats c 
            LEFT JOIN categories cat ON c.category_id = cat.id 
            LEFT JOIN votes v ON c.id = v.candidat_id 
            GROUP BY c.id 
            ORDER BY nombre_votes DESC
        `);
        res.json({
            success: true,
            totalVotes: totalVotesRows[0].total || 0,
            candidats: topCandidats
        });
    } catch (err) {
        console.error('Erreur /api/stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// Route API pour les résultats du podium et dashboard (/api/results)

// Route API pour les résultats du podium et dashboard (/api/results)

// Route API pour les résultats du podium et dashboard (/api/results)

// Route API pour les résultats du podium et dashboard (/api/results)

// Route API pour les résultats du podium et dashboard (/api/results)
app.get('/api/results', async (req, res) => {
    try {
        const [candidats] = await db.query(`
            SELECT 
                c.*, 
                cat.code AS category_code,
                cat.nom AS category_name,
                c.nombre_votes AS total_votes,
                c.nombre_votes AS nombre_votes
            FROM candidats c
            LEFT JOIN categories cat ON c.category_id = cat.id
            ORDER BY c.nombre_votes DESC, c.id ASC
        `);

        res.json({
            success: true,
            data: candidats
        });
    } catch (err) {
        console.error('Erreur /api/results:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
