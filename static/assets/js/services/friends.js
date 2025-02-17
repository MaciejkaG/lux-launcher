function addFriends() {
    new LuxModal({
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
                    const nickname = document.getElementById("add-friend-modal-input").value;
                    await window.electron.friends.add(nickname);
                    this.close();
                    new LuxToast({
                        title: `Friend request sent to ${nickname}`,
                    });
                },
            },
        ],
    });
}

let friendRequests;
let friendsList = [];
let currentFriendRequestCount = 0;

const friendsListWrap = document.querySelector("#friendslistwrap");
const friendsOnlineCount = document.querySelector(".friends-online");
const pendingFriendRequestsCounters = document.querySelectorAll(
    ".pending-friend-requests"
);
const friendsListContainer = document.querySelector(
    "#friendslist .flex.flex-col.gap-4"
);

const updateFriendRequestCount = (val) => {
    if (typeof val === "number") currentFriendRequestCount = val;
    pendingFriendRequestsCounters.forEach((counter) => {
        counter.textContent = val;
    });
};

async function fetchFriendsList() {
    const response = await window.electron.friends.list();
    friendsList = response.friendsList;
    friendRequests = response.friendRequests;
    updateFriendRequestCount(response.friendRequests.length || "0");
    updateFriendsDisplay();
}

async function fetchFriendsStatuses() {
    if (friendsList.length === 0) return;
    const statuses = await window.electron.friends.statuses();
    updateFriendsDisplay(statuses);
}

function updateFriendsDisplay(statuses = {}) {
    const onlineFriends = friendsList.filter(
        (friend) => statuses[friend.public_id]?.online
    );
    friendsOnlineCount.textContent = onlineFriends.length;

    friendsListContainer.innerHTML = "";
    friendsList.forEach((friend) => {
        const status = statuses[friend.public_id] || {
            online: false,
            status: "Offline",
        };
        const statusText = status.online
            ? translateStatus(status.status)
            : "Offline";
        const opacityClass = status.online ? "" : "opacity-40";

        const friendElement = document.createElement("div");
        friendElement.className = `py-2 px-3 flex justify-between ${opacityClass}`;
        friendElement.innerHTML = `
            <span>${friend.display_name}</span>
            <span class="text-foreground-accent">${statusText}</span>
        `;
        friendsListContainer.appendChild(friendElement);
    });
}

function translateStatus(statusKey) {
    const statusDict = {
        "projecto-playing": "Project O: Playing",
        lux: "In Lux",
        "": "Online",
    };
    return statusDict[statusKey] || statusKey;
}

function handleFriendRequest(event, friend) {
    friendRequests.push({ ...friend, incoming: 1 });

    new LuxToast({
        title: "New friend request!",
        content: `${friend.display_name} just invited you to become friends.`,
        duration: 5000,
        buttons: [
            {
                text: "Decline",
                class: "bg-red-600/60 text-white",
                action: function () {
                    this.close();
                    updateFriendRequestCount(currentFriendRequestCount - 1);
                },
            },
            {
                text: "Accept",
                class: "bg-blue-600/60 text-white",
                action: function () {
                    this.close();
                    updateFriendRequestCount(currentFriendRequestCount - 1);
                },
            },
        ],
    });

    updateFriendRequestCount(currentFriendRequestCount + 1);
    friendsListWrap.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", async () => {
    window.electron.on("ws-friend_request", handleFriendRequest);

    await fetchFriendsList();
    await fetchFriendsStatuses();

    setInterval(fetchFriendsList, 30000);
    setInterval(fetchFriendsStatuses, 1000);
});

let friendRequestsModal;
const updateFriendRequests = () => {
    if (friendRequestsModal) {
        let friendRequestsHTML = "<div class=\"flex flex-col gap-2 h-64 overflow-scroll\">";
        friendRequests = friendRequests.sort((a, b) => b.incoming - a.incoming);
        friendRequests.forEach(friend => {
            friendRequestsHTML += `
                <div class="py-2 px-3 flex justify-between items-center">
                    <p>
                        ${friend.display_name}<br>
                        <span class="text-xs">${
                            friend.incoming ? "Incoming" : "Outgoing"
                        }</span>
                    </p>
                    <span class="flex gap-2">
                        ${friend.incoming ? `<span onclick="addFriend('${friend.user_name}')" class="material-symbols-outlined icon-button">check</span>` : ""}
                        <span onclick="revokeFriendRequest('${friend.public_id}')" class="material-symbols-outlined icon-button">close</span>
                    </span>
                </div>
            `;
        });
        friendRequestsHTML += "</div>";

        friendRequestsModal.content = friendRequestsHTML;
    }
};

function openFriendRequests() {
    friendRequestsModal = new LuxModal({
        width: "w-lg",
        title: "Friend requests",
        content: "",
    });

    // TODO: Add friend requests here
    updateFriendRequests();
}

async function addFriend(username) {
    await window.electron.friends.add(username);
    friendRequests = friendRequests.filter((x) => x.user_name !== username);
    await fetchFriendsList();
    updateFriendRequests();
}

async function revokeFriendRequest(publicId) {
    await window.electron.friends.remove(publicId);
    friendRequests = friendRequests.filter((x) => x.public_id !== x.public_id);
    await fetchFriendsList();
    updateFriendRequests();
}