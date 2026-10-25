// PLAY. LOG. PLAY. 오프라인 캐시 (버전이 바뀌면 새 파일로 갈아끼움)
const V = 'plp-202610251957';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 공지 파일은 저장해 둔 옛것을 쓰지 않고 항상 새로 받아요
  if (url.pathname.endsWith('/notice.txt') || url.pathname.endsWith('/club.json')) return;
  // 사용 집계는 저장해 두지 않고 그대로 보내요
  if (url.hostname.endsWith('goatcounter.com') || url.hostname === 'gc.zgo.at') return;
  // 앱 화면: 인터넷이 되면 새 버전, 안 되면 저장된 버전
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // 글꼴·아이콘: 저장된 것 먼저
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; }).catch(() => hit)));
});
