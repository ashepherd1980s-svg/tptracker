/* Offline cache. The app page is always fetched fresh when online, so updates show up on the next open. */
const VERSION = "tp-v36";
const FILES = ["./", "./index.html", "./manifest.webmanifest"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => fetch(new Request(f, { cache: "reload" })).then(r => { if (r && r.ok) return c.put(f, r); }).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  const page = e.request.mode === "navigate" || /\/(index\.html)?$/.test(u.pathname);
  if (page) {
    /* network first: newest app when online, saved copy when offline */
    e.respondWith(caches.open(VERSION).then(async c => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(new Request(u.pathname.endsWith("/") ? "./index.html" : e.request.url, { cache: "no-store", signal: ctl.signal }));
        clearTimeout(t);
        if (r && r.ok) { c.put("./index.html", r.clone()); return r; }
      } catch (x) {}
      return (await c.match("./index.html")) || (await c.match(e.request, { ignoreSearch: true })) || Response.error();
    }));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: "no-cache" }).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || (await c.match("./index.html"));
  }));
});
