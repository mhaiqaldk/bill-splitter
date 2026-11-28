"use client";

import { useEffect } from "react";

// Registers the service worker (production only) and, once it is running,
// loads every screen's code once so all of them open offline later.
export function OfflineReady() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then(async (reg) => {
        await Promise.all([import("./Editor"), import("./SharedView"), import("./History")]);
        // Hand over every file this page already loaded, so the worker can save them.
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ type: "cache-urls", urls });
      })
      .catch(() => {});
  }, []);
  return null;
}
