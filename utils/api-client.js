import fetch from "node-fetch";

export default class APIClient {
    constructor(config) {
        this.baseURL = config.baseURL || "";
    }

    async fetchUserData(authToken) {
        try {
            const response = await fetch(`${this.baseURL}/api/users/me`, {
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
            console.error("Failed to fetch user data:", error);
            throw error;
        }
    }
}
