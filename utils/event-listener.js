import WebSocket from "ws";
import { dialog } from "electron";
import EventEmitter from "eventemitter3";
import { generateUserAgent } from "./api-client.js";

export default class WebSocketClient extends EventEmitter {
    constructor(authToken) {
        if (WebSocketClient.instance) return WebSocketClient.instance;

        super();
        WebSocketClient.instance = this;

        this.ws = null;
        this.messageQueue = [];
        this.friendsPresence = {};
        this.reconnectInterval = 5000;
        this.authToken = authToken;
        this.presenceStatus = "lux";
    }

    connect() {
        if (this.ws) return;

        this.ws = new WebSocket(process.env.API_WEBSOCKET, {
            headers: {
                Authorization: `Bearer ${this.authToken}`,
                "User-Agent": generateUserAgent(),
            },
        });

        this.ws.on("open", () => {
            console.log("Connected to WebSocket server");
        });

        this.ws.on("message", (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (err) {
                console.error("Invalid JSON from WebSocket:", err);
            }
        });

        this.ws.on("close", (code, reason) => {
            switch (code) {
                case -1:
                    dialog.showErrorBox(
                        "WebSocket error",
                        "WebSocket server terminated the connection. Reason:\n\n" + reason
                    );
                    break;
                
                case 3000:
                    dialog.showErrorBox(
                        "WebSocket error",
                        "WebSocket server terminated the connection. Reason:\n\n" +
                            reason
                    );
                    break;
            
                default:
                    console.log(
                        "WebSocket disconnected. Attempting to reconnect..."
                    );
                    this.ws = null;
                    setTimeout(() => this.connect(), this.reconnectInterval);
                    break;
            }
        });

        this.ws.on("error", (err) => {
            if (err.code === "ECONNREFUSED") {
                dialog.showErrorBox(
                    "WebSocket connection error",
                    "Couldn't connect to Lux servers, please try again later."
                );
            } else {
                dialog.showErrorBox(
                    "WebSocket error",
                    "WebSocket error occured:\n\n" + err
                );
            }

            console.error("WebSocket error:", err);
        });
    }

    handleMessage(message) {
        switch (message?.event) {
            case "listening":
                // Send all pending messages
                this.messageQueue.forEach((message) => {
                    this.ws.send(message);
                });
                this.messageQueue.length = 0;

                // Set the previously defined presence
                this.send("presence_update", { status: this.presenceStatus });
                break;

            case "full_friend_presence":
                this.friendsPresence = {};
                message.data.forEach((friend) => {
                    this.friendsPresence[friend.friend_id] = {
                        online: friend.online,
                        status: friend.status,
                    };
                });
                break;

            case "friend_presence_update":
                if (this.friendsPresence[message.data.friend_id]) {
                    this.friendsPresence[message.data.friend_id].online =
                        message.data.online;
                    this.friendsPresence[message.data.friend_id].status =
                        message.data.status;
                } else {
                    this.friendsPresence[message.data.friend_id] = {
                        online: message.data.online,
                        status: message.data.status,
                    };
                }
                break;
            
            default:
                if (typeof message?.event !== "string") break;
                this.emit(message.event, message.data);
                break;
        }
    }

    send(action, data = {}, queue = true) {
        const content = JSON.stringify({ action, data });
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(content);
        } else if (queue) {
            this.messageQueue.push(content);
        }
    }

    setPresence(status) {
        this.presenceStatus = status;
        this.send("presence_update", { status }, false);
    }

    getPresence() {
        return this.friendsPresence;
    }
}
