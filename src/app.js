const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const voteRoutes = require('./routes/voteRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', voteRoutes);
app.get('/health', (req, res) => res.status(200).send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur prêt sur http://localhost:${PORT}`);
});