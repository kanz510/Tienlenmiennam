// ============================================================
//  TIẾN LÊN MIỀN NAM - MOBILE LANDSCAPE ONLY
// ============================================================

// ==== CONSTANTS ====
const SUITS = ['♠', '♣', '♦', '♥'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const RANK_2 = 12; // index của '2'

const PLAYERS = ['player', 'left', 'top', 'right'];
const PLAYER_NAMES = {
    player: 'Bạn',
    left: 'Bot Tây',
    right: 'Bot Đông',
    top: 'Bot Bắc'
};

// ==== STATE ====
let state = {
    hands: { player: [], left: [], right: [], top: [] },
    turn: 0,
    lastPlay: null,
    passCount: 0,
    hasPassed: false,
    firstMove: true,
    money: { player: 1000, left: 1000, right: 1000, top: 1000 },
    selected: new Set(),
    gameOver: false
};
state.timer = null;
state.timeLeft = 15;

// ============================================================
//  RUNG / ÂM THANH / LƯU VÁN
// ============================================================
function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

let audioCtx = null;
let soundOn = true;
try { soundOn = localStorage.getItem('tlSound') !== 'off'; } catch (e) {}

function ensureAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// Tiếng "tách" khi đánh bài ra bàn
function playClick() {
    if (!soundOn) return;
    const ctx = ensureAudio(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(620, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.07);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.09);
}

// Tiếng xào bài (white noise) khi chia bài mới
function playShuffle() {
    if (!soundOn) return;
    const ctx = ensureAudio(); if (!ctx) return;
    const dur = 0.35, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.16;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
}

// Hợp âm vui khi kết thúc ván
function playWin() {
    if (!soundOn) return;
    const ctx = ensureAudio(); if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
        const t = ctx.currentTime + i * 0.12;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = fr;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.55);
    });
}

// ===== GIỌNG ĐỌC CÀ KHỊA (Text-to-Speech) =====
const TAUNTS = {
    single: ['Xấu nè', 'Đánh nè', 'Lẻ nè', 'Nhỏ thôi', 'Chặn nè', 'Đỡ nè', 'Ngon thì đỡ nè', 'Qua được không nè'],
    pair: ['Đôi nè', 'Cặp nè', 'Đè nè', 'Cặp đôi hoàn cảnh nè', 'To chưa nè', 'Đè chết nè'],
    straight: ['Sảnh nè', 'Dài nè', 'Nguyên dây nè', 'Một đường thẳng nè', 'Trôi nè'],
    big: ['Tứ quý nè', 'Chặt nè', 'Nữa đi con', 'Chết mày chưa', 'Hàng khủng ra lò', 'Đỡ đi con trai', 'Hết hồn chưa', 'To chưa'],
    pass: ['Sợ rồi hả', 'Chạy đâu cho thoát', 'Bỏ lượt nha', 'Thua rồi à', 'Khóc chưa', 'Nhường nè']
};
const VOICE_PITCH = { player: 1.0, left: 0.8, right: 1.2, top: 0.95 };

function tauntFor(type) {
    const arr = type === 'pass' ? TAUNTS.pass
        : (type === 'pair' || type === 'triple') ? TAUNTS.pair
        : type === 'straight' ? TAUNTS.straight
        : (type === 'quad' || type === 'double_straight') ? TAUNTS.big
        : TAUNTS.single;
    return arr[Math.floor(Math.random() * arr.length)];
}

function speak(text, actorIdx) {
    try {
        if (!soundOn) return;
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN';
        const vi = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('vi'));
        if (vi) u.voice = vi;
        const basePitch = VOICE_PITCH[PLAYERS[actorIdx || 0]] || 1;
        u.pitch = Math.max(0.5, basePitch + (Math.random() * 0.1 - 0.05));
        u.rate = 0.95 + Math.random() * 0.25;
        window.speechSynthesis.speak(u);
    } catch (e) {}
}

const RANK_SPEECH = { '3': 'ba', '4': 'bốn', '5': 'năm', '6': 'sáu', '7': 'bảy', '8': 'tám', '9': 'chín', '10': 'mười', 'J': 'bồi', 'Q': 'đầm', 'K': 'già', 'A': 'ách', '2': 'heo' };
const NUM_SPEECH = { 3: 'ba', 4: 'bốn', 5: 'năm', 6: 'sáu' };

function cardSpeech(combo) {
    if (!combo || !combo.cards || !combo.cards.length) return null;
    const cards = combo.cards;
    const hi = RANK_SPEECH[cards[cards.length - 1].rank];
    const lo = RANK_SPEECH[cards[0].rank];
    if (!hi || !lo) return null;
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    switch (combo.type) {
        case 'single': return cap(hi) + ' nè';
        case 'pair': return 'Đôi ' + hi + ' nè';
        case 'triple': return 'Sám ' + hi + ' nè';
        case 'quad': return 'Tứ quý ' + hi + ' nè';
        case 'double_straight': return cap(NUM_SPEECH[cards.length / 2] || String(cards.length / 2)) + ' đôi thông nè';
        case 'straight':
            if (cards.length <= 5) return cap(cards.map(c => RANK_SPEECH[c.rank]).join(' ')) + ' nè';
            return 'Sảnh từ ' + lo + ' tới ' + hi + ' nè';
        default: return null;
    }
}

// Đánh bài: 50% đọc số lá, 50% bốc câu cà khịa
function speakPlay(combo, actorIdx) {
    try {
        if (combo && Math.random() < 0.5) {
            const line = cardSpeech(combo);
            if (line) return speak(line, actorIdx);
        }
        speak(tauntFor(combo ? combo.type : 'single'), actorIdx);
    } catch (e) {}
}

function updateMoneyUI() {
    PLAYERS.forEach(k => {
        const el = document.getElementById('money-' + k);
        if (el) el.textContent = '💰 ' + state.money[k];
    });
}

function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem('tlSound', soundOn ? 'on' : 'off'); } catch (e) {}
    const b = document.getElementById('btn-sound');
    if (b) b.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) playClick();
}

function saveGame() {
    try {
        if (state.gameOver) return;
        localStorage.setItem('tlSave', JSON.stringify({
            v: 2,
            hands: state.hands,
            turn: state.turn,
            lastPlay: state.lastPlay,
            passCount: state.passCount,
            hasPassed: state.hasPassed,
            firstMove: state.firstMove,
            money: state.money,
            selected: [...state.selected]
        }));
    } catch (e) {}
}

function clearSave() {
    try { localStorage.removeItem('tlSave'); } catch (e) {}
}

function loadGame() {
    try {
        const raw = localStorage.getItem('tlSave');
        if (!raw) return false;
        const d = JSON.parse(raw);
        if (!d || d.v !== 2 || !d.hands || !d.hands.player || !d.hands.left || !d.hands.right || !d.hands.top) return false;
        state.hands = d.hands;
        state.turn = d.turn || 0;
        state.lastPlay = d.lastPlay || null;
        state.passCount = d.passCount || 0;
        state.hasPassed = !!d.hasPassed;
        state.firstMove = !!d.firstMove;
        if (d.money) state.money = d.money;
        state.selected = new Set(d.selected || []);
        state.gameOver = false;
        return true;
    } catch (e) { return false; }
}


// ============================================================
//  TIMER — đếm ngược 15s cho lượt người chơi
// ============================================================
function startTimer() {
    stopTimer();
    const timerBox = document.querySelector('.timer-box');

    // Chỉ chạy đồng hồ khi đến lượt người chơi
    if (state.turn !== 0 || state.gameOver) {
        if (timerBox) timerBox.style.visibility = 'hidden';
        return;
    }

    if (timerBox) timerBox.style.visibility = 'visible';
    state.timeLeft = 15;
    updateTimerUI();

    state.timer = setInterval(() => {
        state.timeLeft--;
        updateTimerUI();
        if (state.timeLeft <= 0) {
            stopTimer();
            vibrate(200);
            if (state.turn === 0 && !state.gameOver) {
                if (state.lastPlay) {
                    showMessage('Hết giờ! Tự động bỏ lượt.');
                    playerPass();
                } else if (state.firstMove) {
                    // Nước đầu của ván: tự đánh bộ chứa 3♠
                    showMessage('Hết giờ! Tự động đánh bộ có 3♠.');
                    const pick = pickFirstMove(state.hands.player, false);
                    if (pick) {
                        state.selected = new Set(pick.cards.map(c => state.hands.player.indexOf(c)));
                        playerPlay();
                    }
                } else {
                    // Đang dẫn vòng: không bỏ lượt được — tự đánh lá nhỏ nhất
                    showMessage('Hết giờ! Tự động đánh lá nhỏ nhất.');
                    state.selected = new Set([0]);
                    playerPlay();
                }
            }
        }
    }, 1000);
}

function stopTimer() {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
}

function updateTimerUI() {
    const timerBox = document.querySelector('.timer-box');
    const timerText = document.getElementById('timer-text');
    timerText.textContent = state.timeLeft;

    if (state.timeLeft <= 5) {
        timerBox.classList.add('danger');
    } else {
        timerBox.classList.remove('danger');
    }
}

// ============================================================
//  CARD HELPERS
// ============================================================
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function rankValue(card) { return RANKS.indexOf(card.rank); }
function suitValue(card) { return SUITS.indexOf(card.suit); }

function compareCards(a, b) {
    const r = rankValue(a) - rankValue(b);
    if (r !== 0) return r;
    return suitValue(a) - suitValue(b);
}

function sortHand(hand) {
    hand.sort(compareCards);
    return hand;
}

// ============================================================
//  COMBO DETECTION
// ============================================================
function getCombo(cards) {
    if (!cards || cards.length === 0) return null;
    const n = cards.length;
    const sorted = [...cards].sort(compareCards);
    const ranks = sorted.map(c => rankValue(c));

    const counts = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const countVals = Object.values(counts);
    const uniqueRanks = Object.keys(counts).map(Number).sort((a, b) => a - b);

    // Single
    if (n === 1) {
        return { type: 'single', cards: sorted, rank: ranks[0] };
    }

    // Pair
    if (n === 2 && countVals.every(c => c === 2)) {
        return { type: 'pair', cards: sorted, rank: ranks[0] };
    }

    // Triple
    if (n === 3 && countVals.every(c => c === 3)) {
        return { type: 'triple', cards: sorted, rank: ranks[0] };
    }

    // Quad
    if (n === 4 && countVals.every(c => c === 4)) {
        return { type: 'quad', cards: sorted, rank: ranks[0] };
    }

    // Straight (sảnh): 3+ lá liên tiếp, không có 2
    if (n >= 3 && countVals.every(c => c === 1)) {
        const hasTwo = uniqueRanks.includes(RANK_2);
        let consecutive = true;
        for (let i = 1; i < uniqueRanks.length; i++) {
            if (uniqueRanks[i] !== uniqueRanks[i - 1] + 1) {
                consecutive = false;
                break;
            }
        }
        if (consecutive && !hasTwo) {
            return {
                type: 'straight',
                cards: sorted,
                rank: uniqueRanks[uniqueRanks.length - 1],
                length: n
            };
        }
    }

    // Đôi thông: 3+ đôi liên tiếp
    if (n >= 6 && n % 2 === 0 && countVals.every(c => c === 2)) {
        const hasTwo = uniqueRanks.includes(RANK_2);
        let consecutive = true;
        for (let i = 1; i < uniqueRanks.length; i++) {
            if (uniqueRanks[i] !== uniqueRanks[i - 1] + 1) {
                consecutive = false;
                break;
            }
        }
        if (consecutive && !hasTwo) {
            return {
                type: 'double_straight',
                cards: sorted,
                rank: uniqueRanks[uniqueRanks.length - 1],
                pairs: uniqueRanks.length
            };
        }
    }

    return null;
}

// So sánh: newCombo có đè được oldCombo không?
function canBeat(newCombo, oldCombo) {
    if (!oldCombo) return true;
    if (!newCombo) return false;

    const nc = newCombo, oc = oldCombo;

    // Tứ quý
    if (nc.type === 'quad') {
        if (oc.type === 'single' && oc.rank === RANK_2) return true;
        if (oc.type === 'pair' && oc.rank === RANK_2) return true;
        if (oc.type === 'quad') return nc.rank > oc.rank;
    }

    // 3+ đôi thông
    if (nc.type === 'double_straight' && nc.pairs >= 3) {
        if (oc.type === 'single' && oc.rank === RANK_2) return true;
        if (nc.pairs >= 4) {
            if (oc.type === 'quad') return true;
            if (oc.type === 'pair' && oc.rank === RANK_2) return true;
            if (oc.type === 'double_straight' && oc.pairs === 3) return true;
        }
    }

    // Cùng loại
    if (nc.type !== oc.type) return false;

    if (nc.type === 'straight') {
        if (nc.length !== oc.length) return false;
        if (nc.rank !== oc.rank) return nc.rank > oc.rank;
        const nTopS = nc.cards[nc.cards.length - 1];
        const oTopS = oc.cards[oc.cards.length - 1];
        return suitValue(nTopS) > suitValue(oTopS);
    }

    if (nc.type === 'double_straight') {
        if (nc.pairs !== oc.pairs) return false;
        if (nc.rank !== oc.rank) return nc.rank > oc.rank;
        const nTopD = nc.cards[nc.cards.length - 1];
        const oTopD = oc.cards[oc.cards.length - 1];
        return suitValue(nTopD) > suitValue(oTopD);
    }

    if (nc.type === 'single' || nc.type === 'pair' || nc.type === 'triple') {
        if (nc.rank > oc.rank) return true;
        if (nc.rank < oc.rank) return false;
        // Cùng số: so chất của lá lớn nhất (lá cuối cùng sau khi sắp xếp)
        const nTop = nc.cards[nc.cards.length - 1];
        const oTop = oc.cards[oc.cards.length - 1];
        return suitValue(nTop) > suitValue(oTop);
    }

    return false;
}

// ============================================================
//  DEVICE / ORIENTATION GATE
// ============================================================
function isMobileDevice() {
    const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const ua = navigator.userAgent || '';
    const isMobileUA = /android|iphone|ipad|ipod|mobile|blackberry|opera mini|iemobile/i.test(ua);
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return (hasTouch && isMobileUA) || isIPadOS;
}

function isLandscape() {
    return window.innerWidth > window.innerHeight;
}

let gameStarted = false;

function applyRotation() {
    const game = document.getElementById('game-container');
    if (!game) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vh > vw) {
        // Máy dọc → xoay game 90° thành landscape
        game.classList.add('rotate-90');
        game.style.width = vh + 'px';
        game.style.height = vw + 'px';
    } else {
        // Máy ngang → bình thường
        game.classList.remove('rotate-90');
        game.style.width = '';
        game.style.height = '';
    }

    // Mức co theo chiều cao KHUNG GAME sau xoay (không theo chiều cao máy)
    const lh = vh > vw ? vw : vh;
    game.classList.toggle('tier-short', lh <= 440);
    game.classList.toggle('tier-tiny', lh <= 350);
}

function checkGate() {
    const blocker = document.getElementById('blocker');
    const game = document.getElementById('game-container');
    const icon = document.getElementById('blocker-icon');
    const title = document.getElementById('blocker-title');
    const text = document.getElementById('blocker-text');

    if (!isMobileDevice()) {
        blocker.classList.remove('hidden');
        game.classList.add('hidden');
        icon.textContent = '💻';
        icon.style.animation = 'none';
        title.textContent = 'Chỉ hỗ trợ điện thoại';
        text.textContent = 'Game này chỉ chơi được trên điện thoại. Vui lòng mở bằng điện thoại của bạn.';
        return false;
    }

    blocker.classList.add('hidden');
    game.classList.remove('hidden');
    applyRotation();
    return true;
}

function initOrResume() {
    if (checkGate()) {
        if (!gameStarted) {
            gameStarted = true;
            if (loadGame()) resumeSavedGame();
            else newGame();
        }
    }
}

function resumeSavedGame() {
    document.getElementById('overlay').classList.add('hidden');
    render();
    if (state.turn === 0) {
        showMessage('Tiếp tục ván đã lưu!');
        startTimer();
    } else {
        startTimer();
        setTimeout(() => showMessage('Tiếp tục ván đã lưu!'), 300);
        setTimeout(botPlay, 900);
    }
}

// ============================================================
//  GAME FLOW
// ============================================================
function newGame() {
    stopTimer();
    const deck = shuffle(createDeck());
    playShuffle();
    state.hands.player = sortHand(deck.slice(0, 13));
    state.hands.left   = sortHand(deck.slice(13, 26));
    state.hands.right  = sortHand(deck.slice(26, 39));
    state.hands.top    = sortHand(deck.slice(39, 52));

    // Tìm ai có 3♠ đi trước
    state.turn = 0;
    for (let i = 0; i < PLAYERS.length; i++) {
        const p = PLAYERS[i];
        if (state.hands[p].some(c => c.rank === '3' && c.suit === '♠')) {
            state.turn = i;
            break;
        }
    }

    state.lastPlay = null;
    state.passCount = 0;
    state.hasPassed = false;
    state.firstMove = true;
    state.selected.clear();
    state.gameOver = false;

    // Đảm bảo overlay thắng/thua không che nút Ván mới
    document.getElementById('overlay').classList.add('hidden');

    render();
    updateTurnIndicator();
    if (document.querySelectorAll) {
        document.querySelectorAll('.player-cards .card').forEach((el, i) => {
            el.classList.add('card-deal-anim');
            el.style.animationDelay = (i * 0.05) + 's';
        });
    }
    showMessage(`${PLAYER_NAMES[PLAYERS[state.turn]]} đi trước`);

    if (state.turn !== 0) {
        setTimeout(botPlay, 800);
    } else {
        updateButtons();
        startTimer();
    }
}

// ============================================================
//  RENDER
// ============================================================
function updateTurnIndicator() {
    const targets = {
        player: document.querySelector('.player-info'),
        left: document.querySelector('.bot-left .bot-info'),
        top: document.querySelector('.bot-top .bot-info'),
        right: document.querySelector('.bot-right .bot-info')
    };
    Object.values(targets).forEach(el => { if (el) el.classList.remove('active-turn'); });
    if (state.gameOver) return;
    const el = targets[PLAYERS[state.turn]];
    if (el) el.classList.add('active-turn');
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
function handleCardClick(idx) {
    if (state.gameOver || state.turn !== 0) return;
    const hand = state.hands.player;
    const rv = rankValue(hand[idx]);

    if (state.selected.has(idx)) {
        // Click lại 1 lá trong cụm đang chọn: thu gọn còn đúng lá đó (để đánh lẻ);
        // nếu đang chỉ chọn đúng 1 lá thì bỏ chọn hẳn
        if (state.selected.size === 1) state.selected.delete(idx);
        else { state.selected.clear(); state.selected.add(idx); }
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

let lastPlayAnimKey = null;

function renderLastPlay() {
    const el = document.getElementById('played-cards');
    el.innerHTML = '';
    if (!state.lastPlay) { lastPlayAnimKey = null; return; }
    // Chỉ bay khi nước đánh thay đổi thật; các lần render lại (qua lượt/bỏ lượt) thì đứng yên
    const key = state.lastPlay.player + '|' + state.lastPlay.cards.map(c => c.rank + c.suit).join(',');
    const animate = key !== lastPlayAnimKey;
    lastPlayAnimKey = key;
    const dir = ['from-bottom', 'from-left', 'from-right', 'from-top'][state.lastPlay.player] || 'from-bottom';
    const sorted = [...state.lastPlay.cards].sort(compareCards);
    sorted.forEach(card => {
        const c = createCardEl(card);
        if (animate) c.classList.add('card-play-anim', dir);
        el.appendChild(c);
    });
}

function createCardEl(card) {
    const div = document.createElement('div');
    const isRed = (card.suit === '♥' || card.suit === '♦');
    div.className = 'card ' + (isRed ? 'red' : 'black');
    div.innerHTML = `
        <div class="corner">
            <span>${card.rank}</span>
            <span>${card.suit}</span>
        </div>
        <div class="suit-big">${card.suit}</div>
    `;
    return div;
}

function showMessage(msg) {
    document.getElementById('message').textContent = msg;
}

function updateButtons() {
    const isMyTurn = (state.turn === 0) && !state.gameOver;
    document.getElementById('btn-play').disabled = !isMyTurn || state.hasPassed || state.selected.size === 0;
    document.getElementById('btn-pass').disabled = !isMyTurn || state.hasPassed || !state.lastPlay;
}

// ============================================================
//  PLAYER ACTIONS
// ============================================================
function playerPlay() {
    if (state.turn !== 0 || state.gameOver) return;
    if (state.hasPassed) return; // Đã bỏ lượt trong vòng này thì không được đánh lại

    const indices = [...state.selected].sort((a, b) => a - b);
    const cards = indices.map(i => state.hands.player[i]);
    const combo = getCombo(cards);

    if (!combo) {
        showMessage('Bộ bài không hợp lệ!');
        return;
    }

    if (state.firstMove && !cards.some(c => c.rank === '3' && c.suit === '♠')) {
        showMessage('Nước đầu phải có 3♠!');
        return;
    }

    if (!canBeat(combo, state.lastPlay ? state.lastPlay.combo : null)) {
        showMessage('Bộ bài không đè được!');
        return;
    }

    stopTimer();
    vibrate(40);
    playClick();
    speakPlay(combo, 0);

    // Xóa bài khỏi tay (từ index lớn xuống)
    for (let i = indices.length - 1; i >= 0; i--) {
        state.hands.player.splice(indices[i], 1);
    }

    state.lastPlay = { player: 0, cards, combo };
    state.firstMove = false;
    state.passCount = 0;
    state.selected.clear();

    render();

    if (state.hands.player.length === 0) {
        return endGame(0);
    }

    showMessage(`Bạn đánh ${formatCombo(combo)}`);
    nextTurn();
}

function playerPass() {
    if (state.turn !== 0 || state.gameOver) return;
    if (!state.lastPlay) return;
    state.hasPassed = true;
    document.getElementById('btn-play').disabled = true;
    document.getElementById('btn-pass').disabled = true;
    stopTimer();
    showMessage('Bạn bỏ lượt');
    doPass();
}

// ============================================================
//  TURN MANAGEMENT
// ============================================================
function nextTurn() {
    state.turn = (state.turn + 1) % 4;

    if (state.passCount >= 3) {
        state.lastPlay = null;
        state.passCount = 0;
        state.hasPassed = false;
        renderLastPlay();
    }

    if (state.gameOver) return;

    if (state.turn === 0) {
        if (state.hasPassed && state.lastPlay) {
            // Đã bỏ lượt trong vòng này → tự động bỏ qua
            render();
            setTimeout(() => {
                if (state.gameOver) return;
                showMessage('Bạn đã bỏ lượt vòng này!');
                doPass();
            }, 350);
            return;
        }
        setTimeout(() => {
            vibrate([100, 50, 100]);
            showMessage('Lượt của bạn!');
            render();
            startTimer();
        }, 350);
    } else {
        startTimer();
        render();
        setTimeout(() => {
            showMessage(`Lượt của ${PLAYER_NAMES[PLAYERS[state.turn]]}`);
        }, 300);
        setTimeout(botPlay, 900);
    }
    updateTurnIndicator();
}

function doPass() {
    speak(tauntFor('pass'), state.turn);
    state.passCount++;
    if (state.passCount >= 3) {
        state.lastPlay = null;
        state.passCount = 0;
        state.hasPassed = false;
        renderLastPlay();
    }
    nextTurn();
}

// ============================================================
//  BOT LOGIC
// ============================================================
// ===== NƯỚC ĐẦU CỦA VÁN: bộ bài phải chứa 3♠ =====
function firstMoveCandidates(hand) {
    const spade3 = hand.find(c => c.rank === '3' && c.suit === '♠');
    if (!spade3) return [];
    const byRank = {};
    hand.forEach(c => { const r = rankValue(c); (byRank[r] = byRank[r] || []).push(c); });
    const out = [];
    const add = cards => { const combo = getCombo(cards); if (combo) out.push({ cards, combo }); };
    add([spade3]);
    const threes = byRank[rankValue(spade3)];
    const otherThrees = threes.filter(c => c !== spade3);
    otherThrees.forEach(c => add([spade3, c]));
    if (threes.length >= 3) add([spade3, otherThrees[0], otherThrees[1]]);
    if (threes.length >= 4) add([...threes]);
    const r3 = rankValue(spade3);
    // Sảnh bắt đầu từ 3
    let maxRun = 0;
    while (byRank[r3 + maxRun]) maxRun++;
    for (let len = 3; len <= maxRun && r3 + len - 1 < RANK_2; len++) {
        const cards = [spade3];
        for (let r = r3 + 1; r < r3 + len; r++) cards.push(byRank[r][0]);
        add(cards);
    }
    // Đôi thông bắt đầu từ đôi 3
    if (threes.length >= 2) {
        let maxPairs = 0;
        while (byRank[r3 + maxPairs] && byRank[r3 + maxPairs].length >= 2) maxPairs++;
        for (let len = 3; len <= maxPairs && r3 + len - 1 < RANK_2; len++) {
            const cards = [spade3, otherThrees[0]];
            for (let r = r3 + 1; r < r3 + len; r++) cards.push(byRank[r][0], byRank[r][1]);
            add(cards);
        }
    }
    return out;
}

// largest = true: bộ lớn nhất (cho bot); false: bộ nhỏ nhất (cho người chơi hết giờ)
function pickFirstMove(hand, largest) {
    const cands = firstMoveCandidates(hand);
    if (!cands.length) return null;
    const power = c => { const top = c.combo.cards[c.combo.cards.length - 1]; return rankValue(top) * 10 + suitValue(top); };
    cands.sort((a, b) => (a.cards.length - b.cards.length) || (power(a) - power(b)));
    return largest ? cands[cands.length - 1] : cands[0];
}

function botPlay() {
    if (state.gameOver) return;
    const who = PLAYERS[state.turn];
    if (who === 'player') return;

    const hand = state.hands[who];
    const opponentCombo = state.lastPlay ? state.lastPlay.combo : null;

    let cardsToPlay = null;

    // Đối thủ đang còn chơi chỉ còn 1 lá -> phải chặn
    const danger = [0, 1, 2, 3].some(i => i !== state.turn && state.hands[PLAYERS[i]].length === 1);
    // Nước dùng lá 2 hoặc hàng chặt (tứ quý/đôi thông) là "hàng dự trữ": giữ lại, chỉ dùng khi cần
    const usesReserve = c => c.combo.type === 'quad' || c.combo.type === 'double_straight' || c.cards.some(card => rankValue(card) === RANK_2);

    if (!opponentCombo) {
        if (state.firstMove) {
            const pick = pickFirstMove(hand, true);
            if (pick) cardsToPlay = pick.cards;
        } else if (danger) {
            // Dẫn vòng khi cần chặn: đánh lá đơn cao nhất
            cardsToPlay = [hand[hand.length - 1]];
        } else {
            // Dẫn vòng: xả lá rác (lá lẻ không thuộc đôi/sảnh nào) nhỏ nhất trước
            const counts = {};
            hand.forEach(c => counts[rankValue(c)] = (counts[rankValue(c)] || 0) + 1);
            const uniq = [...new Set(hand.map(c => rankValue(c)))].filter(r => r < RANK_2).sort((a, b) => a - b);
            const inRun = new Set();
            let runStart = 0;
            for (let i = 1; i <= uniq.length; i++) {
                if (i === uniq.length || uniq[i] !== uniq[i - 1] + 1) {
                    if (i - runStart >= 3) for (let k = runStart; k < i; k++) inRun.add(uniq[k]);
                    runStart = i;
                }
            }
            const trash = hand.find(c => counts[rankValue(c)] === 1 && !inRun.has(rankValue(c)));
            cardsToPlay = [trash || hand[0]];
        }
    } else {
        const candidates = findCandidates(hand, opponentCombo);
        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                const aSame = a.combo.type === opponentCombo.type;
                const bSame = b.combo.type === opponentCombo.type;
                if (aSame !== bSame) return bSame ? 1 : -1;
                return a.combo.rank - b.combo.rank;
            });
            let pool = candidates;
            if (!danger) {
                const nonReserve = candidates.filter(c => !usesReserve(c));
                if (nonReserve.length > 0) pool = nonReserve;
            }
            // Cần chặn thì lấy nước mạnh nhất, bình thường lấy nước yếu nhất trong pool
            cardsToPlay = (danger ? pool[pool.length - 1] : pool[0]).cards;
        }
    }

    if (!cardsToPlay) {
        showMessage(`${PLAYER_NAMES[who]} bỏ lượt`);
        setTimeout(() => doPass(), 400);
        return;
    }

    // Xóa bài
    const idx = cardsToPlay.map(c => hand.indexOf(c));
    idx.sort((a, b) => b - a).forEach(i => hand.splice(i, 1));

    const combo = getCombo(cardsToPlay);
    state.lastPlay = { player: state.turn, cards: cardsToPlay, combo };
    state.firstMove = false;
    state.passCount = 0;

    playClick();
    speakPlay(combo, state.turn);
    render();
    showMessage(`${PLAYER_NAMES[who]} đánh ${formatCombo(combo)}`);

    if (hand.length === 0) {
        return endGame(state.turn);
    }

    if (state.gameOver) return;
    nextTurn();
}

function findCandidates(hand, target) {
    const results = [];
    const byRank = {};
    hand.forEach((c, i) => {
        const r = rankValue(c);
        if (!byRank[r]) byRank[r] = [];
        byRank[r].push({ card: c, idx: i });
    });

    // Singles
    if (target.type === 'single') {
        hand.forEach((c) => {
            const combo = { type: 'single', cards: [c], rank: rankValue(c) };
            if (canBeat(combo, target)) results.push({ cards: [c], combo });
        });
    }

    // Pairs: thử mọi cặp trong nhóm cùng số (nhóm xếp theo chất tăng dần,
    // cặp đè được với chất nhỏ nhất đủ thắng sẽ đứng đầu danh sách)
    if (target.type === 'pair') {
        Object.values(byRank).forEach(group => {
            for (let i = 0; i < group.length - 1; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const cards = [group[i].card, group[j].card];
                    const combo = { type: 'pair', cards, rank: rankValue(cards[0]) };
                    if (canBeat(combo, target)) results.push({ cards, combo });
                }
            }
        });
    }

    // Triples: thử mọi bộ 3 trong nhóm cùng số
    if (target.type === 'triple') {
        Object.values(byRank).forEach(group => {
            for (let i = 0; i < group.length - 2; i++) {
                for (let j = i + 1; j < group.length - 1; j++) {
                    for (let k = j + 1; k < group.length; k++) {
                        const cards = [group[i].card, group[j].card, group[k].card];
                        const combo = { type: 'triple', cards, rank: rankValue(cards[0]) };
                        if (canBeat(combo, target)) results.push({ cards, combo });
                    }
                }
            }
        });
    }

    // Straights
    if (target.type === 'straight') {
        const len = target.length;
        const sortedRanks = Object.keys(byRank).map(Number).sort((a, b) => a - b);
        for (let start = 0; start < sortedRanks.length; start++) {
            const seq = [sortedRanks[start]];
            for (let k = start + 1; k < sortedRanks.length && seq.length < len; k++) {
                if (sortedRanks[k] === seq[seq.length - 1] + 1) seq.push(sortedRanks[k]);
                else break;
            }
            if (seq.length === len && !seq.includes(RANK_2)) {
                const topRank = seq[seq.length - 1];
                byRank[topRank].forEach(topEntry => {
                    const cards = seq.map(r => r === topRank ? topEntry.card : byRank[r][0].card);
                    const combo = getCombo(cards);
                    if (combo && canBeat(combo, target)) results.push({ cards, combo });
                });
            }
        }
    }

    // Quad
    Object.values(byRank).forEach(group => {
        if (group.length >= 4) {
            const cards = group.slice(0, 4).map(g => g.card);
            const combo = { type: 'quad', cards, rank: rankValue(cards[0]) };
            if (canBeat(combo, target)) results.push({ cards, combo });
        }
    });

    // Đôi thông
    const pairs = Object.keys(byRank)
        .filter(r => byRank[r].length >= 2)
        .map(Number)
        .sort((a, b) => a - b);

    for (let start = 0; start < pairs.length; start++) {
        const seq = [pairs[start]];
        for (let k = start + 1; k < pairs.length; k++) {
            if (pairs[k] === seq[seq.length - 1] + 1) seq.push(pairs[k]);
            else break;
        }
        for (let len = 3; len <= seq.length; len++) {
            if (seq.slice(0, len).includes(RANK_2)) continue;
            const topR = seq[len - 1];
            const topGroup = byRank[topR];
            for (let i = 0; i < topGroup.length - 1; i++) {
                for (let j = i + 1; j < topGroup.length; j++) {
                    const cards = [];
                    seq.slice(0, len).forEach(r => {
                        if (r === topR) cards.push(topGroup[i].card, topGroup[j].card);
                        else cards.push(byRank[r][0].card, byRank[r][1].card);
                    });
                    const combo = getCombo(cards);
                    if (combo && canBeat(combo, target)) results.push({ cards, combo });
                }
            }
        }
    }

    return results;
}

function formatCombo(combo) {
    if (!combo) return '';
    const map = {
        single: 'lá',
        pair: 'đôi',
        triple: 'sám cô',
        quad: 'tứ quý',
        straight: 'sảnh',
        double_straight: 'đôi thông'
    };
    return map[combo.type] || combo.type;
}

// ============================================================
//  END GAME
// ============================================================
function endGame(winnerIdx) {
    stopTimer();
    state.gameOver = true;
    clearSave();
    playWin();
    const winnerKey = PLAYERS[winnerIdx];
    PLAYERS.forEach(k => { state.money[k] += (k === winnerKey ? 300 : -100); });
    updateMoneyUI();
    const name = PLAYER_NAMES[PLAYERS[winnerIdx]];
    showMessage(`${name} thắng!`);

    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    title.textContent = winnerIdx === 0 ? '🎉 Bạn thắng! 🎉' : `😢 ${name} thắng!`;
    const om = document.getElementById('overlay-money');
    if (om) {
        om.textContent = winnerIdx === 0 ? '💰 +300' : '💸 -100';
        om.classList.remove('coin-pop');
        void om.offsetWidth;
        om.classList.add('coin-pop');
    }
    overlay.classList.remove('hidden');

    updateButtons();
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
document.getElementById('btn-play').addEventListener('click', playerPlay);
document.getElementById('btn-pass').addEventListener('click', playerPass);
document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-overlay-new').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('hidden');
    newGame();
});
document.getElementById('btn-sound').addEventListener('click', toggleSound);
if (!soundOn) document.getElementById('btn-sound').textContent = '🔇';
document.getElementById('btn-clear-save').addEventListener('click', () => {
    if (!confirm('Xóa ván đã lưu và bắt đầu ván mới?')) return;
    clearSave();
    document.getElementById('overlay').classList.add('hidden');
    newGame();
});
// Gate + resize
window.addEventListener('resize', () => {
    clearTimeout(window._resizeTimer);
    window._resizeTimer = setTimeout(() => {
        if (!document.getElementById('game-container').classList.contains('hidden')) {
            applyRotation();
        }
    }, 150);
});

window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (!document.getElementById('game-container').classList.contains('hidden')) {
            applyRotation();
        }
    }, 250);
});

// Start
document.addEventListener('DOMContentLoaded', initOrResume);
