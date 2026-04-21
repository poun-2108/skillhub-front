// @author MU202605
// Tests du service d'authentification

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock pour Laravel (uploadPhoto)
const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        post: vi.fn(),
        get: vi.fn(),
    },
}));

// Mock pour SpringBoot (login, register, profile, logout)
const { authApiMock } = vi.hoisted(() => ({
    authApiMock: {
        post: vi.fn(),
        get: vi.fn(),
    },
}));

vi.mock("./axiosConfig", () => ({
    default: apiMock,
}));

vi.mock("./authApiConfig", () => ({
    default: authApiMock,
}));

import authService from "./authService";

describe("authService", () => {
    beforeEach(() => {
        apiMock.post.mockReset();
        apiMock.get.mockReset();
        authApiMock.post.mockReset();
        authApiMock.get.mockReset();
        localStorage.clear();
    });

    it("register appelle SpringBoot puis connecte l'utilisateur automatiquement", async () => {
        authApiMock.post
            .mockResolvedValueOnce({ data: { message: "Inscription reussie" } })
            .mockResolvedValueOnce({ data: { email: "a@test.com", nonce: "n", timestamp: 1, hmac: "h" } })
            .mockResolvedValueOnce({ data: { token: "jwt-token", user: { name: "Alice" } } });

        const result = await authService.register("Alice", "a@test.com", "pwd", "pwd", "apprenant");

        expect(authApiMock.post).toHaveBeenNthCalledWith(1, "/register", {
            name: "Alice",
            email: "a@test.com",
            password: "pwd",
            role: "apprenant",
        });
        expect(result.user.nom).toBe("Alice");
        expect(localStorage.getItem("token")).toBe("jwt-token");
    });

    it("register retourne user null si la connexion automatique echoue", async () => {
        authApiMock.post
            .mockResolvedValueOnce({ data: { message: "ok" } })
            .mockRejectedValueOnce(new Error("login failed"));

        const result = await authService.register("Alice", "a@test.com", "pwd", "pwd", "apprenant");

        expect(result.user).toBeNull();
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("register retourne user null si le serveur renvoie une erreur", async () => {
        authApiMock.post.mockResolvedValueOnce({ data: { error: "Email deja utilise" } });

        const result = await authService.register("Alice", "a@test.com", "pwd", "pwd", "apprenant");

        expect(result.user).toBeNull();
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("login appelle client-proof puis login sur SpringBoot", async () => {
        authApiMock.post
            .mockResolvedValueOnce({ data: { nonce: "n", timestamp: 1, hmac: "h" } })
            .mockResolvedValueOnce({ data: { token: "jwt-login", user: { name: "Bob" } } });

        const result = await authService.login("b@test.com", "pwd");

        expect(authApiMock.post).toHaveBeenNthCalledWith(1, "/client-proof", {
            email: "b@test.com",
            password: "pwd",
        });
        expect(authApiMock.post).toHaveBeenNthCalledWith(2, "/login", {
            email: "b@test.com",
            nonce: "n",
            timestamp: 1,
            hmac: "h",
        });
        expect(result.user.nom).toBe("Bob");
        expect(localStorage.getItem("token")).toBe("jwt-login");
    });

    it("login sans token ne sauvegarde pas en local", async () => {
        authApiMock.post
            .mockResolvedValueOnce({ data: { nonce: "n", timestamp: 1, hmac: "h" } })
            .mockResolvedValueOnce({ data: {} });

        const result = await authService.login("b@test.com", "pwd");

        expect(result.user).toBeNull();
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("profile appelle /me sur SpringBoot et normalise l'utilisateur", async () => {
        authApiMock.get.mockResolvedValue({
            data: { user: { name: "Charlie" } },
        });

        const result = await authService.profile();

        expect(authApiMock.get).toHaveBeenCalledWith("/me");
        expect(result.user.nom).toBe("Charlie");
    });

    it("profile retourne user null si le backend ne renvoie pas d'utilisateur", async () => {
        authApiMock.get.mockResolvedValue({ data: {} });

        const result = await authService.profile();

        expect(result.user).toBeNull();
    });

    it("logout appelle /logout sur SpringBoot et supprime la session locale", async () => {
        localStorage.setItem("token", "x");
        localStorage.setItem("utilisateur", "{}");
        authApiMock.post.mockResolvedValue({ data: { message: "ok" } });

        await authService.logout();

        expect(authApiMock.post).toHaveBeenCalledWith("/logout", {});
        expect(localStorage.getItem("token")).toBeNull();
        expect(localStorage.getItem("utilisateur")).toBeNull();
    });

    it("uploadPhoto envoie un FormData a Laravel et normalise l'utilisateur", async () => {
        const fakeFile = new File(["a"], "photo.jpg", { type: "image/jpeg" });
        apiMock.post.mockResolvedValue({ data: { user: { nom: "Dana" } } });

        const result = await authService.uploadPhoto(fakeFile);

        expect(apiMock.post).toHaveBeenCalledWith(
            "/profil/photo",
            expect.any(FormData),
            { headers: { "Content-Type": "multipart/form-data" } }
        );
        expect(result.user.name).toBe("Dana");
    });

    it("uploadPhoto sans user dans la reponse retourne user null", async () => {
        const fakeFile = new File(["a"], "photo.jpg", { type: "image/jpeg" });
        apiMock.post.mockResolvedValue({ data: {} });

        const result = await authService.uploadPhoto(fakeFile);

        expect(result.user).toBeNull();
        expect(localStorage.getItem("utilisateur")).toBeNull();
    });

    it("retourne null si utilisateur local absent ou invalide", () => {
        expect(authService.getUtilisateur()).toBeNull();

        localStorage.setItem("utilisateur", "not-json");
        expect(authService.getUtilisateur()).toBeNull();
    });

    it("retourne l'utilisateur local si le JSON est valide", () => {
        localStorage.setItem("utilisateur", JSON.stringify({ nom: "Eva" }));
        expect(authService.getUtilisateur()).toEqual({ nom: "Eva" });
    });

    it("retourne le token et l'etat de connexion", () => {
        expect(authService.estConnecte()).toBe(false);

        localStorage.setItem("token", "abc");
        expect(authService.getToken()).toBe("abc");
        expect(authService.estConnecte()).toBe(true);
    });

    it("clear vide le stockage local", () => {
        localStorage.setItem("token", "abc");
        localStorage.setItem("utilisateur", "{}");

        authService.clear();

        expect(localStorage.getItem("token")).toBeNull();
        expect(localStorage.getItem("utilisateur")).toBeNull();
    });
});
