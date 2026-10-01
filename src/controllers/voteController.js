const db = require('../config/db');

const getVotes = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                c.id,
                c.category_id,
                c.code_vote,
                c.code_vote AS code_sms,
                c.code_vote AS code_candidat,
                c.nom,
		c.photo,
                c.nombre_votes,
                c.nombre_votes AS total_votes,
                cat.nom as category_name,
                cat.code as category_code
            FROM candidats c
            LEFT JOIN categories cat ON c.category_id = cat.id
            ORDER BY c.category_id ASC, CAST(c.code_vote AS UNSIGNED) ASC, c.id ASC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Erreur getVotes:", error.message);
        res.status(500).json({ success: false, error: error.message, data: [] });
    }
};

const saveAdminCandidat = async (req, res) => {
    try {
        const { id, code_sms, code_vote, category_id, prenom, nom } = req.body;
        const code = (code_sms || code_vote || '').toString().trim();
        const fullNom = prenom ? `${prenom} ${nom || ''}`.trim() : (nom || '').toString().trim();
        const catId = category_id ? parseInt(category_id, 10) : null;

        // Récupérer le chemin de l'image si un fichier a été uploadé via Multer
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // Validation du nom
        if (!fullNom) {
            return res.status(400).json({ success: false, message: "Le nom du candidat est obligatoire." });
        }

        // ------------------------------------
        // 1. CAS : MISE À JOUR PAR ID
        // ------------------------------------
        if (id) {
            if (photoUrl) {
                await db.query(
                    `UPDATE candidats 
                     SET nom = ?, 
                         category_id = COALESCE(NULLIF(?, ''), category_id), 
                         code_vote = COALESCE(NULLIF(?, ''), code_vote),
                         photo = ?
                     WHERE id = ?`,
                    [fullNom, catId, code, photoUrl, id]
                );
            } else {
                await db.query(
                    `UPDATE candidats 
                     SET nom = ?, 
                         category_id = COALESCE(NULLIF(?, ''), category_id), 
                         code_vote = COALESCE(NULLIF(?, ''), code_vote)
                     WHERE id = ?`,
                    [fullNom, catId, code, id]
                );
            }
            return res.json({ success: true, message: "Candidat mis à jour avec succès" });
        }

        // ------------------------------------
        // 2. CAS : AJOUT OU MISE À JOUR PAR CODE
        // ------------------------------------
        if (!catId) {
            return res.status(400).json({ success: false, message: "La catégorie est requise pour ajouter un candidat." });
        }

        if (code) {
            const [existing] = await db.query(
                'SELECT id FROM candidats WHERE code_vote = ? AND category_id = ?', 
                [code, catId]
            );

            if (existing.length > 0) {
                if (photoUrl) {
                    await db.query('UPDATE candidats SET nom = ?, photo = ? WHERE id = ?', [fullNom, photoUrl, existing[0].id]);
                } else {
                    await db.query('UPDATE candidats SET nom = ? WHERE id = ?', [fullNom, existing[0].id]);
                }
                return res.json({ success: true, message: "Candidat mis à jour avec succès" });
            }
        }

        // Insertion d'un nouveau candidat avec sa photo
        await db.query(
            'INSERT INTO candidats (code_vote, category_id, nom, photo, nombre_votes) VALUES (?, ?, ?, ?, 0)',
            [code || '1', catId, fullNom, photoUrl]
        );

        return res.json({ success: true, message: "Candidat ajouté avec succès" });

    } catch (error) {
        console.error("Erreur saveAdminCandidat:", error.message);
        return res.status(500).json({ success: false, error: "Erreur serveur lors de l'enregistrement" });
    }
};

const deleteCandidat = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM candidats WHERE id = ?', [id]);
        res.json({ success: true, message: "Candidat supprimé avec succès" });
    } catch (error) {
        console.error("Erreur deleteCandidat:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getStats = async (req, res) => {
    try {
        const [totalVotesRes] = await db.query('SELECT SUM(nombre_votes) as total FROM candidats');
        const [candidatsRes] = await db.query('SELECT COUNT(*) as total FROM candidats');

        res.json({
            success: true,
            stats: {
                totalVotes: parseInt(totalVotesRes[0]?.total || 0, 10),
                totalCandidats: parseInt(candidatsRes[0]?.total || 0, 10)
            }
        });
    } catch (error) {
        console.error("Erreur getStats:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const handleSmsVote = async (req, res) => {
    try {
        const { sender, message } = req.body;
        if (!sender || !message) {
            return res.status(400).json({ success: false, message: "Données manquantes" });
        }

        const codeVote = message.trim();
        await db.query('INSERT INTO votes_sms (phone_number, message, code_vote) VALUES (?, ?, ?)', [sender, message, codeVote]);
        await db.query('UPDATE candidats SET nombre_votes = nombre_votes + 1 WHERE code_vote = ?', [codeVote]);

        res.json({ success: true, message: "Vote enregistré avec succès" });
    } catch (error) {
        console.error("Erreur handleSmsVote:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getVotes,
    saveAdminCandidat,
    deleteCandidat,
    getStats,
    handleSmsVote
};
