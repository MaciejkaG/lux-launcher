import 'dotenv/config';

import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";
import initHandlers from "./utils/ipc-handlers.js";

import packageData from "./package.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIN_WIDTH = 1400;
const WIN_HEIGHT = 800;

// modify your existing createWindow() function
const mainWindow = () => {
    console.log(app.getPath('userData'))
    const mainWindow = new BrowserWindow({
        minWidth: WIN_WIDTH,
        minHeight: WIN_HEIGHT,
        width: WIN_WIDTH,
        height: WIN_HEIGHT,

        webPreferences: {
            preload: path.join(__dirname, "main-preload.js"),
        },

        center: true,

        autoHideMenuBar: true,

        title: `Lux Launcher v${packageData.version}`,
    });

    initHandlers(mainWindow);

    mainWindow.loadFile("./static/landing.html");
};

app.whenReady().then(() => {
    mainWindow();
});