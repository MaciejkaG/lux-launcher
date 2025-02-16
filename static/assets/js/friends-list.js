let friendsListWrapped = true;

document.addEventListener("DOMContentLoaded", () => toggleFriendsList());

function toggleFriendsList() {
    const friendsList = document.getElementById("friendslist");

    const friendsListWrap = document.getElementById("friendslistwrap");

    friendsListWrapped = !friendsListWrapped;

    if (friendsListWrapped) {
        anime({
            targets: friendsList,

            translateY: "-50%",
            scaleY: 0,
            opacity: 0,

            duration: 200,
            easing: "easeInQuart",
            complete: () => {
                friendsListWrap.style.display = "flex";
                anime({
                    targets: friendsListWrap,

                    translateY: [20, 0],
                    opacity: [0, 1],

                    duration: 200,
                    easing: "easeOutQuart",
                });
            },
        });
    } else {
        anime({
            targets: friendsListWrap,

            translateY: [0, 50],
            opacity: [1, 0],

            duration: 200,
            easing: "easeInQuart",
            complete: () => {
                friendsListWrap.style.display = "hidden";
                anime({
                    targets: friendsList,

                    translateY: 0,
                    scaleY: 1,
                    opacity: 1,

                    duration: 200,
                    easing: "easeOutQuart",

                    complete: () => {},
                });
            },
        });
    }
 }