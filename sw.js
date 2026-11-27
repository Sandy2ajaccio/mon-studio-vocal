// Service worker de Mon Studio Vocal
// À chaque nouvelle version publiée, change le numéro ci-dessous (v6 -> v7…)
// pour que les téléphones récupèrent les nouveaux fichiers.
const CACHE = "studio-vocal-v16";
const FICHIERS = ["./", "index.html", "sep-core.js", "lame.min.js", "manifest.json", "icon-192.png", "icon-512.png"];

// Installation : met tous les fichiers de l'application en cache (fonctionnement hors connexion)
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)));
  self.skipWaiting();
});

// Activation : supprime les anciennes versions du cache (les modèles IA, rangés à part, sont gardés)
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== CACHE && x.startsWith("studio-vocal-")).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

// Requêtes : réseau d'abord (pour avoir la dernière version), cache si pas de connexion
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(r => {
        if (r.ok) { const copie = r.clone(); caches.open(CACHE).then(c => c.put(req, copie)); }
        return r;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
