// @author MU202605
// Tests du client Axios pour le service d'authentification SpringBoot

import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const state = {
        requestOk: null,
        requestErr: null,
        responseOk: null,
        responseErr: null,
    };

    const authApiMock = {
        interceptors: {
            request: {
                use: vi.fn((onFulfilled, onRejected) => {
                    state.requestOk = onFulfilled;
                    state.requestErr = onRejected;
                }),
            },
            response: {
                use: vi.fn((onFulfilled, onRejected) => {
                    state.responseOk = onFulfilled;
                    state.responseErr = onRejected;
                }),
            },
        },
    };

    return {
        state,
        authApiMock,
        createMock: vi.fn(() => authApiMock),
    };
});

vi.mock("axios", () => ({
    default: {
        create: hoisted.createMock,
    },
}));

import authApi from "./authApiConfig";

describe("authApiConfig", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("cree une instance axios avec la baseURL du service auth", () => {
        expect(authApi).toBe(hoisted.authApiMock);
        expect(hoisted.createMock).toHaveBeenCalledWith({
            baseURL: "http://localhost:8000/api/auth",
            headers: {
                "Content-Type": "application/json",
            },
        });
    });

    it("ajoute le token Authorization quand un token est present", async () => {
        localStorage.setItem("token", "jwt-auth-token");

        const config = { headers: {} };
        const result = await hoisted.state.requestOk(config);

        expect(result.headers.Authorization).toBe("Bearer jwt-auth-token");
    });

    it("laisse la requete intacte si pas de token", async () => {
        const config = { headers: {} };
        const result = await hoisted.state.requestOk(config);

        expect(result.headers.Authorization).toBeUndefined();
    });

    it("propage l'erreur du request interceptor", async () => {
        const error = new Error("request failed");
        await expect(hoisted.state.requestErr(error)).rejects.toBe(error);
    });

    it("retourne la reponse directement en succes", () => {
        const payload = { data: { token: "abc" } };
        expect(hoisted.state.responseOk(payload)).toBe(payload);
    });

    it("nettoie la session sur erreur 401", async () => {
        localStorage.setItem("token", "t");
        localStorage.setItem("utilisateur", "{}");

        const error = { response: { status: 401 } };

        await expect(hoisted.state.responseErr(error)).rejects.toEqual(error);
        expect(localStorage.getItem("token")).toBeNull();
        expect(localStorage.getItem("utilisateur")).toBeNull();
    });

    it("ne nettoie pas si pas de token sur 401", async () => {
        const error = { response: { status: 401 } };

        await expect(hoisted.state.responseErr(error)).rejects.toEqual(error);
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("ne nettoie pas la session sur erreur hors 401", async () => {
        localStorage.setItem("token", "still-there");

        const error = { response: { status: 500 } };
        await expect(hoisted.state.responseErr(error)).rejects.toEqual(error);

        expect(localStorage.getItem("token")).toBe("still-there");
    });
});
