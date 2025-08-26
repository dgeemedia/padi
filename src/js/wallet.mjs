// /src/js/wallet.mjs
// Patched wallet with finders-fee collection helper (platform coffer).

const WALLET_KEY = "mypadiman_wallet";
const COFFER_KEY = "mypadiman_platform_coffer";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function nowTs() { return Date.now(); }

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
function setWallet(w) { save(WALLET_KEY, w); try { document.dispatchEvent(new CustomEvent('mypadiman_wallet_updated', { detail: { wallet: w } })); } catch(e){} }

function getCoffer() {
  const c = load(COFFER_KEY, null);
  if (c) return c;
  const fresh = { balance: 0, transactions: [] };
  save(COFFER_KEY, fresh);
  return fresh;
}
function setCoffer(c) { save(COFFER_KEY, c); try { document.dispatchEvent(new CustomEvent('mypadiman_coffer_updated', { detail: { coffer: c } })); } catch(e){} }

function addTxn(target, type, amount, meta = {}) {
  target.transactions.unshift({ id: crypto.randomUUID(), type, amount, meta, ts: nowTs() });
}

export function getBalances() {
  const w = getWallet();
  const c = getCoffer();
  const escrowTotal = Object.values(w.escrows).reduce((a,b) => a + b, 0);
  return { walletBalance: w.balance, escrowCommitted: escrowTotal, platformCoffer: c.balance };
}

export function initWallet() {
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
        <button id=\"btnWalletWithdraw\" class=\"btn-save\">Withdraw</button>
        <button id=\"btnWalletTx\" class=\"btn-save\">Transactions</button>
      </div>
      <div id="wallet-transactions" style="margin-top:12px;display:none;max-height:180px;overflow:auto;border-top:1px solid #eee;padding-top:8px;"></div>
    `;
    const main = document.querySelector("main.dashboard");
    if (main) main.appendChild(panel);
  }

  document.getElementById("btnWalletDeposit")?.addEventListener("click", async () => {
    const input = prompt("Enter amount to deposit (₦):", "5000");
    if (!input) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) { alert("Please enter a valid amount."); return; }
    deposit(amount);
    alert(`Deposited ${formatNaira(amount)} successfully.`);
    renderBalances();
  });

  document.getElementById("btnWalletWithdraw")?.addEventListener("click", () => {
    const w = getWallet();
    const max = w.balance;
    const input = prompt(`Enter withdrawal amount (Max ${formatNaira(max)}):`, `${Math.floor(max)}`);
    if (!input) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0 || amount > max) { alert("Invalid withdrawal amount."); return; }
    deduct(amount, { type: 'withdrawal' });
    alert(`Withdrew ${formatNaira(amount)} (local MVP).`);
    renderBalances();
  });

  document.getElementById("btnWalletTx")?.addEventListener("click", () => {
    const txContainer = document.getElementById("wallet-transactions");
    if (!txContainer) return;
    txContainer.style.display = txContainer.style.display === 'none' ? 'block' : 'none';
    renderTransactions();
  });

  renderBalances();
}

export function renderBalances() {
  const el = document.getElementById("wallet-balances");
  if (!el) return;
  const { walletBalance, escrowCommitted, platformCoffer } = getBalances();
  el.innerHTML = `
    <p><strong>Wallet Balance:</strong> ${formatNaira(walletBalance)}</p>
    <p><strong>Escrow (Committed):</strong> ${formatNaira(escrowCommitted)}</p>
    <p><strong>Platform Coffer:</strong> ${formatNaira(platformCoffer)}</p>
  `;
}

function renderTransactions() {
  const txContainer = document.getElementById("wallet-transactions");
  if (!txContainer) return;
  const w = getWallet();
  txContainer.innerHTML = "";
  if (!w.transactions || w.transactions.length === 0) {
    txContainer.innerHTML = '<div class="task-card"><p>No transactions yet.</p></div>';
    return;
  }
  w.transactions.slice(0,50).forEach(tx => {
    const d = new Date(tx.ts).toLocaleString();
    const div = document.createElement('div');
    div.style.padding = '6px 0';
    div.innerHTML = `<small>${d} — <strong>${tx.type}</strong> ${formatNaira(tx.amount)}</small>`;
    txContainer.appendChild(div);
  });
}

export function deposit(amount) {
  const w = getWallet();
  w.balance += amount;
  addTxn(w, "deposit", amount);
  setWallet(w);
  renderBalances();
}

export function deduct(amount, meta = {}) {
  const w = getWallet();
  if (w.balance < amount) return false;
  w.balance -= amount;
  addTxn(w, "deduct", amount, meta);
  setWallet(w);
  renderBalances();
  return true;
}

export async function ensureFunds(amount) {
  const w = getWallet();
  if (w.balance >= amount) return true;
  const shortfall = amount - w.balance;
  const want = confirm(
    `You need ${formatNaira(amount)} but have ${formatNaira(w.balance)}.\nShortfall: ${formatNaira(shortfall)}.\n\nDeposit now?`
  );
  if (!want) return false;
  const input = prompt(`Enter deposit amount (>= ${formatNaira(shortfall)}):`, `${Math.ceil(shortfall)}`);
  if (!input) return false;
  const depositAmt = Number(input);
  if (!Number.isFinite(depositAmt) || depositAmt < shortfall) { alert("Deposit cancelled or insufficient."); return false; }
  deposit(depositAmt);
  return getWallet().balance >= amount;
}

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
  renderBalances();
  return true;
}

export function releaseEscrow(taskId, runnerId = null) {
  const w = getWallet();
  const held = w.escrows[taskId] || 0;
  if (held <= 0) return false;
  const c = getCoffer();
  if (c.balance < held) { console.warn("Platform coffer insufficient—data mismatch."); return false; }
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

export function refundEscrow(taskId) {
  const w = getWallet();
  const held = w.escrows[taskId] || 0;
  if (held <= 0) return false;
  const c = getCoffer();
  if (c.balance < held) { console.warn("Platform coffer insufficient—data mismatch."); return false; }
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

// ------------------------------
// NEW: Hold a finders fee in platform coffer
// ------------------------------
export function holdFindersFeeInCoffer(taskId, amount) {
  if (!taskId || amount <= 0) return false;
  // deduct from current wallet (MVP local)
  if (!deduct(amount, { taskId, type: 'finders_fee' })) return false;
  const c = getCoffer();
  c.balance += amount;
  addTxn(c, "collect_finders_fee", amount, { taskId });
  setCoffer(c);
  renderBalances();
  return true;
}
