const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    auth: {
        start: () => ipcRenderer.invoke("start-auth"),
    },

    users: {
        me: async () => await ipcRenderer.invoke("get-users-me"),
    },
});
