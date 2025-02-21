import { ipcMain, BrowserWindow, dialog } from "electron";

import TMan from "./tman.js";

import APIClient from "./api-client.js";
import AppManager from "./app-manager.js";
import WebSocketClient from "./event-listener.js";

const api = new APIClient({
    baseURL: process.env.API_URL,
});

const wsc = new WebSocketClient();
wsc.setPresence("lux");

const apps = new AppManager(process.env.API_URL, "/home/maciej/Desktop/lux-games");

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
                if (error.code === "ECONNREFUSED") {
                    dialog.showErrorBox("Connection error", "Couldn't connect to Lux servers. Please check your internet connection status and try again later.");
                    return;
                }
                console.error("Failed to verify token:", error);
                TMan.clearToken();
            }
        }

        // Open login window
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
            mainWindow.loadFile("./static/landing.html");
            console.error("No token found");
        }

        try {
            // Try to fetch user's profile (if it fails, the token is invalid)
            await api.fetchUserData(token);
        } catch (error) {
            if (error?.status === 401) {
                TMan.clearToken();
                mainWindow.loadFile("./static/landing.html");
                console.error("Token expired: ", error);
            }

            throw error;
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

    ipcMain.handle("add-friend", async (event, username) => {
        const token = await requireToken();

        return await api.addFriend(token, username);
    });

    ipcMain.handle("remove-friend", async (event, pubId) => {
        const token = await requireToken();

        return await api.removeFriend(token, pubId);
    });

    // App library
    ipcMain.handle("get-library", async () => {
        return await apps.listApps();
    });

    ipcMain.handle("get-app", async (event, appId) => {
        return await apps.fetchAppDetails(appId);
    });

    ipcMain.handle("install-app", async (event, appId) => {
        return await apps.install(appId, (progress) => {
            event.sender.send(`install-progress-${appId}`, progress);
        });
    });

    ipcMain.handle("uninstall-app", async (event, appId) => {
        return await apps.uninstall(appId);
    });

    ipcMain.handle("launch-app", async (event, appId) => {
        const token = await requireToken();

        await apps.launch(appId, token);
        return;
    });

    ipcMain.handle("verify-app", async (event, appId) => {
        return await apps.verifyFiles(appId);
    });

    // WebSocket events handling
    wsc.on("friend_request", (friend) => {
        mainWindow.webContents.send("ws-friend_request", friend);
    });
};
