// ============================================================
//  TIẾN LÊN MIỀN NAM — game.js: STATE + LUỒNG VÁN + CÀI ĐẶT
// ============================================================

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
    gameOver: false,
    playedAny: { player: false, left: false, right: false, top: false },
    playedCards: [],
    ledger: [],
    lastPlayWasChop: false,
    hintsLeft: 3,
    sortMode: 'rank',
    toiTrang: null
};
state.timer = null;
state.timeLeft = 15;

// ============================================================
//  RUNG / ÂM THANH / LƯU VÁN
// ============================================================

// ============================================================
//  CÀI ĐẶT + THỐNG KÊ (localStorage, luôn trong try/catch)
// ============================================================
const DEFAULT_SETTINGS = { sound: true, voice: true, botSpeed: 'vua', difficulty: 'thuong', bet: 100, tableColor: 'xanh', backStyle: 'kimcuong' };
let settings = { ...DEFAULT_SETTINGS };
let stats = { games: 0, wins: 0, losses: 0, curStreak: 0, bestStreak: 0, biggestWin: 0 };

function betFactor() { return (settings.bet || 100) / 100; }

function loadSettings() {
    try {
        const raw = localStorage.getItem('tlSettings');
        if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {}
    applySettings();
}
function saveSettings() {
    try { localStorage.setItem('tlSettings', JSON.stringify(settings)); } catch (e) {}
}
function applySettings() {
    soundOn = settings.sound;
    voiceOn = settings.voice;
    if (document.body) {
        document.body.classList.remove('theme-do', 'theme-duong');
        if (settings.tableColor === 'do') document.body.classList.add('theme-do');
        if (settings.tableColor === 'duong') document.body.classList.add('theme-duong');
    }
    const gc = document.getElementById('game-container');
    if (gc) {
        gc.classList.remove('theme-do', 'theme-duong', 'back-soc', 'back-cham');
        if (settings.tableColor === 'do') gc.classList.add('theme-do');
        if (settings.tableColor === 'duong') gc.classList.add('theme-duong');
        if (settings.backStyle === 'soc') gc.classList.add('back-soc');
        if (settings.backStyle === 'cham') gc.classList.add('back-cham');
    }
    const bs = document.getElementById('btn-sound');
    if (bs) bs.textContent = settings.sound ? '🔊' : '🔇';
    if (typeof syncSettingsForm === 'function') syncSettingsForm();
}
function loadStats() {
    try {
        const raw = localStorage.getItem('tlStats');
        if (raw) stats = { ...stats, ...JSON.parse(raw) };
    } catch (e) {}
}
function saveStats() {
    try { localStorage.setItem('tlStats', JSON.stringify(stats)); } catch (e) {}
}
function updateStats(winnerIdx, playerTotalDelta) {
    stats.games++;
    if (winnerIdx === 0) {
        stats.wins++;
        stats.curStreak++;
        if (stats.curStreak > stats.bestStreak) stats.bestStreak = stats.curStreak;
        if (playerTotalDelta > stats.biggestWin) stats.biggestWin = playerTotalDelta;
    } else {
        stats.losses++;
        stats.curStreak = 0;
    }
    saveStats();
}

function saveGame() {
    try {
        if (state.gameOver) return;
        localStorage.setItem('tlSave', JSON.stringify({
            v: 3,
            hands: state.hands,
            turn: state.turn,
            lastPlay: state.lastPlay,
            passCount: state.passCount,
            hasPassed: state.hasPassed,
            firstMove: state.firstMove,
            money: state.money,
            selected: [...state.selected],
            playedAny: state.playedAny,
            playedCards: state.playedCards,
            ledger: state.ledger,
            lastPlayWasChop: state.lastPlayWasChop,
            hintsLeft: state.hintsLeft,
            sortMode: state.sortMode
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
        if (!d || (d.v !== 2 && d.v !== 3) || !d.hands || !d.hands.player || !d.hands.left || !d.hands.right || !d.hands.top) return false;
        state.hands = d.hands;
        state.turn = d.turn || 0;
        state.lastPlay = d.lastPlay || null;
        state.passCount = d.passCount || 0;
        state.hasPassed = !!d.hasPassed;
        state.firstMove = !!d.firstMove;
        if (d.money) state.money = d.money;
        state.selected = new Set(d.selected || []);
        state.playedAny = d.playedAny || { player: false, left: false, right: false, top: false };
        state.playedCards = d.playedCards || [];
        state.ledger = d.ledger || [];
        state.lastPlayWasChop = !!d.lastPlayWasChop;
        state.hintsLeft = (typeof d.hintsLeft === 'number') ? d.hintsLeft : 3;
        state.sortMode = d.sortMode || 'rank';
        state.toiTrang = null;
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
    setTurnRing('player', state.timeLeft / 15, state.timeLeft <= 5);
}

// ============================================================
//  CARD HELPERS
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
    loadSettings();
    loadStats();
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
        setTimeout(botPlay, botDelay());
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
    state.playedAny = { player: false, left: false, right: false, top: false };
    state.playedCards = [];
    state.ledger = [];
    state.lastPlayWasChop = false;
    state.sortMode = 'rank';
    state.hintsLeft = 3;
    state.toiTrang = null;

    // Đảm bảo overlay thắng/thua không che nút Ván mới
    document.getElementById('overlay').classList.add('hidden');
    clearPassLabels();
    const cfBox = document.getElementById('confetti');
    if (cfBox) cfBox.innerHTML = '';

    render();
    updateTurnIndicator();
    if (document.querySelectorAll) {
        document.querySelectorAll('.player-cards .card').forEach((el, i) => {
            el.classList.add('card-deal-anim');
            el.style.animationDelay = (i * 0.05) + 's';
        });
        document.querySelectorAll('.back-card').forEach((el, i) => {
            el.classList.add('deal-anim');
            el.style.animationDelay = (i * 0.03) + 's';
        });
    }
    updateHintButton();
    // TỚI TRẮNG: kiểm tra ngay khi chia bài, trước nước đi đầu tiên
    const tt = checkToiTrangAll(state.hands, state.turn);
    if (tt) {
        state.toiTrang = tt;
        endGame(PLAYERS.indexOf(tt.player));
        return;
    }
    showMessage(`${PLAYER_NAMES[PLAYERS[state.turn]]} đi trước`);

    if (state.turn !== 0) {
        setTimeout(botPlay, botDelay());
    } else {
        updateButtons();
        startTimer();
    }
}

// ============================================================
//  RENDER
// ============================================================

// Ghi nhận một nước đánh thành công: theo dõi cóng + đếm bài, và xử lý CHẶT HEO ngay tại chỗ.
// Chặt heo: bộ mới là tứ quý/đôi thông đè bộ cũ có heo -> người bị chặt đền ngay cho người chặt.
// Chặt CHỒNG (bộ bị chặt chính là bộ vừa chặt heo trước đó) thì đền gấp đôi. Mọi khoản đều hai chiều (tổng = 0).
function trackPlay(whoKey, cards, combo, prevPlay) {
    state.playedAny[whoKey] = true;
    cards.forEach(c => state.playedCards.push(c));
    if (prevPlay && (combo.type === 'quad' || combo.type === 'double_straight')) {
        const heos = prevPlay.cards.filter(c => c.rank === '2');
        if (heos.length) {
            const victimKey = PLAYERS[prevPlay.player];
            let amount = heos.reduce((sum, c) => sum + heoValue(c), 0);
            const chong = !!state.lastPlayWasChop;
            if (chong) amount *= 2;
            amount *= betFactor();
            state.money[whoKey] += amount;
            state.money[victimKey] -= amount;
            state.ledger.push({ type: chong ? 'chat-chong' : 'chat', from: victimKey, to: whoKey, amount });
            updateMoneyUI();
            floatMoney(whoKey, '+' + amount, true);
            floatMoney(victimKey, '−' + amount, false);
            showMessage('⚔️ ' + PLAYER_NAMES[whoKey] + (chong ? ' chặt CHỒNG heo của ' : ' chặt heo của ') + PLAYER_NAMES[victimKey] + ' — đền ' + amount + ' xu!');
            state.lastPlayWasChop = true;
            return;
        }
    }
    state.lastPlayWasChop = false;
}

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

    const prevPlay = state.lastPlay;
    state.lastPlay = { player: 0, cards, combo };
    trackPlay('player', cards, combo, prevPlay);
    state.firstMove = false;
    state.passCount = 0;
    state.selected.clear();

    render();

    if (state.hands.player.length === 0) {
        return endGame(0);
    }

    if (!state.lastPlayWasChop) showMessage(`Bạn đánh ${formatCombo(combo)}`);
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
        clearPassLabels();
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
        setTimeout(botPlay, botDelay());
    }
    updateTurnIndicator();
}

function doPass() {
    speak(tauntFor('pass'), state.turn);
    showPassLabel(PLAYERS[state.turn]);
    state.passCount++;
    if (state.passCount >= 3) {
        state.lastPlay = null;
        state.passCount = 0;
        state.hasPassed = false;
        clearPassLabels();
        renderLastPlay();
    }
    nextTurn();
}

// ============================================================
//  BOT LOGIC
// ============================================================
// ===== NƯỚC ĐẦU CỦA VÁN: bộ bài phải chứa 3♠ =====

function endGame(winnerIdx) {
    stopTimer();
    state.gameOver = true;
    clearSave();
    playWin();
    const winnerKey = PLAYERS[winnerIdx];
    const k = betFactor();
    const delta = { player: 0, left: 0, top: 0, right: 0 };

    if (state.toiTrang) {
        // TỚI TRẮNG: mỗi người còn lại trả gấp đôi mức thua cơ bản
        PLAYERS.forEach(key => {
            if (key === winnerKey) return;
            const pay = 200 * k;
            delta[key] -= pay;
            delta[winnerKey] += pay;
            state.ledger.push({ type: 'toitrang', from: key, to: winnerKey, amount: pay });
        });
    } else {
        // Thắng cơ bản + CÓNG (chưa đánh được lá nào trong ván: trả gấp đôi)
        PLAYERS.forEach(key => {
            if (key === winnerKey) return;
            const cong = !state.playedAny[key];
            const pay = (cong ? 200 : 100) * k;
            delta[key] -= pay;
            delta[winnerKey] += pay;
            state.ledger.push({ type: cong ? 'cong' : 'base', from: key, to: winnerKey, amount: pay });
        });
        // THỐI HEO: còn heo trên tay khi ván kết thúc thì đền cho người thắng theo giá heo
        PLAYERS.forEach(key => {
            if (key === winnerKey) return;
            state.hands[key].filter(c => c.rank === '2').forEach(card => {
                const v = heoValue(card) * k;
                delta[key] -= v;
                delta[winnerKey] += v;
                state.ledger.push({ type: 'thoi', from: key, to: winnerKey, amount: v, note: 'heo ' + card.suit });
            });
        });
    }

    PLAYERS.forEach(key => { state.money[key] += delta[key]; });
    updateMoneyUI();

    // Tổng thay đổi cả ván (cộng cả chặt heo đã thanh toán ngay trong ván) — luôn bằng 0 khi cộng 4 người
    const totalDelta = { ...delta };
    state.ledger.forEach(en => {
        if (en.type === 'chat' || en.type === 'chat-chong') {
            totalDelta[en.to] += en.amount;
            totalDelta[en.from] -= en.amount;
        }
    });
    PLAYERS.forEach(key => {
        if (totalDelta[key] !== 0) floatMoney(key, (totalDelta[key] > 0 ? '+' : '−') + Math.abs(totalDelta[key]), totalDelta[key] > 0);
    });

    updateStats(winnerIdx, totalDelta.player);

    const name = PLAYER_NAMES[winnerKey];
    showMessage(state.toiTrang ? '🎉 ' + name + ' TỚI TRẮNG (' + state.toiTrang.label + ')!' : `${name} thắng!`);

    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    if (state.toiTrang) title.textContent = winnerIdx === 0 ? '🎉 TỚI TRẮNG! Bạn thắng! 🎉' : '🎉 ' + name + ' TỚI TRẮNG!';
    else title.textContent = winnerIdx === 0 ? '🎉 Bạn thắng! 🎉' : `😢 ${name} thắng!`;
    const om = document.getElementById('overlay-money');
    if (om) {
        om.textContent = totalDelta.player >= 0 ? '💰 +' + totalDelta.player : '💸 ' + totalDelta.player;
        om.classList.remove('coin-pop');
        void om.offsetWidth;
        om.classList.add('coin-pop');
    }
    renderBreakdown(totalDelta);
    if (winnerIdx === 0) spawnConfetti();
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
// Tiện ích + cài đặt
document.getElementById('btn-hint').addEventListener('click', hintMove);
document.getElementById('btn-sort').addEventListener('click', toggleSort);
document.getElementById('btn-settings').addEventListener('click', () => { syncSettingsForm(); openModal('settings-modal'); });
document.getElementById('btn-close-settings').addEventListener('click', () => closeModal('settings-modal'));
document.getElementById('btn-open-stats').addEventListener('click', () => { renderStats(); openModal('stats-modal'); });
document.getElementById('btn-close-stats').addEventListener('click', () => closeModal('stats-modal'));
document.getElementById('btn-open-rules').addEventListener('click', () => openModal('rules-modal'));
document.getElementById('btn-close-rules').addEventListener('click', () => closeModal('rules-modal'));
document.getElementById('btn-refill').addEventListener('click', () => {
    if (state.money.player > 0) { showMessage('Bạn vẫn còn tiền, chưa cần nạp!'); return; }
    state.money.player = 1000;
    updateMoneyUI();
    saveGame();
    syncSettingsForm();
    showMessage('Đã nạp lại 1000 xu!');
});
function bindSetting(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { fn(el); saveSettings(); applySettings(); });
}
bindSetting('set-sound', el => settings.sound = el.checked);
bindSetting('set-voice', el => settings.voice = el.checked);
bindSetting('set-speed', el => settings.botSpeed = el.value);
bindSetting('set-difficulty', el => settings.difficulty = el.value);
bindSetting('set-bet', el => settings.bet = parseInt(el.value, 10) || 100);
bindSetting('set-table', el => settings.tableColor = el.value);
bindSetting('set-back', el => settings.backStyle = el.value);
initSwipeSelect();

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
