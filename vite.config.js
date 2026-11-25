import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig } from "vite";

function walk(dir, root = dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path, root));
    else files.push(relative(root, path).split("\\").join("/"));
  }
  return files;
}

function serviceWorker() {
  return {
    name: "grok-service-worker",
    apply: "build",
    closeBundle() {
      const dist = join(process.cwd(), "dist");
      const files = walk(dist).filter((file) => file !== "sw.js");
      const precache = files.map((file) => `./${file}`);
      const source = `const CACHE = "grok-course-${Date.now()}";
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        await cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match("./index.html");
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(request);
      return cached || Response.error();
    }
  })());
});
`;
      writeFileSync(join(dist, "sw.js"), source);
    },
  };
}

export default defineConfig({
  base: "/grok-course-trainer/",
  plugins: [serviceWorker()],
});
