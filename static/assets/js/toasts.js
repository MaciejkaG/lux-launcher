class LuxToast {
    static container = null;
    static activeToasts = new Set();
    static gap = 8;

    constructor({ title, content = "", buttons = [], duration = 5000 }) {
        this.title = title;
        this.content = content;
        this.buttons = buttons;
        this.duration = duration;
        this.isExpanded = false;
        this.baseHeight = 0;
        this.createToast();
        this.measureHeights();
        this.animateIn();
        LuxToast.activeToasts.add(this);
    }

    createToast() {
        if (!LuxToast.container) {
            LuxToast.container = document.createElement("div");
            LuxToast.container.className = "fixed bottom-4 left-4 w-xs z-50";
            document.body.appendChild(LuxToast.container);
        }

        this.toast = document.createElement("div");
        this.toast.className =
            "absolute left-0 bg-alt-background-plain p-3 pb-4 rounded-xl shadow-lg w-full border border-foreground-main/20 overflow-hidden opacity-0";

        // Set visibility to hidden initially to prevent flash during measurement
        this.toast.style.visibility = "hidden";

        const titleEl = document.createElement("span");
        titleEl.className = "font-semibold";
        titleEl.innerText = this.title;
        this.toast.appendChild(titleEl);

        if (this.content.length > 0) {
            const contentEl = document.createElement("div");
            contentEl.className =
                "text-sm transition-all mt-1 duration-300 ease-linear";
            contentEl.innerText = this.content;
            this.contentEl = contentEl;
            this.toast.appendChild(contentEl);
        }

        if (this.buttons.length > 0) {
            const buttonsContainer = document.createElement("div");
            buttonsContainer.className =
                "flex justify-end space-x-2 mt-3 transition-all duration-300 ease-linear";
            this.buttons.forEach((btn) => {
                const button = document.createElement("button");
                button.innerText = btn.text;
                button.className = `px-3 py-1 rounded-lg ${
                    btn.class || "bg-button-background/40"
                }`;
                button.onclick = btn.action ? btn.action.bind(this) : () => {};
                buttonsContainer.appendChild(button);
            });
            this.toast.appendChild(buttonsContainer);
            this.buttonsContainer = buttonsContainer;
        }

        const progressBar = document.createElement("div");
        progressBar.className =
            "absolute bottom-0 left-0 h-1 bg-foreground-accent w-full";
        this.progressBar = progressBar;
        this.toast.appendChild(progressBar);

        this.toast.addEventListener("mouseenter", () => {
            this.pauseTimer();
            this.rearrangeToasts(); // Rearrange when expanding
        });

        this.toast.addEventListener("mouseleave", () => {
            this.resumeTimer();
            this.rearrangeToasts(); // Rearrange when collapsing
        });

        LuxToast.container.appendChild(this.toast);

        requestAnimationFrame(() => {
            this.height = this.toast.offsetHeight + 8; // 8px for gap
        });
    }

    measureHeights() {
        // Measure height
        this.baseHeight = this.toast.offsetHeight;

        // Make toast visible again
        this.toast.style.visibility = "visible";

        // Set initial position
        const currentToasts = Array.from(LuxToast.container.children);
        let initialBottom = 0;

        // Calculate position based on heights of toasts below this one
        for (let i = 0; i < currentToasts.indexOf(this.toast); i++) {
            const toastInstance = Array.from(LuxToast.activeToasts).find(
                (t) => t.toast === currentToasts[i]
            );
            initialBottom += (toastInstance.baseHeight ?? 0) + LuxToast.gap;
        }

        this.toast.style.bottom = `${initialBottom}px`;
    }

    animateIn() {
        anime({
            targets: this.toast,
            opacity: [0, 1],
            translateY: [-30, 0],
            duration: 300,
            easing: "easeOutQuad",
            complete: () => {
                this.startTimer();
            },
        });
    }

    startTimer() {
        this.progressBarAnimation = anime({
            targets: this.progressBar,
            width: ["100%", "0%"],
            duration: this.duration,
            easing: "linear",
            complete: () => this.close(),
        });
    }

    pauseTimer() {
        this.progressBarAnimation.restart();
        this.progressBarAnimation.pause();
    }

    resumeTimer() {
        this.progressBarAnimation.play();
    }

    close() {
        LuxToast.activeToasts.delete(this);
        anime({
            targets: this.toast,
            opacity: [1, 0],
            translateX: [0, -20],
            duration: 300,
            easing: "easeInQuad",
            complete: () => {
                this.toast.remove();
                this.rearrangeToasts();
            },
        });
    }

    rearrangeToasts() {
        const toasts = Array.from(LuxToast.container.children);
        let currentBottom = 0;

        toasts.forEach((toast, index) => {
            const toastInstance = Array.from(LuxToast.activeToasts).find(
                (t) => t.toast === toast
            );

            if (toastInstance) {
                anime({
                    targets: toast,
                    bottom: currentBottom,
                    duration: 300,
                    easing: "easeOutQuad",
                });

                currentBottom += (toastInstance.baseHeight ?? 0) + LuxToast.gap;
            }
        });
    }
}

// Example Usage
function showToast() {
    
}
