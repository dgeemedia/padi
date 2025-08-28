// src/js/dashboardmain.js
// Dashboard entrypoint + verification banner wiring
// Comments added liberally for easy debugging.

import { initProfileForm } from "./profile.mjs";
import { initLocationDropdowns } from "./location.mjs";
import { initTaskSystem, refreshNearbyTasks } from "./tasks.mjs";
import { initWallet } from "./wallet.mjs";
import { initAIChat } from "./aiChat.mjs";
import { ensureProfileHasGeo } from "./geolocation.mjs";
import { initMap } from "./map.mjs";
import { initAuth, getCurrentUser } from "./auth.mjs";
import { apiFetch } from "./api.mjs"; // small client API wrapper used to call mock server

// -----------------------------
// App boot
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
  console.log("MyPadiMan Dashboard Loaded ✅");

  // init auth first so modules can use auth state or token on boot.
  // initAuth is idempotent so it's safe to call from multiple entrypoints.
  try {
    initAuth();
  } catch (e) {
    console.warn("Auth init error", e);
  }

  // render verification banner for QA (may call server if user clicks resend)
  try {
    renderVerificationBanner();
  } catch (e) {
    console.warn("verification banner error", e);
  }

  // Initialize other modules
  try { initLocationDropdowns(); } catch (e) { console.warn("location init failed", e); }
  try { initProfileForm(); } catch (e) { console.warn("profile init failed", e); }

  try { initTaskSystem(); } catch (e) { console.warn("task system init failed", e); }
  try { initWallet(); } catch (e) { console.warn("wallet init failed", e); }
  try { initAIChat(); } catch (e) { console.warn("ai chat init failed", e); }

  // Initialize map if present in DOM
  try {
    const mapEl = document.getElementById("map");
    if (mapEl) {
      const instance = initMap("map");
      if (instance) window._mypadiman_map = instance;
    }
  } catch (e) {
    console.warn("Map init failed:", e);
  }

  // Try to grab geo early (silent, cached)
  await ensureProfileHasGeo().catch(() => {});

  // Populate runner view list once on load
  try { refreshNearbyTasks(); } catch (e) { console.warn("refreshNearbyTasks failed", e); }

  // Wire sidebar navigation AFTER core UI is ready
  setupSidebarNavigation();
});

// -----------------------------
// Verification banner (QA)
// - reads current user and shows a small banner indicating verification state
// - adds a "Resend confirmation" button which calls /auth/resend-confirm
// - if server returns verifyLink, optionally show it (if container exists in DOM)
// -----------------------------
function renderVerificationBanner() {
  const el = document.getElementById("verificationBanner");
  const verifyLinkContainer = document.getElementById("verifyLinkContainer"); // optional in DOM
  const verifyLinkEl = document.getElementById("verifyLink");               // optional anchor element
  const copyBtn = document.getElementById("copyVerifyLink");               // optional copy btn

  if (!el) return; // nothing to do if banner missing

  // hide verify link UI by default (if present)
  try {
    if (verifyLinkContainer) verifyLinkContainer.style.display = "none";
    if (verifyLinkEl) verifyLinkEl.textContent = "";
  } catch (e) {
    console.warn("verify link UI missing or inaccessible", e);
  }

  const user = getCurrentUser();
  if (!user) {
    // Not authenticated state
    el.innerHTML = `
      <div style="padding:8px;border-radius:8px;background:#fff3cd;border:1px solid #ffeeba;color:#856404;">
        Not signed in. <a href="login.html">Sign in</a> to continue.
      </div>
    `;
    return;
  }

  // heuristics to decide if user is considered verified
  const verified = !!(
    user.emailVerified ||
    user.emailConfirmed ||
    user.verified ||
    user.isVerified ||
    user.provider ||
    user.authProvider ||
    user.socialId
  );

  if (verified) {
    // Verified state
    el.innerHTML = `
      <div style="padding:8px;border-radius:8px;background:#e8f5e9;border:1px solid #c8e6c9;color:#256029;">
        Account verified ✅ — ${escapeHtml(user.email || user.name || '')}. You can post tasks and accept runners.
      </div>
    `;
    return;
  }

  // Unverified state: show CTA + Resend button
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:8px;border-radius:8px;background:#fff3cd;border:1px solid #ffeeba;color:#856404;">
      <div style="flex:1;">
        ⚠ Account not verified — <strong>${escapeHtml(user.email || user.name || '')}</strong>.
        <a href="welcome.html" style="margin-left:8px;">Complete verification</a>
      </div>
      <div>
        <button id="btnResendConfirm" class="btn-save">Resend confirmation</button>
      </div>
    </div>
  `;

  // Wire resend button (if present)
  const btn = document.getElementById("btnResendConfirm");
  if (!btn) return;

  // Prevent wiring the same handler multiple times
  if (btn._mypadiman_wired) return;
  btn._mypadiman_wired = true;

  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      btn.textContent = "Sending…";

      // Call server endpoint via apiFetch
      // apiFetch will use window.MYPADIMAN_CONFIG.baseUrl and token if available
      const resp = await apiFetch("/auth/resend-confirm", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
      });

      // Inform QA/dev
      alert(resp?.message || "Confirmation resent (mock).");

      // If mock server supplied a verifyLink, reveal it (if DOM provides the container)
      if (resp?.verifyLink && verifyLinkContainer && verifyLinkEl) {
        verifyLinkEl.href = resp.verifyLink;
        verifyLinkEl.textContent = resp.verifyLink;
        verifyLinkContainer.style.display = "block";

        // Wire copy button if present
        if (copyBtn) {
          copyBtn.onclick = () => {
            try {
              navigator.clipboard.writeText(resp.verifyLink);
              copyBtn.textContent = "Copied!";
              setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
            } catch (e) {
              alert("Copy failed, please copy manually.");
            }
          };
        }
      }
    } catch (err) {
      console.error("Resend confirm failed", err);
      alert("Resend failed: " + (err?.message || "unknown error"));
    } finally {
      btn.disabled = false;
      btn.textContent = "Resend confirmation";
    }
  });
}

// -----------------------------
// keep banner in sync if auth state changes elsewhere
// example: auth.mjs dispatches 'mypadiman_auth_changed' after login/register/logout
// -----------------------------
document.addEventListener("mypadiman_auth_changed", () => {
  try { renderVerificationBanner(); } catch (e) { console.warn("banner refresh failed", e); }
});

// -----------------------------
// Small utility: escape HTML to avoid injection when rendering user data
// -----------------------------
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// -----------------------------
// Sidebar navigation wiring (unchanged)
// -----------------------------
function setupSidebarNavigation() {
  const sidebarItems = document.querySelectorAll(".sidebar ul li");
  if (!sidebarItems || !sidebarItems.length) return;

  const profileForm = document.querySelector(".profile-form");
  const taskSection = document.querySelector(".task-section");
  const tasksListContainer = document.getElementById("tasks-list");
  const walletPanel = document.getElementById("wallet-panel");

  const hideAll = () => {
    if (profileForm) profileForm.style.display = "none";
    if (taskSection) taskSection.style.display = "none";
    if (walletPanel) walletPanel.style.display = "none";
  };

  hideAll();
  if (profileForm) profileForm.style.display = "block";
  if (taskSection) taskSection.style.display = "block";

  sidebarItems.forEach((li) => {
    li.addEventListener("click", (e) => {
      sidebarItems.forEach((x) => x.classList.remove("active"));
      li.classList.add("active");

      const label = (li.textContent || "").trim().toLowerCase();
      hideAll();

      if (label.includes("profile")) {
        if (profileForm) profileForm.style.display = "block";
        if (taskSection) taskSection.style.display = "block";
        return;
      }

      if (label.includes("tasks")) {
        if (taskSection) taskSection.style.display = "block";
        return;
      }

      if (label.includes("wallet")) {
        if (walletPanel) walletPanel.style.display = "block";
        else alert("Wallet panel will appear after you open Wallet (wallet module creates it).");
        return;
      }

      if (label.includes("orders")) {
        if (tasksListContainer) {
          const ev = new CustomEvent("mypadiman_show_orders");
          document.dispatchEvent(ev);
          setTimeout(() => {
            if (!document._mypadiman_orders_rendered) {
              const tasks = (function () {
                try { return JSON.parse(localStorage.getItem("mypadiman_tasks") || "[]"); } catch { return []; }
              })();
              const orders = tasks.filter((t) => ["accepted","completed"].includes(t.status));
              if (orders.length === 0) {
                tasksListContainer.innerHTML = `<div class="task-card"><p>No orders yet.</p></div>`;
              } else {
                tasksListContainer.innerHTML = "";
                orders.forEach((t) => {
                  const el = document.createElement("div");
                  el.className = "task-card";
                  const h3 = document.createElement("h3"); h3.textContent = t.title || "";
                  const p  = document.createElement("p");  p.textContent  = t.desc || "";
                  const sm = document.createElement("small"); sm.textContent = `Status: ${t.status || ""}`;
                  el.appendChild(h3); el.appendChild(p); el.appendChild(sm);
                  tasksListContainer.appendChild(el);
                });
              }
            }
          }, 30);
        } else alert("No task list found to show orders.");
        return;
      }

      if (label.includes("settings")) {
        alert("Settings are not a separate view in this MVP UI; use Profile or Wallet.");
        if (profileForm) profileForm.style.display = "block";
        return;
      }

      if (label.includes("logout")) {
        if (confirm("Log out from this device?")) {
          localStorage.removeItem("mypadiman_profile");
          alert("Logged out locally. Refresh the page.");
        }
        return;
      }
    });
  });
}
