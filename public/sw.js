// Patungan service worker: lets the app open and work with no internet.
// - Pages: network first, so a new deploy shows up when online; the saved copy is used offline.
// - Built files (/_next/static, hashed and never changed): saved on first use, then served from the cache.
// - Icons and other same-origin files: served from the cache and refreshed in the background.
// - /api/* (the receipt scan) and other sites are never cached.
const VERSION = "v1";
const PAGES = `patungan-pages-${VERSION}`;
const STATIC = `patungan-static-${VERSION}`;
const KEEP = [PAGES, STATIC];
const SHELL = ["/", "/history", "/s"];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

// Saves each page, plus every built file its HTML points to, so any screen opens offline.
async function precacheShell() {
  const pages = await caches.open(PAGES);
  const files = await caches.open(STATIC);
  const assets = new Set();
  for (const path of SHELL) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
    const html = await res.clone().text();
    await pages.put(path, res);
    for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)) assets.add(m[0]);
  }
  // Built JS also loads screens on demand ("static/chunks/…"), so follow those too.
  let queue = [...assets];
  while (queue.length) {
    const found = [];
    await Promise.all(
      queue.map(async (u) => {
        let res = await files.match(u);
        if (!res) {
          await files.add(u).catch(() => null);
          res = await files.match(u);
        }
        if (!res || !u.endsWith(".js")) return;
        const js = await res.text();
        for (const m of js.matchAll(/static\/(?:chunks|media)\/[\w.~-]+\.(?:js|css|woff2)/g)) {
          const next = `/_next/${m[0]}`;
          if (!assets.has(next)) {
            assets.add(next);
            found.push(next);
          }
        }
      }),
    );
    queue = found;
  }
  // Drop built files from older deploys.
  for (const req of await files.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/_next/static/") && !assets.has(path)) await files.delete(req);
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("patungan-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page sends the URLs of files it already loaded (on a first visit they load
// before this worker runs), and asks for the saved pages to be refreshed.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-urls" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((u) => {
    try {
      const url = new URL(u, self.location.origin);
      return url.origin === self.location.origin && !url.pathname.startsWith("/api/") && !url.searchParams.has("_rsc");
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => Promise.all(urls.map(async (u) => ((await cache.match(u)) ? null : cache.add(u).catch(() => null)))))
      // Refresh the saved pages too, so a new deploy is fully saved after one online visit.
      .then(() => precacheShell())
      .catch(() => {}),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  // React Server Component requests from client navigation: leave them to Next.
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (req.mode === "navigate") {
    event.respondWith(pageNetworkFirst(req, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function pageNetworkFirst(req, url) {
  const cache = await caches.open(PAGES);
  // The share link keeps the bill in the hash, so every /s link is the same page.
  const key = url.pathname;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit || Response.error());
  return hit || fresh;
}
