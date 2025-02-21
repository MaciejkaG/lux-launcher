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
        buttons: app.installed
            ? [
                  {
                      text: "Uninstall",
                      class: "bg-red-600/60 text-white",
                      action: function () {
                          this.close();
                      },
                  },
                  {
                      text: "Play",
                      class: "bg-button-background text-button-foreground",
                      action: async function () {
                          this.close();
                      },
                  },
              ]
            : [
                  {
                      text: "Install",
                      class: "bg-blue-600/60 text-white",
                      action: async function () {
                          this.close();
                      },
                  },
              ],
    });
}

async function updateAppsList() {
    const appsList = document.getElementById("apps-list");
    appsList.innerHTML = "";
    let appsHTML = "";

    const apps = await window.electron.apps.list();
    apps.forEach((app) => {
        appsState.set(app.appId, app);
        // TODO: On details click, call appDetails(app) with the app data as an argument.
        appsHTML += `
            <div class="bg-alt-background-plain w-sm h-40 flex flex-col justify-between p-4 rounded-xl">
                <h3 class="text-3xl font-medium">${app.name}</h3>
                <div class="flex ml-auto gap-6">
                    <button onclick="appDetails('${app.appId}')" class="text-button-background underline cursor-pointer">Details</button>
                    ${
                        app.installed
                            ? '<button class="bg-button-background text-button-foreground rounded-xl px-12 py-2 cursor-pointer">Play</button>'
                            : '<button class="bg-blue-600/60 text-white rounded-xl px-12 py-2 cursor-pointer">Install</button>'
                    }
                </div>
            </div>
        `;
    });
    appsList.innerHTML = appsHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
    const games = await window.electron.apps.list();
    console.log(games);
    updateAppsList();
});
