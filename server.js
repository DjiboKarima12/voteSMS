const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser les requêtes JSON et URL-encoded
app.use(express.json());
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
    user: 'root',
    password: 'VOTRE_MOT_DE_PASSE_MYSQL',
    database: 'vote_sms',
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

// -------------------------------------------------------------
// ROUTES API ADMIN - CANDIDATS
// -------------------------------------------------------------

// Obtenir tous les candidats
app.get('/api/admin/candidats', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM candidats ORDER BY id DESC');
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
        const [rows] = await db.query('SELECT * FROM candidats ORDER BY id DESC');
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
        const [rows] = await db.query('SELECT DISTINCT category_id as id, CONCAT("Catégorie ", category_id) as nom FROM candidats');
        res.json(rows);
    } catch (err) {
        console.error("Erreur /api/categories:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});
// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
