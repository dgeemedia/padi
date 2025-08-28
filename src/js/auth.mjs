// src/js/auth.mjs
import { apiFetch, setToken, getToken, clearToken, setUser, getUser, clearUser } from "./api.mjs";

/**
 * initAuth(options)
 * - wires login/register forms (if present on the page)
 * - idempotent: uses window._mypadiman_auth_initialized guard
 */
export function initAuth({
  loginSelector = ".auth-form",
  registerSelector = ".register-form",
  logoutSelector = "#btnLogout",
  loginModalTrigger = "#btnOpenLogin",
} = {}) {
  if (window._mypadiman_auth_initialized) return;
  window._mypadiman_auth_initialized = true;

  // modal opener (optional)
  const trigger = document.querySelector(loginModalTrigger);
  if (trigger) trigger.addEventListener("click", () => {
    const modal = document.getElementById("loginModal");
    if (modal) modal.style.display = "block";
  });

  // wire login page/form
  const loginForm = document.querySelector(loginSelector);
  if (loginForm) loginForm.addEventListener("submit", (e) => handleLogin(e, loginForm, { isEmail: true }));

  // wire register page/form
  const regForm = document.querySelector(registerSelector);
  if (regForm) regForm.addEventListener("submit", (e) => handleRegister(e, regForm));

  // logout (dashboard)
  const logoutBtn = document.querySelector(logoutSelector);
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearToken();
      clearUser();
      renderAuthState();
      document.dispatchEvent(new CustomEvent("mypadiman_auth_changed", { detail: { user: null } }));
      try { window.location.href = "login.html"; } catch {}
    });
  }

  // initial UI render
  renderAuthState();
}

/* -----------------------
   Helpers
------------------------*/
function isVerified(user) {
  if (!user) return false;
  const flags = ['emailVerified','emailConfirmed','verified','isVerified'];
  for (const f of flags) if (user[f]) return true;
  if (user.authProvider || user.provider || user.socialId || user.oauth) return true;
  return false;
}

export async function handleLogin(e, form, opts = { isEmail: false }) {
  e.preventDefault();
  const fd = new FormData(form);
  const isEmail = !!opts.isEmail;
  const email = (fd.get("email") || "").trim();
  const password = (fd.get("password") || "").trim();
  const phone = (fd.get("phone") || "").trim();

  if (isEmail) {
    if (!email || !password) return alert("Enter email and password.");
  } else {
    if (!phone && !email) return alert("Enter phone or email and password.");
    if (!password) return alert("Enter password.");
  }

  try {
    const conf = window.MYPADIMAN_CONFIG || { serverMode: false };

    if (conf.serverMode) {
      const payload = isEmail ? { email, password } : (phone ? { phone, password } : { email, password });
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setToken(data.token);
      setUser(data.user || null);
      renderAuthState();
      document.dispatchEvent(new CustomEvent("mypadiman_auth_changed", { detail: { user: data.user } }));

      if (document.querySelector(".auth-page")) {
        if (isVerified(data.user)) window.location.href = "dashboard.html";
        else window.location.href = "welcome.html";
      } else {
        const modal = document.getElementById("loginModal");
        if (modal) modal.style.display = "none";
      }
      return;
    }

    // local dev fallback
    const uid = "local_" + (email || phone || Date.now());
    const user = { id: uid, name: email || phone || "Local User", email: email || null, phone: phone || null, emailVerified: true };
    setToken("localdev-token");
    setUser(user);
    renderAuthState();
    document.dispatchEvent(new CustomEvent("mypadiman_auth_changed", { detail: { user } }));
    if (document.querySelector(".auth-page")) window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Login failed", err);
    alert("Login error: " + (err?.message || "unknown"));
  }
}

export async function handleRegister(e, form) {
  e.preventDefault();
  const fd = new FormData(form);
  const fullName = (fd.get("fullName") || "").trim();
  const email = (fd.get("email") || "").trim();
  const password = (fd.get("password") || "").trim();

  if (!fullName || !email || !password) return alert("Please complete all fields.");

  try {
    const conf = window.MYPADIMAN_CONFIG || { serverMode: false };

    if (conf.serverMode) {
      const data = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ name: fullName, email, password }) });
      setToken(data.token);
      setUser(data.user || null);
      renderAuthState();
      document.dispatchEvent(new CustomEvent("mypadiman_auth_changed", { detail: { user: data.user } }));

      if (isVerified(data.user)) window.location.href = "dashboard.html";
      else window.location.href = "welcome.html";
      return;
    }

    // local dev fallback
    const userId = "local_" + (email || Date.now());
    const user = { id: userId, name: fullName, email, phone: null, emailVerified: true };
    setToken("localdev-token");
    setUser(user);
    renderAuthState();
    document.dispatchEvent(new CustomEvent("mypadiman_auth_changed", { detail: { user } }));

    // prefer welcome page if present
    try {
      const resp = await fetch("welcome.html", { method: "HEAD" });
      window.location.href = resp.ok ? "welcome.html" : "dashboard.html";
    } catch { window.location.href = "dashboard.html"; }
  } catch (err) {
    console.error("Registration failed", err);
    alert("Registration error: " + (err?.message || "unknown"));
  }
}

/* -----------------------
   Exports & helpers
------------------------*/
export function getCurrentUser() {
  return getUser();
}

function renderAuthState() {
  const container = document.getElementById("sidebarAvatar");
  const profileNameEl = document.getElementById("profileNameDisplay");
  const logoutBtn = document.getElementById("btnLogout");
  const user = getUser();

  if (container) {
    if (user?.avatar) {
      container.innerHTML = `<img src="${user.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    } else {
      container.textContent = user ? (user.name ? (user.name[0] || "U") : "👤") : "👤";
    }
  }
  if (profileNameEl) profileNameEl.textContent = user?.name || "Guest";
  if (logoutBtn) logoutBtn.style.display = user ? "block" : "none";
}

// Expose small helpers for dev debugging
window.mypadiman_auth = {
  initAuth,
  handleLogin,
  handleRegister,
  getCurrentUser
};
