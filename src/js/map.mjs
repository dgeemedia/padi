// /src/js/map.mjs
// Minimal Leaflet-based map helper for showing poster + runner markers.
// Requires Leaflet to be included on the page (CSS + JS).

export function initMap(containerId = 'map') {
  try {
    if (typeof L === 'undefined') return null;
  } catch (e) { return null; }

  const map = L.map(containerId, { zoomControl: true }).setView([9.0765, 7.3986], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const instance = { map, markers: {}, polylines: [] };
  // store globally for easy access in the UI
  window._mypadiman_map = instance;
  return instance;
}

export function showTaskOnMap(instance, task, runnerGeo) {
  if (!instance || !instance.map) return;
  const map = instance.map;

  // clear existing markers/polylines
  Object.values(instance.markers).forEach(m => map.removeLayer(m));
  instance.markers = {};
  instance.polylines.forEach(p => map.removeLayer(p));
  instance.polylines = [];

  const pts = [];
  if (task.posterGeo) {
    const m = L.marker([task.posterGeo.lat, task.posterGeo.lon]).addTo(map).bindPopup('Poster location');
    instance.markers.poster = m;
    pts.push([task.posterGeo.lat, task.posterGeo.lon]);
  }
  if (runnerGeo) {
    const m2 = L.marker([runnerGeo.lat, runnerGeo.lon]).addTo(map).bindPopup('Runner location');
    instance.markers.runner = m2;
    pts.push([runnerGeo.lat, runnerGeo.lon]);
  }

  if (pts.length >= 2) {
    const poly = L.polyline(pts, { weight: 3 }).addTo(map);
    instance.polylines.push(poly);
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds.pad(0.3));
  } else if (pts.length === 1) {
    map.setView(pts[0], 14);
  }
}
