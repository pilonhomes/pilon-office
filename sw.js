// Pilon Homes Office - offline support. Bump VERSION when the app changes.
const VERSION = "pho-v15";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
// cache: "reload" skips the browser's own cache, so a new version never installs an old copy of the page
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== "pho-libs").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;                                   // sync calls to Google go straight to the network
  if (url.hostname.endsWith("google.com") && url.pathname.includes("/macros/")) return;
  if (/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname)) {
    // libraries and fonts: keep a copy so PDFs and exports work offline
    e.respondWith(caches.open("pho-libs").then(async c => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }));
    return;
  }
  if (url.origin === location.origin && req.mode === "navigate") {
    // opening the app: get the newest page when online (up to 4 s), otherwise use the saved copy
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match("./index.html");
      const net = fetch(new Request(req.url, { cache: "no-store" })).then(res => { if (res.ok) c.put("./index.html", res.clone()); return res; });
      if (!hit) return net;
      return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 4000))]);
    }));
    return;
  }
  if (url.origin === location.origin) {
    // other app files: show the saved copy instantly, refresh it in the background for next time
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
