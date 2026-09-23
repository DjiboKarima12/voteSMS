const db = require('../config/db');

// 1. Récupérer tous les candidats pour Admin et Dashboard
exports.getVotes = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                c.id, 
                c.category_id, 
                c.code_vote, 
                c.code_vote AS code_sms,
                c.code_vote AS code_candidat,
                c.nom, 
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

// 2. Sauvegarder/Mettre à jour un candidat
exports.saveAdminCandidat = async (req, res) => {
    try {
        const { id, code_sms, code_vote, category_id, prenom, nom } = req.body;
        const code = (code_sms || code_vote || '').trim();
        const fullNom = prenom ? `${prenom} ${nom}`.trim() : (nom || '').trim();

        if (id) {
            // Si mis à jour par ID
            await db.query(
                'UPDATE candidats SET nom = ?, category_id = IFNULL(NULLIF(?, ""), category_id), code_vote = IFNULL(NULLIF(?, ""), code_vote) WHERE id = ?',
                [fullNom, category_id, code, id]
            );
            return res.json({ success: true, message: "Candidat mis à jour avec succès" });
        }

        // Si mis à jour par code_vote
        if (code) {
            const [existing] = await db.query('SELECT id FROM candidats WHERE code_vote = ? AND category_id = ?', [code, category_id || 1]);
            if (existing.length > 0) {
                await db.query(
                    'UPDATE candidats SET nom = ? WHERE id = ?',
                    [fullNom, existing[0].id]
                );
                return res.json({ success: true, message: "Candidat mis à jour avec succès" });
            }
        }

        // Insertion nouveau
        await db.query(
            'INSERT INTO candidats (code_vote, category_id, nom, nombre_votes) VALUES (?, ?, ?, 0)',
            [code || '1', category_id || 1, fullNom]
        );
        res.json({ success: true, message: "Candidat ajouté avec succès" });

    } catch (error) {
        console.error("Erreur saveAdminCandidat:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Supprimer un candidat
exports.deleteCandidat = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM candidats WHERE id = ?', [id]);
        res.json({ success: true, message: "Candidat supprimé avec succès" });
    } catch (error) {
        console.error("Erreur deleteCandidat:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. Statistiques globales
exports.getStats = async (req, res) => {
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

// 5. Traiter les SMS entrants
exports.handleSmsVote = async (req, res) => {
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
