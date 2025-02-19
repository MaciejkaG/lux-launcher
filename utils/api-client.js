import fetch from "node-fetch";

export default class APIClient {
    constructor(config) {
        this.baseURL = config.baseURL || "";
    }

    async _get(path, authToken = null) {
        try {
            const response = await fetch(this.baseURL + path, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken && {
                        Authorization: `Bearer ${authToken}`,
                    }),
                },
            });

            if (!response.ok) {
                throw new Error(
                    `API Error: ${response.status} ${response.statusText}`
                );
            }

            return await response.json();
        } catch (error) {
            console.error("GET request failed:", error);
            throw error;
        }
    }

    async _post(path, authToken = null, payload = {}) {
        try {
            const response = await fetch(this.baseURL + path, {
                method: "POST",
                body: JSON.stringify(payload),
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken && {
                        Authorization: `Bearer ${authToken}`,
                    }),
                },
            });

            if (!response.ok) {
                throw new Error(
                    `API Error: ${response.status} ${response.statusText}`,
                    {
                        status: response.status,
                    }
                );
            }

            return await response.text();
        } catch (error) {
            console.error("POST request failed:", error);
            throw error;
        }
    }

    async fetchUserData(authToken) {
        return await this._get("/users/me", authToken);
    }

    async fetchUserFriends(authToken) {
        return await this._get("/friends", authToken);
    }

    async addFriend(authToken, friendUsername) {
        return await this._post("/friends/add", authToken, {
            friend_username: friendUsername,
        });
    }

    async removeFriend(authToken, friendPubId) {
        return await this._post("/friends/remove", authToken, {
            friend_public_id: friendPubId,
        });
    }
}
