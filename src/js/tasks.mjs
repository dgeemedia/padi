// /src/js/tasks.mjs
// Patched task system to support: finders fee calculation, contact reveal after payment,
// and map/chat integration hooks (MVP localStorage-based behavior).

import {
  attachPosterGeoToTask,
  ensureProfileHasGeo,
  totalTaskDistanceKm,
  sortTasksByProximityForRunner,
  distanceKm,
} from "./geolocation.mjs";

import {
  ensureFunds,
  holdInEscrow,
  releaseEscrow,
  refundEscrow,
  formatNaira,
  holdFindersFeeInCoffer,
} from "./wallet.mjs";

import { initMap, showTaskOnMap } from "./map.mjs";

const RATE_PER_KM = 200; // ₦/km for task work (existing)
const STORAGE_KEY = "mypadiman_tasks";
const TASK_COUNT_KEY = "mypadiman_task_count"; // poster-side free quota tracker
const RUNNER_ID_KEY = "mypadiman_runner_id";   // simple local identity for MVP

function getRunnerId() {
  let id = localStorage.getItem(RUNNER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(RUNNER_ID_KEY, id);
  }
  return id;
}

function getTaskCount() {
  return Number(localStorage.getItem(TASK_COUNT_KEY) || 0);
}
function setTaskCount(n) {
  localStorage.setItem(TASK_COUNT_KEY, String(n));
}

/* --------------------------
   Pricing helper
   -------------------------- */
export function computeFindersFeeKm(distanceKm, { base = 50, perKm = 50 } = {}) {
  // base and perKm are ₦ constants — tune to your business model.
  return Math.max(0, Math.round(base + perKm * distanceKm));
}

/* --------------------------
   Public functions
   -------------------------- */
export function initTaskSystem() {
  const btnPostTask = document.getElementById("btnPostTask");
  const tasksList = document.getElementById("tasks-list");
  if (!btnPostTask || !tasksList) return;

  btnPostTask.addEventListener("click", async () => {
    const title = document.getElementById("task-title").value.trim();
    const desc = document.getElementById("task-desc").value.trim();

    if (!title || !desc) {
      alert("Please enter task title and description.");
      return;
    }

    let task = {
      id: crypto.randomUUID(),
      title,
      desc,
      createdAt: Date.now(),
      posterGeo: null,
      errandGeo: null,
      status: "posted",
      escrow: 0,
      runnerId: null,
      findersFee: 0,
      findersFeePaid: false,
      contactRevealed: false,
      acceptedAt: null,
      revealedContact: null,
    };

    task = await attachPosterGeoToTask(task);

    // free-task logic for poster (first 2 posts free)
    const currentCount = getTaskCount();
    const nextCount = currentCount + 1;

    if (nextCount <= 2) {
      alert(`Task "${title}" posted for FREE 🎉`);
    } else {
      // compute a provisional cost (pricing for task work) — final finders fee computed at accept time
      const km = totalTaskDistanceKm({ posterGeo: task.posterGeo, runnerGeo: null, errandGeo: task.errandGeo });
      const cost = Math.max(0, Math.round(km * RATE_PER_KM));
      if (cost > 0) {
        // we do not auto-hold escrow here; hold when runner accepts (poster will be asked to pay finders fee)
        task.escrow = 0;
        console.log("Note: pricing will be computed when runner accepts.");
      }
    }

    setTaskCount(nextCount);
    const allTasks = loadTasksFromStorage();
    allTasks.unshift(task);
    saveTasksToStorage(allTasks);

    renderTaskCard(task, tasksList);
    refreshNearbyTasks();
  });

  // Initial render
  const existing = loadTasksFromStorage();
  existing.forEach((task) => renderTaskCard(task, tasksList));

  // React to wallet updates
  document.addEventListener("mypadiman_wallet_updated", () => {
    const posterList = document.getElementById("tasks-list");
    if (posterList) {
      posterList.innerHTML = "";
      loadTasksFromStorage().forEach((tk) => renderTaskCard(tk, posterList));
    }
    try { refreshNearbyTasks(); } catch (e) {}
  });
}

function renderTaskCard(task, container) {
  const el = document.createElement("div");
  el.className = "task-card";
  el.innerHTML = `
    <h3>${escapeHtml(task.title)}</h3>
    <p>${escapeHtml(task.desc)}</p>
    <small>${new Date(task.createdAt).toLocaleString()}</small><br/>
    <small>Status: <strong>${task.status}</strong></small><br/>
    ${task.escrow > 0 ? `<small>Escrow: <strong>${formatNaira(task.escrow)}</strong></small>` : ""}
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
      ${task.status === "posted" ? `<button data-act="cancel" data-id="${task.id}" class="btn-save" style="background:#9e9e9e">Cancel</button>` : ""}
      ${task.status === "accepted" ? `<button data-act="complete" data-id="${task.id}" class="btn-save">Mark Completed</button>` : ""}
      ${task.status === "accepted" && task.contactRevealed ? `<button data-act="call" data-id="${task.id}" class="btn-save">Call Poster</button>` : ""}
    </div>
  `;
  container.appendChild(el);

  el.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => handleTaskAction(btn.dataset.act, btn.dataset.id, el));
  });
}

async function handleTaskAction(action, taskId, cardEl) {
  const tasks = loadTasksFromStorage();
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;
  const task = tasks[idx];

  if (action === "cancel") {
    if (!confirm("Cancel this task? Escrow (if any) will be refunded.")) return;
    if (task.escrow > 0) refundEscrow(task.id);
    task.status = "cancelled";
  }

  if (action === "complete") {
    if (!confirm("Mark task as completed? Escrow will be released to runner.")) return;
    const ok = releaseEscrow(task.id, task.runnerId);
    if (ok) {
      task.status = "completed";
      task.escrow = 0;
    } else {
      alert("Could not release escrow. Try again.");
      return;
    }
  }

  if (action === "call") {
    // open tel: link if contact revealed
    if (task.contactRevealed && task.revealedContact?.phone) {
      window.open(`tel:${task.revealedContact.phone}`);
    } else {
      alert("Contact is not revealed for this task.");
    }
  }

  tasks[idx] = task;
  saveTasksToStorage(tasks);

  const parent = cardEl.parentElement;
  cardEl.remove();
  renderTaskCard(task, parent);
}

export function loadTasksFromStorage() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}
export function saveTasksToStorage(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  try { document.dispatchEvent(new CustomEvent('mypadiman_tasks_updated')); } catch (e) {}
}

/* -------------------------
   Nearby Tasks for Runners
   ------------------------- */
export async function refreshNearbyTasks() {
  const runnerGeo = await ensureProfileHasGeo();
  const tasks = loadTasksFromStorage().filter((t) => t.status === "posted");
  const nearby = sortTasksByProximityForRunner(tasks, runnerGeo, { maxKm: 20 });

  const list = document.getElementById("nearby-tasks") || document.getElementById("tasks-list");
  if (!list) return;

  list.innerHTML = "";
  nearby.forEach((t) => {
    const el = document.createElement("div");
    el.className = "task-card";

    const info = typeof t.distanceFromRunnerKm === "number" ? `${t.distanceFromRunnerKm.toFixed(1)} km away` : "";

    el.innerHTML = `
      <h3>${escapeHtml(t.title)}</h3>
      <p>${escapeHtml(t.desc)}</p>
      ${info ? `<small>${info}</small><br/>` : ""}
      <button data-accept="${t.id}" class="btn-save">Accept Task</button>
      <div style="margin-top:8px;">${t.findersFeePaid ? '<small>Finders fee paid</small>' : ''}</div>
    `;

    list.appendChild(el);

    el.querySelector("button[data-accept]")?.addEventListener("click", async () => {
      const all = loadTasksFromStorage();
      const index = all.findIndex((x) => x.id === t.id);
      if (index === -1) return;

      const task = all[index];

      // compute distance from poster -> runner (approx)
      const runnerGeoCurrent = await ensureProfileHasGeo();
      const kmPosterToRunner = task.posterGeo && runnerGeoCurrent ? distanceKm(task.posterGeo, runnerGeoCurrent) : 0;

      // compute finders fee
      const findersFee = computeFindersFeeKm(kmPosterToRunner, { base: 50, perKm: 50 });

      // If poster is within free-first-2, do not charge finders fee
      const posterTaskCount = Number(localStorage.getItem(TASK_COUNT_KEY) || 0);
      const mustCollectFinders = posterTaskCount > 2 && !task.findersFeePaid && findersFee > 0;

      if (mustCollectFinders) {
        // MVP approach: attempt to collect from CURRENT user's wallet (works if current user is poster)
        // In a multi-device environment you'd signal the poster to pay via server/notification.
        const wants = confirm(`A finders fee of ${formatNaira(findersFee)} is required so the runner can get contact details. Pay now?`);
        if (!wants) {
          alert("Finder's fee not paid. Accept cancelled.");
          return;
        }

        const ok = await ensureFunds(findersFee);
        if (!ok) {
          alert("Insufficient funds to pay finders fee.");
          return;
        }

        // move money into platform coffer for finders fee
        const held = holdFindersFeeInCoffer(task.id, findersFee);
        if (!held) {
          alert("Could not collect finders fee. Try again.");
          return;
        }

        task.findersFee = findersFee;
        task.findersFeePaid = true;

        // reveal full contact to runner (MVP local — pulls poster profile from storage if present)
        const poster = loadPosterProfileForTask(task);
        task.contactRevealed = true;
        task.revealedContact = {
          phone: poster?.phone || null,
          address: poster?.location?.address || null,
        };
      }

      // compute final cost (task work) and hold escrow if needed
      const km = totalTaskDistanceKm({ posterGeo: task.posterGeo, runnerGeo: runnerGeoCurrent, errandGeo: task.errandGeo });
      const cost = Math.max(0, Math.round(km * RATE_PER_KM));

      if (task.escrow === 0 && cost > 0) {
        // Ask the current user to ensure funds. (MVP: same device)
        const okFunds = await ensureFunds(cost);
        if (!okFunds) {
          alert("Insufficient funds to start this task.");
          return;
        }
        const held = holdInEscrow(task.id, cost);
        if (!held) {
          alert("Could not hold escrow. Try again.");
          return;
        }
        task.escrow = cost;
        alert(`Escrow of ${formatNaira(cost)} secured. ✅`);
      }

      task.status = "accepted";
      task.runnerId = getRunnerId();
      task.acceptedAt = Date.now();

      all[index] = task;
      saveTasksToStorage(all);

      alert("Task accepted! You can mark it completed when done.");
      refreshNearbyTasks();

      // refresh poster list view
      const posterList = document.getElementById("tasks-list");
      if (posterList) {
        posterList.innerHTML = "";
        loadTasksFromStorage().forEach((tk) => renderTaskCard(tk, posterList));
      }

      // show map for accepted task
      try {
        const mapInstance = window._mypadiman_map;
        if (mapInstance) showTaskOnMap(mapInstance, task, runnerGeoCurrent);
      } catch (e) { }

    });
  });
}

/* ----------------------------
   Helpers
   ---------------------------- */
function loadPosterProfileForTask(task) {
  // MVP local approach: if the poster profile exists on this device, return it
  try {
    const prof = JSON.parse(localStorage.getItem("mypadiman_profile"));
    if (!prof) return null;
    return prof;
  } catch {
    return null;
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ----------------------------
   Expose for external tests
   ---------------------------- */
export { renderTaskCard };
