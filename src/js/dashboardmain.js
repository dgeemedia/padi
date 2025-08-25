// dashboardmain.js
import { initProfileForm } from "./profile.mjs";
import { initLocationDropdowns } from "./location.mjs";
import { initTaskSystem, refreshNearbyTasks } from "./tasks.mjs";
import { initWallet } from "./wallet.mjs";
import { initAIChat } from "./aiChat.mjs";
import { ensureProfileHasGeo } from "./geolocation.mjs";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("MyPadiMan Dashboard Loaded ✅");
  initProfileForm();
  initLocationDropdowns();
  initTaskSystem();
  initWallet();
  initAIChat();

  // Try to grab geo early (silent, cached)
  await ensureProfileHasGeo().catch(() => {});

  // Populate runner view list once on load
  refreshNearbyTasks();
});