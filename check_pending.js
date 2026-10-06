require('dotenv').config({ path: '/var/www/voteSMS/.env' });
const db = require('./src/config/db');
const { checkAchatStatus } = require('./src/services/nitaService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function verifyRecentPending() {
    try {
        console.log("🔍 Vérification des transactions PENDING récentes...");
        
        // On ne prend que les transactions PENDING créées dans la dernière heure
        const [pendingTxs] = await db.query(
            "SELECT * FROM transactions WHERE statut = 'PENDING' AND created_at >= NOW() - INTERVAL 1 HOUR"
        );

        if (pendingTxs.length === 0) {
            console.log("Aucune transaction récente en attente.");
            return;
        }

        for (const tx of pendingTxs) {
            try {
                console.log(`Vérification de la requête : ${tx.request_id}`);
                const result = await checkAchatStatus(tx.request_id, tx.telephone);

                const codeResult = result?.data?.code || result?.code;

                if (codeResult === '1' || codeResult === 1) {
                    console.log(`✅ Paiement validé pour ${tx.request_id}! Mise à jour...`);

                    await db.query('UPDATE transactions SET statut = ? WHERE id = ?', ['SUCCESS', tx.id]);

                    await db.query(
                        'INSERT INTO votes (candidat_id, nombre_voix, telephone) VALUES (?, ?, ?)',
                        [tx.candidat_id, tx.nombre_voix, tx.telephone]
                    );

                    await db.query(
                        'UPDATE candidats SET nombre_votes = nombre_votes + ? WHERE id = ?',
                        [tx.nombre_voix, tx.candidat_id]
                    );

                    console.log(`🎉 Vote de ${tx.nombre_voix} voix crédité pour le candidat ID ${tx.candidat_id}`);
                } else {
                    console.log(`⏳ Transaction ${tx.request_id} en attente ou non payée.`);
                }

                // Pause de 2 secondes entre chaque requête pour respecter l'API MyNITA
                await sleep(2000);

            } catch (err) {
                console.error(`Erreur pour la transaction ${tx.request_id}:`, err.response?.data?.message || err.message);
                await sleep(2000);
            }
        }
    } catch (error) {
        console.error("Erreur générale dans verifyRecentPending:", error.message);
    } finally {
        process.exit(0);
    }
}

verifyRecentPending();
