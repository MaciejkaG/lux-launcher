import axios from "axios";
import os from "node:os";
import packageJson from "../package.json" with { type: "json" };

const ax = axios.create({
    baseURL: process.env.API_URL,
    timeout: 5000,
    headers: {
        "User-Agent": generateUserAgent(),
    }
});

class ApiError extends Error {
    constructor(status, statusText) {
        super(`API Error: ${status} ${statusText}`);
        this.status = status;
    }
}

export default class APIClient {
    constructor() {
    }

    async _get(path, authToken = null) {
        try {
            const response = await ax.get(path, {
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken && { Authorization: `Bearer ${authToken}` }),
                },
            });

            console.log({
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
            });

            return response.data;
        } catch (error) {
            console.error("GET request failed:", error);
            throw error;
        }
    }

    async _post(path, authToken = null, payload = {}) {
        try {
            const response = await ax.post(this.baseURL + path, payload, {
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken && { Authorization: `Bearer ${authToken}` }),
                    "User-Agent": generateUserAgent(),
                },
            });

            return response.data;
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

export function generateUserAgent(appName = packageJson.name, appVersion = packageJson.version) {
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();

    let osInfo;
    switch (platform) {
        case "win32":
            osInfo = `Windows NT ${release}`;
            break;
        case "darwin":
            osInfo = `Macintosh; Intel Mac OS X ${release.replace(/\./g, "_")}`;
            break;
        case "linux":
            osInfo = `X11; Linux ${arch}`;
            break;
        default:
            osInfo = `${platform} ${release}`;
    }

    return `${appName}/${appVersion} (${osInfo})`;
}