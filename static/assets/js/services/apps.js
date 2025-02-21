const appsState = new Map();

async function appDetails(appId) {
    const app = appsState.get(appId);
    if (!app) throw new Error("App not found.");

    if (!app?.details) {
        app.details = await window.electron.apps.details(appId);
        appsState.set(appId, app);
    }

    const supportedPlatforms = Object.keys(app.details.archives).join(", ");

    new LuxModal({
        width: "w-xl",
        title: app.name,
        content: `
            <p>${app.details.description}</p>
            <p class="mt-6 text-xs">Latest version tag: ${app.details.latest_tag}<br>Supported platforms: ${supportedPlatforms}<br>App ID: ${app.appId}</p>
            `,
        buttons: app.isInstalled
            ? [
                  {
                      text: "Uninstall",
                      class: "bg-red-600/60 text-white",
                      action: async function () {
                          try {
                              this.close();
                              uninstallApp(appId);
                          } catch (error) {
                              console.error("Failed to uninstall app:", error);
                              // You might want to show an error message to the user
                          }
                      },
                  },
                  {
                      text: "Play",
                      class: "bg-button-background text-button-foreground",
                      action: async function () {
                          try {
                              await window.electron.apps.launch(appId);
                              this.close();
                          } catch (error) {
                              console.error("Failed to launch app:", error);
                              // You might want to show an error message to the user
                          }
                      },
                  },
              ]
            : [
                  {
                      text: "Install",
                      class: "bg-blue-600/60 text-white",
                      action: async function () {
                          await installApp(appId);
                          this.close();
                      },
                  },
              ],
    });
}

async function updateAppsList() {
    const appsList = document.getElementById("apps-list");
    
    const apps = await window.electron.apps.list();
    appsList.innerHTML = "";

    let appsHTML = "";
    apps.forEach((app) => {
        appsState.set(app.appId, app);
        appsHTML += `
            <div class="bg-alt-background-plain w-sm h-40 flex flex-col justify-between p-4 rounded-xl">
                <h3 class="text-3xl font-medium">${app.name}</h3>
                <div class="flex ml-auto gap-6">
                    <button onclick="appDetails('${
                        app.appId
                    }')" class="text-button-background underline cursor-pointer">Details</button>
                    ${
                        app.isInstalled
                            ? `<button onclick="launchApp('${app.appId}')" class="bg-button-background text-button-foreground rounded-xl px-12 py-2 cursor-pointer">Play</button>`
                            : `<button onclick="appDetails('${app.appId}')" class="bg-blue-600/60 text-white rounded-xl px-12 py-2 cursor-pointer">Install</button>`
                    }
                </div>
            </div>
        `;
    });
    appsList.innerHTML = appsHTML;
}

async function installApp(appId) {
    const app = appsState.get(appId);

    try {
        const installing = new LuxToast({
            indefinite: true,
            title: `Installing ${app.name}`,
            content: "This might take a while...",
        });
        await window.electron.apps.install(appId, (progress) => {
            installing.progress = progress;
            // progressValue.textContent = Math.round(progress);
        });

        installing.close();
        app.isInstalled = true;
        appsState.set(appId, app);
        await updateAppsList();

        new LuxToast({
            title: "Installation successfull!",
            content: `Finished installing ${app.name} (${app.details.latest_tag})`,
        });
    } catch (error) {
        console.error("Failed to install app:", error);
        progressDiv.classList.add("hidden");
        // You might want to show an error message to the user
    }
}

async function uninstallApp(appId) {
    const app = appsState.get(appId);

    await window.electron.apps.uninstall(appId);
    app.isInstalled = false;
    appsState.set(appId, app);
    await updateAppsList();

    new LuxToast({
        title: `Uninstalled ${app.name}`,
    });
}

async function launchApp(appId) {
    try {
        await window.electron.apps.launch(appId);
    } catch (error) {
        console.error("Failed to launch app:", error);
        // You might want to show an error message to the user
    }
}

// Optional: Add file verification functionality
async function verifyApp(appId) {
    try {
        const result = await window.electron.apps.verify(appId);
        return result;
    } catch (error) {
        console.error("Failed to verify app files:", error);
        return false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const games = await window.electron.apps.list();
        console.log(games);
        console.log(games);
        await updateAppsList();
    } catch (error) {
        console.error("Failed to initialize app list:", error);
        // You might want to show an error message to the user
    }
});
