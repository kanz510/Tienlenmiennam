// Service worker — Tiến Lên Miền Nam (cache để chơi offline)
// Trang HTML luôn lấy từ mạng trước để cơ chế tự cập nhật theo __TLV hoạt động;
// tài nguyên tĩnh có ?v= theo phiên bản nên cache-first an toàn.
const CACHE = 'tlmn-r64';
const ASSETS = ['./', 'index.html', 'style.css', 'rules.js', 'audio.js', 'cards-img.js', 'bot.js', 'ui.js', 'game.js', 'manifest.json', 'icon.svg', 'icon-180.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);
    if (url.search.includes('tlvcheck')) return;
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    if (req.mode === 'navigate') {
        e.respondWith(fetch(req).catch(() => caches.match('index.html')));
        return;
    }
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
    })));
});
