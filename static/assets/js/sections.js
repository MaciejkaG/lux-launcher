const DEFAULT_DISPLAY = "block";

let sections = [];
document.addEventListener("DOMContentLoaded", () => {
    sections = document.querySelectorAll("section.app-section");
    _hideAllSections();

    sections[0].style.display = DEFAULT_DISPLAY;
});

function gotoSection(sectionId) {
    anime({
        targets: "section.app-section",
        opacity: 0,
        translateY: [0, -20],

        duration: 150,
        easing: "easeInQuad",
        complete: () => {
            _hideAllSections();
            document.querySelector("section.app-section#" + sectionId).style.display = DEFAULT_DISPLAY;

            anime({
                targets: "section.app-section#" + sectionId,
                opacity: 1,
                translateY: [-20, 0],

                duration: 150,
                easing: "easeOutQuad",
            });
        },
    });

    const navbar = document.getElementById("navbar");
    Array.from(navbar.children).forEach((child) => {
        child.classList.remove("text-foreground-accent");

        if (child.getAttribute("data-section") === sectionId) {
            child.classList.add("text-foreground-accent");
        }
    });
}

function _hideAllSections() {
    console.log(sections)
    sections.forEach((section) => {
        section.style.display = "none";
    });
}