// @author MU202605
// Service d'authentification
// Les appels login, register, profile et logout vont vers SpringBoot
// L'upload de photo reste sur Laravel car c'est une fonctionnalite metier

import api from './axiosConfig';
import authApi from './authApiConfig';

// Normalise les champs nom/name pour compatibilite entre SpringBoot et Laravel
function normaliserUtilisateur(user) {
    if (!user) {
        return null;
    }

    return {
        ...user,
        nom: user.nom || user.name || '',
        name: user.name || user.nom || '',
    };
}

const authService = {

    // Inscription via SpringBoot puis connexion automatique
    async register(nom, email, password, passwordConfirmation, role) {
        const response = await authApi.post('/register', {
            name: nom,
            email,
            password,
            role
        });

        // Si l'inscription reussit sans erreur on connecte l'utilisateur automatiquement
        if (response.data && !response.data.error) {
            try {
                return await authService.login(email, password);
            } catch (e) {
                // Si la connexion echoue (ex: email non verifie) on retourne la reponse d'inscription
                return { ...response.data, user: null };
            }
        }

        return { ...response.data, user: null };
    },

    // Connexion via SpringBoot en deux etapes
    // Etape 1: obtenir la preuve HMAC depuis le service
    // Etape 2: s'authentifier avec la preuve
    async login(email, password) {
        const proofReponse = await authApi.post('/client-proof', { email, password });
        const { nonce, timestamp, hmac } = proofReponse.data;

        const loginReponse = await authApi.post('/login', { email, nonce, timestamp, hmac });

        const utilisateurNormalise = normaliserUtilisateur(loginReponse.data.user || loginReponse.data);

        if (loginReponse.data.token) {
            localStorage.setItem('token', loginReponse.data.token);
        }

        if (utilisateurNormalise) {
            localStorage.setItem('utilisateur', JSON.stringify(utilisateurNormalise));
        }

        return {
            ...loginReponse.data,
            user: utilisateurNormalise
        };
    },

    // Recupere le profil de l'utilisateur connecte depuis SpringBoot
    async profile() {
        const reponse = await authApi.get('/me');

        const utilisateurNormalise = normaliserUtilisateur(reponse.data.user || reponse.data);

        if (utilisateurNormalise) {
            localStorage.setItem('utilisateur', JSON.stringify(utilisateurNormalise));
        }

        return {
            ...reponse.data,
            user: utilisateurNormalise
        };
    },

    // Deconnexion via SpringBoot
    async logout() {
        const reponse = await authApi.post('/logout', {});

        localStorage.removeItem('token');
        localStorage.removeItem('utilisateur');

        return reponse.data;
    },

    // Upload photo de profil via Laravel car c'est une fonctionnalite metier
    async uploadPhoto(fichier) {
        const formData = new FormData();
        formData.append('photo', fichier);

        const reponse = await api.post('/profil/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        const utilisateurNormalise = normaliserUtilisateur(reponse.data.user);

        if (utilisateurNormalise) {
            localStorage.setItem('utilisateur', JSON.stringify(utilisateurNormalise));
        }

        return {
            ...reponse.data,
            user: utilisateurNormalise
        };
    },

    // Retourne l'utilisateur depuis le stockage local
    getUtilisateur() {
        const utilisateur = localStorage.getItem('utilisateur');

        if (!utilisateur) {
            return null;
        }

        try {
            return JSON.parse(utilisateur);
        } catch (error) {
            return null;
        }
    },

    // Retourne le token stocke localement
    getToken() {
        return localStorage.getItem('token');
    },

    // Verifie si un token existe
    estConnecte() {
        return !!localStorage.getItem('token');
    },

    // Supprime le token et l'utilisateur du stockage local
    clear() {
        localStorage.removeItem('token');
        localStorage.removeItem('utilisateur');
    }
};

export default authService;
