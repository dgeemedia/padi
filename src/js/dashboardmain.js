// /src/js/dashboardmain.js
import { initProfileForm } from "./profile.mjs";
import { initLocationDropdowns } from "./location.mjs";
import { initTaskSystem, refreshNearbyTasks } from "./tasks.mjs";
import { initWallet } from "./wallet.mjs";
import { initAIChat } from "./aiChat.mjs";
import { ensureProfileHasGeo } from "./geolocation.mjs";
import { initMap } from "./map.mjs";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("MyPadiMan Dashboard Loaded ✅");

  // IMPORTANT: initialize location dropdowns BEFORE profile so populateForm can set state/lga reliably
  initLocationDropdowns();
  initProfileForm();

  initTaskSystem();
  initWallet();
  initAIChat();

  // Initialize map if present in DOM
  try {
    const mapEl = document.getElementById('map');
    if (mapEl) {
      const instance = initMap('map');
      if (instance) window._mypadiman_map = instance;
    }
  } catch (e) {
    console.warn('Map init failed:', e);
  }

  // Try to grab geo early (silent, cached)
  await ensureProfileHasGeo().catch(() => {});

  // Populate runner view list once on load
  try { refreshNearbyTasks(); } catch(e) { console.warn(e); }

  // Wire sidebar navigation AFTER core UI is ready
  setupSidebarNavigation();
});

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
