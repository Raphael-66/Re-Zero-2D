/* Service worker: rede primeiro, cópia em cache se offline. Troque a versão a cada atualização. */
var V = "rz2d-v1-a2";
var FILES = ["./", "index.html", "js/data.js", "js/sprites.js", "js/game.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    Promise.race([
      fetch(e.request).then(function (r) {
        var cp = r.clone();
        caches.open(V).then(function (c) { c.put(e.request, cp); });
        return r;
      }),
      new Promise(function (_, rej) { setTimeout(rej, 3000); })
    ]).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
