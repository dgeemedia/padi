// src/js/main.js
import { initAuth } from "./auth.mjs";

/**
 * Load an HTML partial into #<id> from `file`.
 * Calls callback() after insertion (if provided).
 */
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

// Detect path depth so partial paths resolve correctly
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
  loadPartial("hero-placeholder", `${basePath}/partials/hero.html`, () => {
    // ... hero slider logic unchanged ...
  });
}

// Services (index only)
if (document.getElementById("services-placeholder")) {
  loadPartial("services-placeholder", `${basePath}/partials/services.html`);
}

/* ==============================
   Auth + social login wiring
   ============================== */
function wireSocialButtons() {
  const providers = ["google", "facebook", "apple", "instagram", "x", "linkedin"];
  const conf = window.MYPADIMAN_CONFIG || { serverMode: false, baseUrl: "" };

  providers.forEach((p) => {
    const btn = document.querySelector(`.btn-${p}`);
    if (!btn) return;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (conf.serverMode && conf.baseUrl) {
        const oauthUrl = `${conf.baseUrl.replace(/\/$/, "")}/auth/oauth/${p}`;
        const w = window.open(oauthUrl, `oauth_${p}`, "width=600,height=700");
        if (!w) {
          window.location.href = oauthUrl; // fallback
        }
      } else {
        alert("Social login is disabled in local mode.\n\nTo test, set `window.MYPADIMAN_CONFIG.serverMode = true`.");
      }
    });
  });
}

/* ==============================
   OAuth popup message listener
   ============================== */
window.addEventListener("message", (ev) => {
  try {
    const conf = window.MYPADIMAN_CONFIG || { serverMode: true, baseUrl: "" };

    // Optional: restrict origin to backend
    if (conf.baseUrl) {
      try {
        const allowedOrigin = new URL(conf.baseUrl).origin;
        if (ev.origin !== allowedOrigin) return;
      } catch (e) {
        // ignore parse failure (local dev)
      }
    }

    const msg = ev.data;
    if (!msg || msg.type !== "mypadiman_oauth" || !msg.data) return;

    const { token, user } = msg.data;

    // Persist token + user
    try { localStorage.setItem("mypadiman_token", token); } catch {}
    try { localStorage.setItem("mypadiman_user", JSON.stringify(user || null)); } catch {}

    // Notify app listeners
    document.dispatchEvent(new CustomEvent("mypadiman_auth_changed", { detail: { user } }));

    // Redirect: verified users → dashboard, others → welcome
    const verified = !!(
      user &&
      (user.emailVerified || user.provider || user.authProvider || user.socialId)
    );

    const baseRedirect = window.location.origin;
    const target = verified
      ? `${baseRedirect}/pages/dashboard.html`
      : `${baseRedirect}/pages/welcome.html`;
    window.location.href = target;
  } catch (err) {
    console.error("OAuth message handler error", err);
  }
});

/* ==============================
   App init
   ============================== */
function initApp() {
  try {
    const isDashboardPage =
      !!document.querySelector("main.dashboard") ||
      window.location.pathname.endsWith("dashboard.html");

    if (!isDashboardPage) {
      try { initAuth(); } catch (e) { console.warn("Auth init failed:", e); }
      try { wireSocialButtons(); } catch (e) { console.warn("Social buttons wiring failed:", e); }
    } else {
      console.debug("Detected dashboard page; skipping initAuth in main.js (dashboardmain.js handles it).");
    }
  } catch (e) {
    console.warn("initApp failed:", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
