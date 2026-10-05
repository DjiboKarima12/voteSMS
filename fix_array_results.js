const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const newResultsRoute = `
// Route API pour les résultats du podium et dashboard (/api/results)
app.get('/api/results', async (req, res) => {
    try {
        const [candidats] = await db.query(\`
            SELECT 
                c.*, 
                cat.nom AS category_name,
                COUNT(v.id) AS nombre_votes
            FROM candidats c
            LEFT JOIN categories cat ON c.category_id = cat.id
            LEFT JOIN votes v ON c.id = v.candidat_id
            GROUP BY c.id
            ORDER BY nombre_votes DESC, c.id ASC
        \`);

        res.json({
            success: true,
            data: candidats
        });
    } catch (err) {
        console.error('Erreur /api/results:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
`;

// Remplacer l'ancienne route /api/results par la nouvelle
const regex = /\/\/ Route API pour les résultats du podium[\s\S]*?\}\);\s*\}\);\s*\});?/g;
if (code.includes('/api/results')) {
    // On remplace simplement tout le bloc de la route existante
    // S'il y a un doute, on réécrit proprement
    code = code.replace(/\/\/ Route API pour les résultats[\s\S]*?\}\);\s*\});/g, '');
    
    // Ajout avant app.listen
    code = code.replace('app.listen(', newResultsRoute + '\napp.listen(');
    fs.writeFileSync('server.js', code);
    console.log('Route /api/results mise à jour en tableau direct !');
}
