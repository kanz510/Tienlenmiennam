// Service worker — Tiến Lên Miền Nam (cache để chơi offline)
// Trang HTML luôn lấy từ mạng trước để cơ chế tự cập nhật theo __TLV hoạt động;
// tài nguyên tĩnh có ?v= theo phiên bản nên cache-first an toàn.
const CACHE = 'tlmn-r81';
const ASSETS = ['./', 'index.html', 'style.css', 'rules.js', 'audio.js', 'cards-img.js', 'bot.js', 'ui.js', 'game.js', 'manifest.json', 'icon.svg', 'icon-180.png', 'assets/felt.svg', 'assets/cards/3S.svg', 'assets/cards/3C.svg', 'assets/cards/3D.svg', 'assets/cards/3H.svg', 'assets/cards/4S.svg', 'assets/cards/4C.svg', 'assets/cards/4D.svg', 'assets/cards/4H.svg', 'assets/cards/5S.svg', 'assets/cards/5C.svg', 'assets/cards/5D.svg', 'assets/cards/5H.svg', 'assets/cards/6S.svg', 'assets/cards/6C.svg', 'assets/cards/6D.svg', 'assets/cards/6H.svg', 'assets/cards/7S.svg', 'assets/cards/7C.svg', 'assets/cards/7D.svg', 'assets/cards/7H.svg', 'assets/cards/8S.svg', 'assets/cards/8C.svg', 'assets/cards/8D.svg', 'assets/cards/8H.svg', 'assets/cards/9S.svg', 'assets/cards/9C.svg', 'assets/cards/9D.svg', 'assets/cards/9H.svg', 'assets/cards/10S.svg', 'assets/cards/10C.svg', 'assets/cards/10D.svg', 'assets/cards/10H.svg', 'assets/cards/JS.svg', 'assets/cards/JC.svg', 'assets/cards/JD.svg', 'assets/cards/JH.svg', 'assets/cards/QS.svg', 'assets/cards/QC.svg', 'assets/cards/QD.svg', 'assets/cards/QH.svg', 'assets/cards/KS.svg', 'assets/cards/KC.svg', 'assets/cards/KD.svg', 'assets/cards/KH.svg', 'assets/cards/AS.svg', 'assets/cards/AC.svg', 'assets/cards/AD.svg', 'assets/cards/AH.svg', 'assets/cards/2S.svg', 'assets/cards/2C.svg', 'assets/cards/2D.svg', 'assets/cards/2H.svg'];

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
