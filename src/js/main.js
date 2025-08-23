// src/js/main.js

async function loadPartial(id, file, callback) {
  try {
    const res = await fetch(file);
    const html = await res.text();
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = html;
      if (callback) callback();
    }
  } catch (err) {
    console.error(`Error loading ${file}:`, err);
  }
}

// Detect path depth
const isInPagesFolder = window.location.pathname.includes("/pages/");
const basePath = isInPagesFolder ? ".." : ".";

// Header
loadPartial("header-placeholder", `${basePath}/partials/header.html`, () => {
  const toggleButton = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");

  if (toggleButton && navMenu) {
    toggleButton.addEventListener("click", () => {
      toggleButton.classList.toggle("open");
      navMenu.classList.toggle("open");
    });
  }
});

// Footer
loadPartial("footer-placeholder", `${basePath}/partials/footer.html`);

// Hero (index only)
if (document.getElementById("hero-placeholder")) {
  loadPartial("hero-placeholder", `${basePath}/partials/hero.html`);
}

// Services (index only)
if (document.getElementById("services-placeholder")) {
  loadPartial("services-placeholder", `${basePath}/partials/services.html`);
}
