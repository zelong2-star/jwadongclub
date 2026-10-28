// 좌동클럽 게임현황판 오프라인 캐시 (이 폴더 /board/ 안에서만 동작)
const V = 'board-202610282051';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  // 화면: 인터넷이 되면 항상 새 버전, 안 되면 저장된 버전
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(fetch(req, {cache: 'no-store'}).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; }).catch(() => hit)));
});
