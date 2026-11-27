// 좌동클럽 게임현황판 오프라인 캐시 (이 폴더 /board/ 안에서만 동작)
const V = 'board-202611271540';
const FC = 'board-face'; // 얼굴 인식 모델(약 8MB)과 글꼴(약 6MB)은 앱 버전이 바뀌어도 지우지 않는 별도 보관함에 둬요
const FONTS = ['fonts/PretendardVariable.woff2', 'fonts/Giants-Regular.ttf', 'fonts/Giants-Bold.ttf', 'fonts/busanM.woff2', 'fonts/busanB.woff2', 'fonts/kk.woff2'];
const PERSIST = p => p.includes('/face/') || p.includes('/fonts/');
const CORE = ['./', './index.html', './manifest.webmanifest', './qr.png', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(async () => { try { const fc = await caches.open(FC); await Promise.all(FONTS.map(async f => { try { if (!(await fc.match(f))) await fc.add(f); } catch (_) {} })); } catch (_) {} }).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil((async () => {
  const ks = await caches.keys(), fc = await caches.open(FC);
  // 이전 버전 보관함에 들어 있던 얼굴 모델은 지우기 전에 별도 보관함으로 옮겨요
  for (const k of ks) { if (k === V || k === FC) continue; try { const oc = await caches.open(k); for (const rq of await oc.keys()) { if (PERSIST(new URL(rq.url).pathname) && !(await fc.match(rq))) { const rs = await oc.match(rq); if (rs) await fc.put(rq, rs); } } } catch (_) {} }
  await Promise.all(ks.filter(k => k !== V && k !== FC).map(k => caches.delete(k)));
  await self.clients.claim();
})()); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  // 폰에서 고치는 원격 공지 파일은 저장해 둔 옛것을 쓰지 않고 항상 새로 받아요
  if (url.pathname.endsWith('/remote.txt') || url.pathname.endsWith('/remote-edit.html') || url.pathname.endsWith('/qr.html') || url.pathname.endsWith('/face-test.html')) return;
  // 화면: 인터넷이 되면 항상 새 버전, 안 되면 저장된 버전
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(fetch(req, {cache: 'no-store'}).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // 얼굴 모델: 한 번 받아 두면 인터넷 없이도 계속 사용
  if (PERSIST(url.pathname)) {
    e.respondWith(caches.open(FC).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); } return r; }).catch(() => hit)));
});
