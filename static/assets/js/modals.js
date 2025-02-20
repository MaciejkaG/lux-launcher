class LuxModal {
    constructor({
        title,
        content,
        buttons = [],
        onClose = null,
        dismissible = true,
        width = "w-sm",
    }) {
        this._title = title;
        this._content = content;
        this.buttons = buttons;
        this.onClose = onClose;
        this.dismissible = dismissible;
        this.width = width;
        this.render();
        this.animateIn();
    }

    set content(val) {
        this._content = val;

        this.contentEl.innerHTML = val;
    }

    get content() {
        return this.contentEl.innerHTML;
    }

    set title(val) {
        this._title = val;

        this.titleEl.innerHTML = val;
    }

    get title() {
        return this.titleEl.innerHTML;
    }

    render() {
        this.modal = document.createElement("div");
        this.modal.className = `fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center z-40`;

        const modalContent = document.createElement("div");
        modalContent.className = `bg-alt-background-plain p-6 rounded-2xl shadow-lg ${this.width} relative border border-foreground-main/20`;
        console.log(modalContent.className);
        this.modalContent = modalContent;

        if (this.dismissible) {
            const closeButton = document.createElement("span");
            closeButton.innerHTML = "close";
            closeButton.className =
                "material-symbols-outlined icon-button absolute top-5 right-6";
            closeButton.onclick = () => this.close();
            modalContent.appendChild(closeButton);
        }

        const titleEl = document.createElement("h2");
        titleEl.className = "text-xl font-semibold mb-4";
        titleEl.innerText = this._title;
        this.titleEl = titleEl;

        const contentEl = document.createElement("div");
        contentEl.className = "my-4";
        contentEl.innerHTML = this._content;
        this.contentEl = contentEl;

        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "flex justify-end space-x-2";
        this.buttons.forEach((btn) => {
            const button = document.createElement("button");
            button.innerText = btn.text;
            button.className = `px-4 py-2 rounded-lg cursor-pointer ${
                btn.class || "bg-button-background/40"
            }`;
            button.onclick = btn.action
                ? btn.action.bind(this)
                : this.close.bind(this);
            buttonsContainer.appendChild(button);
        });

        modalContent.appendChild(titleEl);
        modalContent.appendChild(contentEl);
        modalContent.appendChild(buttonsContainer);
        this.modal.appendChild(modalContent);

        document.body.appendChild(this.modal);
    }

    animateIn() {
        anime({
            targets: this.modal,
            opacity: [0, 1],
            duration: 150,
            easing: "easeOutQuad",
        });
        console.log(this.modalContent);
        anime({
            targets: this.modalContent,
            scale: [0.75, 1],
            opacity: [0, 1],
            duration: 300,
            delay: 100,
            easing: "easeOutBack",
        });
    }

    close() {
        anime({
            targets: this.modalContent,
            scale: [1, 0.75],
            opacity: [1, 0],
            duration: 150,
            easing: "easeOutQuad",
        });

        anime({
            targets: this.modal,
            opacity: [1, 0],
            duration: 200,
            delay: 50,
            easing: "easeOutQuad",
            complete: () => {
                this.modal.remove();
                if (this.onClose) this.onClose();
            },
        });
    }
}

// Example Usage
function showLogoutModal() {
    new LuxModal({
        title: "Are you sure?",
        content: "Do you really want to log out?",
        buttons: [
            {
                text: "Cancel",
                action: function () {
                    this.close();
                },
            },
            {
                text: "Log Out",
                class: "bg-red-600/60 text-white",
                action: function () {
                    console.log("Logging out...");
                    this.close();
                },
            },
        ],
    });
}