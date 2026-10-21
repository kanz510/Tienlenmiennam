// ============================================================
//  TIẾN LÊN MIỀN NAM - MOBILE LANDSCAPE ONLY
// ============================================================

// ==== CONSTANTS ====
const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const RANK_2 = 12; // index của '2'

const PLAYERS = ['player', 'left', 'right', 'top'];
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
    selected: new Set(),
    gameOver: false
};
state.timer = null;
state.timeLeft = 15;

// ============================================================
//  TIMER — đếm ngược 15s cho lượt người chơi
// ============================================================
function startTimer() {
    stopTimer();
    // Chỉ đếm ngược khi đến lượt người chơi
    if (state.turn !== 0 || state.gameOver) {
        document.querySelector('.timer-box').style.visibility = 'hidden';
        return;
    }

    document.querySelector('.timer-box').style.visibility = 'visible';
    state.timeLeft = 15;
    updateTimerUI();

    state.timer = setInterval(() => {
        state.timeLeft--;
        updateTimerUI();

        if (state.timeLeft <= 0) {
            stopTimer();
            // Hết giờ: có bài trên bàn thì bỏ lượt; đang dẫn vòng thì tự đánh lá nhỏ nhất
            if (state.turn === 0 && !state.gameOver) {
                if (state.lastPlay) {
                    showMessage('Hết giờ! Tự động bỏ lượt.');
                    playerPass();
                } else {
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
        return nc.rank > oc.rank;
    }

    if (nc.type === 'double_straight') {
        if (nc.pairs !== oc.pairs) return false;
        return nc.rank > oc.rank;
    }

    if (nc.type === 'single' || nc.type === 'pair' || nc.type === 'triple') {
        return nc.rank > oc.rank;
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
            newGame();
        }
    }
}

// ============================================================
//  GAME FLOW
// ============================================================
function newGame() {
    stopTimer();
    const deck = shuffle(createDeck());
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
    state.selected.clear();
    state.gameOver = false;

    render();
    showMessage(`${PLAYER_NAMES[PLAYERS[state.turn]]} đi trước`);

    if (state.turn !== 0) {
        setTimeout(botPlay, 800);
    } else {
        updateButtons();
    }
    startTimer();
}

// ============================================================
//  RENDER
// ============================================================
function render() {
    renderPlayerHand();
    renderBotHand('left', 'cards-left', 'count-left');
    renderBotHand('right', 'cards-right', 'count-right');
    renderBotHand('top', 'cards-top', 'count-top');
    renderLastPlay();
    updateButtons();
}

function renderPlayerHand() {
    const el = document.getElementById('cards-player');
    el.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const c = createCardEl(card);
        if (state.selected.has(i)) c.classList.add('selected');
        c.addEventListener('click', () => {
            if (state.gameOver || state.turn !== 0) return;
            if (state.selected.has(i)) state.selected.delete(i);
            else state.selected.add(i);
            renderPlayerHand();
            updateButtons();
        });
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

function renderLastPlay() {
    const el = document.getElementById('played-cards');
    el.innerHTML = '';
    if (!state.lastPlay) return;
    const sorted = [...state.lastPlay.cards].sort(compareCards);
    sorted.forEach(card => {
        el.appendChild(createCardEl(card));
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
        <div class="corner bottom">
            <span>${card.rank}</span>
            <span>${card.suit}</span>
        </div>
    `;
    return div;
}

function showMessage(msg) {
    document.getElementById('message').textContent = msg;
}

function updateButtons() {
    const isMyTurn = (state.turn === 0) && !state.gameOver;
    document.getElementById('btn-play').disabled = !isMyTurn || state.selected.size === 0;
    document.getElementById('btn-pass').disabled = !isMyTurn || !state.lastPlay;
}

// ============================================================
//  PLAYER ACTIONS
// ============================================================
function playerPlay() {
    if (state.turn !== 0 || state.gameOver) return;

    const indices = [...state.selected].sort((a, b) => a - b);
    const cards = indices.map(i => state.hands.player[i]);
    const combo = getCombo(cards);

    if (!combo) {
        showMessage('Bộ bài không hợp lệ!');
        return;
    }

    if (!canBeat(combo, state.lastPlay ? state.lastPlay.combo : null)) {
        showMessage('Bộ bài không đè được!');
        return;
    }

    stopTimer();

    // Xóa bài khỏi tay (từ index lớn xuống)
    for (let i = indices.length - 1; i >= 0; i--) {
        state.hands.player.splice(indices[i], 1);
    }

    state.lastPlay = { player: 0, cards, combo };
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
        renderLastPlay();
    }

    if (state.gameOver) return;

    if (state.turn === 0) {
        setTimeout(() => {
            showMessage('Lượt của bạn!');
            render();
            startTimer();
        }, 350);
    } else {
        stopTimer();
        render();
        setTimeout(() => {
            showMessage(`Lượt của ${PLAYER_NAMES[PLAYERS[state.turn]]}`);
        }, 300);
        setTimeout(botPlay, 900);
    }
}

function doPass() {
    state.passCount++;
    if (state.passCount >= 3) {
        state.lastPlay = null;
        state.passCount = 0;
        renderLastPlay();
    }
    nextTurn();
}

// ============================================================
//  BOT LOGIC
// ============================================================
function botPlay() {
    if (state.gameOver) return;
    const who = PLAYERS[state.turn];
    if (who === 'player') return;

    const hand = state.hands[who];
    const opponentCombo = state.lastPlay ? state.lastPlay.combo : null;

    let cardsToPlay = null;

    if (!opponentCombo) {
        // Đi trước: đánh lá nhỏ nhất
        cardsToPlay = [hand[0]];
    } else {
        const candidates = findCandidates(hand, opponentCombo);
        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                const aSame = a.combo.type === opponentCombo.type;
                const bSame = b.combo.type === opponentCombo.type;
                if (aSame !== bSame) return bSame ? 1 : -1;
                return a.combo.rank - b.combo.rank;
            });
            cardsToPlay = candidates[0].cards;
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
    state.passCount = 0;

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

    // Pairs
    if (target.type === 'pair') {
        Object.values(byRank).forEach(group => {
            if (group.length >= 2) {
                const cards = group.slice(0, 2).map(g => g.card);
                const combo = { type: 'pair', cards, rank: rankValue(cards[0]) };
                if (canBeat(combo, target)) results.push({ cards, combo });
            }
        });
    }

    // Triples
    if (target.type === 'triple') {
        Object.values(byRank).forEach(group => {
            if (group.length >= 3) {
                const cards = group.slice(0, 3).map(g => g.card);
                const combo = { type: 'triple', cards, rank: rankValue(cards[0]) };
                if (canBeat(combo, target)) results.push({ cards, combo });
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
                const cards = seq.map(r => byRank[r][0].card);
                const combo = getCombo(cards);
                if (combo && canBeat(combo, target)) results.push({ cards, combo });
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
            const cards = [];
            seq.slice(0, len).forEach(r => {
                cards.push(byRank[r][0].card, byRank[r][1].card);
            });
            const combo = getCombo(cards);
            if (combo && canBeat(combo, target)) results.push({ cards, combo });
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
    const name = PLAYER_NAMES[PLAYERS[winnerIdx]];
    showMessage(`${name} thắng!`);

    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    title.textContent = winnerIdx === 0 ? '🎉 Bạn thắng! 🎉' : `😢 ${name} thắng!`;
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
