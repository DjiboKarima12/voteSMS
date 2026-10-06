require('dotenv').config();
const axios = require('axios');

const NITA_BASE_URL = process.env.NITA_BASE_URL;
const NITA_API_KEY = process.env.NITA_API_KEY;
const NITA_USERNAME = process.env.NITA_USERNAME;
const NITA_PASSWORD = process.env.NITA_PASSWORD;

let cachedToken = null;
let tokenExpiration = null;

// 1. Fonction pour récupérer le Token JWT auprès de NITA
async function authenticateNita() {
    try {
        if (cachedToken && tokenExpiration && Date.now() < tokenExpiration) {
            return cachedToken;
        }

        const response = await axios.post(`${NITA_BASE_URL}/api/authenticate`, {
            username: NITA_USERNAME,
            password: NITA_PASSWORD
        }, {
            headers: {
                'X-NT-API-KEY': NITA_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Afficher toute la réponse pour voir ce que Nita envoie vraiment
        console.log("REPONSE AUTH NITA BRUTE :", JSON.stringify(response.data, null, 2));

        // Chercher le token dans tous les endroits possibles
        const token = response.data?.data?.token || response.data?.token || response.data?.accessToken || response.data?.access_token;

        if (token) {
            cachedToken = token;
            tokenExpiration = Date.now() + (50 * 60 * 1000);
            return cachedToken;
        } else {
            throw new Error("Token introuvable. Structure reçue : " + JSON.stringify(response.data));
        }
    } catch (error) {
        console.error("Erreur d'authentification MyNITA :", error.response?.data || error.message);
        throw error;
    }
}

// 2. Fonction pour créer un achat en ligne et obtenir le code de paiement
async function creerAchatEnLigne({ requestId, montant, description, phoneClient, adresseIp, urlCallback }) {
    try {
        const token = await authenticateNita();

        const payload = {
            descriptionAchat: Array.isArray(description) ? description : [description],
            montantTransaction: parseFloat(montant),
            motifTransaction: "Paiement de votes SMS",
            requestId: String(requestId),
            phoneClient: String(phoneClient),
            adresseIp: adresseIp || "127.0.0.1",
            urlCallback: urlCallback || ""
        };

        const response = await axios.post(`${NITA_BASE_URL}/api/nitaServices/achatEnLigne/saveAchatEnLigne`, payload, {
            headers: {
                'X-NT-API-KEY': NITA_API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log("Reponse brute API MyNITA saveAchatEnLigne :", response.data);
        return response.data.data || response.data;
    } catch (error) {
        console.error("Erreur lors de la création de l'achat NITA :", error.response?.data || error.message);
        throw error;
    }
}

// 3. Fonction pour vérifier le statut d'un achat
async function checkAchatStatus(requestId, ipClient) {
    try {
        const token = await authenticateNita();
        const response = await axios.post(`${NITA_BASE_URL}/api/nitaServices/achatEnLigne/checkAchatStatus`, {
            requestId: requestId,
            longTransaction: "2.0301",
            latTransaction: "13.5123",
            adresseIp: ipClient || "127.0.0.1"
        }, {
            headers: {
                'X-NT-API-KEY': NITA_API_KEY,
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        console.log("Statut de l'achat vérifié :", response.data);
        return response.data;
    } catch (error) {
        console.error("Erreur lors de la vérification du statut :", error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    authenticateNita,
    creerAchatEnLigne,
    checkAchatStatus
};
