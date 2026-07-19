/* Service worker de Calma.
   Reglas:
   1. Solo se ocupa de los archivos de la propia app y de las fuentes.
      Las llamadas a Supabase (API) pasan de largo: si se guardaran en caché,
      la app podría leer datos de la nube antiguos.
   2. Solo intercepta peticiones GET. Las de escritura nunca se tocan.
   3. La respuesta de emergencia (index.html) se usa solo al navegar, no para
      imágenes ni fuentes.

   VERSIÓN (v27): ya no se escribe aquí. Llega en la URL con la que la app
   registra el worker: sw.js?v=v27. Cambiar APP_VERSION en el HTML es todo lo
   que hay que hacer; para el navegador, sw.js?v=v27 es un archivo distinto de
   sw.js?v=v26, así que lo reinstala solo y estrena caché.
   Si por lo que sea no llega el parámetro, se usa 'v0': la app mostrará
   "caché: v0 ⚠ desajuste" y así el fallo se ve en vez de pasar callando. */
const V = new URL(self.location).searchParams.get('v') || 'v0';
const CACHE = 'calma-cache-' + V;

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

  /* El documento se pide primero a la red y solo se tira de caché si no hay
     conexión. Con la estrategia anterior (caché primero) podías abrir la app
     recién actualizada y seguir viendo la versión vieja hasta la segunda
     recarga. El resto de archivos sí van de caché primero, que es rápido y no
     se quedan obsoletos porque cada versión estrena caché. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    }).catch(() => Response.error()))
  );
});
