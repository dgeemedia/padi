// ==========================
// File: /src/js/tasks.mjs
// ==========================
import {
  attachPosterGeoToTask,
  ensureProfileHasGeo,
  totalTaskDistanceKm,
  sortTasksByProximityForRunner,
} from "./geolocation.mjs";

import {
  ensureFunds,
  holdInEscrow,
  releaseEscrow,
  refundEscrow,
  formatNaira,
} from "./wallet.mjs";

const RATE_PER_KM = 200; // ₦/km
const STORAGE_KEY = "mypadiman_tasks";
const TASK_COUNT_KEY = "mypadiman_task_count"; // poster-side free quota tracker
const RUNNER_ID_KEY = "mypadiman_runner_id";   // simple local identity for MVP

// Ensure a local runner identity exists
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

    // Build task object and attach poster geo
    let task = {
      id: crypto.randomUUID(),
      title,
      desc,
      createdAt: Date.now(),
      posterGeo: null,
      errandGeo: null, // future input
      status: "posted", // posted | accepted | completed | cancelled
      escrow: 0,
      runnerId: null,
    };
    task = await attachPosterGeoToTask(task);

    const runnerGeo = await ensureProfileHasGeo();

    // Free task logic (persisted per-device for MVP)
    const currentCount = getTaskCount();
    const nextCount = currentCount + 1;

    if (nextCount <= 2) {
      alert(`Task "${title}" posted for FREE 🎉`);
    } else {
      // Compute cost if we have sufficient points
      const km = totalTaskDistanceKm({
        posterGeo: task.posterGeo,
        runnerGeo,
        errandGeo: task.errandGeo,
      });
      const cost = Math.max(0, km * RATE_PER_KM);

      if (cost > 0) {
        const ok = await ensureFunds(cost);
        if (!ok) {
          alert("Insufficient funds. Task not posted.");
          return;
        }
        const held = holdInEscrow(task.id, cost);
        if (!held) {
          alert("Could not hold escrow. Task not posted.");
          return;
        }
        task.escrow = cost;
        alert(`Task "${title}" posted and ${formatNaira(cost)} held in escrow.`);
      } else {
        alert(`Task "${title}" posted. (Pricing will update when a runner views it.)`);
      }
    }

    // Persist count and task
    setTaskCount(nextCount);
    const allTasks = loadTasksFromStorage();
    allTasks.unshift(task);
    saveTasksToStorage(allTasks);

    // Render immediately
    renderTaskCard(task, tasksList);

    // Update runner list view
    refreshNearbyTasks();
  });

  // On load, show existing tasks (poster view)
  const existing = loadTasksFromStorage();
  existing.forEach((task) => renderTaskCard(task, tasksList));
}

function renderTaskCard(task, container) {
  const el = document.createElement("div");
  el.className = "task-card";
  el.innerHTML = `
    <h3>${task.title}</h3>
    <p>${task.desc}</p>
    <small>${new Date(task.createdAt).toLocaleString()}</small><br/>
    <small>Status: <strong>${task.status}</strong></small><br/>
    ${task.escrow > 0 ? `<small>Escrow: <strong>${formatNaira(task.escrow)}</strong></small>` : ""}
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
      ${task.status === "posted" ? `<button data-act="cancel" data-id="${task.id}" class="btn-save" style="background:#9e9e9e">Cancel</button>` : ""}
      ${task.status === "accepted" ? `<button data-act="complete" data-id="${task.id}" class="btn-save">Mark Completed</button>` : ""}
    </div>
  `;
  container.appendChild(el);

  // Wire actions (cancel, complete)
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

  tasks[idx] = task;
  saveTasksToStorage(tasks);

  // Refresh the card
  const parent = cardEl.parentElement;
  cardEl.remove();
  renderTaskCard(task, parent);
}

// ----------------
// Storage Helpers
// ----------------
export function loadTasksFromStorage() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}
export function saveTasksToStorage(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// -------------------------
// Nearby Tasks for Runners
// -------------------------
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
      <h3>${t.title}</h3>
      <p>${t.desc}</p>
      ${info ? `<small>${info}</small><br/>` : ""}
      <button data-accept="${t.id}" class="btn-save">Accept Task</button>
    `;

    list.appendChild(el);

    el.querySelector("button[data-accept]")?.addEventListener("click", async () => {
      const all = loadTasksFromStorage();
      const index = all.findIndex((x) => x.id === t.id);
      if (index === -1) return;

      // If no escrow has been held yet and the task isn't part of the free quota,
      // compute cost now using current runner geo and ask poster (MVP: same user)
      const task = all[index];
      const km = totalTaskDistanceKm({
        posterGeo: task.posterGeo,
        runnerGeo,
        errandGeo: task.errandGeo,
      });
      const cost = Math.max(0, km * RATE_PER_KM);

      if (task.escrow === 0 && cost > 0) {
        const ok = await ensureFunds(cost);
        if (!ok) {
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

      all[index] = task;
      saveTasksToStorage(all);

      alert("Task accepted! You can mark it completed when done.");
      refreshNearbyTasks();

      // Also refresh poster list if visible
      const posterList = document.getElementById("tasks-list");
      if (posterList) {
        posterList.innerHTML = "";
        loadTasksFromStorage().forEach((tk) => renderTaskCard(tk, posterList));
      }
    });
  });
}
