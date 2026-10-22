// ============================================================
//  TIẾN LÊN MIỀN NAM — ui.js: HIỂN THỊ + TƯƠNG TÁC
// ============================================================

const AVATAR_WRAP_IDS = { player: 'awrap-player', left: 'awrap-left', top: 'awrap-top', right: 'awrap-right' };
function setTurnRing(key, frac, danger) {
    const el = document.getElementById(AVATAR_WRAP_IDS[key]);
    if (!el) return;
    if (frac === null || frac === undefined) { el.style.background = ''; return; }
    const pct = Math.max(0, Math.min(100, frac * 100));
    const col = danger ? '#ff5252' : '#ffd700';
    el.style.background = 'conic-gradient(' + col + ' ' + pct + '%, rgba(255,255,255,.14) ' + pct + '%)';
}
function clearTurnRings() { PLAYERS.forEach(k => setTurnRing(k, null)); }

const PASS_LABEL_IDS = { player: 'pass-player', left: 'pass-left', top: 'pass-top', right: 'pass-right' };
function showPassLabel(key) { const el = document.getElementById(PASS_LABEL_IDS[key]); if (el) el.classList.add('show'); }
function clearPassLabels() { PLAYERS.forEach(k => { const el = document.getElementById(PASS_LABEL_IDS[k]); if (el) el.classList.remove('show'); }); }

const BUBBLE_IDS = { left: 'bubble-left', top: 'bubble-top', right: 'bubble-right' };
const bubbleTimers = {};
function showBubble(actorIdx, text) {
    const key = PLAYERS[actorIdx || 0];
    const id = BUBBLE_IDS[key];
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(bubbleTimers[key]);
    bubbleTimers[key] = setTimeout(() => { el.classList.remove('show'); }, 2000);
}

// Số tiền bay lên khỏi avatar của một người (thắng: xanh lá, thua: đỏ)
function floatMoney(key, text, win) {
    const wrap = document.getElementById(AVATAR_WRAP_IDS[key]);
    if (!wrap) return;
    const f = document.createElement('div');
    f.className = 'money-float ' + (win ? 'win' : 'lose');
    f.textContent = text;
    wrap.appendChild(f);
    setTimeout(() => { try { f.remove(); } catch (e) {} }, 1400);
}

function spawnConfetti() {
    const box = document.getElementById('confetti');
    if (!box) return;
    box.innerHTML = '';
    const colors = ['#ffd700', '#f3d27a', '#fff6cf', '#1db981', '#e9c767', '#ffffff'];
    for (let i = 0; i < 34; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = (Math.random() * 100) + '%';
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = (Math.random() * 0.6) + 's';
        p.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
        box.appendChild(p);
    }
}


function updateMoneyUI() {
    PLAYERS.forEach(k => {
        const el = document.getElementById('money-' + k);
        if (el) el.textContent = '💰 ' + state.money[k];
    });
}


function applyRotation() {
    const game = document.getElementById('game-container');
    if (!game) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const portrait = vh > vw;
    const availW = portrait ? vh : vw;
    const availH = portrait ? vw : vh;

    // Khung thiết kế: cao cố định 440px, rộng linh hoạt lấp đầy màn hình.
    // Chừa lề an toàn 20px mỗi bên cho tai thỏ (trừ vào bề rộng hiệu dụng trước khi tính).
    const effW = Math.max(0, availW - 40);
    let s = availH / 440;
    let designW = effW / s;
    if (designW < 780) { s = effW / 780; designW = 780; }
    designW = Math.round(designW);
    const offX = (availW - designW * s) / 2;
    const offY = (availH - 440 * s) / 2;

    game.classList.add('tier-short');
    game.classList.remove('tier-tiny');
    game.classList.remove('rotate-90');
    game.style.width = designW + 'px';
    game.style.height = '440px';
    game.style.transform = portrait
        ? `translate(${vw - offY}px, ${offX}px) rotate(90deg) scale(${s})`
        : `translate(${offX}px, ${offY}px) scale(${s})`;

    // r65: bảng kết ván (#overlay là phần tử fixed riêng, không nằm trong khung game)
    // phải xoay CÙNG khung với bàn chơi khi máy dọc: sao chép nguyên bề rộng + transform
    // của khung game sang overlay (cùng gốc tọa độ top-left, cùng hệ số scale).
    // Máy ngang/desktop: xóa sạch style đã gán để overlay trở lại full-screen như cũ.
    const overlay = document.getElementById('overlay');
    if (overlay) {
        if (portrait) {
            overlay.classList.add('ov-rot');
            overlay.style.width = designW + 'px';
            overlay.style.height = '440px';
            overlay.style.transform = game.style.transform;
        } else {
            overlay.classList.remove('ov-rot');
            overlay.style.width = '';
            overlay.style.height = '';
            overlay.style.transform = '';
        }
    }
}


function updateTurnIndicator() {
    const targets = {
        player: document.querySelector('.player-info'),
        left: document.querySelector('.bot-left .bot-info'),
        top: document.querySelector('.bot-top .bot-info'),
        right: document.querySelector('.bot-right .bot-info')
    };
    Object.values(targets).forEach(el => { if (el) el.classList.remove('active-turn'); });
    clearTurnRings();
    if (state.gameOver) return;
    const el = targets[PLAYERS[state.turn]];
    if (el) el.classList.add('active-turn');
    // Bot không có đồng hồ riêng → vòng đầy khi tới lượt; vòng của người chơi do updateTimerUI chạy theo giây
    if (state.turn !== 0) setTurnRing(PLAYERS[state.turn], 1, false);
}

function render() {
    renderPlayerHand();
    renderBotHand('left', 'cards-left', 'count-left');
    renderBotHand('right', 'cards-right', 'count-right');
    renderBotHand('top', 'cards-top', 'count-top');
    renderLastPlay();
    updateButtons();
    updateMoneyUI();
    saveGame();
}

// Dãy sảnh dài nhất chứa rank rv (không tính lá 2); trả về mảng rankValue hoặc null

function straightRunThrough(rv) {
    if (rv >= RANK_2) return null;
    const present = new Set(state.hands.player.map(c => rankValue(c)).filter(v => v < RANK_2));
    if (!present.has(rv)) return null;
    let lo = rv, hi = rv;
    while (present.has(lo - 1)) lo--;
    while (present.has(hi + 1)) hi++;
    if (hi - lo + 1 < 3) return null;
    const run = [];
    for (let r = lo; r <= hi; r++) run.push(r);
    return run;
}

// Đồng bộ class 'selected' lên các lá bài ĐÃ CÓ trong DOM (không dựng lại),
// để transition của lá bài chạy mượt khi chọn/bỏ chọn
function syncSelectedUI() {
    const wrap = document.getElementById('cards-player');
    if (wrap) {
        [...wrap.children].forEach((el, i) => el.classList.toggle('selected', state.selected.has(i)));
    }
    updateButtons();
}

// Chọn bài nhanh: click lá chưa chọn -> chọn cả nhóm cùng số / cả sảnh (nếu ở đầu mút);
// click lá đã chọn -> bỏ chọn cả nhóm / cả sảnh chứa nó
let suppressNextClick = false;
function handleCardClick(idx) {
    if (suppressNextClick) { suppressNextClick = false; return; }
    if (state.gameOver || state.turn !== 0) return;
    const hand = state.hands.player;
    const rv = rankValue(hand[idx]);

    if (state.selected.has(idx)) {
        // Chạm lá đang chọn -> chỉ hạ đúng lá đó xuống, giữ nguyên các lá còn lại đang chọn
        state.selected.delete(idx);
    } else {
        // Ưu tiên theo bài trên bàn: phải theo vòng thì gom đúng loại bộ của đối thủ trước
        if (state.lastPlay && state.lastPlay.combo) {
            const tType = state.lastPlay.combo.type;
            if (tType === 'single') {
                // Bàn là lá đơn -> chỉ chọn đúng lá vừa click
                state.selected.add(idx);
                syncSelectedUI();
                return;
            }
            const sameRankIdx = [];
            hand.forEach((c, i) => { if (rankValue(c) === rv) sameRankIdx.push(i); });
            if (tType === 'pair' && sameRankIdx.length >= 2) {
                // Bàn là đôi -> chọn đúng 1 đôi của số này (lá vừa click + lá cùng số chất cao nhất)
                const others = sameRankIdx.filter(i => i !== idx);
                state.selected.add(idx);
                state.selected.add(others[others.length - 1]);
                syncSelectedUI();
                return;
            }
            if (tType === 'triple' && sameRankIdx.length >= 3) {
                // Bàn là sám -> chọn đúng 1 sám của số này (lá vừa click + 2 lá cùng số chất cao nhất)
                const others = sameRankIdx.filter(i => i !== idx);
                state.selected.add(idx);
                state.selected.add(others[others.length - 1]);
                state.selected.add(others[others.length - 2]);
                syncSelectedUI();
                return;
            }
            if (tType === 'straight') {
                // Bàn là sảnh -> phải chọn sảnh ĐÚNG ĐỘ DÀI của sảnh trên bàn (r67):
                // xét mọi "cửa sổ" dài bằng sảnh bàn nằm trong dãy liên tục chứa lá vừa
                // chạm, lấy cửa sổ yếu nhất mà vẫn đè được; không có thì chỉ chọn lá đó.
                const need = state.lastPlay.combo.cards.length;
                const runFull = straightRunThrough(rv);
                let bestWin = null, bestRank = Infinity;
                if (runFull && runFull.length >= need) {
                    const pos = runFull.indexOf(rv);
                    for (let st = Math.max(0, pos - need + 1); st <= Math.min(pos, runFull.length - need); st++) {
                        const win = runFull.slice(st, st + need);
                        const cards = win.map(r => (r === rv) ? hand[idx] : hand.find(c => rankValue(c) === r));
                        const combo = getCombo(cards);
                        if (combo && combo.type === 'straight' && canBeat(combo, state.lastPlay.combo) && combo.rank < bestRank) {
                            bestRank = combo.rank; bestWin = win;
                        }
                    }
                }
                if (bestWin) {
                    bestWin.forEach(r => {
                        const i = (r === rv) ? idx : hand.findIndex(c => rankValue(c) === r);
                        if (i >= 0) state.selected.add(i);
                    });
                } else {
                    state.selected.add(idx);
                }
                syncSelectedUI();
                return;
            }
        }
        // Ưu tiên sảnh: các lá đang chọn (không trùng số) đều thuộc cùng một sảnh với lá
        // vừa click -> chọn cả sảnh dài nhất đó, thay vì gom đôi/sám của lá vừa click
        const runFirst = straightRunThrough(rv);
        if (runFirst && state.selected.size > 0) {
            const runSet = new Set(runFirst);
            const selRankList = [...state.selected].map(i => rankValue(hand[i]));
            const noDup = new Set(selRankList).size === selRankList.length;
            if (noDup && selRankList.every(r => runSet.has(r))) {
                runFirst.forEach(r => {
                    if (selRankList.includes(r)) return; // giữ lá đã chọn của số này
                    const i = (r === rv) ? idx : hand.findIndex(c => rankValue(c) === r);
                    if (i >= 0) state.selected.add(i);
                });
                syncSelectedUI();
                return;
            }
        }
        const sameRank = [];
        hand.forEach((c, i) => { if (rankValue(c) === rv) sameRank.push(i); });
        if (sameRank.length > 1) {
            // Có đôi/sám/tứ: chọn cả nhóm cùng số
            sameRank.forEach(i => state.selected.add(i));
        } else {
            const run = straightRunThrough(rv);
            if (run && (rv === run[0] || rv === run[run.length - 1])) {
                // Lá đơn ở đầu mút sảnh: chọn toàn bộ sảnh dài nhất chứa nó
                run.forEach(r => {
                    const i = (r === rv) ? idx : hand.findIndex(c => rankValue(c) === r);
                    if (i >= 0) state.selected.add(i);
                });
            } else {
                state.selected.add(idx);
            }
        }
    }
    syncSelectedUI();
}


function renderPlayerHand() {
    const el = document.getElementById('cards-player');
    el.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const c = createCardEl(card);
        c.dataset.idx = i;
        c.style.zIndex = i + 1; // lá sau nằm trên lá trước: góc số/chất bên trái luôn lộ rõ
        if (state.selected.has(i)) c.classList.add('selected');
        c.addEventListener('click', () => handleCardClick(i));
        el.appendChild(c);
    });
    document.getElementById('count-player').textContent = state.hands.player.length;
}

function renderBotHand(who, elId, countId) {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    const count = state.hands[who].length;
    if (state.gameOver) {
        // r63: hết ván thì NGỬA toàn bộ bài còn lại của bot cho mọi người cùng xem
        state.hands[who].forEach((card, i) => {
            const c = createCardEl(card);
            c.classList.add('revealed');
            c.style.animationDelay = (i * 45) + 'ms';
            el.appendChild(c);
        });
    } else {
        for (let i = 0; i < count; i++) {
            const c = document.createElement('div');
            c.className = 'back-card';
            el.appendChild(c);
        }
    }
    document.getElementById(countId).textContent = count;
}

const COMBO_LABELS = { single: 'đơn', pair: 'đôi', triple: 'sám', straight: 'sảnh', quad: 'tứ quý', double_straight: 'đôi thông' };

let lastPlayAnimKey = null;

function renderLastPlay() {
    const el = document.getElementById('played-cards');
    const ghost = document.getElementById('played-ghost');
    const info = document.getElementById('last-play-info');
    if (!state.lastPlay) {
        el.innerHTML = '';
        if (ghost) ghost.innerHTML = '';
        if (info) { info.textContent = ''; info.classList.remove('show', 'big-play'); }
        lastPlayAnimKey = null;
        return;
    }
    // Chỉ bay khi nước đánh thay đổi thật; các lần render lại (qua lượt/bỏ lượt) thì đứng yên
    const key = state.lastPlay.player + '|' + state.lastPlay.cards.map(c => c.rank + c.suit).join(',');
    const animate = key !== lastPlayAnimKey;
    // Nước cũ lùi xuống lớp mờ phía dưới đống bài
    if (animate && ghost && el.children && el.children.length) {
        ghost.innerHTML = '';
        [...el.children].forEach(ch => {
            if (!ch.cloneNode) return;
            const cl = ch.cloneNode(true);
            cl.classList.remove('card-play-anim', 'from-bottom', 'from-left', 'from-right', 'from-top');
            cl.style.transform = '';
            ghost.appendChild(cl);
        });
    }
    lastPlayAnimKey = key;
    el.innerHTML = '';
    const sorted = [...state.lastPlay.cards].sort(compareCards);
    const midIdx = (sorted.length - 1) / 2;
    sorted.forEach((card, i) => {
        const c = createCardEl(card);
        // Xòe quạt ra 2 phía theo vị trí (lá giữa thẳng, ra rìa nghiêng dần, tối đa ±14°) để góc số không đè nhau
        const tilt = Math.max(-14, Math.min(14, (i - midIdx) * 4));
        c.style.transform = 'rotate(' + tilt + 'deg)';
        el.appendChild(c);
    });
    if (info) {
        info.textContent = PLAYER_NAMES[PLAYERS[state.lastPlay.player]] + ' · ' + (COMBO_LABELS[state.lastPlay.combo.type] || '');
        info.classList.add('show');
        info.classList.toggle('big-play', isBigPlay(state.lastPlay.combo, state.lastPlayWasChop));
    }
}

// ===== r68/r69: BAY BÀI TỪ VỊ TRÍ THẬT + NHẤN SÁNG NGƯỜI VỪA ĐÁNH =====
// Tọa độ được đo bằng getBoundingClientRect() (hệ viewport) rồi chuyển đổi về hệ
// local của #fly-layer bằng MA TRẬN NEO: 3 phần tử neo tạm đặt tại local (0,0),
// (100,0), (0,100) ngay trong #fly-layer — chúng chịu đúng phép biến đổi của khung
// (xoay 90°/scale/translate trên máy dọc) như mọi clone, nên phép chuyển đổi đúng
// tuyệt đối mà không cần biết transform của bất kỳ phần tử cha nào, và không trộn
// tọa độ viewport với tọa độ local. (r69 thay cho cách cộng offset thủ công ở r68.)
function flyMatrix() {
    try {
        const layer = document.getElementById('fly-layer');
        if (!layer || !layer.getBoundingClientRect) return null;
        const anchor = (l, t) => {
            const d = document.createElement('div');
            d.style.cssText = 'position:absolute;width:0;height:0;left:' + l + 'px;top:' + t + 'px;';
            layer.appendChild(d);
            const r = d.getBoundingClientRect();
            d.remove();
            return { x: r.left, y: r.top };
        };
        const A = anchor(0, 0), B = anchor(100, 0), C = anchor(0, 100);
        const ux = B.x - A.x, uy = B.y - A.y, vx = C.x - A.x, vy = C.y - A.y;
        const det = ux * vy - vx * uy;
        if (!det || !isFinite(det)) return null;
        return { ax: A.x, ay: A.y, ux: ux, uy: uy, vx: vx, vy: vy, det: det };
    } catch (e) { return null; }
}

// Chuyển một điểm viewport (client) về hệ local của #fly-layer theo ma trận neo.
function flyLocalPoint(m, cx, cy) {
    const dx = cx - m.ax, dy = cy - m.ay;
    return {
        x: (dx * m.vy - dy * m.vx) / m.det * 100,
        y: (dy * m.ux - dx * m.uy) / m.det * 100
    };
}

// Đo một phần tử theo hệ local của #fly-layer: tâm (cx, cy) từ rect đã chuyển đổi,
// kích thước w/h là kích thước layout trong cùng hệ local (clone là con của
// #fly-layer nên dùng chung đơn vị). Không dựng được ma trận (môi trường không có
// layout thật) thì trả kích thước 0 để tầng bay tự bỏ qua an toàn.
function measureFly(el, m) {
    const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
    if (!m || !el.getBoundingClientRect) return { cx: 0, cy: 0, w: 0, h: 0 };
    const r = el.getBoundingClientRect();
    const p = flyLocalPoint(m, r.left + r.width / 2, r.top + r.height / 2);
    return { cx: p.x, cy: p.y, w: w, h: h };
}

// Chụp vị trí các lá SẮP bay trên tay người đánh — phải gọi TRƯỚC khi tay bị cắt/render
// lại. Trả về [{card, cx, cy, w, h}] sắp theo đúng thứ tự lá hiển thị trên bàn.
// Bot: bài đang úp không có định danh trên DOM -> lấy các lá úp cuối cùng của ĐÚNG
// vùng bài của bot đó (#cards-<who>) làm điểm xuất phát.
function captureFlySource(who, cards) {
    try {
        const m = flyMatrix();
        const sorted = [...cards].sort(compareCards);
        if (who === 'player') {
            const wrap = document.getElementById('cards-player');
            if (!wrap) return null;
            const out = [];
            sorted.forEach(card => {
                const el = wrap.children[state.hands.player.indexOf(card)];
                if (el) { const p = measureFly(el, m); out.push({ card: card, cx: p.cx, cy: p.cy, w: p.w, h: p.h }); }
            });
            return out.length ? out : null;
        }
        const wrapB = document.getElementById('cards-' + who);
        if (!wrapB || !wrapB.children.length) return null;
        const kids = [...wrapB.children].slice(-sorted.length);
        return sorted.map((card, i) => {
            const p = measureFly(kids[Math.min(i, kids.length - 1)], m);
            return { card: card, cx: p.cx, cy: p.cy, w: p.w, h: p.h };
        });
    } catch (e) { return null; }
}

let flyCleanup = null; // hàm dọn của lượt bay đang chạy (để hủy an toàn khi lượt mới đến)

// r70: bộ "lớn" đáng hiệu ứng mạnh: tứ quý, đôi thông, hoặc bất kỳ nước chặt heo nào
function isBigPlay(combo, wasChop) {
    return !!wasChop || !!(combo && (combo.type === 'quad' || combo.type === 'double_straight'));
}

// r70: hiệu ứng khi lá HẠ CÁNH tự nhiên (không chạy khi lượt bay bị hủy giữa chừng):
// lá đích nảy nhẹ về vị trí, một vòng sáng lan ra tại tâm đống bài, và nếu là bộ lớn
// thì bung 14 hạt vàng. Mọi phần tử tự xóa bằng finished promise.
function onFlyLanded(destEls, center, big) {
    try {
        if (!center) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const probe = document.createElement('div');
        if (!probe.animate) return;
        const layer = document.getElementById('fly-layer');
        const dest = document.getElementById('played-cards');
        destEls.forEach(el => {
            if (!dest || el.parentNode !== dest || !el.animate) return;
            const base = el.style.transform || '';
            el.animate([
                { transform: base + ' scale(1.09) translateY(2px)' },
                { transform: base }
            ], { duration: 180, easing: 'ease-out' });
        });
        if (!layer) return;
        const ring = document.createElement('div');
        ring.className = 'fx-ring';
        ring.style.left = (center.cx - 16) + 'px';
        ring.style.top = (center.cy - 16) + 'px';
        ring.style.width = '32px';
        ring.style.height = '32px';
        layer.appendChild(ring);
        const ra = ring.animate([
            { transform: 'scale(.5)', opacity: .8 },
            { transform: 'scale(2.6)', opacity: 0 }
        ], { duration: 380, easing: 'ease-out' });
        ra.finished.then(() => ring.remove()).catch(() => ring.remove());
        if (big) {
            for (let i = 0; i < 14; i++) {
                const sp = document.createElement('div');
                sp.className = 'fx-spark';
                const sz = 5 + Math.random() * 4;
                sp.style.width = sz + 'px';
                sp.style.height = sz + 'px';
                sp.style.left = (center.cx - sz / 2) + 'px';
                sp.style.top = (center.cy - sz / 2) + 'px';
                layer.appendChild(sp);
                const ang = (Math.PI * 2 * i) / 14 + (Math.random() - .5) * .5;
                const r = 46 + Math.random() * 38;
                const sa = sp.animate([
                    { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
                    { transform: 'translate(' + Math.cos(ang) * r + 'px, ' + (Math.sin(ang) * r - 12) + 'px) scale(.4)', opacity: 0 }
                ], { duration: 480 + Math.random() * 180, easing: 'cubic-bezier(.15,.7,.4,1)' });
                sa.finished.then(() => sp.remove()).catch(() => sp.remove());
            }
        }
    } catch (e) { /* hiệu ứng phụ */ }
}

// Bay các lá từ vị trí đã chụp ra đúng vị trí cuối trên bàn bằng Web Animations API.
// Lá đích thật bị ẩn trong lúc bay (không nhân đôi); dọn clone bằng finished promise.
function playFlyAnimation(who, srcList) {
    try {
        flashJustPlayed(who);
        if (!srcList || !srcList.length) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const probe = document.createElement('div');
        if (!probe.animate) return; // môi trường không hỗ trợ WAAPI: hiện bài ngay, không bay
        const layer = document.getElementById('fly-layer');
        const dest = document.getElementById('played-cards');
        if (!layer || !dest || !dest.children.length) return;
        if (flyCleanup) flyCleanup(); // hủy lượt bay trước nếu còn đang chạy
        const destEls = [...dest.children];
        const mDest = flyMatrix(); // ma trận đo đích tại đúng thời điểm này
        const n = Math.min(srcList.length, destEls.length);
        const clones = [];
        const anims = [];
        const hiddenEls = []; // chỉ những phần tử CHÍNH lượt này đã ẩn mới được khôi phục
        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            clones.forEach(c => c.remove());
            // Chỉ khôi phục visibility cho phần tử của chính lượt này và chỉ khi nó
            // VẪN còn là lá đang hiển thị trong #played-cards. Nếu render mới đã thay
            // nó (lượt mới), tuyệt đối không chạm vào — tránh hiện/ẩn nhầm bài lượt sau.
            hiddenEls.forEach(el => {
                const destNow = document.getElementById('played-cards');
                if (destNow && el.parentNode === destNow) el.style.visibility = '';
            });
            if (flyCleanup === cleanup) flyCleanup = null;
        };
        flyCleanup = cleanup;
        for (let i = 0; i < n; i++) {
            const dEl = destEls[i];
            const d = measureFly(dEl, mDest);
            const s = srcList[i];
            if (!s.w || !s.h || !d.w || !d.h) continue;
            const clone = createCardEl(s.card);
            clone.style.position = 'absolute';
            clone.style.left = (s.cx - s.w / 2) + 'px';
            clone.style.top = (s.cy - s.h / 2) + 'px';
            clone.style.width = s.w + 'px';
            clone.style.height = s.h + 'px';
            clone.style.margin = '0';
            clone.style.zIndex = 10 + i;
            layer.appendChild(clone);
            clones.push(clone);
            dEl.style.visibility = 'hidden';
            hiddenEls.push(dEl);
            const dx = d.cx - s.cx;
            const dy = d.cy - s.cy;
            const m = /rotate\((-?[\d.]+)deg\)/.exec(dEl.style.transform || '');
            const tilt = m ? parseFloat(m[1]) : 0;
            // r71: thêm điểm giữa nhấc nhẹ + phóng hơi lớn để quỹ đạo thành cung bay
            // tự nhiên; điểm đầu và điểm cuối giữ nguyên như đã đối chiếu ở r69.
            const midSx = (1 + d.w / s.w) / 2 * 1.05, midSy = (1 + d.h / s.h) / 2 * 1.05;
            anims.push(clone.animate([
                { transform: 'translate(0px, 0px) scale(1, 1) rotate(0deg)', opacity: 1 },
                { transform: 'translate(' + (dx * .55) + 'px, ' + (dy * .55 - 10) + 'px) scale(' + midSx + ', ' + midSy + ') rotate(' + (tilt * .55) + 'deg)', opacity: 1, offset: .55 },
                { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + (d.w / s.w) + ', ' + (d.h / s.h) + ') rotate(' + tilt + 'deg)', opacity: 1 }
            ], { duration: 430, delay: i * 25, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'forwards' }));
        }
        if (!anims.length) { cleanup(); return; }
        const destCenter = measureFly(dest, mDest);
        const big = isBigPlay(state.lastPlay && state.lastPlay.combo, state.lastPlayWasChop);
        Promise.allSettled(anims.map(a => a.finished)).then(() => {
            cleanup();
            onFlyLanded(destEls, destCenter, big);
        });
    } catch (e) { /* hiệu ứng phụ: lỗi thì bỏ qua, bài trên bàn vẫn hiển thị bình thường */ }
}

// Nhấn sáng xấp bài vừa đánh + vòng avatar của đúng người đánh + nhãn VỪA ĐÁNH (~1,1s).
// Lượt mới đến thì hủy hiệu ứng cũ trước để không chồng chéo.
function flashJustPlayed(who) {
    try {
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const played = document.getElementById('played-cards');
        if (played && played.animate && !reduced) {
            played.getAnimations().forEach(a => a.cancel());
            played.animate([
                { boxShadow: '0 0 0 3px rgba(255,215,0,.95), 0 0 28px rgba(255,215,0,.6)' },
                { boxShadow: '0 0 0 0 rgba(255,215,0,0), 0 0 0 rgba(255,215,0,0)' }
            ], { duration: 750, easing: 'ease-out' });
        }
        const wrap = document.getElementById(AVATAR_WRAP_IDS[who]);
        if (wrap && wrap.animate && !reduced) {
            wrap.getAnimations().forEach(a => a.cancel());
            wrap.animate([
                { boxShadow: '0 0 0 3px rgba(255,215,0,.95), 0 0 18px rgba(255,215,0,.7)' },
                { boxShadow: '0 0 0 0 rgba(255,215,0,0), 0 0 0 rgba(255,215,0,0)' }
            ], { duration: 750, easing: 'ease-out' });
        }
        ['player', 'left', 'top', 'right'].forEach(k => {
            const b = document.getElementById('just-' + k);
            if (b) { if (b.getAnimations) b.getAnimations().forEach(a => a.cancel()); b.classList.add('hidden'); }
        });
        const badge = document.getElementById('just-' + who);
        if (badge && badge.animate && !reduced) {
            badge.classList.remove('hidden');
            const a = badge.animate([
                { opacity: 0, transform: 'scale(.7) translateY(3px)' },
                { opacity: 1, transform: 'scale(1) translateY(0)', offset: .18 },
                { opacity: 1, transform: 'scale(1) translateY(0)', offset: .78 },
                { opacity: 0, transform: 'scale(.92) translateY(-2px)' }
            ], { duration: 1100, easing: 'ease-out', fill: 'forwards' });
            a.finished.then(() => badge.classList.add('hidden')).catch(() => {});
        }
    } catch (e) {}
}

// Hình mặt J/Q/K cổ điển: mỗi rank một hình dùng cho cả 4 chất (chất phân biệt ở góc số)
function faceArtFor(card) { return CARD_IMG['face-' + card.rank] || ''; }

function createCardEl(card) {
    const div = document.createElement('div');
    const isRed = (card.suit === '♥' || card.suit === '♦');
    div.className = 'card ' + (isRed ? 'red' : 'black');
    const face = faceArtFor(card);
    // Lá số/A: góc chỉ để con số, toàn lá chỉ có 1 hình chất to ở giữa (như Bảo chốt); lá mặt giữ chất nhỏ ở góc
    div.innerHTML = `
        <div class="corner">
            <span>${card.rank}</span>
            ${face ? `<span>${card.suit}</span>` : ''}
        </div>
        ${face ? `<img class="face-art" src="${face}" alt="">` : `<div class="suit-big">${card.suit}</div>`}
    `;
    return div;
}

function showMessage(msg) {
    document.getElementById('message').textContent = msg;
}

function updateButtons() {
    const isMyTurn = (state.turn === 0) && !state.gameOver;
    const playBtn = document.getElementById('btn-play');
    playBtn.disabled = !isMyTurn || state.hasPassed || state.selected.size === 0;
    document.getElementById('btn-pass').disabled = !isMyTurn || state.hasPassed || !state.lastPlay;
    // Sáng nút Đánh khi bộ đang chọn hợp lệ và đè được (chỉ hiển thị — luật vẫn do playerPlay chốt)
    let ready = false;
    if (isMyTurn && !state.hasPassed && state.selected.size > 0) {
        const cards = [...state.selected].map(i => state.hands.player[i]).sort(compareCards);
        const combo = getCombo(cards);
        ready = !!combo && (!state.lastPlay || canBeat(combo, state.lastPlay.combo));
        if (ready && state.firstMove && !cards.some(c => c.rank === '3' && c.suit === '♠')) ready = false;
    }
    if (ready) playBtn.classList.add('ready'); else playBtn.classList.remove('ready');
    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) hintBtn.disabled = !isMyTurn || state.hasPassed || state.hintsLeft <= 0;
}

// ============================================================
//  PLAYER ACTIONS
// ============================================================


// ============================================================
//  TIỆN ÍCH + MODAL (gợi ý, sắp xếp, vuốt chọn, cài đặt/thống kê/luật)
// ============================================================
function updateHintButton() {
    const b = document.getElementById('btn-hint');
    if (b) b.textContent = '💡' + state.hintsLeft;
}

// GỢI Ý: tô sáng nước đi hợp lệ tốt nhất (mỗi ván tối đa 3 lần)
function hintMove() {
    if (state.turn !== 0 || state.gameOver || state.hintsLeft <= 0) return;
    const hand = state.hands.player;
    let pick = null;
    if (state.firstMove) {
        pick = pickFirstMove(hand, false);
    } else if (!state.lastPlay) {
        const leads = leadCandidates(hand);
        const normal = leads.filter(x => !isSpecialCombo(x.combo));
        const pool = normal.length ? normal : leads;
        if (pool.length) {
            pool.sort((a, b) => (b.cards.length - a.cards.length) || (a.combo.rank - b.combo.rank));
            pick = pool[0];
        } else {
            pick = { cards: [hand[0]], combo: getCombo([hand[0]]) };
        }
    } else {
        const cands = findCandidates(hand, state.lastPlay.combo);
        if (cands.length) {
            const normal = cands.filter(x => !isSpecialCombo(x.combo));
            pick = (normal.length ? normal : cands)[0];
        }
    }
    if (!pick) { showMessage('Không có nước đè được — hãy bỏ lượt!'); return; }
    state.hintsLeft--;
    state.selected = new Set(pick.cards.map(c => hand.indexOf(c)));
    syncSelectedUI();
    updateHintButton();
    showMessage('💡 Gợi ý: ' + formatCombo(pick.combo || getCombo(pick.cards)) + ' (còn ' + state.hintsLeft + ' lần gợi ý)');
}

// SẮP XẾP: đổi giữa xếp theo số và xếp theo bộ
function toggleSort() {
    state.sortMode = state.sortMode === 'combo' ? 'rank' : 'combo';
    state.selected.clear();
    state.hands.player = state.sortMode === 'combo' ? sortHandByCombo(state.hands.player) : sortHand(state.hands.player);
    renderPlayerHand();
    syncSelectedUI();
    saveGame();
    showMessage(state.sortMode === 'combo' ? 'Đã xếp theo bộ (đôi/sám/sảnh gom lại)' : 'Đã xếp theo số');
}

// VUỐT CHỌN: kéo ngang qua nhiều lá để chọn cả dải
function initSwipeSelect() {
    const cp = document.getElementById('cards-player');
    if (!cp || !cp.addEventListener) return;
    let dragging = false, dragMoved = false, dragStart = null;
    const cardAt = e => {
        if (!document.elementFromPoint) return null;
        const t = document.elementFromPoint(e.clientX, e.clientY);
        return t && t.closest ? t.closest('#cards-player .card') : null;
    };
    cp.addEventListener('pointerdown', e => {
        if (state.turn !== 0 || state.gameOver) return;
        const t = cardAt(e) || (e.target && e.target.closest ? e.target.closest('#cards-player .card') : null);
        if (!t || t.dataset.idx === undefined) return;
        dragging = true; dragMoved = false; dragStart = +t.dataset.idx;
    });
    cp.addEventListener('pointermove', e => {
        if (!dragging || state.turn !== 0 || state.gameOver) return;
        const t = cardAt(e);
        if (!t || t.dataset.idx === undefined) return;
        const idx = +t.dataset.idx;
        if (idx === dragStart && !dragMoved) return;
        dragMoved = true;
        const a = Math.min(dragStart, idx), b = Math.max(dragStart, idx);
        state.selected = new Set();
        for (let i = a; i <= b; i++) state.selected.add(i);
        syncSelectedUI();
    });
    const endDrag = () => {
        if (dragging && dragMoved) {
            suppressNextClick = true;
            setTimeout(() => { suppressNextClick = false; }, 50);
        }
        dragging = false; dragMoved = false; dragStart = null;
    };
    cp.addEventListener('pointerup', endDrag);
    cp.addEventListener('pointercancel', endDrag);
}

// MODAL
function openModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('hidden'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.add('hidden'); }

function syncSettingsForm() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    set('set-sound', settings.sound);
    set('set-voice', settings.voice);
    set('set-autoplay', settings.autoPlay);
    setV('set-speed', settings.botSpeed);
    setV('set-difficulty', settings.difficulty);
    setV('set-bet', settings.bet);
    setV('set-table', settings.tableColor);
    setV('set-back', settings.backStyle);
    const rf = document.getElementById('btn-refill');
    if (rf) rf.disabled = state.money.player >= 100;
    // r61: khóa lựa chọn chưa sở hữu trong Cửa hàng
    (document.querySelectorAll ? document.querySelectorAll('option[data-shop]') : []).forEach(op => {
        const it = SHOP_ITEMS.find(x => x.id === op.getAttribute('data-shop'));
        if (!it) return;
        const has = owns(it.id);
        op.disabled = !has;
        op.textContent = op.getAttribute('data-name') + (has ? '' : ' 🔒 ' + it.price + ' xu');
    });
}

function renderStats() {
    const box = document.getElementById('stats-body');
    if (!box) return;
    const wr = stats.games ? Math.round(stats.wins / stats.games * 100) : 0;
    box.innerHTML =
        '<div class="bd-row"><span>Số ván đã chơi</span><b>' + stats.games + '</b></div>' +
        '<div class="bd-row"><span>Thắng / Thua</span><b>' + stats.wins + ' / ' + stats.losses + ' (' + wr + '%)</b></div>' +
        '<div class="bd-row"><span>Chuỗi thắng hiện tại</span><b>' + stats.curStreak + '</b></div>' +
        '<div class="bd-row"><span>Chuỗi thắng dài nhất</span><b>' + stats.bestStreak + '</b></div>' +
        '<div class="bd-row"><span>Thắng lớn nhất (1 ván)</span><b>+' + stats.biggestWin + ' xu</b></div>';
}

// Bảng kê tiền cuối ván trong overlay
function renderBreakdown(totalDelta) {
    const box = document.getElementById('overlay-breakdown');
    if (!box) return;
    const names = { base: 'Thắng cơ bản', cong: 'Cóng (chưa đánh lá nào)', thoi: 'Thối heo', chat: 'Chặt heo', 'chat-chong': 'Chặt chồng heo', toitrang: 'Tới trắng' };
    let html = '';
    state.ledger.forEach(en => {
        html += '<div class="bd-row"><span>' + (names[en.type] || en.type) + ': ' + PLAYER_NAMES[en.from] + ' → ' + PLAYER_NAMES[en.to] + (en.note ? ' (' + en.note + ')' : '') + '</span><b>' + en.amount + '</b></div>';
    });
    html += '<div class="bd-total">';
    PLAYERS.forEach(k => {
        html += '<div class="bd-row"><span>' + PLAYER_NAMES[k] + ' — tổng ván</span><b>' + (totalDelta[k] > 0 ? '+' : '') + totalDelta[k] + ' xu</b></div>';
    });
    html += '</div>';
    if (typeof levelUpNote !== 'undefined' && levelUpNote) html += '<div class="bd-row"><span>' + levelUpNote + '</span><b></b></div>';
    box.innerHTML = html;
}

// ============================================================
//  r61: CỬA HÀNG + NHIỆM VỤ — giao diện và mua/bán (dữ liệu ở game.js: meta/TASK_DEFS)
// ============================================================
const SHOP_ITEMS = [
    { id: 'back-vangkim',   kind: 'back',   name: 'Lưng bài Vàng kim',  price: 500,  value: 'vangkim' },
    { id: 'back-timmong',   kind: 'back',   name: 'Lưng bài Tím mộng',  price: 800,  value: 'timmong' },
    { id: 'back-denhuyen',  kind: 'back',   name: 'Lưng bài Đen huyền', price: 800,  value: 'denhuyen' },
    { id: 'table-tim',      kind: 'table',  name: 'Màu bàn Tím',        price: 600,  value: 'tim' },
    { id: 'table-den',      kind: 'table',  name: 'Màu bàn Đen',        price: 1000, value: 'den' },
    { id: 'avatar-sutu',    kind: 'avatar', name: 'Mặt Sư tử',          price: 300,  value: '🦁' },
    { id: 'avatar-gautruc', kind: 'avatar', name: 'Mặt Gấu trúc',       price: 300,  value: '🐼' },
    { id: 'avatar-kylan',   kind: 'avatar', name: 'Mặt Kỳ lân',         price: 800,  value: '🦄' },
    { id: 'avatar-rong',    kind: 'avatar', name: 'Mặt Rồng',           price: 800,  value: '🐲' },
    { id: 'frame-bac',      kind: 'frame',  name: 'Khung avatar Bạc',   price: 400,  value: 'bac' },
    { id: 'frame-vang',     kind: 'frame',  name: 'Khung avatar Vàng',  price: 800,  value: 'vang' },
    { id: 'frame-lua',      kind: 'frame',  name: 'Khung avatar Lửa',   price: 1500, value: 'lua' }
];
function owns(id) { return meta.owned.includes(id); }
function isEquipped(it) {
    if (it.kind === 'back') return settings.backStyle === it.value;
    if (it.kind === 'table') return settings.tableColor === it.value;
    if (it.kind === 'avatar') return meta.equipped.avatar === it.value;
    if (it.kind === 'frame') return meta.equipped.frame === it.value;
    return false;
}
function equipItem(it) {
    if (it.kind === 'back') { settings.backStyle = it.value; saveSettings(); applySettings(); }
    else if (it.kind === 'table') { settings.tableColor = it.value; saveSettings(); applySettings(); }
    else if (it.kind === 'avatar') { meta.equipped.avatar = it.value; saveMeta(); applyMetaVisuals(); }
    else if (it.kind === 'frame') { meta.equipped.frame = it.value; saveMeta(); applyMetaVisuals(); }
}
function buyItem(id) {
    const it = SHOP_ITEMS.find(x => x.id === id);
    if (!it || owns(id)) return false;
    if (state.money.player < it.price) { showMessage('Không đủ xu! Cần ' + it.price + ' xu cho "' + it.name + '".'); return false; }
    state.money.player -= it.price;
    meta.owned.push(id);
    saveMoney(); saveMeta();
    equipItem(it);
    updateMoneyUI();
    showMessage('🛒 Đã mua "' + it.name + '" và dùng ngay!');
    return true;
}
function applyMetaVisuals() {
    const wrap = document.getElementById('awrap-player');
    if (wrap) {
        const av = wrap.querySelector ? wrap.querySelector('.avatar') : null;
        if (av) av.textContent = meta.equipped.avatar || '🧑';
        wrap.classList.remove('frame-bac', 'frame-vang', 'frame-lua');
        if (meta.equipped.frame && meta.equipped.frame !== 'none') wrap.classList.add('frame-' + meta.equipped.frame);
    }
    const badge = document.getElementById('level-badge');
    if (badge) badge.textContent = '⭐' + levelFromXp(meta.xp).level;
}
function renderLobbyMeta() {
    ensureDaily();
    const info = levelFromXp(meta.xp);
    const line = document.getElementById('lobby-level');
    if (line) line.textContent = '⭐ Cấp ' + info.level + ' · ' + state.money.player + ' xu · 🔥 Đăng nhập ' + meta.login.streak + ' ngày';
    const fill = document.getElementById('xp-fill');
    if (fill) fill.style.width = Math.round(info.into / info.need * 100) + '%';
    const xpText = document.getElementById('xp-text');
    if (xpText) xpText.textContent = 'XP ' + info.into + '/' + info.need;
    const gift = document.getElementById('btn-gift');
    if (gift) {
        gift.classList.toggle('hidden', !!meta.daily.claimed);
        gift.textContent = '🎁 Nhận thưởng đăng nhập +' + loginReward() + ' xu';
    }
}
function renderShop() {
    const box = document.getElementById('shop-body');
    if (!box) return;
    const money = document.getElementById('shop-money');
    if (money) money.textContent = '💰 ' + state.money.player + ' xu';
    const groups = { back: '🂠 Lưng bài', table: '🎨 Màu bàn', avatar: '😀 Mặt nhân vật (của bạn)', frame: '🖼️ Khung avatar (của bạn)' };
    let html = '';
    ['back', 'table', 'avatar', 'frame'].forEach(kind => {
        html += '<div class="shop-group">' + groups[kind] + '</div>';
        SHOP_ITEMS.filter(it => it.kind === kind).forEach(it => {
            const has = owns(it.id), eq = has && isEquipped(it);
            html += '<div class="shop-item"><span>' + it.name + (it.kind === 'avatar' || it.kind === 'frame' ? '' : '') + '</span>' +
                (eq ? '<button class="modal-btn shop-btn" disabled>Đang dùng</button>'
                    : has ? '<button class="modal-btn shop-btn" data-equip="' + it.id + '">Dùng</button>'
                    : '<button class="modal-btn shop-btn" data-buy="' + it.id + '">' + it.price + ' xu</button>') + '</div>';
        });
    });
    box.innerHTML = html;
    (box.querySelectorAll ? box.querySelectorAll('[data-buy]') : []).forEach(b => b.addEventListener('click', () => { if (buyItem(b.getAttribute('data-buy'))) renderShop(); }));
    (box.querySelectorAll ? box.querySelectorAll('[data-equip]') : []).forEach(b => b.addEventListener('click', () => {
        const it = SHOP_ITEMS.find(x => x.id === b.getAttribute('data-equip'));
        if (it) { equipItem(it); renderShop(); }
    }));
}
function renderTasks() {
    ensureDaily();
    const box = document.getElementById('tasks-body');
    if (!box) return;
    let html = '<div class="shop-group">🔥 Chuỗi đăng nhập: ' + meta.login.streak + ' ngày · ' + (meta.daily.claimed ? 'đã nhận thưởng hôm nay' : 'chưa nhận thưởng hôm nay (ra sảnh chờ nhận)') + '</div>';
    Object.keys(TASK_DEFS).forEach(key => {
        const def = TASK_DEFS[key], tk = meta.daily.tasks[key];
        const done = tk.p >= def.goal;
        html += '<div class="shop-item"><span>' + def.name + ' (' + Math.min(tk.p, def.goal) + '/' + def.goal + ')</span>' +
            (tk.c ? '<button class="modal-btn shop-btn" disabled>Đã nhận</button>'
                : done ? '<button class="modal-btn shop-btn" data-claim="' + key + '">Nhận ' + def.reward + ' xu</button>'
                : '<button class="modal-btn shop-btn" disabled>Chưa xong</button>') + '</div>';
    });
    box.innerHTML = html;
    (box.querySelectorAll ? box.querySelectorAll('[data-claim]') : []).forEach(b => b.addEventListener('click', () => { claimTask(b.getAttribute('data-claim')); }));
}
