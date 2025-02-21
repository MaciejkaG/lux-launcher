import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import fetch from "node-fetch";
import unzipper from "unzipper";
import { spawn } from "node:child_process";
import { platform, arch } from "node:os";
import { app } from "electron";

import packageJson from "../package.json" with { type: "json" };

import AppIPCServer from "./app-ipc-server.js";

const platformString = `${platform()}-${arch()}`;

let baseInstallDir;
switch (platform()) {
    case "win32":
        baseInstallDir = path.join(
            process.env.LOCALAPPDATA,
            packageJson.name,
            "luxapps"
        );
        break;

    case "darwin":
        baseInstallDir = path.join(
            app.getPath("home"),
            "Library/Application Support",
            packageJson.name,
            "luxapps"
        );
        break;

    case "linux":
        baseInstallDir = path.join(
            process.env.HOME,
            "." + packageJson.name,
            "luxapps"
        );
        break;

    default:
        throw new Error(
            "Unsupported platform detected. Couldn't initialise the App Library Manager."
        );
}

fs.stat(baseInstallDir).catch(() => {
    fs.mkdir(baseInstallDir, { recursive: true });
});

const AppIPC = new AppIPCServer();

export default class AppManager {
    constructor(libraryApiUrl) {
        this.libraryApiUrl = libraryApiUrl;
        this.installDir = baseInstallDir;
        this.installedAppsFile = path.join(
            this.installDir,
            "installed_apps.json"
        );
        this.operationLock = null;
    }

    // Helper method to manage operation locks
    async withOperationLock(operationType, appId, operation) {
        if (this.operationLock) {
            throw new Error(
                `Another operation (${this.operationLock.type}) is in progress for app ${this.operationLock.appId}`
            );
        }

        this.operationLock = { type: operationType, appId };
        try {
            const result = await operation();
            return result;
        } finally {
            this.operationLock = null;
        }
    }

    async fetchAppLibrary() {
        const response = await fetch(`${this.libraryApiUrl}/apps`, {
            method: "GET",
        });
        if (!response.ok) throw new Error("Failed to fetch app library");
        const responseJSON = await response.json();
        return responseJSON;
    }

    async fetchAppDetails(appId) {
        const response = await fetch(`${this.libraryApiUrl}/apps/${appId}`, {
            method: "GET",
        });
        if (!response.ok)
            throw new Error(`Failed to fetch details for app ${appId}`);
        return response.json();
    }

    async listApps(authToken) {
        const library = await this.fetchAppLibrary(authToken);
        const installedApps = await this.getInstalledApps();

        return library.map((app) => ({
            name: app.display_name,
            appId: app.app_id,
            isInstalled: Object.keys(installedApps).includes(app.app_id),
        }));
    }

    async install(appId, onProgress = () => {}) {
        return this.withOperationLock("install", appId, async () => {
            const app = await this.fetchAppDetails(appId);
            const appPath = path.join(this.installDir, appId);
            await fs.mkdir(appPath, { recursive: true });
            const zipPath = path.join(appPath, "app.zip");

            const archive = app.archives[platformString];

            if (!archive) {
                throw new Error("Platform unsupported");
            }

            console.log(`Downloading ${archive.url}...`);
            const response = await fetch(archive.url);
            if (!response.ok) throw new Error("Failed to download app files");
            const totalSize = response.headers.get("content-length");
            let downloadedSize = 0;

            const fileStream = createWriteStream(zipPath);
            response.body.on("data", (chunk) => {
                downloadedSize += chunk.length;
                onProgress((downloadedSize / totalSize) * 100);
            });
            await pipeline(response.body, fileStream);

            console.log("Verifying file integrity...");
            const fileHash = await this.computeFileHash(zipPath);
            if (fileHash !== archive.hash)
                throw new Error("Downloaded file hash mismatch!");

            console.log("Extracting app files...");
            await createReadStream(zipPath)
                .pipe(unzipper.Extract({ path: appPath }))
                .promise();
            await fs.unlink(zipPath);

            console.log(`Installed ${app.display_name} successfully.`);
            await this.saveInstalledApp(appId, app);
        });
    }

    async uninstall(appId) {
        return this.withOperationLock("uninstall", appId, async () => {
            const installedApps = await this.getInstalledApps();
            if (!installedApps[appId]) throw new Error("App not installed");
            await fs.rm(installedApps[appId].installPath, {
                recursive: true,
                force: true,
            });
            delete installedApps[appId];
            await this.saveInstalledApps(installedApps);
            console.log(`Uninstalled ${appId}`);
        });
    }

    async checkForUpdates(appId) {
        return this.withOperationLock("checkForUpdates", appId, async () => {
            const app = await this.fetchAppDetails(appId);
            const installedApps = await this.getInstalledApps();
            if (!installedApps[appId]) throw new Error("App not installed");
            return app.latest_tag !== installedApps[appId].version;
        });
    }

    async verifyFiles(appId) {
        return this.withOperationLock("verify", appId, async () => {
            const installedApps = await this.getInstalledApps();
            if (!installedApps[appId]) throw new Error("App not installed");
            const app = await this.fetchAppDetails(appId);
            const appPath = installedApps[appId].installPath;

            console.log("Verifying app files...");
            const computedHash = await this.computeDirectoryHash(appPath);
            return computedHash === app.archives[platformString];
        });
    }

    async launch(appId, authToken) {
        return this.withOperationLock("launch", appId, async () => {
            const installedApps = await this.getInstalledApps();
            if (!installedApps[appId]) throw new Error("App not installed");
            const binaryPath = path.join(
                installedApps[appId].installPath,
                installedApps[appId].binaryPath
            );
            console.log(`Launching app: ${binaryPath}`);

            const appProcess = spawn(binaryPath, {
                detached: true,
                stdio: "ignore",
            });
            appProcess.unref();

            setupIPC(authToken);

            appProcess.on("close", () => {
                AppIPC.stop();
            });

            return appProcess;
        });
    }

    async getInstalledApps() {
        try {
            const data = await fs.readFile(this.installedAppsFile, "utf-8");
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    async saveInstalledApp(appId, app) {
        const installPath = path.join(this.installDir, appId);
        const installedApps = await this.getInstalledApps();

        const archive = app.archives[platformString];
        if (!archive) {
            throw new Error(
                "Couldn't save installed app data, platform unsupported"
            );
        }

        installedApps[appId] = {
            name: app.name,
            version: app.latest_tag,
            installPath,
            binaryPath: archive.binaryPath,
        };
        await this.saveInstalledApps(installedApps);
    }

    async saveInstalledApps(installedApps) {
        await fs.writeFile(
            this.installedAppsFile,
            JSON.stringify(installedApps, null, 2)
        );
    }

    async computeFileHash(filePath) {
        const hash = crypto.createHash("sha256");
        const stream = createReadStream(filePath);
        for await (const chunk of stream) hash.update(chunk);
        return hash.digest("hex");
    }

    async computeDirectoryHash(dirPath) {
        const files = await fs.readdir(dirPath, { recursive: true });
        const hash = crypto.createHash("sha256");
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            if ((await fs.stat(filePath)).isFile()) {
                hash.update(await this.computeFileHash(filePath));
            }
        }
        return hash.digest("hex");
    }
}

function setupIPC(authToken) {
    AppIPC.start();
    AppIPC.on("message:token", () => {
        AppIPC.send("token", { token: authToken });
    });
}
