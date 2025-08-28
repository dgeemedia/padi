// /src/js/api.mjs
// Small client-side API wrapper that:
// - stores/retrieves token and user in localStorage
// - exposes apiFetch(path, options) which uses baseUrl from window.MYPADIMAN_CONFIG
// - in non-serverMode throws a helpful error to avoid accidental network calls

const TOKEN_KEY = "mypadiman_token";
const USER_KEY = "mypadiman_user";

/* -----------------------
   Configuration helper
   ----------------------- */
function cfg() {
  // window.MYPADIMAN_CONFIG should be set in your HTML (login.html / dashboard.html)
  return window.MYPADIMAN_CONFIG || { serverMode: true, baseUrl: "http://localhost:4000" };
}

/* -----------------------
   Token & user storage helpers
   ----------------------- */
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
}
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

export function setUser(user) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user || null)); } catch (e) {}
}
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function clearUser() {
  try { localStorage.removeItem(USER_KEY); } catch (e) {}
}

/* -----------------------
   apiFetch: wrapper around fetch
   - path: string starting with '/' (e.g. '/auth/login')
   - options: same as fetch options. If options.body is an object and not FormData, it's stringified.
   - returns parsed JSON if response is JSON
   - throws Error with .status and .body on non-2xx responses
   ----------------------- */
export async function apiFetch(path, options = {}) {
  const conf = cfg();

  if (!conf.serverMode) {
    // In local mode, fail fast for network operations (developer must enable serverMode)
    throw new Error("apiFetch blocked: serverMode is false. Set window.MYPADIMAN_CONFIG.serverMode = true to enable server calls.");
  }

  const base = (conf.baseUrl || "").replace(/\/$/, "");
  const url = base + (path.startsWith("/") ? path : "/" + path);

  const headers = Object.assign({}, options.headers || {});
  headers["Accept"] = "application/json";

  // If body is not FormData and not a string, stringify as JSON
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    body = JSON.stringify(body);
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  // attach bearer token if present
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, Object.assign({}, options, { headers, body }));

  const contentType = res.headers.get("content-type") || "";
  let parsed = null;
  if (contentType.includes("application/json")) {
    parsed = await res.json();
  } else {
    parsed = await res.text();
  }

  if (!res.ok) {
    const err = new Error(parsed?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }

  return parsed;
}
