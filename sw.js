/* Service worker de Calma — v20.
   Reglas:
   1. Solo se ocupa de los archivos de la propia app y de las fuentes.
      Las llamadas a Supabase (API) pasan de largo: si se guardaran en caché,
      la app podría leer datos de la nube antiguos.
   2. Solo intercepta peticiones GET. Las de escritura nunca se tocan.
   3. La respuesta de emergencia (index.html) se usa solo al navegar, no para
      imágenes ni fuentes.
   IMPORTANTE: al publicar una versión nueva, sube CACHE aquí y APP_VERSION en
   index.html. La app avisa si los dos números no coinciden. */
const CACHE = 'calma-cache-v36';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const FUENTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // escrituras: nunca

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  const propio = url.origin === self.location.origin;
  const esFuente = FUENTES.indexOf(url.hostname) !== -1;
  if (!propio && !esFuente) return;                    // Supabase y demás: directo a la red

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    }).catch(() => {
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
