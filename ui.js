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
function toggleOne(idx) {
    if (state.selected.has(idx)) state.selected.delete(idx); else state.selected.add(idx);
}

// Chọn 'count' số liên tiếp, mỗi số 'perRank' lá, chứa số của lá vừa chạm:
// thử dãy bắt đầu từ số đó trước, rồi dãy kết thúc ở số đó. Chọn được -> true.
function pickRunOfLength(idx, rv, count, perRank) {
    const hand = state.hands.player;
    if (rv >= RANK_2) return false;
    const tryRange = start => {
        if (start < 0 || start + count - 1 > RANK_2 - 1) return null;
        const picked = [];
        for (let r = start; r < start + count; r++) {
            const idxs = [];
            hand.forEach((c, i) => { if (rankValue(c) === r) idxs.push(i); });
            if (idxs.length < perRank) return null;
            idxs.sort((a, b) => suitValue(hand[a]) - suitValue(hand[b]));
            if (r === rv) {
                picked.push(idx);
                idxs.filter(i => i !== idx).slice(0, perRank - 1).forEach(i => picked.push(i));
            } else {
                idxs.slice(0, perRank).forEach(i => picked.push(i));
            }
        }
        return picked;
    };
    const picked = tryRange(rv) || tryRange(rv - count + 1);
    if (!picked) return false;
    picked.forEach(i => state.selected.add(i));
    return true;
}

// Chế độ từ–đến: đã chọn đúng 1 lá (firstIdx), chạm lá khác số (idx) -> chọn mỗi số
// một lá từ số đầu đến số cuối (hai đầu là chính hai lá đã chạm, số giữa lấy lá chất
// thấp nhất); đứt số nào ở giữa thì chỉ thêm lá vừa chạm và báo số bị đứt.
function rangeSelect(firstIdx, idx) {
    const hand = state.hands.player;
    const r1 = rankValue(hand[firstIdx]), r2 = rankValue(hand[idx]);
    const lo = Math.min(r1, r2), hi = Math.max(r1, r2);
    const picked = [];
    for (let r = lo + 1; r < hi; r++) {
        let best = -1;
        hand.forEach((c, i) => { if (rankValue(c) === r && (best < 0 || suitValue(c) < suitValue(hand[best]))) best = i; });
        if (best < 0) {
            state.selected.add(idx);
            showMessage('Sảnh bị đứt ở ' + RANKS[r]);
            return;
        }
        picked.push(best);
    }
    picked.forEach(i => state.selected.add(i));
    state.selected.add(idx);
}

// Lần chạm đầu (chưa chọn lá nào) ở chế độ tự động: gom theo bộ trên bàn / dẫn vòng
// như trước; riêng bàn là sảnh/đôi thông thì chọn đúng số lá liên tiếp theo bộ trên bàn.
function firstTapAuto(idx, rv) {
    const hand = state.hands.player;
    if (state.lastPlay && state.lastPlay.combo) {
        const t = state.lastPlay.combo;
        if (t.type === 'single') { state.selected.add(idx); return; }
        const sameRankIdx = [];
        hand.forEach((c, i) => { if (rankValue(c) === rv) sameRankIdx.push(i); });
        if (t.type === 'pair' && sameRankIdx.length >= 2) {
            const others = sameRankIdx.filter(i => i !== idx);
            state.selected.add(idx);
            state.selected.add(others[others.length - 1]);
            return;
        }
        if (t.type === 'triple' && sameRankIdx.length >= 3) {
            const others = sameRankIdx.filter(i => i !== idx);
            state.selected.add(idx);
            state.selected.add(others[others.length - 1]);
            state.selected.add(others[others.length - 2]);
            return;
        }
        if (t.type === 'straight') {
            if (!pickRunOfLength(idx, rv, t.length, 1)) state.selected.add(idx);
            return;
        }
        if (t.type === 'double_straight') {
            if (!pickRunOfLength(idx, rv, t.length / 2, 2)) state.selected.add(idx);
            return;
        }
    }
    const sameRank = [];
    hand.forEach((c, i) => { if (rankValue(c) === rv) sameRank.push(i); });
    if (sameRank.length > 1) {
        sameRank.forEach(i => state.selected.add(i));
    } else {
        const run = straightRunThrough(rv);
        if (run && (rv === run[0] || rv === run[run.length - 1])) {
            run.forEach(r => {
                const i = (r === rv) ? idx : hand.findIndex(c => rankValue(c) === r);
                if (i >= 0) state.selected.add(i);
            });
        } else {
            state.selected.add(idx);
        }
    }
}

function handleCardClick(idx) {
    if (suppressNextClick) { suppressNextClick = false; return; }
    if (state.gameOver || state.turn !== 0) return;
    const hand = state.hands.player;
    const rv = rankValue(hand[idx]);
    const mode = settings.selectMode || 'auto';

    if (mode === 'single') {
        toggleOne(idx);
        syncSelectedUI();
        return;
    }
    if (mode === 'range') {
        if (state.selected.size === 0) {
            state.selected.add(idx);
        } else if (state.selected.size === 1) {
            const first = [...state.selected][0];
            if (idx !== first && rankValue(hand[first]) !== rv) rangeSelect(first, idx);
            else toggleOne(idx);
        } else {
            toggleOne(idx);
        }
        syncSelectedUI();
        return;
    }
    // Chế độ tự động
    if (state.selected.has(idx)) {
        // Chạm lá đã chọn: cụm nhiều lá cùng một số (tự gom) -> thu về đúng lá này;
        // các trường hợp khác chỉ bỏ chọn đúng lá đó.
        if (state.selected.size === 1) {
            state.selected.delete(idx);
        } else {
            const ranks = [...state.selected].map(i => rankValue(hand[i]));
            if (ranks.every(r => r === ranks[0])) {
                state.selected.clear();
                state.selected.add(idx);
            } else {
                state.selected.delete(idx);
            }
        }
    } else if (state.selected.size > 0) {
        // Đã chọn ít nhất 1 lá: chỉ thêm đúng lá vừa chạm, không gom nhóm
        state.selected.add(idx);
    } else {
        firstTapAuto(idx, rv);
    }
    syncSelectedUI();
}


function renderPlayerHand() {
    const el = document.getElementById('cards-player');
    el.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const c = createCardEl(card);
        c.dataset.idx = i;
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
function cardTilt(card) { return ((rankValue(card) * 7 + suitValue(card) * 3) % 9) - 4; }

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
    sorted.forEach(card => {
        const c = createCardEl(card);
        if (animate) c.classList.add('card-play-anim', dir);
        c.style.transform = 'rotate(' + cardTilt(card) + 'deg)';
        el.appendChild(c);
    });
    if (info) {
        info.textContent = PLAYER_NAMES[PLAYERS[state.lastPlay.player]] + ' · ' + (COMBO_LABELS[state.lastPlay.combo.type] || '');
        info.classList.add('show');
    }
}

const FACE_SYMBOLS = { J: '♞', Q: '♛', K: '♚' };

function createCardEl(card) {
    const div = document.createElement('div');
    const isRed = (card.suit === '♥' || card.suit === '♦');
    div.className = 'card ' + (isRed ? 'red' : 'black');
    div.innerHTML = `
        <div class="corner">
            <span>${card.rank}</span>
            <span>${card.suit}</span>
        </div>
        <div class="corner corner-br">
            <span>${card.rank}</span>
            <span>${card.suit}</span>
        </div>
        <div class="suit-big">${card.suit}</div>
        ${FACE_SYMBOLS[card.rank] ? `<div class="face-badge face-${card.rank}">${FACE_SYMBOLS[card.rank]}</div>` : ''}
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

// CHẾ ĐỘ CHỌN BÀI: auto (tự gom) / single (từng lá) / range (từ–đến)
const SELECT_MODES = [
    { id: 'auto', icon: '🎯', label: 'Chọn tự động' },
    { id: 'single', icon: '☝️', label: 'Chọn từng lá' },
    { id: 'range', icon: '↔️', label: 'Chọn từ–đến' }
];
function selectModeInfo() { return SELECT_MODES.find(m => m.id === settings.selectMode) || SELECT_MODES[0]; }
function updateSelModeIcon() {
    const b = document.getElementById('btn-selmode');
    if (b) b.textContent = selectModeInfo().icon;
}
function cycleSelectMode() {
    const i = SELECT_MODES.findIndex(m => m.id === settings.selectMode);
    const next = SELECT_MODES[(i + 1) % SELECT_MODES.length];
    settings.selectMode = next.id;
    saveSettings();
    state.selected.clear();
    syncSelectedUI();
    updateSelModeIcon();
    showMessage(next.label);
}

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
    setV('set-select', settings.selectMode);
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
