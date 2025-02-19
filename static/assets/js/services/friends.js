// State management
const state = {
    friendsList: [],
    friendRequests: [],
    currentFriendRequestCount: 0,
};

// DOM Elements
const elements = {
    friendsListWrap: document.querySelector("#friendslistwrap"),
    friendsOnlineCount: document.querySelector(".friends-online"),
    pendingFriendRequestsCounters: document.querySelectorAll(
        ".pending-friend-requests"
    ),
    friendsListContainer: document.querySelector(
        "#friendslist .flex.flex-col.gap-4"
    ),
};

// UI Components
class FriendsUI {
    static addFriendsModal() {
        return new LuxModal({
            title: "Add Friend",
            content:
                '<input type="text" id="add-friend-modal-input" placeholder="Enter username..." class="w-full lux-input">',
            buttons: [
                {
                    text: "Cancel",
                    action: function () {
                        this.close();
                    },
                },
                {
                    text: "Send Request",
                    class: "bg-blue-600/60 text-white",
                    action: async function () {
                        const nickname = document.getElementById(
                            "add-friend-modal-input"
                        ).value;
                        await FriendsManager.sendFriendRequest(nickname);
                        this.close();
                    },
                },
            ],
        });
    }

    static showNotification(
        title,
        content = "",
        duration = 5000,
        buttons = []
    ) {
        return new LuxToast({ title, content, duration, buttons });
    }

    static createFriendElement(friend, status) {
        const statusText = status.online
            ? FriendsManager.translateStatus(status.status)
            : "Offline";
        const opacityClass = status.online ? "" : "opacity-40";

        const element = document.createElement("div");
        element.className = `py-2 px-3 flex justify-between ${opacityClass}`;
        element.innerHTML = `
            <p class="leading-5">
                <span class="">${friend.display_name}</span><br>
                <span class="text-foreground-accent text-xs">${statusText}</span>
            </p>
            <span class="text-foreground-accent flex gap-2 items-center">
                ${
                    status.online
                        ? `<span class="material-symbols-outlined icon-button">person_add</span>`
                        : ""
                }
                <span class="material-symbols-outlined icon-button" onclick="FriendsManager.removeFriend('${friend.public_id}')">delete</span>
            </span>
        `;
        return element;
    }
}

// Friends Management
class FriendsManager {
    static async sendFriendRequest(nickname) {
        try {
            await window.electron.friends.add(nickname);
        } catch (err) {
            const errorMessage = err.message.slice(61);
            switch (errorMessage) {
                case "409 Conflict":
                    new LuxToast({
                        title: "An error occured",
                        content: `You and ${nickname} are already friends!`,
                    });
                    break;

                case "404 Not Found":
                    new LuxToast({
                        title: "An error occured",
                        content: `Player ${nickname} not found`,
                    });
                    break;

                case "400 Bad Request":
                    new LuxToast({
                        title: "An error occured",
                        content: `You can't invite yourself!`,
                    });
                    break;

                default:
                    throw err;
            }

            return;
        }
        FriendsUI.showNotification(`Friend request sent to ${nickname}`);
        await this.refreshFriendsList();
    }

    static async acceptFriendRequest(username) {
        await window.electron.friends.add(username);
        state.friendRequests = state.friendRequests.filter(
            (x) => x.user_name !== username
        );
        await this.refreshFriendsList();
        this.updateFriendRequestsModal();
    }

    static async revokeFriendRequest(publicId) {
        await window.electron.friends.remove(publicId);
        state.friendRequests = state.friendRequests.filter(
            (x) => x.public_id !== publicId
        );
        await this.refreshFriendsList();
        this.updateFriendRequestsModal();
    }

    static async removeFriend(publicId) {
        await window.electron.friends.remove(publicId);
        state.friendsList = state.friendsList.filter(
            (x) => x.public_id !== publicId
        );
        await this.refreshFriendsList();
    }

    static async refreshFriendsList() {
        const response = await window.electron.friends.list();
        state.friendsList = response.friendsList;
        state.friendRequests = response.friendRequests;
        this.updateFriendRequestCount(response.friendRequests.length || "0");
        await this.updateFriendsDisplay();
    }

    static async updateFriendsStatuses() {
        if (state.friendsList.length === 0) return;
        const statuses = await window.electron.friends.statuses();
        await this.updateFriendsDisplay(statuses);
    }

    static async updateFriendsDisplay(statuses = {}) {
        const onlineFriends = state.friendsList.filter(
            (friend) => statuses[friend.public_id]?.online
        );
        elements.friendsOnlineCount.textContent = onlineFriends.length;
        elements.friendsListContainer.innerHTML = "";

        state.friendsList.forEach((friend) => {
            const status = statuses[friend.public_id] || {
                online: false,
                status: "Offline",
            };
            const friendElement = FriendsUI.createFriendElement(friend, status);
            elements.friendsListContainer.appendChild(friendElement);
        });
    }

    static updateFriendRequestCount(val) {
        if (typeof val === "number") state.currentFriendRequestCount = val;
        elements.pendingFriendRequestsCounters.forEach((counter) => {
            counter.textContent = val;
        });
    }

    static translateStatus(statusKey) {
        const statusDict = {
            "projecto-playing": "Project O: Playing",
            lux: "In Lux",
            "": "Online",
        };
        return statusDict[statusKey] || statusKey;
    }

    static handleFriendRequest(event, friend) {
        state.friendRequests.push({ ...friend, incoming: 1 });

        FriendsUI.showNotification(
            "New friend request!",
            `${friend.display_name} just invited you to become friends.`,
            5000,
            [
                {
                    text: "Decline",
                    class: "bg-red-600/60 text-white",
                    action: function () {
                        this.close();
                        FriendsManager.updateFriendRequestCount(
                            state.currentFriendRequestCount - 1
                        );
                        FriendsManager.revokeFriendRequest(friend.public_id);
                    },
                },
                {
                    text: "Accept",
                    class: "bg-blue-600/60 text-white",
                    action: function () {
                        this.close();
                        FriendsManager.updateFriendRequestCount(
                            state.currentFriendRequestCount - 1
                        );
                        FriendsManager.acceptFriendRequest(friend.user_name);
                    },
                },
            ]
        );

        this.updateFriendRequestCount(state.currentFriendRequestCount + 1);
        elements.friendsListWrap.classList.remove("hidden");
    }

    static updateFriendRequestsModal() {
        if (!window.friendRequestsModal) return;

        let friendRequestsHTML =
            '<div class="flex flex-col gap-2 h-64 overflow-scroll [&::-webkit-scrollbar]:hidden">';
        const sortedRequests = [...state.friendRequests].sort(
            (a, b) => b.incoming - a.incoming
        );

        sortedRequests.forEach((friend) => {
            friendRequestsHTML += `
                <div class="py-2 px-3 flex justify-between items-center">
                    <p>
                        ${friend.display_name}<br>
                        <span class="text-xs">${
                            friend.incoming ? "Incoming" : "Outgoing"
                        }</span>
                    </p>
                    <span class="flex gap-2">
                        ${
                            friend.incoming
                                ? `<span onclick="FriendsManager.acceptFriendRequest('${friend.user_name}')" class="material-symbols-outlined icon-button">check</span>`
                                : ""
                        }
                        <span onclick="FriendsManager.revokeFriendRequest('${
                            friend.public_id
                        }')" class="material-symbols-outlined icon-button">close</span>
                    </span>
                </div>
            `;
        });
        friendRequestsHTML += "</div>";

        window.friendRequestsModal.content = friendRequestsHTML;
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
    window.electron.on(
        "ws-friend_request",
        FriendsManager.handleFriendRequest.bind(FriendsManager)
    );

    await FriendsManager.refreshFriendsList();
    await FriendsManager.updateFriendsStatuses();

    // Set up polling with different intervals for different types of updates
    setInterval(() => FriendsManager.refreshFriendsList(), 30000);
    setInterval(() => FriendsManager.updateFriendsStatuses(), 1000);
});

// Exposed functions for HTML onclick handlers
window.addFriends = () => FriendsUI.addFriendsModal();
window.openFriendRequests = () => {
    window.friendRequestsModal = new LuxModal({
        width: "w-lg",
        title: "Friend requests",
        content: "",
    });
    FriendsManager.updateFriendRequestsModal();
};
