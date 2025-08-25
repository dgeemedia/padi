// /src/js/geolocation.mjs

const PROFILE_KEY = "mypadiman_profile";
const GEO_CACHE_KEY = "mypadiman_geo_cache";

/**
 * Get device location with caching and fallbacks.
 * Requires HTTPS (or localhost).
 */
export async function getDeviceLocation(options = {}) {
  const {
    force = false,
    highAccuracy = true,
    timeout = 10000,
    maximumAge = 300000, // 5 min cache OK
  } = options;

  // 1) Use cache if fresh and not forced
  try {
    if (!force) {
      const cached = JSON.parse(localStorage.getItem(GEO_CACHE_KEY));
      if (cached && Date.now() - cached.ts < maximumAge) {
        return cached;
      }
    }
  } catch {}

  // 2) Ask browser geolocation
  const supported = typeof navigator !== "undefined" && navigator.geolocation;
  if (!supported) {
    console.warn("Geolocation API not available.");
    return null;
  }

  const position = await new Promise((resolve) => {
    let done = false;
    const onSuccess = (pos) => {
      if (done) return;
      done = true;
      resolve(pos);
    };
    const onError = (err) => {
      if (done) return;
      console.warn("Geolocation error:", err);
      resolve(null);
    };
    try {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge,
      });
    } catch (e) {
      console.warn("Geolocation call failed:", e);
      resolve(null);
    }
  });

  if (!position) return null;

  const { latitude, longitude, accuracy } = position.coords;
  const payload = {
    lat: latitude,
    lon: longitude,
    accuracy: typeof accuracy === "number" ? accuracy : null,
    ts: Date.now(),
  };

  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(payload));
  } catch {}

  return payload;
}

/**
 * Ensure the current user's profile has geo coordinates.
 * Adds/updates profile.geo ({lat, lon, accuracy, updatedAt}) without breaking existing data.
 */
export async function ensureProfileHasGeo({ force = false } = {}) {
  const profile = loadProfile();
  if (!profile) return null;

  // Only refresh if missing or very old (> 24h) unless forced
  const stale =
    !profile.geo || !profile.geo.updatedAt || Date.now() - profile.geo.updatedAt > 24 * 60 * 60 * 1000;

  if (stale || force) {
    const loc = await getDeviceLocation({ force });
    if (!loc) return profile.geo || null;

    profile.geo = {
      lat: loc.lat,
      lon: loc.lon,
      accuracy: loc.accuracy,
      updatedAt: Date.now(),
    };
    saveProfile(profile);
  }
  return profile.geo || null;
}

/**
 * Haversine distance in KM.
 * Accepts {lat, lon} or {latitude, longitude}.
 */
export function distanceKm(a, b) {
  if (!a || !b) return 0;

  const lat1 = a.lat ?? a.latitude;
  const lon1 = a.lon ?? a.longitude;
  const lat2 = b.lat ?? b.latitude;
  const lon2 = b.lon ?? b.longitude;

  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    console.warn("distanceKm: invalid coordinates", a, b);
    return 0;
  }

  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const L1 = toRad(lat1);
  const L2 = toRad(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(L1) * Math.cos(L2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Attach poster's geo to a task payload.
 * - Reads profile.geo; if missing, tries to fetch device location once.
 * - Returns new task object with task.posterGeo = {lat, lon, accuracy, updatedAt}
 */
export async function attachPosterGeoToTask(task) {
  const profile = loadProfile();
  let posterGeo = profile?.geo;

  if (!posterGeo) {
    const loc = await getDeviceLocation();
    if (loc) {
      posterGeo = {
        lat: loc.lat,
        lon: loc.lon,
        accuracy: loc.accuracy,
        updatedAt: Date.now(),
      };
      if (profile) {
        profile.geo = posterGeo;
        saveProfile(profile);
      }
    }
  }

  return {
    ...task,
    posterGeo: posterGeo || null,
  };
}

/**
 * Compute total route distance for pricing.
 * total = (Poster -> Runner) + (Runner -> Errand)
 */
export function totalTaskDistanceKm({ posterGeo, runnerGeo, errandGeo }) {
  const a = posterGeo && runnerGeo ? distanceKm(posterGeo, runnerGeo) : 0;
  const b = runnerGeo && errandGeo ? distanceKm(runnerGeo, errandGeo) : 0;
  return a + b;
}

/**
 * Sort tasks by distance from runner and optionally filter by maxKm.
 * Each returned task is annotated with `distanceFromRunnerKm`.
 */
export function sortTasksByProximityForRunner(tasks, runnerGeo, { maxKm = null } = {}) {
  if (!Array.isArray(tasks) || !runnerGeo) return tasks || [];

  const annotated = tasks
    .map((t) => {
      const target = t.errandGeo || t.posterGeo; // prefer explicit errand destination; fallback to poster location
      const d = target ? distanceKm(runnerGeo, target) : Infinity;
      return { ...t, distanceFromRunnerKm: Number.isFinite(d) ? d : null };
    })
    .filter((t) => (maxKm ? (t.distanceFromRunnerKm ?? Infinity) <= maxKm : true))
    .sort((a, b) => (a.distanceFromRunnerKm ?? Infinity) - (b.distanceFromRunnerKm ?? Infinity));

  return annotated;
}

/* ----------------------------
   Internal helpers (profile)
---------------------------- */
function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveProfile(p) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {}
}
