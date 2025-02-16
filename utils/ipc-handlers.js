import { ipcMain, BrowserWindow } from "electron";

import TMan from "./tman.js";

import APIClient from "./api-client.js";

const api = new APIClient({
    baseURL: process.env.API_URL,
});

export default (mainWindow) => {
    ipcMain.handle("start-auth", async () => {
        let token = await TMan.loadToken();
        if (token) { // If token is already there.
            // TODO: Check if token is valid through an API call
            try {
                const userData = await api.fetchUserData(token);

                mainWindow.loadFile("./static/index.html");
                return;
            } catch (error) {
                console.error("Failed to verify token:", error);
                TMan.clearToken();
            }
        }

        const win = new BrowserWindow({
            width: 650,
            height: 900,
            webPreferences: {
                partition: "authWindow",
            },
        });

        win.loadURL(process.env.AUTH_URL);

        // Intercept navigation before it happens
        win.webContents.on("will-navigate", (event, url) => {
            const regex = /localhost/;
            if (regex.test(url)) {
                event.preventDefault(); // Prevent the navigation to example.com
                win.close();

                url = new URL(url);
                token = url.searchParams.get("token");
                TMan.saveToken(token);

                mainWindow.loadFile("./static/index.html");
            }
        });
    });

    ipcMain.handle("get-users-me", async () => {
        const token = await TMan.loadToken();
        if (!token) {
            throw new Error("No token found");
        }

        return await api.fetchUserData(token);
    });
};
