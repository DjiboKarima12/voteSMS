const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();
const db = require('./config/db');
const voteRoutes = require('./routes/voteRoutes');

const app = express();
app.use(express.static(path.join(__dirname, '../public')));
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 1. Déclarer les fichiers statiques AVANT les routes API
// Expose le dossier des images sous l'URL /uploads/
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Expose l'ensemble du dossier public (HTML, CSS, JS frontend)
app.use(express.static(path.join(__dirname, '../public')));

// 2. Healthcheck
app.get('/health', (req, res) => res.status(200).send("OK"));
// Servir les fichiers statiques (images, CSS, JS, HTML)
app.use(express.static(path.join(__dirname, '../public')));

// 1. Route racine '/' -> Redirige directement vers le Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// 2. Route '/vote' -> Pour la page où le public vote via MyNita
app.get('/vote', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/vote.html'));
});

// Routes API
app.use('/api/votes', voteRoutes);
app.use('/api', voteRoutes);

// Endpoint Callback pour recevoir les notifications de paiement Nita
app.post('/api/nita/callback', async (req, res) => {
    try {
        console.log("Notification Nita reçue :", req.body);

        // Récupération des données envoyées par Nita
        const { code_candidat, votes, status } = req.body;

        if (status === 'SUCCESS' || status === 'PAID') {
            const nombreVotes = parseInt(votes) || 1;

            // Incrementer les votes du candidat dans la base de données
            await db.query(
                'UPDATE candidats SET nombre_votes = nombre_votes + ? WHERE code_vote = ?',
                [nombreVotes, code_candidat]
            );

            console.log(`✅ ${nombreVotes} vote(s) ajouté(s) au candidat ${code_candidat}`);
            return res.status(200).json({ success: true, message: "Vote comptabilisé" });
        }

        res.status(400).json({ success: false, message: "Statut de paiement non validé" });
    } catch (error) {
        console.error("Erreur Webhook Nita :", error);
        res.status(500).json({ success: false, error: error.message });
    }
});const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur prêt sur http://localhost:${PORT}`);
});
