// Token Manager (TMan)

import fs from "fs/promises";
import crypto from "crypto";
import os from "os";
import path from "path";

import { app } from "electron";

const TMAN_DIR = path.join(app.getPath("userData"), "TMan");

// If TMAN_DIR does not exist, create it
try {
    await fs.stat(TMAN_DIR);
} catch (err) {
    await fs.mkdir(TMAN_DIR);
}

// Paths for persistent storage
const TOKEN_PATH = path.join(TMAN_DIR, "token.lux");
const INSTALL_ID_PATH = path.join(TMAN_DIR, "install_id.lux");

let _currentToken = "";

// Returns the device-specific encryption key
async function getDeviceKey() {
    const installId = await loadOrCreateInstallId();
    const keyComponents = [installId, os.hostname(), os.platform(), os.arch()];
    return crypto
        .createHash("sha256")
        .update(keyComponents.join(""))
        .digest("hex");
}

// Creates or loads the unique installation ID
async function loadOrCreateInstallId() {
    try {
        const data = await fs.readFile(INSTALL_ID_PATH, "utf8");
        return data.trim();
    } catch {
        const newId = crypto.randomBytes(16).toString("hex");
        await fs.writeFile(INSTALL_ID_PATH, newId, "utf8");
        return newId;
    }
}

// Basic XOR encryption using the device key
function encryptData(data, key) {
    const dataBuffer = Buffer.from(data, "utf8");
    const keyBuffer = Buffer.from(key, "utf8");
    return Buffer.from(
        dataBuffer.map((byte, i) => byte ^ keyBuffer[i % keyBuffer.length])
    );
}

// Decrypt data using the same device key
function decryptData(encryptedData, key) {
    const keyBuffer = Buffer.from(key, "utf8");
    const decryptedBuffer = Buffer.from(
        encryptedData.map((byte, i) => byte ^ keyBuffer[i % keyBuffer.length])
    );
    return decryptedBuffer.toString("utf8");
}

// Save token with timestamp
async function saveToken(jwtToken) {
    _currentToken = jwtToken;
    const saveData = {
        token: jwtToken,
        timestamp: Math.floor(Date.now() / 1000),
        deviceId: os.hostname(),
    };

    const jsonString = JSON.stringify(saveData);
    const deviceKey = await getDeviceKey();
    const encryptedData = encryptData(jsonString, deviceKey);
    await fs.writeFile(TOKEN_PATH, encryptedData);
}

// Load and validate token
async function loadToken() {
    if (_currentToken) return _currentToken;
    try {
        const deviceKey = await getDeviceKey();
        const encryptedData = await fs.readFile(TOKEN_PATH);
        const decryptedJson = decryptData(encryptedData, deviceKey);
        const json = JSON.parse(decryptedJson);

        if (!validateTokenData(json)) {
            await clearToken();
            return "";
        }

        _currentToken = json.token;
        return _currentToken;
    } catch {
        return "";
    }
}

// Validate token data
function validateTokenData(json) {
    return json.token && json.timestamp && json.deviceId === os.hostname();
}

// Clear token
async function clearToken() {
    _currentToken = "";
    try {
        await fs.unlink(TOKEN_PATH);
    } catch {}
}

// Get current token
function getCurrentToken() {
    return _currentToken;
}

export default { saveToken, loadToken, clearToken, getCurrentToken };
