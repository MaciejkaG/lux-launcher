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

        add: async (username) =>
            await ipcRenderer.invoke("add-friend", username),
        remove: async (publicId) =>
            await ipcRenderer.invoke("remove-friend", publicId),
    },

    apps: {
        list: async () => await ipcRenderer.invoke("get-library"),
        details: async (appId) => await ipcRenderer.invoke("get-app", appId),

        install: async (appId, onProgress) => {
            ipcRenderer.on(`install-progress-${appId}`, (event, progress) => {
                onProgress(progress);
            });
            return await ipcRenderer.invoke("install-app", appId);
        },
    },
});
