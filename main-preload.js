const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    on: (channel, callback) => ipcRenderer.on(channel, callback),

    auth: {
        start: () => ipcRenderer.invoke("start-auth"),
    },

    users: {
        me: async () => await ipcRenderer.invoke("get-users-me"),
    },

    friends: {
        list: async () => await ipcRenderer.invoke("get-friendslist"),
        statuses: async () => await ipcRenderer.invoke("get-friends-presence"),
    },
});
