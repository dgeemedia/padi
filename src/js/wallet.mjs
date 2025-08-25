// ==========================
// File: /src/js/wallet.mjs
// ==========================
const WALLET_KEY = "mypadiman_wallet";
const COFFER_KEY = "mypadiman_platform_coffer";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function nowTs() {
  return Date.now();
}

export function formatNaira(n) {
  const amt = Number(n || 0);
  return `₦${amt.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function getWallet() {
  const w = load(WALLET_KEY, null);
  if (w) return w;
  const fresh = { balance: 0, escrows: {}, transactions: [] };
  save(WALLET_KEY, fresh);
  return fresh;
}
function setWallet(w) {
  save(WALLET_KEY, w);
}

function getCoffer() {
  const c = load(COFFER_KEY, null);
  if (c) return c;
  const fresh = { balance: 0, transactions: [] };
  save(COFFER_KEY, fresh);
  return fresh;
}
function setCoffer(c) {
  save(COFFER_KEY, c);
}

function addTxn(target, type, amount, meta = {}) {
  target.transactions.unshift({
    id: crypto.randomUUID(),
    type, // "deposit" | "deduct" | "escrow_hold" | "escrow_release" | "escrow_refund"
    amount,
    meta,
    ts: nowTs(),
  });
}

export function getBalances() {
  const w = getWallet();
  const c = getCoffer();
  const escrowTotal = Object.values(w.escrows).reduce((a, b) => a + b, 0);
  return {
    walletBalance: w.balance,
    escrowCommitted: escrowTotal,
    platformCoffer: c.balance,
  };
}

/** UI: lightweight panel + buttons (Deposit). */
export function initWallet() {
  // Create a tiny wallet panel if one doesn’t exist
  let panel = document.getElementById("wallet-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.className = "form-section";
    panel.id = "wallet-panel";
    panel.innerHTML = `
      <h2>Wallet</h2>
      <div id="wallet-balances"></div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button id=\"btnWalletDeposit\" class=\"btn-save\">Deposit</button>
      </div>
    `;
    const main = document.querySelector("main.dashboard");
    if (main) main.appendChild(panel);
  }

  const depositBtn = document.getElementById("btnWalletDeposit");
  depositBtn?.addEventListener("click", async () => {
    const input = prompt("Enter amount to deposit (₦):", "5000");
    if (!input) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    deposit(amount);
    alert(`Deposited ${formatNaira(amount)} successfully.`);
    renderBalances();
  });

  renderBalances();
}

function renderBalances() {
  const el = document.getElementById("wallet-balances");
  if (!el) return;
  const { walletBalance, escrowCommitted, platformCoffer } = getBalances();
  el.innerHTML = `
    <p><strong>Wallet Balance:</strong> ${formatNaira(walletBalance)}</p>
    <p><strong>Escrow (Committed):</strong> ${formatNaira(escrowCommitted)}</p>
    <p><strong>Platform Coffer:</strong> ${formatNaira(platformCoffer)}</p>
  `;
}

/** Add cash to user wallet */
export function deposit(amount) {
  const w = getWallet();
  w.balance += amount;
  addTxn(w, "deposit", amount);
  setWallet(w);
}

/** Try to deduct from wallet; returns boolean */
export function deduct(amount, meta = {}) {
  const w = getWallet();
  if (w.balance < amount) return false;
  w.balance -= amount;
  addTxn(w, "deduct", amount, meta);
  setWallet(w);
  return true;
}

/**
 * Ensure user has at least `amount` available. If not, prompt to deposit.
 * Returns true if funds available (after possible deposit), else false.
 */
export async function ensureFunds(amount) {
  const w = getWallet();
  if (w.balance >= amount) return true;

  const shortfall = amount - w.balance;
  const want = confirm(
    `You need ${formatNaira(amount)} but have ${formatNaira(w.balance)}.\n` +
      `Shortfall: ${formatNaira(shortfall)}.\n\nDeposit now?`
  );
  if (!want) return false;

  const input = prompt(`Enter deposit amount (>= ${formatNaira(shortfall)}):`, `${Math.ceil(shortfall)}`);
  if (!input) return false;

  const depositAmt = Number(input);
  if (!Number.isFinite(depositAmt) || depositAmt < shortfall) {
    alert("Deposit cancelled or insufficient.");
    return false;
  }

  deposit(depositAmt);
  return getWallet().balance >= amount;
}

/**
 * Hold funds in escrow for a task.
 * Deducts from wallet, credits platform coffer, records escrow by taskId.
 */
export function holdInEscrow(taskId, amount) {
  if (!taskId || amount <= 0) return false;

  if (!deduct(amount, { taskId })) return false;

  const w = getWallet();
  w.escrows[taskId] = (w.escrows[taskId] || 0) + amount;
  addTxn(w, "escrow_hold", amount, { taskId });
  setWallet(w);

  const c = getCoffer();
  c.balance += amount;
  addTxn(c, "escrow_hold", amount, { taskId });
  setCoffer(c);

  // Update balances UI
  const el = document.getElementById("wallet-balances");
  if (el) {
    const { walletBalance, escrowCommitted, platformCoffer } = getBalances();
    el.innerHTML = `
      <p><strong>Wallet Balance:</strong> ${formatNaira(walletBalance)}</p>
      <p><strong>Escrow (Committed):</strong> ${formatNaira(escrowCommitted)}</p>
      <p><strong>Platform Coffer:</strong> ${formatNaira(platformCoffer)}</p>
    `;
  }

  return true;
}

/**
 * Release escrow to runner wallet (MVP: same local wallet acts as runner wallet).
 * Deducts from platform coffer, credits wallet, clears escrow.
 */
export function releaseEscrow(taskId, runnerId = null) {
  const w = getWallet();
  const held = w.escrows[taskId] || 0;
  if (held <= 0) return false;

  const c = getCoffer();
  if (c.balance < held) {
    console.warn("Platform coffer insufficient—data mismatch.");
    return false;
  }

  // Move from platform → runner (MVP: same wallet)
  c.balance -= held;
  addTxn(c, "escrow_release", held, { taskId, runnerId });
  setCoffer(c);

  w.escrows[taskId] = 0;
  delete w.escrows[taskId];
  w.balance += held;
  addTxn(w, "escrow_release", held, { taskId, runnerId });
  setWallet(w);

  renderBalances();
  return true;
}

/** Refund escrow back to poster wallet (e.g., task cancelled) */
export function refundEscrow(taskId) {
  const w = getWallet();
  const held = w.escrows[taskId] || 0;
  if (held <= 0) return false;

  const c = getCoffer();
  if (c.balance < held) {
    console.warn("Platform coffer insufficient—data mismatch.");
    return false;
  }

  c.balance -= held;
  addTxn(c, "escrow_refund", held, { taskId });
  setCoffer(c);

  w.escrows[taskId] = 0;
  delete w.escrows[taskId];
  w.balance += held;
  addTxn(w, "escrow_refund", held, { taskId });
  setWallet(w);

  renderBalances();
  return true;
}