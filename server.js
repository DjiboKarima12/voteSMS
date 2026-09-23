// Obtenir tous les candidats pour l'administration
app.get('/api/admin/candidats', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM candidats ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Ajouter un nouveau candidat
app.post('/api/admin/candidats', async (req, res) => {
    const { code_candidat, nom, prenom, category_code } = req.body;
    if (!code_candidat || !nom || !prenom || !category_code) {
        return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
    }
    try {
        await db.query(
            'INSERT INTO candidats (code_candidat, nom, prenom, category_code) VALUES (?, ?, ?, ?)',
            [code_candidat.trim(), nom.trim(), prenom.trim(), category_code.trim()]
        );
        res.json({ success: true, message: 'Candidat ajouté avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Modifier un candidat existant
app.put('/api/admin/candidats/:id', async (req, res) => {
    const { id } = req.params;
    const { code_candidat, nom, prenom, category_code } = req.body;
    try {
        await db.query(
            'UPDATE candidats SET code_candidat = ?, nom = ?, prenom = ?, category_code = ? WHERE id = ?',
            [code_candidat.trim(), nom.trim(), prenom.trim(), category_code.trim(), id]
        );
        res.json({ success: true, message: 'Candidat mis à jour avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Supprimer un candidat
app.delete('/api/admin/candidats/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM candidats WHERE id = ?', [id]);
        res.json({ success: true, message: 'Candidat supprimé avec succès !' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

