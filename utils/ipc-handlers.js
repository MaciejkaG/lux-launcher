import { ipcMain, BrowserWindow } from "electron";

import TMan from "./tman.js";

export default (mainWindow) => {
    ipcMain.handle("start-auth", async () => {
        if (await TMan.loadToken()) { // If token is already there.
            // TODO: Check if token is valid through an API call
            mainWindow.loadFile("./static/index.html");
            return;
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

                url = new URL("http://localhost:22277/?token=mytoken");
                const token = url.searchParams.get("token");
                TMan.saveToken(token);

                mainWindow.loadFile("./static/index.html");
            }
        });
    });
};
