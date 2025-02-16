import { ipcMain, BrowserWindow } from "electron";

import TMan from "./tman.js";

import APIClient from "./api-client.js";
import WebSocketClient from "./event-listener.js";

const api = new APIClient({
    baseURL: process.env.API_URL,
});

const wsc = new WebSocketClient();
wsc.setPresence("lux");

export default (mainWindow) => {
    ipcMain.handle("start-auth", async () => {
        let token = await TMan.loadToken();
        if (token) {
            // If token is already there.
            // TODO: Check if token is valid through an API call
            try {
                // Try to fetch user's profile (if it fails, the token is invalid)
                await api.fetchUserData(token);

                mainWindow.loadFile("./static/index.html");
                wsc.authToken = token;
                wsc.connect();
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
                wsc.authToken = token;
                wsc.connect();
            }
        });
    });

    const requireToken = async () => {
        const token = await TMan.loadToken();
        if (!token) {
            throw new Error("No token found");
        }

        return token;
    };

    // Users
    ipcMain.handle("get-users-me", async () => {
        const token = await requireToken();

        return await api.fetchUserData(token);
    });

    // Friends
    ipcMain.handle("get-friendslist", async () => {
        const token = await requireToken();

        return await api.fetchUserFriends(token);
    });

    ipcMain.handle("get-friends-presence", () => {
        return wsc.getPresence();
    });

    wsc.on("friend_request", (friend) => {
        mainWindow.webContents.send("ws-friend_request", friend);
    });
};
