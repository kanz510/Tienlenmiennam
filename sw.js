// Service worker — Tiến Lên Miền Nam (cache để chơi offline)
// Trang HTML luôn lấy từ mạng trước để cơ chế tự cập nhật theo __TLV hoạt động;
// tài nguyên tĩnh có ?v= theo phiên bản nên cache-first an toàn.
const CACHE = 'tlmn-r150';
const ASSETS = ["./","index.html","style.css","rules.js","audio.js","cards-img.js","bot.js","ui.js","game.js","manifest.json","icon.svg","icon-180.png","assets/felt.svg","assets/coin.svg","assets/audio/Nhạc sảnh chờ.mp3","assets/audio/Nhạc trong ván.mp3","assets/cards/3S.svg","assets/cards/3C.svg","assets/cards/3D.svg","assets/cards/3H.svg","assets/cards/4S.svg","assets/cards/4C.svg","assets/cards/4D.svg","assets/cards/4H.svg","assets/cards/5S.svg","assets/cards/5C.svg","assets/cards/5D.svg","assets/cards/5H.svg","assets/cards/6S.svg","assets/cards/6C.svg","assets/cards/6D.svg","assets/cards/6H.svg","assets/cards/7S.svg","assets/cards/7C.svg","assets/cards/7D.svg","assets/cards/7H.svg","assets/cards/8S.svg","assets/cards/8C.svg","assets/cards/8D.svg","assets/cards/8H.svg","assets/cards/9S.svg","assets/cards/9C.svg","assets/cards/9D.svg","assets/cards/9H.svg","assets/cards/10S.svg","assets/cards/10C.svg","assets/cards/10D.svg","assets/cards/10H.svg","assets/cards/JS.svg","assets/cards/JC.svg","assets/cards/JD.svg","assets/cards/JH.svg","assets/cards/QS.svg","assets/cards/QC.svg","assets/cards/QD.svg","assets/cards/QH.svg","assets/cards/KS.svg","assets/cards/KC.svg","assets/cards/KD.svg","assets/cards/KH.svg","assets/cards/AS.svg","assets/cards/AC.svg","assets/cards/AD.svg","assets/cards/AH.svg","assets/cards/2S.svg","assets/cards/2C.svg","assets/cards/2D.svg","assets/cards/2H.svg","assets/css/premium-3d-r122.css","assets/css/premium-art-assets-r140.css","assets/css/premium-artdirection-r139.css","assets/css/premium-artwork-integration-r145.css","assets/css/premium-assets-r127.css","assets/css/premium-bigplay-r131.css","assets/css/premium-card-feedback-r141.css","assets/css/premium-cards-r128.css","assets/css/premium-court-art-r147.css","assets/css/premium-deal-r133.css","assets/css/premium-facecards-r130.css","assets/css/premium-finish-r137.css","assets/css/premium-finish-r138.css","assets/css/premium-focus-r135.css","assets/css/premium-fx-suite-r142.css","assets/css/premium-material-r126.css","assets/css/premium-motion-r129.css","assets/css/premium-regression-fixes-r150.css","assets/css/premium-roundflow-r134.css","assets/css/premium-status-r136.css","assets/css/premium-suit-emblems-r144.css","assets/css/premium-table-art-r146.css","assets/css/premium-table-crest-r143.css","assets/css/premium-transitions-r132.css","assets/avatars/avatar-hung-lion.svg","assets/avatars/avatar-nam-fox.svg","assets/avatars/avatar-player-emerald.svg","assets/avatars/avatar-tuan-tiger.svg","assets/ui/emerald-table-room-r146.svg","assets/ui/premium-player-frame.svg","assets/ui/premium-table-crest-r143.svg","assets/ui/premium-table-felt.svg","assets/fx/chop-heo-burst-r145.svg","assets/fx/victory-plaque-r145.svg","assets/cards/card-back-emerald-r146.svg","assets/cards/card-back-premium.svg","assets/cards/royal-medallion-j-r147.svg","assets/cards/royal-medallion-k-r147.svg","assets/cards/royal-medallion-q-r147.svg","assets/cards/suit-emblem-clubs-r144.svg","assets/cards/suit-emblem-diamonds-r144.svg","assets/cards/suit-emblem-hearts-r144.svg","assets/cards/suit-emblem-spades-r144.svg"];

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
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
    })));
});
