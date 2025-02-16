function addFriends() {
    new LuxModal({
        title: "Add Friend",
        content:
            '<input type="text" placeholder="Enter username..." class="w-full lux-input">',
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
                action: function () {
                    console.log("Friend request sent");
                    this.title = "Friend request sent!";
                },
            },
        ],
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const friendsListWrap = document.querySelector("#friendslistwrap");
    const friendsOnlineCount = document.querySelector(".friends-online");
    const pendingFriendRequestsCounters = document.querySelectorAll(
        ".pending-friend-requests"
    );
    let currentFriendRequestCount = 0;
    const updateFriendRequestCount = (val) => {
        if (typeof val === "number") currentFriendRequestCount = val;

        pendingFriendRequestsCounters.forEach(counter => {
            counter.textContent = val;
        });
    };
    const friendsListContainer = document.querySelector(
        "#friendslist .flex.flex-col.gap-4"
    );

    let friendsList = []; // Store the friends list locally

    async function fetchFriendsList() {
        const response = await window.electron.friends.list();
        friendsList = response.friendsList; // Cache the friends list locally
        updateFriendRequestCount(response.friendRequests.length || "0");
        updateFriendsDisplay();
    }

    async function fetchFriendsStatuses() {
        if (friendsList.length === 0) return; // Skip if there are no friends
        const statuses = await window.electron.friends.statuses();
        console.log(statuses);
        updateFriendsDisplay(statuses);
    }

    function updateFriendsDisplay(statuses = {}) {
        // Count online friends
        const onlineFriends = friendsList.filter(
            (friend) => statuses[friend.public_id]?.online
        );
        friendsOnlineCount.textContent = onlineFriends.length;

        // Clear and repopulate friends list
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

        // Show/hide the friends list UI based on data presence
        // friendsListWrap.classList.toggle(
        //     "hidden",
        //     friendsList.length === 0 &&
        //         pendingFriendRequestsCount.textContent === "0"
        // );
    }

    function translateStatus(statusKey) {
        const statusDict = {
            "projecto-playing": "Project O: Playing",
            lux: "In Lux",
            "": "Online",
        };
        return statusDict[statusKey] || statusKey;
    }

    window.electron.on("ws-friend_request", (event, friend) => {
        new LuxToast({
            title: "New friend request!",
            content: `${friend.display_name} just invited you to become friends.`,
            duration: 5000,
            buttons: [
                {
                    text: "Decline",
                    class: "bg-red-600/60 text-white",
                    action: function () {
                        // window.electron.friends.respond(
                        //     friend.public_id,
                        //     false
                        // );
                        this.close();
                        updateFriendRequestCount(currentFriendRequestCount - 1);
                    },
                },
                {
                    text: "Accept",
                    class: "bg-blue-600/60 text-white",
                    action: function () {
                        console.log("accepted");
                        // window.electron.friends.respond(friend.public_id, true);
                        this.close();
                        updateFriendRequestCount(currentFriendRequestCount - 1);
                    },
                },
            ],
        });

        // Increase pending requests count without fetching list
        updateFriendRequestCount(currentFriendRequestCount + 1);
        friendsListWrap.classList.remove("hidden"); // Show UI if a request comes in
    });

    // Initial fetch
    await fetchFriendsList();
    await fetchFriendsStatuses();

    // Set intervals for polling
    setInterval(fetchFriendsList, 30000); // Fetch full friends list every 30s
    setInterval(fetchFriendsStatuses, 1000); // Fetch statuses every 3s
});


// async function updateFriendsList() {
//     const { friends }
// }