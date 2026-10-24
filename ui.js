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

const BUBBLE_IDS = { player: 'bubble-player', left: 'bubble-left', top: 'bubble-top', right: 'bubble-right' };
const bubbleTimers = {};
// Giữ bong bóng chữ ở lại cho khớp tiếng đọc: khi tiếng bắt đầu phát thì hẹn
// tắt theo lúc tiếng kết thúc (dự phòng tối đa ~6 giây), thay vì tắt cố định 2 giây.
function bubbleKeep(actorIdx, ms) {
    const key = PLAYERS[actorIdx || 0];
    const id = BUBBLE_IDS[key];
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    clearTimeout(bubbleTimers[key]);
    bubbleTimers[key] = setTimeout(() => { el.classList.remove('show'); }, ms);
}
function bubbleSyncAudio(actorIdx, au) {
    let done = false;
    const fin = (ms) => { if (done) return; done = true; bubbleKeep(actorIdx, ms); };
    try { au.addEventListener('ended', () => fin(350)); } catch (e) {}
    setTimeout(() => fin(0), 6500);
    bubbleKeep(actorIdx, 6500);
}

function showBubble(actorIdx, text) {
    const key = PLAYERS[actorIdx || 0];
    const id = BUBBLE_IDS[key];
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(bubbleTimers[key]);
    // Ở lại theo độ dài câu cho kịp đọc (3.2s - 6.5s), rồi mờ dần đi (CSS .45s)
    const hold = Math.min(6500, Math.max(3200, 1600 + String(text).length * 95));
    bubbleTimers[key] = setTimeout(() => { el.classList.remove('show'); }, hold);
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
    if (win) spawnCoins(wrap);
}

// r87: xu vang LAT bay tu giua ban ve avatar nguoi an tien (3 dong, lech pha nhau).
// Dung chung he toa do flyMatrix/measureFly voi he thong bay bai nen dung ca khi
// khung dang xoay doc. Loi o bat ky buoc nao thi bo qua — tien bay chu van chay.
function spawnCoins(targetWrap) {
    try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const probe = document.createElement('div');
        if (!probe.animate) return;
        const layer = document.getElementById('fly-layer');
        const table = document.getElementById('played-cards');
        if (!layer || !table || !targetWrap) return;
        const m = flyMatrix();
        if (!m) return;
        const src = measureFly(table, m);
        const dst = measureFly(targetWrap, m);
        if (!src.cx || !dst.cx) return;
        const dx = dst.cx - src.cx, dy = dst.cy - src.cy;
        for (let i = 0; i < 3; i++) {
            const img = document.createElement('img');
            img.src = 'assets/coin.svg';
            img.alt = '';
            img.className = 'coin-fly';
            const size = 19 + i * 4;
            img.style.width = size + 'px';
            img.style.height = size + 'px';
            img.style.left = (src.cx - size / 2) + 'px';
            img.style.top = (src.cy - size / 2) + 'px';
            layer.appendChild(img);
            setTimeout(() => { try { img.remove(); } catch (e) {} }, 1900);
            try {
                const a = img.animate([
                    { transform: 'translate(0px, 0px) rotate(0deg) scaleX(1)', opacity: 1 },
                    { transform: 'translate(' + (dx * .38) + 'px, ' + (dy * .38 - 36) + 'px) rotate(210deg) scaleX(.22)', opacity: 1, offset: .38 },
                    { transform: 'translate(' + (dx * .74) + 'px, ' + (dy * .74 - 12) + 'px) rotate(430deg) scaleX(1)', opacity: 1, offset: .74 },
                    { transform: 'translate(' + dx + 'px, ' + dy + 'px) rotate(600deg) scaleX(.9)', opacity: 0 }
                ], { duration: 820, delay: i * 85, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
                a.finished.then(() => { try { img.remove(); } catch (e) {} }).catch(() => {});
            } catch (e) { try { img.remove(); } catch (e2) {} }
        }
    } catch (e) { /* hieu ung phu: bo qua */ }
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


// r133: chỉ tạo hiệu ứng chia bài khi bắt đầu ván / số bài tăng, không chạy lại khi chọn bài.
const premiumDealCounts = { player: null, left: null, right: null, top: null };
function resetPremiumDealCounts() {
    Object.keys(premiumDealCounts).forEach(who => { premiumDealCounts[who] = null; });
}
function shouldAnimateDeal(who, count) {
    const previous = premiumDealCounts[who];
    premiumDealCounts[who] = count;
    return previous === null || count > previous;
}

function renderPlayerHand() {
    const el = document.getElementById('cards-player');
    el.innerHTML = '';
    const nHand = state.hands.player.length;
    const animateDeal = shouldAnimateDeal('player', nHand) && nHand > 0;
    const midHand = (nHand - 1) / 2;
    state.hands.player.forEach((card, i) => {
        const c = createCardEl(card);
        if (animateDeal) {
            c.classList.add('premium-deal-in-r133');
            c.style.animationDelay = (Math.min(i, 12) * 32) + 'ms';
        }
        c.dataset.idx = i;
        // r87: biến vị trí cho hiệu ứng tay cong 3D (lệch tâm + độ võng hai đầu)
        const p = midHand ? (i - midHand) / midHand : 0;
        c.style.setProperty('--p', p.toFixed(3));
        c.style.setProperty('--q', (p * p).toFixed(3));
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
    const animateDeal = shouldAnimateDeal(who, count) && count > 0 && !state.gameOver;
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
            if (animateDeal) {
                c.classList.add('premium-deal-in-r133');
                c.style.animationDelay = (Math.min(i, 12) * 32) + 'ms';
            }
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
    if (el) {
        el.classList.remove('big-play');
        el.classList.remove('trick-clear-r134');
    }
    if (!state.lastPlay) {
        if (el && el.children && el.children.length) {
            el.classList.remove('trick-clear-r134');
            void el.offsetWidth;
            el.classList.add('trick-clear-r134');
            setTimeout(() => { if (el) el.classList.remove('trick-clear-r134'); }, 360);
        }
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
            // r80-fix2: lá gốc có ảnh mặt đã hỏng hẳn thì bỏ qua, không nhân
            // bản thành lá trắng trong lớp mờ (lớp mờ chỉ là vệt trang trí).
            try {
                const gim = ch.querySelector ? ch.querySelector('img.face-full') : null;
                if (gim && gim.complete && gim.naturalWidth === 0) return;
            } catch (e) {}
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
        const isBig = isBigPlay(state.lastPlay.combo, state.lastPlayWasChop);
        info.classList.toggle('big-play', isBig);
        if (el) el.classList.toggle('big-play', isBig);
    }
    // r88: giấu lá đích NGAY từ lúc dựng mỗi khi nước thay đổi — bài chỉ hiện
    // khi chính chuyến bay của nước đó hạ cánh (cơ chế dọn dẹp của chuyến bay
    // sẽ gỡ giấu). Trước đây lá đích chỉ được giấu khi hiệu ứng bay bắt đầu,
    // nên bất kỳ lần vẽ lại nào chen giữa cũng làm bài hiện sẵn trên bàn trong
    // khi lá bay còn đang tới, phá mất hiệu ứng "bay tới mới hiện bài".
    // Đồng hồ canh dự phòng: nếu chuyến bay không chạy (không có nguồn bay,
    // bị lỗi...) và không còn chuyến nào đang bay thì tự gỡ giấu để không
    // bao giờ mất bài.
    if (animate) {
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduced) {
            [...el.children].forEach(c => { c.style.visibility = 'hidden'; c.dataset.flyWait = '1'; });
            clearTimeout(window.__destWaitTimer);
            window.__destWaitTimer = setTimeout(() => {
                try {
                    if (flyCleanup) return;
                    const destNow = document.getElementById('played-cards');
                    if (!destNow) return;
                    [...destNow.children].forEach(c => {
                        if (c.dataset && c.dataset.flyWait) { c.style.visibility = ''; delete c.dataset.flyWait; }
                    });
                } catch (e) {}
            }, 750);
        }
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
// Góc xoay cục bộ hiện tại của một phần tử (độ), đọc từ transform đã tính của
// chính nó — dùng để lá bay bắt đầu đúng góc của lá gốc (xấp bài úp của bot
// xòe quạt) thay vì bị dựng thẳng lại gây cảm giác biến hình.
function elementAngle(el) {
    try {
        const t = window.getComputedStyle(el).transform;
        if (!t || t === 'none') return 0;
        const mt = /matrix\(([^)]+)\)/.exec(t);
        if (!mt) return 0;
        const p = mt[1].split(',').map(Number);
        return Math.atan2(p[1], p[0]) * 180 / Math.PI;
    } catch (e) { return 0; }
}

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
                if (el) { const p = measureFly(el, m); out.push({ card: card, cx: p.cx, cy: p.cy, w: p.w, h: p.h, el: el, ang: elementAngle(el) }); }
            });
            return out.length ? out : null;
        }
        const wrapB = document.getElementById('cards-' + who);
        if (!wrapB || !wrapB.children.length) return null;
        const kids = [...wrapB.children].slice(-sorted.length);
        return sorted.map((card, i) => {
            const kel = kids[Math.min(i, kids.length - 1)];
            const p = measureFly(kel, m);
            return { card: card, cx: p.cx, cy: p.cy, w: p.w, h: p.h, el: kel, ang: elementAngle(kel) };
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
        // r75: nếu đống bài đích không còn là bài đang hiển thị trên bàn (đã bị
        // nước mới thay), bỏ qua toàn bộ hiệu ứng hạ cánh của nước cũ.
        if (!dest || !destEls.length || destEls[0].parentNode !== dest) return;
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
        let cancelled = false; // r75: lượt bay này bị lượt mới thay thế giữa chừng
        let cancelFlight = null;
        let watchdog = null;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            clearTimeout(watchdog);
            // r75: hủy luôn hoạt ảnh của các lá bay (trước đây chỉ gỡ khỏi DOM,
            // hoạt ảnh vẫn chạy tiếp và lời hứa hoàn thành vẫn kích hoạt về sau,
            // làm hiệu ứng hạ cánh của nước cũ bung chồng lên nước mới).
            anims.forEach(a => { try { a.cancel(); } catch (e) {} });
            clones.forEach(c => c.remove());
            // Chỉ khôi phục visibility cho phần tử của chính lượt này và chỉ khi nó
            // VẪN còn là lá đang hiển thị trong #played-cards. Nếu render mới đã thay
            // nó (lượt mới), tuyệt đối không chạm vào — tránh hiện/ẩn nhầm bài lượt sau.
            hiddenEls.forEach(el => {
                const destNow = document.getElementById('played-cards');
                if (destNow && el.parentNode === destNow) el.style.visibility = '';
            });
            if (flyCleanup === cancelFlight) flyCleanup = null;
        };
        cancelFlight = () => { cancelled = true; cleanup(); };
        flyCleanup = cancelFlight;
        // r80-fix2: đồng hồ canh dự phòng — nếu lời hứa hoàn thành của hoạt ảnh
        // không bao giờ chạy (bị hủy lạ, app xuống nền, lỗi nền tảng), dọn dẹp
        // cưỡng bức để lá đích THẬT không bao giờ bị giấu vĩnh viễn.
        watchdog = setTimeout(() => { cleanup(); }, 430 + srcList.length * 25 + 600);
        for (let i = 0; i < n; i++) {
            const dEl = destEls[i];
            const d = measureFly(dEl, mDest);
            const s = srcList[i];
            if (!s.w || !s.h || !d.w || !d.h) continue;
            // r72+r73: lá bay là bản nhân nguyên xi, không dựng mới:
            // - Người chơi: nhân bản lá gốc trên tay (vốn đã ngửa sẵn).
            // - Bot: nhân bản CHÍNH LÁ ĐÍCH trên bàn — lá vừa đánh NGỬA NGAY TỪ ĐẦU
            //   chuyến bay, đúng hạng/chất/màu của lá sẽ nằm lại trên bàn, và giữ
            //   nguyên kích thước đích suốt chuyến bay nên không bóp méo, không
            //   lật, không biến hình. Chỉ lá đã đánh mới hiện mặt; bài còn lại
            //   trên tay bot vẫn úp như cũ.
            const fromBot = who !== 'player';
            let clone = null;
            if (fromBot) {
                try { clone = dEl.cloneNode(true); } catch (e) { clone = null; }
            } else if (s.el && typeof s.el.cloneNode === 'function') {
                try { clone = s.el.cloneNode(true); } catch (e) { clone = null; }
            }
            if (!clone || !clone.classList) clone = createCardEl(s.card);
            clone.classList.remove('selected', 'deal-anim', 'card-deal-anim', 'revealed', 'hint-glow');
            clone.style.visibility = 'visible';
            clone.style.transform = '';
            const boxW = fromBot ? d.w : s.w;
            const boxH = fromBot ? d.h : s.h;
            clone.style.position = 'absolute';
            clone.style.left = (s.cx - boxW / 2) + 'px';
            clone.style.top = (s.cy - boxH / 2) + 'px';
            clone.style.width = boxW + 'px';
            clone.style.height = boxH + 'px';
            clone.style.margin = '0';
            clone.style.zIndex = 10 + i;
            // r87: bot danh bai thi la bay LAT 3D — boc la dich trong khung lat:
            // mat truoc la chinh la dich, mat sau la lung bai (class back-card
            // nen an theo dung theme lung dang dung). Khung ngoai van bay bang
            // quy dao cu, khung trong tu lat up -> ngua dong bo theo chuyen bay.
            let flyEl = clone;
            let flipInner = null;
            if (fromBot) {
                try {
                    const wrapF = document.createElement('div');
                    wrapF.className = 'fly-flip';
                    wrapF.style.cssText = 'position:absolute;left:' + clone.style.left + ';top:' + clone.style.top + ';width:' + clone.style.width + ';height:' + clone.style.height + ';margin:0;z-index:' + clone.style.zIndex + ';';
                    const innerF = document.createElement('div');
                    innerF.className = 'fly-inner';
                    const backF = document.createElement('div');
                    backF.className = 'back-card fly-back';
                    clone.classList.add('fly-front');
                    clone.style.left = '0'; clone.style.top = '0';
                    clone.style.width = '100%'; clone.style.height = '100%';
                    innerF.appendChild(clone);
                    innerF.appendChild(backF);
                    wrapF.appendChild(innerF);
                    flyEl = wrapF;
                    flipInner = innerF;
                } catch (e) { flyEl = clone; flipInner = null; }
            }
            layer.appendChild(flyEl);
            clones.push(flyEl);
            dEl.style.visibility = 'hidden';
            hiddenEls.push(dEl);
            const dx = d.cx - s.cx;
            const dy = d.cy - s.cy;
            const m = /rotate\((-?[\d.]+)deg\)/.exec(dEl.style.transform || '');
            const tilt = m ? parseFloat(m[1]) : 0;
            // r71: điểm giữa nhấc nhẹ để quỹ đạo thành cung bay tự nhiên; điểm đầu
            // và điểm cuối giữ nguyên như đã đối chiếu ở r69.
            // r74: co giãn ĐỒNG ĐỀU bằng một hệ số duy nhất cho cả hai trục trong
            // suốt chuyến bay để tỉ lệ lá không bao giờ đổi (trước đây hai trục co
            // giãn độc lập lệch nhau ~1% làm lá hơi méo, và điểm giữa còn phồng
            // thêm 5%). Hệ số cuối là trung bình nhân của hai tỉ lệ trục, nên
            // kích thước lúc hạ cánh chỉ lệch dưới nửa điểm ảnh — mắt không thấy.
            const startRot = fromBot ? 0 : (s.ang || 0);
            const uniK = Math.sqrt((d.w / boxW) * (d.h / boxH));
            const midK = (1 + uniK) / 2;
            try {
                anims.push(flyEl.animate([
                    { transform: 'translate(0px, 0px) scale(1) rotate(' + startRot + 'deg)', opacity: 1 },
                    { transform: 'translate(' + (dx * .55) + 'px, ' + (dy * .55 - 10) + 'px) scale(' + midK + ') rotate(' + (startRot + (tilt - startRot) * .55) + 'deg)', opacity: 1, offset: .55 },
                    { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + uniK + ') rotate(' + tilt + 'deg)', opacity: 1 }
                ], { duration: 430, delay: i * 25, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'forwards' }));
                if (flipInner) {
                    try {
                        anims.push(flipInner.animate([
                            { transform: 'rotateY(180deg)' },
                            { transform: 'rotateY(0deg)' }
                        ], { duration: 430, delay: i * 25, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'forwards' }));
                    } catch (e2) { /* lat loi thi la ngua san van bay nhu cu */ }
                }
            } catch (e) {
                // r80-fix2: tạo hoạt ảnh lỗi ở lá này -> gỡ bản bay, hiện lại lá
                // đích ngay lập tức, các lá còn lại vẫn bay bình thường.
                flyEl.remove();
                const ix = clones.indexOf(flyEl);
                if (ix >= 0) clones.splice(ix, 1);
                dEl.style.visibility = '';
                const hx = hiddenEls.indexOf(dEl);
                if (hx >= 0) hiddenEls.splice(hx, 1);
            }
        }
        if (!anims.length) { cleanup(); return; }
        const destCenter = measureFly(dest, mDest);
        const big = isBigPlay(state.lastPlay && state.lastPlay.combo, state.lastPlayWasChop);
        Promise.allSettled(anims.map(a => a.finished)).then(() => {
            const wasCancelled = cancelled;
            cleanup();
            // r75: chuyến bay đã bị lượt mới thay thế thì TUYỆT ĐỐI không chạy
            // hiệu ứng hạ cánh của nước cũ (vòng sáng/hạt/nảy lá) chồng lên
            // nước mới — đây là gốc của hiện tượng lá trông như bị nhân đôi.
            if (!wasCancelled) onFlyLanded(destEls, destCenter, big);
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
// r80: mặt bài đầy đủ (bộ Byron Knoll) — có file thì dùng ảnh thật, thiếu thì lùi về mặt vẽ cũ
const SUIT_LETTER = { '♠': 'S', '♣': 'C', '♦': 'D', '♥': 'H' };
function faceFullFor(card) {
    if (typeof CARD_ART === 'undefined') return '';
    return CARD_ART[card.rank + (SUIT_LETTER[card.suit] || '')] || '';
}
// r80: hiệu ứng chặt heo — bàn rung rất nhẹ + lóe viền vàng, không chặn thao tác
let chopFxTimer = null;
function fxChop() {
    const gc = document.getElementById('game-container');
    if (!gc) return;
    gc.classList.remove('chop-flash');
    void gc.offsetWidth;
    gc.classList.add('chop-flash');
    if (chopFxTimer) clearTimeout(chopFxTimer);
    chopFxTimer = setTimeout(() => gc.classList.remove('chop-flash'), 520);
}
// r80: hiệu ứng lên cấp — vòng sáng vàng quanh avatar người chơi
let levelFxTimer = null;
function fxLevelUp() {
    const w = document.getElementById('awrap-player');
    if (!w) return;
    w.classList.remove('levelup');
    void w.offsetWidth;
    w.classList.add('levelup');
    if (levelFxTimer) clearTimeout(levelFxTimer);
    levelFxTimer = setTimeout(() => w.classList.remove('levelup'), 1500);
}

function createCardEl(card) {
    const div = document.createElement('div');
    const isRed = (card.suit === '♥' || card.suit === '♦');
    div.className = 'card ' + (isRed ? 'red' : 'black');
    // r130: semantic rank classes let the premium theme emphasize J/Q/K without touching game rules.
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') div.classList.add('face-rank', 'face-rank-' + card.rank.toLowerCase());
    const full = faceFullFor(card);
    if (full) {
        div.classList.add('has-art');
        div.innerHTML = '<img class="face-full" src="' + full + '" alt="">';
        // r80-fix2: nếu ảnh mặt bài lỗi tải (mất mạng, cache hỏng...) thì dựng
        // lại mặt hạng/chất dự phòng ngay trên chính lá này — không để khung
        // trắng. Trình xử lý tự gỡ sau một lần chạy, không đệ quy.
        try {
            const img = div.querySelector ? div.querySelector('img.face-full') : null;
            if (img) {
                const toFallback = () => {
                    img.onerror = null;
                    if (div.dataset && div.dataset.artFallback) return;
                    if (div.dataset) div.dataset.artFallback = '1';
                    div.classList.remove('has-art');
                    const f2 = faceArtFor(card);
                    div.innerHTML =
                        '<div class="corner"><span>' + card.rank + '</span>' + (f2 ? '<span>' + card.suit + '</span>' : '') + '</div>' +
                        (f2 ? '<img class="face-art" src="' + f2 + '" alt="">' : '<div class="suit-big">' + card.suit + '</div>');
                };
                img.onerror = toFallback;
                if (img.complete && img.naturalWidth === 0) toFallback();
            }
        } catch (e) { /* phòng thủ: lỗi gắn fallback thì giữ nguyên lá ảnh */ }
        return div;
    }
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
    set('set-music', settings.music !== false);
    set('set-voice', settings.voice);
    set('set-autoplay', settings.autoPlay);
    setV('set-speed', settings.botSpeed);
    setV('set-difficulty', settings.difficulty);
    setV('set-bet', settings.bet);
    setV('set-table', settings.tableColor);
    setV('set-back', settings.backStyle);
    setV('set-swear', settings.swearLevel || 'tuc');
    setV('set-persona-left', settings.personaLeft || 'goc');
    setV('set-persona-top', settings.personaTop || 'goc');
    setV('set-persona-right', settings.personaRight || 'goc');
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
    { id: 'back-vangkim',   kind: 'back',   name: 'Lưng bài Vàng kim',  price: 500,  value: 'vangkim',  rarity: 'hiem',    desc: 'Họa tiết kim cương mạ vàng, sang trọng cổ điển.' },
    { id: 'back-xanhngoc',  kind: 'back',   name: 'Lưng bài Xanh ngọc', price: 650,  value: 'xanhngoc', rarity: 'hiem',    desc: 'Xanh ngọc lục bảo mát mắt với vân sóng nhẹ.' },
    { id: 'back-timmong',   kind: 'back',   name: 'Lưng bài Tím mộng',  price: 800,  value: 'timmong',  rarity: 'hiem',    desc: 'Sắc tím mộng mơ điểm những chấm sao lấp lánh.' },
    { id: 'back-denhuyen',  kind: 'back',   name: 'Lưng bài Đen huyền', price: 800,  value: 'denhuyen', rarity: 'hiem',    desc: 'Đen sâu huyền bí, điểm sáng như bầu trời đêm.' },
    { id: 'back-hoanggia',  kind: 'back',   name: 'Lưng bài Hoàng gia', price: 1200, value: 'hoanggia', rarity: 'suthi',   desc: 'Đỏ hoàng gia viền vàng, khí chất vương giả.' },
    { id: 'back-rongvang',  kind: 'back',   name: 'Lưng bài Rồng vàng', price: 1600, value: 'rongvang', rarity: 'huyen',   desc: 'Vảy rồng vàng óng ánh — biểu tượng của huyền thoại.' },
    { id: 'table-tim',      kind: 'table',  name: 'Màu bàn Tím',        price: 600,  value: 'tim',      rarity: 'hiem',    desc: 'Tông tím trầm ấm, dịu mắt khi chơi lâu.' },
    { id: 'table-huyet',    kind: 'table',  name: 'Màu bàn Huyết',      price: 900,  value: 'huyet',    rarity: 'hiem',    desc: 'Đỏ huyết đậm — căng thẳng như một ván đấu lớn.' },
    { id: 'table-den',      kind: 'table',  name: 'Màu bàn Đen',        price: 1000, value: 'den',      rarity: 'suthi',   desc: 'Đen tuyền tối giản, tôn lên từng lá bài.' },
    { id: 'table-hoangkim', kind: 'table',  name: 'Màu bàn Hoàng kim',  price: 1200, value: 'hoangkim', rarity: 'suthi',   desc: 'Nâu vàng casino ấm áp, sang như sòng bài lớn.' },
    { id: 'avatar-ech',     kind: 'avatar', name: 'Mặt Ếch',            price: 250,  value: '🐸',       rarity: 'thuong',  desc: 'Ếch xanh vui nhộn, nhìn là muốn cười.' },
    { id: 'avatar-tho',     kind: 'avatar', name: 'Mặt Thỏ',            price: 250,  value: '🐰',       rarity: 'thuong',  desc: 'Thỏ trắng nhanh nhẹn, chuyên lật kèo phút chót.' },
    { id: 'avatar-sutu',    kind: 'avatar', name: 'Mặt Sư tử',          price: 300,  value: '🦁',       rarity: 'thuong',  desc: 'Sư tử oai phong, vua của bàn đấu.' },
    { id: 'avatar-gautruc', kind: 'avatar', name: 'Mặt Gấu trúc',       price: 300,  value: '🐼',       rarity: 'thuong',  desc: 'Gấu trúc điềm tĩnh, thắng thua không nao núng.' },
    { id: 'avatar-cu',      kind: 'avatar', name: 'Mặt Cú',             price: 500,  value: '🦉',       rarity: 'hiem',    desc: 'Cú mèo tỉnh táo, soi thấu bài của đối thủ.' },
    { id: 'avatar-cavoi',   kind: 'avatar', name: 'Mặt Cá voi',         price: 500,  value: '🐳',       rarity: 'hiem',    desc: 'Cá voi hiền hòa nhưng ví thì không hề nhỏ.' },
    { id: 'avatar-kylan',   kind: 'avatar', name: 'Mặt Kỳ lân',         price: 800,  value: '🦄',       rarity: 'suthi',   desc: 'Kỳ lân may mắn, ra bài nào cũng như có phép.' },
    { id: 'avatar-rong',    kind: 'avatar', name: 'Mặt Rồng',           price: 800,  value: '🐲',       rarity: 'suthi',   desc: 'Rồng lửa uy nghi, đối thủ nhìn đã rén.' },
    { id: 'frame-bac',      kind: 'frame',  name: 'Khung avatar Bạc',   price: 400,  value: 'bac',      rarity: 'thuong',  desc: 'Viền bạc sáng gọn, khởi đầu của mọi cao thủ.' },
    { id: 'frame-vang',     kind: 'frame',  name: 'Khung avatar Vàng',  price: 800,  value: 'vang',     rarity: 'hiem',    desc: 'Viền vàng phát sáng — đẳng cấp nhà giàu mới nổi.' },
    { id: 'frame-lua',      kind: 'frame',  name: 'Khung avatar Lửa',   price: 1500, value: 'lua',      rarity: 'suthi',   desc: 'Viền lửa cháy rực, khí thế không ai dập nổi.' },
    { id: 'frame-kimcuong', kind: 'frame',  name: 'Khung avatar Kim cương', price: 2000, value: 'kimcuong', rarity: 'huyen', desc: 'Viền kim cương phát sáng lạnh — đỉnh cao đẳng cấp.' },
    { id: 'frame-ngoc',     kind: 'frame',  name: 'Khung avatar Ngọc',  price: 0,    value: 'ngoc',     rarity: 'dacbiet', locked: 'login7', desc: 'Vật phẩm đặc biệt: phần thưởng đăng nhập đủ 7 ngày trong một chu kỳ.' }
];
const RARITY_NAMES = { thuong: 'Thường', hiem: 'Hiếm', suthi: 'Sử thi', huyen: 'Huyền thoại', dacbiet: 'Đặc biệt' };
function owns(id) { return meta.owned.includes(id); }
function isEquipped(it) {
    if (it.kind === 'back') return settings.backStyle === it.value;
    if (it.kind === 'table') return settings.tableColor === it.value;
    if (it.kind === 'avatar') return meta.equipped.avatar === it.value;
    if (it.kind === 'frame') return meta.equipped.frame === it.value;
    return false;
}
function equipItem(it) {
    if (!owns(it.id)) return; // r79: không trang bị vật phẩm chưa sở hữu
    if (it.kind === 'back') { settings.backStyle = it.value; saveSettings(); applySettings(); }
    else if (it.kind === 'table') { settings.tableColor = it.value; saveSettings(); applySettings(); }
    else if (it.kind === 'avatar') { meta.equipped.avatar = it.value; saveMeta(); applyMetaVisuals(); }
    else if (it.kind === 'frame') { meta.equipped.frame = it.value; saveMeta(); applyMetaVisuals(); }
}
function buyItem(id) {
    const it = SHOP_ITEMS.find(x => x.id === id);
    if (!it || owns(id)) return false;
    if (it.locked) { showMessage('🔒 Vật phẩm đặc biệt — nhận qua đường đăng nhập 7 ngày trong mục Nhiệm vụ!'); return false; }
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
        wrap.classList.remove('frame-bac', 'frame-vang', 'frame-lua', 'frame-ngoc', 'frame-kimcuong');
        if (meta.equipped.frame && meta.equipped.frame !== 'none') wrap.classList.add('frame-' + meta.equipped.frame);
    }
    const badge = document.getElementById('level-badge');
    if (badge) badge.textContent = '⭐' + levelFromXp(meta.xp).level;
}
function renderLobbyMeta() {
    ensureDaily();
    const info = levelFromXp(meta.xp);
    const line = document.getElementById('lobby-level');
    if (line) line.textContent = '🪙 ' + Number(state.money.player).toLocaleString('vi-VN') + ' xu';
    const gift = document.getElementById('btn-gift');
    if (gift) {
        gift.classList.toggle('hidden', !!meta.daily.claimed);
        gift.textContent = '🎁 Điểm danh +' + loginReward() + ' xu' + (loginCycleDay() === 7 ? ' · khung Ngọc' : '');
    }
}
let shopTab = 'back', shopSel = null;
function shopPreviewHTML(it, big) {
    const cls = big ? 'pv pv-big' : 'pv';
    if (it.kind === 'back') return '<div class="' + cls + ' pv-back pv-' + it.value + '"><span>✦</span></div>';
    if (it.kind === 'table') return '<div class="' + cls + ' pv-table pv-t-' + it.value + '"></div>';
    if (it.kind === 'avatar') return '<div class="' + cls + ' pv-avatar"><span>' + it.value + '</span></div>';
    return '<div class="' + cls + ' pv-framewrap"><div class="pv-frame pv-f-' + it.value + '"><span>🧑</span></div></div>';
}
function shopActionHTML(it) {
    const has = owns(it.id), eq = has && isEquipped(it);
    if (it.locked && !has) return '<button class="modal-btn shop-act" disabled>🔒 Thưởng đăng nhập 7 ngày</button>';
    if (eq) return '<button class="modal-btn shop-act" disabled>✓ Đang dùng</button>';
    if (has) return '<button class="modal-btn shop-act primary" data-equip="' + it.id + '">Dùng ngay</button>';
    return '<button class="modal-btn shop-act primary" data-buy="' + it.id + '">Mua · ' + it.price + ' xu</button>';
}
function renderShop() {
    const box = document.getElementById('shop-body');
    if (!box) return;
    const money = document.getElementById('shop-money');
    if (money) money.textContent = '💰 ' + state.money.player + ' xu';
    const tabs = { back: '🂠 Lưng bài', table: '🎨 Màu bàn', avatar: '😀 Avatar', frame: '🖼️ Khung' };
    const items = SHOP_ITEMS.filter(it => it.kind === shopTab);
    if (!items.some(it => it.id === shopSel)) shopSel = items.length ? items[0].id : null;
    const sel = SHOP_ITEMS.find(it => it.id === shopSel);
    let html = '<div class="shop-tabs">' + Object.keys(tabs).map(k =>
        '<button class="shop-tab' + (k === shopTab ? ' on' : '') + '" data-tab="' + k + '">' + tabs[k] + '</button>').join('') + '</div>';
    if (sel) {
        html += '<div class="shop-preview">' + shopPreviewHTML(sel, true) +
            '<div class="pv-info"><div class="pv-name">' + sel.name + '</div>' +
            '<div class="pv-rarity rar-' + sel.rarity + '">' + (RARITY_NAMES[sel.rarity] || '') + (sel.locked ? '' : ' · ' + sel.price + ' xu') + '</div>' +
            '<div class="pv-desc">' + sel.desc + '</div>' + shopActionHTML(sel) + '</div></div>';
    }
    html += '<div class="shop-grid">';
    items.forEach(it => {
        const has = owns(it.id), eq = has && isEquipped(it);
        const state = it.locked && !has ? '<span class="sc-state locked">🔒 Đặc biệt</span>'
            : eq ? '<span class="sc-state eq">✓ Đang dùng</span>'
            : has ? '<span class="sc-state own">Đã có</span>'
            : '<span class="sc-price">' + it.price + ' xu</span>';
        html += '<div class="shop-card' + (it.id === shopSel ? ' sel' : '') + '" data-sel="' + it.id + '">' + shopPreviewHTML(it, false) +
            '<div class="sc-name">' + it.name + '</div><div class="pv-rarity rar-' + it.rarity + '">' + (RARITY_NAMES[it.rarity] || '') + '</div>' + state + '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
    const q = sel2 => (box.querySelectorAll ? box.querySelectorAll(sel2) : []);
    q('[data-tab]').forEach(b => b.addEventListener('click', () => { shopTab = b.getAttribute('data-tab'); renderShop(); }));
    q('[data-sel]').forEach(c => c.addEventListener('click', () => { shopSel = c.getAttribute('data-sel'); renderShop(); }));
    q('[data-buy]').forEach(b => b.addEventListener('click', () => { if (buyItem(b.getAttribute('data-buy'))) renderShop(); }));
    q('[data-equip]').forEach(b => b.addEventListener('click', () => {
        const it = SHOP_ITEMS.find(x => x.id === b.getAttribute('data-equip'));
        if (it) { equipItem(it); renderShop(); }
    }));
}
function taskRowHTML(def, tk, attr) {
    const done = tk.p >= def.goal;
    const pct = Math.min(100, Math.round(tk.p / def.goal * 100));
    return '<div class="task-row"><div class="task-main"><div class="task-name">' + def.name +
        ' <span class="task-prog">' + Math.min(tk.p, def.goal) + '/' + def.goal + '</span></div>' +
        '<div class="tbar"><div class="tfill" style="width:' + pct + '%"></div></div></div>' +
        (tk.c ? '<button class="modal-btn shop-btn" disabled>✓ Đã nhận</button>'
            : done ? '<button class="modal-btn shop-btn claim" ' + attr + '>Nhận ' + def.reward + ' xu</button>'
            : '<button class="modal-btn shop-btn" disabled>' + def.reward + ' xu</button>') + '</div>';
}
function milestoneHTML(key) {
    const def = MILESTONE_DEFS[key];
    const store = def.scope === 'd' ? meta.daily.milestones : meta.weekly.milestones;
    const tasks = def.scope === 'd' ? meta.daily.tasks : meta.weekly.tasks;
    const cnt = claimedCount(tasks);
    const got = store && store[key];
    return '<div class="task-row mile"><div class="task-main"><div class="task-name">🏆 ' + def.name +
        ' <span class="task-prog">' + Math.min(cnt, def.need) + '/' + def.need + '</span></div>' +
        '<div class="tbar"><div class="tfill gold" style="width:' + Math.min(100, Math.round(cnt / def.need * 100)) + '%"></div></div></div>' +
        (got ? '<button class="modal-btn shop-btn" disabled>✓ Đã nhận</button>'
            : cnt >= def.need ? '<button class="modal-btn shop-btn claim" data-mile="' + key + '">Nhận ' + def.reward + ' xu</button>'
            : '<button class="modal-btn shop-btn" disabled>' + def.reward + ' xu</button>') + '</div>';
}
function renderTasks() {
    ensureDaily(); ensureWeekly();
    const box = document.getElementById('tasks-body');
    if (!box) return;
    // --- Duong dang nhap 7 ngay ---
    const cyc = loginCycleDay();
    let html = '<div class="shop-group">🎁 Đăng nhập 7 ngày · chuỗi hiện tại: ' + meta.login.streak + ' ngày</div><div class="login-track">';
    for (let i = 1; i <= 7; i++) {
        const isToday = i === cyc, past = i < cyc;
        const label = '+' + LOGIN_REWARDS[i - 1] + (i === 7 ? ' 🖼️' : '');
        let st;
        if (isToday && !meta.daily.claimed) st = '<button class="lt-btn" data-login="1">Nhận</button>';
        else if (isToday) st = '<span class="lt-done">✓ Đã nhận</span>';
        else if (past) st = '<span class="lt-done">✓</span>';
        else st = '<span class="lt-lock">🔒</span>';
        html += '<div class="lt-day' + (isToday ? ' today' : '') + (past ? ' past' : '') + '"><div class="lt-d">Ngày ' + i + '</div><div class="lt-r">' + label + '</div>' + st + '</div>';
    }
    html += '</div>';
    // --- Nhiem vu ngay theo do kho ---
    const tiers = { de: '🟢 Dễ', tb: '🟡 Trung bình', kho: '🔴 Khó' };
    html += '<div class="shop-group">🎯 Nhiệm vụ ngày</div>';
    Object.keys(tiers).forEach(t => {
        html += '<div class="task-tier">' + tiers[t] + '</div>';
        Object.keys(DAILY_TASK_DEFS).filter(k => DAILY_TASK_DEFS[k].tier === t).forEach(k => {
            html += taskRowHTML(DAILY_TASK_DEFS[k], meta.daily.tasks[k], 'data-claim="' + k + '"');
        });
    });
    html += milestoneHTML('d3') + milestoneHTML('dall');
    // --- Nhiem vu tuan ---
    html += '<div class="shop-group">🗓️ Nhiệm vụ tuần</div>';
    Object.keys(WEEKLY_TASK_DEFS).forEach(k => {
        html += taskRowHTML(WEEKLY_TASK_DEFS[k], meta.weekly.tasks[k], 'data-claimw="' + k + '"');
    });
    html += milestoneHTML('w2');
    box.innerHTML = html;
    const q = sel2 => (box.querySelectorAll ? box.querySelectorAll(sel2) : []);
    q('[data-claim]').forEach(b => b.addEventListener('click', () => { claimDailyTask(b.getAttribute('data-claim')); }));
    q('[data-claimw]').forEach(b => b.addEventListener('click', () => { claimWeeklyTask(b.getAttribute('data-claimw')); }));
    q('[data-mile]').forEach(b => b.addEventListener('click', () => { claimMilestone(b.getAttribute('data-mile')); }));
    q('[data-login]').forEach(b => b.addEventListener('click', () => { claimLogin(); }));
}
