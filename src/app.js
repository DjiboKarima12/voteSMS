const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const voteRoutes = require('./routes/voteRoutes');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

// Monter sur /api/votes (pour le frontend) ET /api (pour la compatibilité)
app.use('/api/votes', voteRoutes);
app.use('/api', voteRoutes);

app.get('/health', (req, res) => res.status(200).send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur prêt sur http://localhost:${PORT}`);
});
