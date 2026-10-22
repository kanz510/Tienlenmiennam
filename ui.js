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
    const colors = ['#ffd700', '#2ecc71', '#e74c3c', '#3498db', '#ff8fab', '#ffffff'];
    for (let i = 0; i < 28; i++) {
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
                // Bàn là sảnh -> chọn cả sảnh chứa lá này, không gom đôi
                const runT = straightRunThrough(rv);
                if (runT) {
                    runT.forEach(r => {
                        const i = (r === rv) ? idx : hand.findIndex(c => rankValue(c) === r);
                        if (i >= 0) state.selected.add(i);
                    });
                    syncSelectedUI();
                    return;
                }
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
    for (let i = 0; i < count; i++) {
        const c = document.createElement('div');
        c.className = 'back-card';
        el.appendChild(c);
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
        if (info) { info.textContent = ''; info.classList.remove('show'); }
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
    const dir = ['from-bottom', 'from-left', 'from-right', 'from-top'][state.lastPlay.player] || 'from-bottom';
    const sorted = [...state.lastPlay.cards].sort(compareCards);
    const midIdx = (sorted.length - 1) / 2;
    sorted.forEach((card, i) => {
        const c = createCardEl(card);
        if (animate) c.classList.add('card-play-anim', dir);
        // Xòe quạt ra 2 phía theo vị trí (lá giữa thẳng, ra rìa nghiêng dần, tối đa ±14°) để góc số không đè nhau
        const tilt = Math.max(-14, Math.min(14, (i - midIdx) * 4));
        c.style.transform = 'rotate(' + tilt + 'deg)';
        el.appendChild(c);
    });
    if (info) {
        info.textContent = PLAYER_NAMES[PLAYERS[state.lastPlay.player]] + ' · ' + (COMBO_LABELS[state.lastPlay.combo.type] || '');
        info.classList.add('show');
    }
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
    setV('set-speed', settings.botSpeed);
    setV('set-difficulty', settings.difficulty);
    setV('set-bet', settings.bet);
    setV('set-table', settings.tableColor);
    setV('set-back', settings.backStyle);
    const rf = document.getElementById('btn-refill');
    if (rf) rf.disabled = state.money.player > 0;
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
    box.innerHTML = html;
}
