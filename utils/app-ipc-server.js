import { WebSocketServer } from "ws";
import EventEmitter from "eventemitter3";

const port = 33472; // The official Lux API port

export default class AppIPCServer extends EventEmitter {
    constructor() {
        if (AppIPCServer.instance) return AppIPCServer.instance;

        super();
        AppIPCServer.instance = this;

        this.server = null;
        this.client = null;
    }

    async start() {
        if (this.server) {
            console.warn("[WS] Server is already running");
            return port;
        }

        return new Promise((resolve, reject) => {
            this.server = new WebSocketServer({
                host: "127.0.0.1",
                port: port,
            });

            this.server.on("listening", () => {
                console.log(
                    `[WS] Server started on ws://127.0.0.1:${port}`
                );
                resolve(port);
            });

            this.server.on("connection", (ws, req) => {
                if (this.client) {
                    console.warn(
                        `[WS] Rejecting additional connection from ${req.socket.remoteAddress}`
                    );
                    ws.close();
                    return;
                }

                console.log(
                    `[WS] Client connected from ${req.socket.remoteAddress}`
                );
                this.client = ws;

                ws.on("message", (message) => {
                    try {
                        const parsed = JSON.parse(message);
                        if (parsed.subject && parsed.data) {
                            this.emit(`message:${parsed.subject}`, parsed.data);
                        } else {
                            console.warn(
                                "[WS] Received invalid message format"
                            );
                        }
                    } catch (err) {
                        console.error("[WS] Failed to parse message:", err);
                    }
                });

                ws.on("close", () => {
                    console.log("[WS] Client disconnected");
                    this.client = null;
                    this.stop(); // Auto-shutdown after client disconnects
                });

                ws.on("error", (err) =>
                    console.error("[WS] Client error:", err)
                );
            });

            this.server.on("error", (err) => {
                console.error("[WS] Server error:", err);
                reject(err);
            });
        });
    }

    send(subject, data = {}) {
        if (this.client && this.client.readyState === 1) {
            this.client.send(JSON.stringify({ subject, data }));
        }
    }

    stop() {
        if (this.server) {
            console.log("[WS] Server shutting down");
            this.removeAllListeners();
            this.server.close();
            this.server = null;
            this.client = null;
        }
    }
}
