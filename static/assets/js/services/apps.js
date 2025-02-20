function appDetails(installed) {
    new LuxModal({
        width: "w-xl",
        title: "Project O",
        content: `
            <p>A prototype MMO open-world game.</p>
            <p class="mt-6 text-xs">Latest version tag: v0.0.1-pre<br>Supported platforms: win32-x64, darwin-arm64<br>App ID: cc.mcjk.projecto</p>
            `,
        buttons: installed
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