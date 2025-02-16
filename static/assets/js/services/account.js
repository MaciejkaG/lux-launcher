document.addEventListener("DOMContentLoaded", async () => {
    const userData = await window.electron.users.me();
    
    document.getElementById("username").innerText = userData.user_name;
    document.getElementById("displayname").innerText = userData.display_name;
});