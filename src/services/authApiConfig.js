// @author MU202605
// Client Axios pour le service d'authentification SpringBoot

import axios from "axios";

// URL du service auth, configurable via variable d'environnement
const authApi = axios.create({
    baseURL: import.meta.env.VITE_AUTH_API_URL || "http://localhost:8000/api/auth",
    headers: {
        "Content-Type": "application/json",
    },
});

// Ajoute le token JWT dans chaque requete si disponible
authApi.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Gestion des erreurs de reponse
authApi.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        // Nettoyer la session si le token est expire ou invalide
        if (status === 401) {
            const tokenExistait = !!localStorage.getItem("token");
            if (tokenExistait) {
                localStorage.removeItem("token");
                localStorage.removeItem("utilisateur");
                window.location.href = "/";
            }
        }

        return Promise.reject(error);
    }
);

export default authApi;
