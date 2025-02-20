import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import fetch from "node-fetch";
import unzipper from "unzipper";
import { spawn } from "node:child_process";
import { platform, arch } from 'node:os';

import AppIPCServer from "./app-ipc-server";

const platformString = `${platform()}-${arch()}`;

const AppIPC = new AppIPCServer()

export default class GameManager {
    constructor(libraryApiUrl, installDir) {
        this.libraryApiUrl = libraryApiUrl;
        this.installDir = installDir;
        this.installedGamesFile = path.join(
            this.installDir,
            "installed_games.json"
        );
        this.ipcServers = new Map();
    }

    async fetchGameLibrary() {
        const response = await fetch(`${this.libraryApiUrl}/api/apps`);
        if (!response.ok) throw new Error("Failed to fetch game library");
        return response.json();
    }

    async fetchGameDetails(uid) {
        const response = await fetch(`${this.libraryApiUrl}/api/apps/${uid}`);
        if (!response.ok)
            throw new Error(`Failed to fetch details for game ${uid}`);
        return response.json();
    }

    async installGame(
        uid,
        installPath = this.installDir,
        onProgress = () => {}
    ) {
        const game = await this.fetchGameDetails(uid);
        const gamePath = path.join(installPath, uid);
        await fs.mkdir(gamePath, { recursive: true });
        const zipPath = path.join(gamePath, "game.zip");

        const archiveUrl = game.archives[platformString];

        if (!archiveUrl) {
            throw new Error("Platform unsupported");
        }

        console.log(`Downloading ${game.repo.url}...`);
        const response = await fetch(game.repo.url);
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
        if (fileHash !== game.repo.hash)
            throw new Error("Downloaded file hash mismatch!");

        console.log("Extracting game files...");
        await fs
            .createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: gamePath }))
            .promise();
        await fs.unlink(zipPath);

        console.log(`Installed ${game.name} successfully.`);
        await this.saveInstalledGame(uid, game, installPath);
    }

    async uninstallGame(uid) {
        const installedGames = await this.getInstalledGames();
        if (!installedGames[uid]) throw new Error("Game not installed");
        await fs.rm(installedGames[uid].installPath, {
            recursive: true,
            force: true,
        });
        delete installedGames[uid];
        await this.saveInstalledGames(installedGames);
        console.log(`Uninstalled ${uid}`);
    }

    async checkForUpdates(uid) {
        const game = await this.fetchGameDetails(uid);
        const installedGames = await this.getInstalledGames();
        if (!installedGames[uid]) throw new Error("Game not installed");
        return game.repo.tag !== installedGames[uid].version;
    }

    async verifyGameFiles(uid) {
        const installedGames = await this.getInstalledGames();
        if (!installedGames[uid]) throw new Error("Game not installed");
        const game = await this.fetchGameDetails(uid);
        const gamePath = installedGames[uid].installPath;

        console.log("Verifying game files...");
        const computedHash = await this.computeDirectoryHash(gamePath);
        return computedHash === game.repo.hash;
    }

    async launchGame(uid, authToken) {
        const installedGames = await this.getInstalledGames();
        if (!installedGames[uid]) throw new Error("Game not installed");
        const binaryPath = path.join(
            installedGames[uid].installPath,
            installedGames[uid].binaryPath
        );
        console.log(`Launching game: ${binaryPath}`);

        const gameProcess = spawn(binaryPath, {
            detached: true,
            stdio: "ignore",
        });
        gameProcess.unref();

        this.setupIPC(uid, authToken);
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

    async saveInstalledGame(uid, game, installPath) {
        const installedGames = await this.getInstalledGames();
        installedGames[uid] = {
            name: game.name,
            version: game.repo.tag,
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
        const stream = fs.createReadStream(filePath);
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