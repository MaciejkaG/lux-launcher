import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import fetch from "node-fetch";
import unzipper from "unzipper";
import { spawn } from "node:child_process";
import { platform, arch } from 'node:os';
import { app } from 'electron';

import packageJson from "../package.json" with { type: "json" };

import AppIPCServer from "./app-ipc-server.js";

const platformString = `${platform()}-${arch()}`;

let baseInstallDir;
switch (platform()) {
    case "win32":
        baseInstallDir = path.join("C:", "Program Files", packageJson.name);
        break;

    case "darwin":
        baseInstallDir = path.join(app.getPath("home"), "Library/Application Support", packageJson.name, "apps");
        break;

    default:
        throw new Error(
            "Unsupported platform detected. Couldn't initialise the Game Library Manager."
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
        this.installedGamesFile = path.join(
            this.installDir,
            "installed_games.json"
        );
        this.ipcServers = new Map();
    }

    async fetchGameLibrary() {
        const response = await fetch(`${this.libraryApiUrl}/apps`, {
            method: "GET"
        });
        if (!response.ok) throw new Error("Failed to fetch game library");
        const responseJSON = await response.json();
        return responseJSON;
    }

    async fetchGameDetails(appId) {
        const response = await fetch(`${this.libraryApiUrl}/apps/${appId}`, {
            method: "GET"
        });
        if (!response.ok)
            throw new Error(`Failed to fetch details for game ${appId}`);
        return response.json();
    }

    async listApps(authToken) {
        const library = await this.fetchGameLibrary(authToken);
        const installedGames = await this.getInstalledGames();

        return library.map((game) => ({
            name: game.display_name,
            appId: game.app_id,
            isInstalled: !!installedGames[game.uid],
        }));
    }

    async install(
        appId,
        onProgress = () => {}
    ) {
        const game = await this.fetchGameDetails(appId);
        const gamePath = path.join(this.installDir, appId);
        await fs.mkdir(gamePath, { recursive: true });
        const zipPath = path.join(gamePath, "game.zip");

        const archive = game.archives[platformString];

        if (!archive) {
            throw new Error("Platform unsupported");
        }

        console.log(`Downloading ${archive.url}...`);
        const response = await fetch(archive.url);
        if (!response.ok) throw new Error("Failed to download game files");
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

        console.log("Extracting game files...");
        await 
            createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: gamePath }))
            .promise();
        await fs.unlink(zipPath);

        console.log(`Installed ${game.display_name} successfully.`);
        await this.saveInstalledGame(appId, game);
    }

    async uninstall(appId) {
        const installedGames = await this.getInstalledGames();
        if (!installedGames[appId]) throw new Error("Game not installed");
        await fs.rm(installedGames[appId].installPath, {
            recursive: true,
            force: true,
        });
        delete installedGames[appId];
        await this.saveInstalledGames(installedGames);
        console.log(`Uninstalled ${appId}`);
    }

    async checkForUpdates(appId) {
        const game = await this.fetchGameDetails(appId);
        const installedGames = await this.getInstalledGames();
        if (!installedGames[appId]) throw new Error("Game not installed");
        return game.latest_tag !== installedGames[appId].version;
    }

    async verifyGameFiles(appId) {
        const installedGames = await this.getInstalledGames();
        if (!installedGames[appId]) throw new Error("Game not installed");
        const game = await this.fetchGameDetails(appId);
        const gamePath = installedGames[appId].installPath;

        console.log("Verifying game files...");
        const computedHash = await this.computeDirectoryHash(gamePath);
        return computedHash === game.archives[platformString];
    }

    async launch(appId, authToken) {
        const installedGames = await this.getInstalledGames();
        if (!installedGames[appId]) throw new Error("Game not installed");
        const binaryPath = path.join(
            installedGames[appId].installPath,
            installedGames[appId].binaryPath
        );
        console.log(`Launching game: ${binaryPath}`);

        const gameProcess = spawn(binaryPath, {
            detached: true,
            stdio: "ignore",
        });
        gameProcess.unref();

        this.setupIPC(appId, authToken);
        return gameProcess;
    }

    async getInstalledGames() {
        try {
            const data = await fs.readFile(this.installedGamesFile, "utf-8");
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    async saveInstalledGame(appId, game) {
        const installPath = path.join(this.installDir, appId);
        const installedGames = await this.getInstalledGames();
        installedGames[appId] = {
            name: game.name,
            version: game.latest_tag,
            installPath,
            binaryPath: game.binaryPath,
        };
        await this.saveInstalledGames(installedGames);
    }

    async saveInstalledGames(installedGames) {
        await fs.writeFile(
            this.installedGamesFile,
            JSON.stringify(installedGames, null, 2)
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