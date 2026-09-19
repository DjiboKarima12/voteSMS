const db = require('../config/db');
const { extractData } = require('../config/moovMapping');

exports.handleMoovSms = async (req, res) => {
    const { telephone, messageBrut, transactionId } = extractData(req);

    if (!telephone || !messageBrut) {
        return res.status(200).send("Parametres insuffisants.");
    }

    // Normalisation en minuscules et suppression des espaces superflus (ex: "pat1", "PAT1", "pat 1")
    const textClean = messageBrut.trim().toLowerCase().replace(/\s+/g, '');

    // Extraire le code catégorie (lettres) et le numéro candidat (chiffres)
    const match = textClean.match(/^([a-z]+)(\d+)$/);

    if (!match) {
        await logVote(null, telephone, null, null, messageBrut, transactionId, 'FAILED_FORMAT');
        return res.status(200).send("Format incorrect. Envoyez par exemple pat1 ou coup2.");
    }

    const categoryCode = match[1]; // Ex: "pat", "crea", "coup"
    const candidatCode = match[2]; // Ex: "1", "2", "5"

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Recherche du candidat
        const [rows] = await connection.query(`
            SELECT c.id AS candidat_id, c.nom AS candidat_nom, cat.nom AS cat_nom
            FROM candidats c
            JOIN categories cat ON c.category_id = cat.id
            WHERE LOWER(cat.code) = ? AND c.code_vote = ?
            FOR UPDATE
        `, [categoryCode, candidatCode]);

        if (rows.length === 0) {
            await connection.commit();
            await logVote(null, telephone, categoryCode, candidatCode, messageBrut, transactionId, 'NOT_FOUND');
            return res.status(200).send(`Code ${categoryCode}${candidatCode} introuvable.`);
        }

        const candidat = rows[0];

        // Incrémentation du compteur
        await connection.query(
            'UPDATE candidats SET nombre_votes = nombre_votes + 1 WHERE id = ?',
            [candidat.candidat_id]
        );

        // Enregistrement dans la table d'audit
        await connection.query(`
            INSERT INTO votes_sms 
            (candidat_id, telephone, category_code, candidat_code, raw_message, transaction_id, status)
            VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS')
        `, [candidat.candidat_id, telephone, categoryCode, candidatCode, messageBrut, transactionId]);

        await connection.commit();

        return res.status(200).send(`Vote valide pour ${candidat.candidat_nom} (${candidat.cat_nom}) ! Merci.`);

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erreur Webhook:", error);
        await logVote(null, telephone, categoryCode, candidatCode, messageBrut, transactionId, 'SERVER_ERROR');
        return res.status(200).send("Erreur technique. Veuillez reessayer.");
    } finally {
        if (connection) connection.release();
    }
};

exports.getWinners = async (req, res) => {
    try {
        const query = `
            WITH RankedCandidats AS (
                SELECT 
                    c.id AS candidat_id,
                    c.nom AS nom_candidat,
                    c.nombre_votes,
                    cat.id AS category_id,
                    cat.code AS code_categorie,
                    cat.nom AS nom_categorie,
                    ROW_NUMBER() OVER (
                        PARTITION BY c.category_id 
                        ORDER BY c.nombre_votes DESC, c.id ASC
                    ) as rang
                FROM candidats c
                JOIN categories cat ON c.category_id = cat.id
            )
            SELECT nom_categorie, code_categorie, nom_candidat, nombre_votes
            FROM RankedCandidats
            WHERE rang = 1;
        `;
        const [winners] = await db.query(query);
        return res.status(200).json({ success: true, winners });
    } catch (error) {
        console.error("Erreur classement:", error);
        return res.status(500).json({ success: false, error: "Erreur serveur" });
    }
};

async function logVote(candidatId, phone, catCode, candCode, rawMsg, txId, status) {
    try {
        await db.query(`
            INSERT INTO votes_sms 
            (candidat_id, telephone, category_code, candidat_code, raw_message, transaction_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [candidatId, phone, catCode, candCode, rawMsg, txId, status]);
    } catch (e) {
        console.error("Erreur logVote:", e);
    }
}