/*
 * Cognisaarthi service worker.
 * -----------------------------------------------------------------
 * Purpose: let the app SHELL open without a network, so an elder on a
 * patchy connection still reaches their activities, reminders and
 * routine. The data itself lives in IndexedDB (see lib/offline).
 *
 * Cache strategy, deliberately conservative:
 *
 *   /_next/static/*, fonts, icons   → cache first  (immutable, safe)
 *   elder page navigations          → network first, cached copy as
 *                                     fallback, then /offline.html
 *   /api/*                          → NEVER cached (network only)
 *   /caregiver/*                    → NEVER cached (network only),
 *                                     with ONE narrow exception below
 *
 * Why /api and /caregiver are excluded:
 *   - API responses are per-user and authenticated. Caching them in
 *     Cache Storage risks serving one person's data to another; the
 *     per-user IndexedDB replica is the right home for that.
 *   - Cognisaarthi is built for a SHARED family tablet. A cached
 *     caregiver DASHBOARD could be re-displayed without a valid
 *     caregiver cookie, which would be a real leak. So it is never
 *     stored at all.
 *
 * Phase 7's one exception: /caregiver/offline.
 *
 * That route is a SHELL. Its server render contains no elder name, no
 * scores, no alerts — nothing about anybody. It reads the caregiver's
 * snapshot from IndexedDB on the client, and that store is scoped by
 * caregiver id, cleared on sign-out, and discarded when a different
 * caregiver signs in. So caching the shell stores markup, not data,
 * and the rule above is intact: no per-user caregiver content ever
 * reaches Cache Storage.
 *
 * Elder page HTML *is* cached, because that is what makes the app open
 * offline. It is cleared on sign-out via a CLEAR_CACHES message.
 */

const VERSION = "v1";
const STATIC_CACHE = `cogni-static-${VERSION}`;
const PAGES_CACHE = `cogni-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icon.svg"];

/**
 * The one caregiver route that may be cached. Compared with `===`
 * everywhere it is used, never as a prefix.
 */
const CAREGIVER_OFFLINE_PAGE = "/caregiver/offline";

/** Elder routes whose HTML may be cached for offline opening. */
const CACHEABLE_PAGES = [
  "/home",
  "/games",
  "/reminders",
  "/routine",
  "/memories",
  "/history",
  "/profile",
  "/help",
  "/results",
];

/**
 * Precache the fixed assets.
 *
 * Each entry is stored INDIVIDUALLY on purpose. `cache.addAll()` is
 * atomic: a single failing URL rejects the whole call and leaves the
 * cache completely empty — which, combined with a swallowed error, is
 * indistinguishable from the worker never having run. One missing icon
 * must not cost us the offline page.
 */
async function precache() {
  const cache = await caches.open(STATIC_CACHE);

  const results = await Promise.allSettled(
    PRECACHE.map(async (url) => {
      // `reload` so a stale HTTP-cached copy is never precached.
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`${url} -> ${response.status}`);
      await cache.put(url, response);
      return url;
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(
      "[sw] precache incomplete:",
      failed.map((f) => String(f.reason)),
    );
  }
  console.info(
    `[sw] precached ${results.length - failed.length}/${PRECACHE.length} into ${STATIC_CACHE}`,
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precache()
      .catch((error) => {
        // Never block activation, but say so rather than failing silently.
        console.error("[sw] install failed:", error);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Cache the build assets the page actually loaded.
 *
 * Next.js generates hashed chunk names at build time, so a static list
 * in this file could never name them — and without them the shell
 * cannot boot offline, however many icons we precached. So the page
 * reports which resources it used and the worker decides what may be
 * stored: the allowlist below is enforced HERE, not trusted from the
 * page, so a compromised page cannot talk us into caching /api or a
 * caregiver route.
 */
async function cacheShell(urls) {
  const cache = await caches.open(STATIC_CACHE);

  const allowed = [];
  for (const raw of Array.isArray(urls) ? urls : []) {
    let url;
    try {
      url = new URL(raw, self.location.origin);
    } catch {
      continue;
    }
    if (url.origin !== self.location.origin) continue;
    if (!isStaticAsset(url)) continue; // excludes /api and /caregiver
    allowed.push(url.href);
  }

  let stored = 0;
  await Promise.allSettled(
    allowed.map(async (href) => {
      if (await cache.match(href)) return; // already have it
      const response = await fetch(href);
      if (response.ok) {
        await cache.put(href, response);
        stored += 1;
      }
    }),
  );
  console.info(`[sw] shell: ${stored} new of ${allowed.length} allowed assets`);
}

/**
 * Cache elder pages as full documents.
 *
 * This is what makes offline NAVIGATION work. A client-side App Router
 * navigation asks for RSC data, not a document; when that fails offline
 * Next falls back to a full page load, and that load can only succeed
 * if the document is already here. Caching just the page you happened
 * to load first is not enough — you would land on the offline fallback
 * the moment you pressed Home.
 *
 * Already-cached pages are left alone (so this is one cheap pass per
 * load); `always` re-fetches the page currently being viewed.
 */
async function cachePages(pathnames, always) {
  if (!Array.isArray(pathnames)) return;
  const cache = await caches.open(PAGES_CACHE);

  let stored = 0;
  await Promise.allSettled(
    pathnames.map(async (pathname) => {
      if (typeof pathname !== "string" || !isCacheablePage(pathname)) return;

      if (pathname !== always) {
        const existing = await cache.match(pathname, { ignoreVary: true });
        if (existing) return;
      }

      const response = await fetch(pathname, { credentials: "same-origin" });
      // A redirect means this route sent us to onboarding or a login —
      // never store that under an elder route's key.
      if (!response.ok || response.redirected) return;
      await cache.put(pathname, response);
      stored += 1;
    }),
  );
  console.info(`[sw] pages: ${stored} newly cached into ${PAGES_CACHE}`);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  /** Sign-out clears every cached page, so the next person sees nothing. */
  if (data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
    return;
  }

  if (data.type === "CACHE_SHELL") {
    event.waitUntil(
      Promise.all([
        cacheShell(data.urls),
        // Every supported elder route, plus whichever one is open now.
        cachePages(
          data.pages ? [...data.pages, data.page] : [data.page],
          data.page,
        ),
      ]).catch((error) => console.error("[sw] shell caching failed:", error)),
    );
  }
});

function isCacheablePage(pathname) {
  // The single data-free caregiver shell — see the note at the top.
  // Matched EXACTLY, so no other /caregiver route can slip through on a
  // prefix, and never with a `/…` suffix.
  if (pathname === CAREGIVER_OFFLINE_PAGE) return true;
  if (pathname.startsWith("/caregiver")) return false;
  return CACHEABLE_PAGES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/fonts/")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET is ever cached; everything else goes straight out.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authenticated, per-user, or privacy-sensitive: never cached.
  if (url.pathname.startsWith("/api/")) return;

  /**
   * Caregiver routes stay network-only, exactly as before — with the
   * single exception of the data-free shell, which falls through to the
   * page-cache branch below.
   *
   * An automatic "you're offline, here is the saved view" redirect was
   * tried here and REMOVED: with the dashboard already in the tab's
   * session history, Chrome restores that entry without consulting the
   * worker, so the redirect did not reliably fire. Shipping it would
   * have meant claiming a behaviour that does not happen.
   *
   * The saved view is reached deliberately instead — the "Open the
   * saved view" link in the offline banner, or /caregiver/offline
   * directly. Both are verified working offline.
   */
  if (
    url.pathname.startsWith("/caregiver") &&
    url.pathname !== CAREGIVER_OFFLINE_PAGE
  ) {
    return;
  }

  /**
   * App Router client-side navigation.
   *
   * Clicking a <Link> does NOT make a document request. Next fetches
   * RSC/Flight data instead — `GET /home?_rsc=…` with an `RSC: 1`
   * header and mode "cors", which matches neither the static-asset nor
   * the navigate branch below. Left alone it simply hits the network
   * and fails offline, which is why pressing Home used to land on the
   * offline page.
   *
   * These payloads are deliberately NOT cached: they are authenticated,
   * and they vary with the router state tree, so a stored copy could be
   * served into the wrong state. Instead we fail them cleanly, which
   * makes Next fall back to a full document navigation — and that IS
   * something the page cache can answer.
   */
  const isRscRequest =
    request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (isRscRequest) {
    event.respondWith(fetch(request).catch(() => Response.error()));
    return;
  }

  // Immutable build assets: cache first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Elder page navigations: fresh when possible, cached when not.
  if (request.mode === "navigate" && isCacheablePage(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          // `ignoreSearch` so a page cached as /home still answers a
          // request for /home?foo=1. `ignoreVary` because Next sends
          // `Vary: RSC, Next-Router-State-Tree, Next-Url` on documents —
          // honouring it would mean a cached page almost never matches a
          // real navigation, which is the other half of why Home fell
          // through to the offline page.
          caches
            .match(request, { ignoreSearch: true, ignoreVary: true })
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((response) => response || Response.error()),
        ),
    );
    return;
  }

  // Any other navigation (e.g. onboarding) still gets a friendly page
  // rather than the browser's error screen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((response) => response || Response.error()),
      ),
    );
  }
});
