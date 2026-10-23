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
    passed: { player: false, left: false, top: false, right: false },
    firstMove: true,
    money: { player: 1000, left: 1000, right: 1000, top: 1000 },
    selected: new Set(),
    gameOver: false,
    playedAny: { player: false, left: false, right: false, top: false },
    playedCards: [],
    ledger: [],
    lastPlayWasChop: false,
    lastChop: null,
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
const DEFAULT_SETTINGS = { sound: true, music: true, voice: true, autoPlay: true, botSpeed: 'vua', difficulty: 'thuong', bet: 100, tableColor: 'xanh', backStyle: 'kimcuong', personaLeft: 'goc', personaTop: 'goc', personaRight: 'goc', swearLevel: 'tuc' };
let settings = { ...DEFAULT_SETTINGS };
let stats = { games: 0, wins: 0, losses: 0, curStreak: 0, bestStreak: 0, biggestWin: 0 };

function betFactor() { return (settings.bet || 100) / 100; }

function loadSettings() {
    try {
        const raw = localStorage.getItem('tlSettings');
        if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {}
    // Kiểu lưng Bựa đỏ-xanh đã gỡ ở r44: ai đang lưu kiểu đó thì tự về Kim cương
    if (!['kimcuong', 'soc', 'cham', 'vangkim', 'timmong', 'denhuyen'].includes(settings.backStyle)) settings.backStyle = 'kimcuong';
    applySettings();
}
function saveSettings() {
    try { localStorage.setItem('tlSettings', JSON.stringify(settings)); } catch (e) {}
}
function applySettings() {
    soundOn = settings.sound;
    voiceOn = settings.voice;
    try { musicSync(); } catch (e) {}
    if (document.body) {
        document.body.classList.remove('theme-do', 'theme-duong', 'theme-tim', 'theme-den');
        if (settings.tableColor === 'do') document.body.classList.add('theme-do');
        if (settings.tableColor === 'duong') document.body.classList.add('theme-duong');
        if (settings.tableColor === 'tim') document.body.classList.add('theme-tim');
        if (settings.tableColor === 'den') document.body.classList.add('theme-den');
    }
    const gc = document.getElementById('game-container');
    if (gc) {
        gc.classList.remove('theme-do', 'theme-duong', 'theme-tim', 'theme-den', 'back-soc', 'back-cham', 'back-bua', 'back-vangkim', 'back-timmong', 'back-denhuyen');
        if (settings.tableColor === 'do') gc.classList.add('theme-do');
        if (settings.tableColor === 'duong') gc.classList.add('theme-duong');
        if (settings.tableColor === 'tim') gc.classList.add('theme-tim');
        if (settings.tableColor === 'den') gc.classList.add('theme-den');
        if (settings.backStyle === 'soc') gc.classList.add('back-soc');
        if (settings.backStyle === 'cham') gc.classList.add('back-cham');
        if (settings.backStyle === 'vangkim') gc.classList.add('back-vangkim');
        if (settings.backStyle === 'timmong') gc.classList.add('back-timmong');
        if (settings.backStyle === 'denhuyen') gc.classList.add('back-denhuyen');
    }
    const bs = document.getElementById('btn-sound');
    if (bs) bs.textContent = settings.sound ? '🔊' : '🔇';
    if (typeof applyMetaVisuals === 'function') applyMetaVisuals();
    if (typeof syncSettingsForm === 'function') syncSettingsForm();
}
// ============================================================
//  META GAME (r61): CẤP ĐỘ + NHIỆM VỤ NGÀY + THƯỞNG ĐĂNG NHẬP + CỬA HÀNG
//  Lưu ở localStorage 'tlMeta', chạy offline, dùng chung hệ xu (tlMoney) và thống kê (tlStats)
// ============================================================
// r79: bộ nhiệm vụ ngày (3 mức độ) + nhiệm vụ tuần + mốc hoàn thành.
// Tiến độ chỉ tăng từ sự kiện chơi thật (updateStats / onPlayerChop qua bumpProgress).
const DAILY_TASK_DEFS = {
    play3:  { tier: 'de',   name: 'Chơi 3 ván',        goal: 3, reward: 80 },
    win1:   { tier: 'de',   name: 'Thắng 1 ván',       goal: 1, reward: 100 },
    win3:   { tier: 'tb',   name: 'Thắng 3 ván',       goal: 3, reward: 200 },
    chop1:  { tier: 'tb',   name: 'Chặt 1 heo',        goal: 1, reward: 180 },
    win5:   { tier: 'kho',  name: 'Thắng 5 ván',       goal: 5, reward: 350 },
    trang1: { tier: 'kho',  name: 'Tới trắng 1 lần',   goal: 1, reward: 400 }
};
const WEEKLY_TASK_DEFS = {
    wplay30: { name: 'Chơi 30 ván trong tuần',  goal: 30, reward: 600 },
    wwin15:  { name: 'Thắng 15 ván trong tuần', goal: 15, reward: 800 },
    wchop5:  { name: 'Chặt 5 heo trong tuần',   goal: 5,  reward: 700 },
    wtrang2: { name: 'Tới trắng 2 lần trong tuần', goal: 2, reward: 1200 }
};
const MILESTONE_DEFS = {
    d3:   { scope: 'd', need: 3, name: 'Hoàn thành 3 nhiệm vụ ngày',  reward: 200 },
    dall: { scope: 'd', need: 6, name: 'Hoàn thành tất cả nhiệm vụ ngày', reward: 400 },
    w2:   { scope: 'w', need: 2, name: 'Hoàn thành 2 nhiệm vụ tuần',  reward: 500 }
};
// Đường thưởng đăng nhập 7 ngày: ngày 7 có thêm khung avatar Ngọc (frame-ngoc)
const LOGIN_REWARDS = [50, 75, 100, 125, 150, 200, 500];
let meta = { xp: 0, owned: [], equipped: { avatar: '🧑', frame: 'none' }, daily: null, weekly: null, login: { lastDate: '', streak: 0 } };
let levelUpNote = ''; // ghi chú lên cấp/thưởng XP để hiện kèm bảng kê cuối ván
let lastXpGain = 0; // XP nhận được ở ván vừa kết thúc (hiện trên bảng kết ván)

function saveMeta() { try { localStorage.setItem('tlMeta', JSON.stringify(meta)); } catch (e) {} }
function loadMeta() {
    try {
        const raw = localStorage.getItem('tlMeta');
        if (raw) {
            const m = JSON.parse(raw);
            if (m) meta = { ...meta, ...m, equipped: { ...meta.equipped, ...(m.equipped || {}) }, login: { ...meta.login, ...(m.login || {}) } };
            if (m && m.weekly) meta.weekly = m.weekly;
        }
    } catch (e) {}
    ensureDaily();
    ensureWeekly();
}
function levelFromXp(xp) {
    let lv = 1, need = 100, rest = xp;
    while (rest >= need) { rest -= need; lv++; need = 100 * lv; }
    return { level: lv, into: rest, need };
}
function addXp(n) {
    const before = levelFromXp(meta.xp).level;
    meta.xp += n;
    const after = levelFromXp(meta.xp).level;
    if (after > before) {
        const bonus = 200 * (after - before);
        state.money.player += bonus;
        saveMoney();
        levelUpNote = '⭐ Lên cấp ' + after + '! Thưởng ' + bonus + ' xu (đã cộng).';
        floatMoney('player', '+' + bonus, true);
        if (typeof fxLevelUp === 'function') fxLevelUp(); // r80: phát sáng avatar khi lên cấp
    }
    saveMeta();
}
function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function emptyTasks(defs) { const o = {}; Object.keys(defs).forEach(k => { o[k] = { p: 0, c: false }; }); return o; }
function ensureDaily() {
    const t = todayStr();
    if (!meta.daily || meta.daily.date !== t) {
        const y = todayStr(new Date(Date.now() - 86400000));
        meta.login.streak = (meta.login.lastDate === y) ? (meta.login.streak || 0) + 1 : 1;
        meta.login.lastDate = t;
        meta.daily = { date: t, claimed: false, tasks: emptyTasks(DAILY_TASK_DEFS), milestones: { d3: false, dall: false } };
        saveMeta();
        return;
    }
    // r79 di trú: daily hôm nay theo cấu trúc cũ (chop/wins/streak) -> cấu trúc mới,
    // giữ nguyên tiến độ và trạng thái đã nhận để không ai mất thưởng hay farm lại.
    const tk = meta.daily.tasks || {};
    if (!tk.play3) {
        const oldWins = tk.wins || { p: 0, c: false };
        const oldChop = tk.chop || { p: 0, c: false };
        const nt = emptyTasks(DAILY_TASK_DEFS);
        nt.win1.p = Math.min(1, oldWins.p || 0); nt.win1.c = !!oldWins.c;
        nt.win3.p = Math.min(3, oldWins.p || 0); nt.win3.c = !!oldWins.c;
        nt.win5.p = Math.min(5, oldWins.p || 0);
        nt.chop1.p = Math.min(1, oldChop.p || 0); nt.chop1.c = !!oldChop.c;
        meta.daily.tasks = nt;
        saveMeta();
    }
    if (!meta.daily.milestones) meta.daily.milestones = { d3: false, dall: false };
}
function weekKey() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7; // 0 = thứ Hai
    d.setDate(d.getDate() - day);
    return todayStr(d);
}
function ensureWeekly() {
    const wk = weekKey();
    if (!meta.weekly || meta.weekly.week !== wk) {
        meta.weekly = { week: wk, tasks: emptyTasks(WEEKLY_TASK_DEFS), milestones: { w2: false } };
        saveMeta();
    }
    if (!meta.weekly.milestones) meta.weekly.milestones = { w2: false };
}
// Tăng tiến độ nhiệm vụ từ sự kiện chơi thật: 'play' | 'win' | 'chop' | 'trang'
function bumpProgress(kind) {
    ensureDaily(); ensureWeekly();
    const bump = (tasks, defs, keys) => {
        keys.forEach(k => {
            const tk = tasks[k], def = defs[k];
            if (tk && def && tk.p < def.goal) tk.p++;
        });
    };
    if (kind === 'play') { bump(meta.daily.tasks, DAILY_TASK_DEFS, ['play3']); bump(meta.weekly.tasks, WEEKLY_TASK_DEFS, ['wplay30']); }
    else if (kind === 'win') { bump(meta.daily.tasks, DAILY_TASK_DEFS, ['win1', 'win3', 'win5']); bump(meta.weekly.tasks, WEEKLY_TASK_DEFS, ['wwin15']); }
    else if (kind === 'chop') { bump(meta.daily.tasks, DAILY_TASK_DEFS, ['chop1']); bump(meta.weekly.tasks, WEEKLY_TASK_DEFS, ['wchop5']); }
    else if (kind === 'trang') { bump(meta.daily.tasks, DAILY_TASK_DEFS, ['trang1']); bump(meta.weekly.tasks, WEEKLY_TASK_DEFS, ['wtrang2']); }
    saveMeta();
}
function loginCycleDay() { return ((Math.max(1, meta.login.streak || 1) - 1) % 7) + 1; }
function loginReward() { return LOGIN_REWARDS[loginCycleDay() - 1]; }
function claimLogin() {
    ensureDaily();
    if (meta.daily.claimed) return;
    meta.daily.claimed = true;
    const day = loginCycleDay();
    const r = loginReward();
    state.money.player += r;
    floatMoney('player', '+' + r, true); // r80: xu bay khi nhận thưởng đăng nhập
    let extra = '';
    if (day === 7 && !meta.owned.includes('frame-ngoc')) {
        meta.owned.push('frame-ngoc');
        extra = ' + khung avatar Ngọc 🎁';
    }
    saveMoney(); saveMeta();
    if (typeof renderLobbyMeta === 'function') renderLobbyMeta();
    if (typeof renderTasks === 'function') renderTasks();
    showMessage('🎁 Thưởng đăng nhập ngày ' + day + '/7: +' + r + ' xu!' + extra);
}
function claimDailyTask(key) {
    ensureDaily();
    const def = DAILY_TASK_DEFS[key], tk = meta.daily.tasks[key];
    if (!def || !tk || tk.c || tk.p < def.goal) return false;
    tk.c = true;
    state.money.player += def.reward;
    floatMoney('player', '+' + def.reward, true); // r80: xu bay khi nhận thưởng (chỉ 1 lần)
    saveMoney(); saveMeta();
    if (typeof renderTasks === 'function') renderTasks();
    showMessage('🎯 Hoàn thành nhiệm vụ: +' + def.reward + ' xu!');
    return true;
}
function claimWeeklyTask(key) {
    ensureWeekly();
    const def = WEEKLY_TASK_DEFS[key], tk = meta.weekly.tasks[key];
    if (!def || !tk || tk.c || tk.p < def.goal) return false;
    tk.c = true;
    state.money.player += def.reward;
    floatMoney('player', '+' + def.reward, true); // r80: xu bay khi nhận thưởng tuần (giống nhiệm vụ ngày)
    saveMoney(); saveMeta();
    if (typeof renderTasks === 'function') renderTasks();
    showMessage('🗓️ Hoàn thành nhiệm vụ tuần: +' + def.reward + ' xu!');
    return true;
}
function claimedCount(tasks) { return Object.keys(tasks).filter(k => tasks[k].c).length; }
function claimMilestone(key) {
    ensureDaily(); ensureWeekly();
    const def = MILESTONE_DEFS[key];
    if (!def) return false;
    const store = def.scope === 'd' ? meta.daily.milestones : meta.weekly.milestones;
    if (!store || store[key]) return false;
    const tasks = def.scope === 'd' ? meta.daily.tasks : meta.weekly.tasks;
    if (claimedCount(tasks) < def.need) return false;
    store[key] = true;
    state.money.player += def.reward;
    floatMoney('player', '+' + def.reward, true); // r80: xu bay khi nhận thưởng
    saveMoney(); saveMeta();
    if (typeof renderTasks === 'function') renderTasks();
    showMessage('🏆 ' + def.name + ': +' + def.reward + ' xu!');
    return true;
}
function onPlayerChop() {
    ensureDaily();
    addXp(15);
    bumpProgress('chop');
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
    // r61 + r79: XP + tiến độ nhiệm vụ ngày/tuần từ sự kiện ván vừa xong
    ensureDaily();
    bumpProgress('play');
    if (winnerIdx === 0) {
        lastXpGain = state.toiTrang ? 50 : 30;
        addXp(lastXpGain);
        bumpProgress('win');
        if (state.toiTrang) bumpProgress('trang');
    } else {
        lastXpGain = 10;
        addXp(10);
    }
    saveMeta();
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
            passed: state.passed,
            firstMove: state.firstMove,
            money: state.money,
            selected: [...state.selected],
            playedAny: state.playedAny,
            playedCards: state.playedCards,
            ledger: state.ledger,
            lastPlayWasChop: state.lastPlayWasChop,
            lastChop: state.lastChop,
            hintsLeft: state.hintsLeft,
            sortMode: state.sortMode
        }));
        saveMoney();
    } catch (e) {}
}

function clearSave() {
    try { localStorage.removeItem('tlSave'); } catch (e) {}
}

// Tiền lưu RIÊNG (tlMoney) để giữ qua các phiên, không phụ thuộc bản lưu ván dở
function saveMoney() {
    try { localStorage.setItem('tlMoney', JSON.stringify(state.money)); } catch (e) {}
}
function loadMoney() {
    try {
        const raw = localStorage.getItem('tlMoney');
        if (!raw) return;
        const m = JSON.parse(raw);
        if (!m) return;
        PLAYERS.forEach(key => {
            if (typeof m[key] === 'number') state.money[key] = m[key];
            if (state.money[key] <= 0) state.money[key] = 1000; // hết tiền thì lần vào sau được cấp lại 1000
        });
    } catch (e) {}
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
        state.passed = d.passed ? { player: !!d.passed.player, left: !!d.passed.left, top: !!d.passed.top, right: !!d.passed.right } : { player: false, left: false, top: false, right: false };
        state.firstMove = !!d.firstMove;
        if (d.money) state.money = d.money;
        state.selected = new Set(d.selected || []);
        state.playedAny = d.playedAny || { player: false, left: false, right: false, top: false };
        state.playedCards = d.playedCards || [];
        state.ledger = d.ledger || [];
        state.lastPlayWasChop = !!d.lastPlayWasChop;
        state.lastChop = d.lastChop || null;
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
            onPlayerTimeout();
        }
    }, 1000);
}

// Xử lý khi người chơi hết giờ (đồng hồ về 0)
function onPlayerTimeout() {
    if (state.turn !== 0 || state.gameOver) return;
    if (state.lastPlay) {
        if (settings.autoPlay) {
            // Chế độ tự động BẬT: máy chọn nước như bot Thường và đánh thay
            const move = chooseNormalMove('player');
            if (move) {
                showMessage('🤖 Hết giờ — máy đánh thay!');
                state.selected = new Set(move.map(c => state.hands.player.indexOf(c)));
                renderPlayerHand();
                setTimeout(() => { if (state.turn === 0 && !state.gameOver) playerPlay(); }, 600);
                return;
            }
            showMessage('🤖 Hết giờ — không có bài đè được nên bỏ lượt.');
            playerPass();
            return;
        }
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
let inLobby = false; // đang ở sảnh chờ: chặn bot chạy nền (r67)
let lastWinnerIdx = -1; // người thắng ván trước trong phiên này (-1 = chưa có ván nào xong)


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
    loadMoney();
    loadMeta();
    if (checkGate()) {
        if (!gameStarted) {
            // Hiện sảnh chờ trước; có ván dở thì nạp sẵn state và cho nút Chơi tiếp
            const hasSave = loadGame();
            showLobby(!!hasSave);
        }
    }
}

// Sảnh chờ: Bắt đầu = ván đầu của phiên (3♠ đi trước); Chơi tiếp = vào ván đã lưu
function showLobby(hasSave) {
    inLobby = true;
    const lobby = document.getElementById('lobby');
    if (lobby) lobby.classList.remove('hidden');
    if (typeof renderLobbyMeta === 'function') renderLobbyMeta();
    const cont = document.getElementById('btn-continue');
    if (cont) cont.classList.toggle('hidden', !hasSave);
}
// Về sảnh chờ (từ Cài đặt hoặc bảng kết ván): ván dở được lưu lại để Chơi tiếp
function backToLobby() {
    stopTimer();
    saveGame();
    document.getElementById('overlay').classList.add('hidden');
    let hasSave = false;
    try { hasSave = !state.gameOver && !!localStorage.getItem('tlSave'); } catch (e) {}
    showLobby(hasSave);
}

function enterGame(fromSave) {
    inLobby = false;
    const lobby = document.getElementById('lobby');
    if (lobby) lobby.classList.add('hidden');
    gameStarted = true;
    if (fromSave) resumeSavedGame();
    else { clearSave(); newGame(); }
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
    levelUpNote = '';
    lastXpGain = 0;
    const deck = shuffle(createDeck());
    playShuffle();
    try { aiWarmUp(); } catch (e) {}
    try { musicStart(); } catch (e) {}
    try { banterStart(); } catch (e) {}
    state.hands.player = sortHand(deck.slice(0, 13));
    state.hands.left   = sortHand(deck.slice(13, 26));
    state.hands.right  = sortHand(deck.slice(26, 39));
    state.hands.top    = sortHand(deck.slice(39, 52));

    // Ai đi trước: ván đầu của phiên -> người giữ 3♠, nước đầu bắt buộc có 3♠;
    // các ván sau -> người thắng ván trước đi trước, nước đầu tự do.
    if (lastWinnerIdx >= 0) {
        state.turn = lastWinnerIdx;
        state.firstMove = false;
    } else {
        state.turn = 0;
        for (let i = 0; i < PLAYERS.length; i++) {
            const p = PLAYERS[i];
            if (state.hands[p].some(c => c.rank === '3' && c.suit === '♠')) {
                state.turn = i;
                break;
            }
        }
        state.firstMove = true;
    }

    state.lastPlay = null;
    state.passCount = 0;
    state.hasPassed = false;
    state.passed = { player: false, left: false, top: false, right: false };
    state.selected.clear();
    state.gameOver = false;
    state.playedAny = { player: false, left: false, right: false, top: false };
    state.playedCards = [];
    state.ledger = [];
    state.lastPlayWasChop = false;
    state.lastChop = null;
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
    let chopped = false;
    if (prevPlay && (combo.type === 'quad' || combo.type === 'double_straight')) {
        const victimKey = PLAYERS[prevPlay.player];
        // CHẶT CHỒNG: bộ bị đè chính là nước vừa chặt heo -> người chặt trước trả lại gấp đôi khoản vừa thu:
        // người chặt sau nhận lại đúng khoản đó, người bị chặt đầu tiên được hoàn lại tiền heo.
        if (state.lastPlayWasChop && state.lastChop) {
            const prev = state.lastChop;
            state.money[prev.chopper] -= prev.amount * 2;
            state.money[whoKey] += prev.amount;
            state.money[prev.victim] += prev.amount;
            state.ledger.push({ type: 'chat-chong', from: prev.chopper, to: whoKey, amount: prev.amount, note: 'thu lại khoản chặt heo vòng trước' });
            state.ledger.push({ type: 'chat-chong', from: prev.chopper, to: prev.victim, amount: prev.amount, note: 'hoàn tiền heo cho người bị chặt đầu tiên' });
            updateMoneyUI();
            floatMoney(whoKey, '+' + prev.amount, true);
            floatMoney(prev.victim, '+' + prev.amount, true);
            floatMoney(prev.chopper, '−' + (prev.amount * 2), false);
            showMessage('⚔️ ' + PLAYER_NAMES[whoKey] + ' chặt CHỒNG! ' + PLAYER_NAMES[prev.chopper] + ' trả lại ' + (prev.amount * 2) + ' xu.');
            chopped = true;
            state.lastChop = { amount: prev.amount, chopper: whoKey, victim: prev.chopper };
        }
        const heos = prevPlay.cards.filter(c => c.rank === '2');
        if (heos.length) {
            const amount = heos.reduce((sum, c) => sum + heoValue(c), 0) * betFactor();
            state.money[whoKey] += amount;
            state.money[victimKey] -= amount;
            state.ledger.push({ type: 'chat', from: victimKey, to: whoKey, amount });
            updateMoneyUI();
            floatMoney(whoKey, '+' + amount, true);
            floatMoney(victimKey, '−' + amount, false);
            if (whoKey === 'player') onPlayerChop();
            if (!chopped) showMessage('⚔️ ' + PLAYER_NAMES[whoKey] + ' chặt heo của ' + PLAYER_NAMES[victimKey] + ' — đền ' + amount + ' xu!');
            chopped = true;
            state.lastChop = { amount, chopper: whoKey, victim: victimKey };
        }
    }
    state.lastPlayWasChop = chopped;
    if (!chopped) state.lastChop = null;
    if (chopped && typeof fxChop === 'function') fxChop(); // r80: hiệu ứng bàn khi có chặt heo/chặt chồng
    // Phương án C: chặt heo là khoảnh khắc lớn — người chặt (hoặc người bị chặt) nói câu sinh tại chỗ theo đúng sự việc
    if (chopped && state.lastChop && typeof aiSayNow === 'function' && typeof AI_NAMES !== 'undefined') {
        try {
            const lc = state.lastChop;
            const ci = PLAYERS.indexOf(lc.chopper);
            const vi = PLAYERS.indexOf(lc.victim);
            if (lc.chopper !== 'player' && ci > 0) aiSayNow(ci, 'Bạn vừa chặt heo của ' + (AI_NAMES[lc.victim] || 'đối thủ') + ' và được đền ' + lc.amount + ' xu.', null);
            else if (lc.victim !== 'player' && vi > 0) aiSayNow(vi, 'Bạn vừa bị ' + (AI_NAMES[lc.chopper] || 'đối thủ') + ' chặt heo, mất ' + lc.amount + ' xu đền, rất cay cú.', null);
        } catch (e) {}
    }
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

    const flySrc = captureFlySource('player', cards); // chụp vị trí lá đã chọn trước khi cắt bài
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
    playFlyAnimation('player', flySrc);

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
        state.passed = { player: false, left: false, top: false, right: false };
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
    state.passed[PLAYERS[state.turn]] = true; // ghi dấu đã bỏ lượt trong vòng này (áp cho cả bot lẫn người chơi)
    const lp = state.lastPlay;
    const bigPass = !!(lp && lp.combo && (lp.combo.type === 'quad' || lp.combo.type === 'double_straight' || (lp.cards || []).some(c => c.rank === '2')));
    speak(aiLine(state.turn, bigPass ? 'passbig' : 'pass', tauntFor('pass')), state.turn);
    showPassLabel(PLAYERS[state.turn]);
    state.passCount++;
    if (state.passCount >= 3) {
        state.lastPlay = null;
        state.passCount = 0;
        state.hasPassed = false;
        state.passed = { player: false, left: false, top: false, right: false };
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
    lastWinnerIdx = winnerIdx; // ván sau: người thắng đi trước
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
    saveMoney();
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
    const ox = document.getElementById('overlay-xp');
    if (ox) ox.textContent = '⭐ +' + lastXpGain + ' XP · Cấp ' + levelFromXp(meta.xp).level;
    renderBreakdown(totalDelta);
    render();
    if (winnerIdx === 0) spawnConfetti();
    const oc = document.getElementById('overlay-content');
    if (oc) oc.classList.toggle('player-won', winnerIdx === 0);
    toggleReview(false);
    overlay.classList.remove('hidden');

    // Phương án C: kết ván — người thắng (hoặc bot suýt thắng khi người chơi thắng) nói câu sinh tại chỗ
    try {
        if (typeof aiSayNow === 'function') {
            if (winnerIdx > 0) {
                aiSayNow(winnerIdx, 'Bạn vừa THẮNG ván Tiến Lên này' + (state.toiTrang ? ' bằng TỚI TRẮNG' : '') + ', tổng ăn được ' + Math.abs(totalDelta[winnerKey]) + ' xu từ cả bàn.', null);
            } else {
                let best = -1, bestLeft = 99;
                PLAYERS.forEach((k2, i2) => { if (i2 > 0 && state.hands[k2].length < bestLeft) { bestLeft = state.hands[k2].length; best = i2; } });
                if (best > 0) aiSayNow(best, 'Bạn vừa THUA ván Tiến Lên này — người chơi thắng ván. Bạn chỉ còn ' + bestLeft + ' lá nữa thôi là thắng, cực kỳ tiếc và cay cú.', null);
            }
        }
    } catch (e) {}

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
// Xem lại bài: ẩn bảng kết ván + bỏ lớp mờ để soi bài đã ngửa của cả bàn
function toggleReview(on) {
    const ov = document.getElementById('overlay');
    const back = document.getElementById('btn-review-back');
    if (on) { ov.classList.add('review-mode'); if (back) back.classList.remove('hidden'); }
    else { ov.classList.remove('review-mode'); if (back) back.classList.add('hidden'); }
}

document.getElementById('btn-overlay-review').addEventListener('click', () => toggleReview(true));
document.getElementById('btn-review-back').addEventListener('click', () => toggleReview(false));
document.getElementById('btn-overlay-lobby').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('hidden');
    backToLobby();
});
document.getElementById('btn-to-lobby').addEventListener('click', () => { closeModal('settings-modal'); backToLobby(); });
document.getElementById('btn-shop-ingame').addEventListener('click', () => { renderShop(); openModal('shop-modal'); });
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
document.getElementById('btn-start').addEventListener('click', () => enterGame(false));
document.getElementById('btn-continue').addEventListener('click', () => enterGame(true));
document.getElementById('btn-settings').addEventListener('click', () => { syncSettingsForm(); openModal('settings-modal'); });
document.getElementById('btn-shop').addEventListener('click', () => { renderShop(); openModal('shop-modal'); });
document.getElementById('btn-close-shop').addEventListener('click', () => closeModal('shop-modal'));
document.getElementById('btn-tasks').addEventListener('click', () => { renderTasks(); openModal('tasks-modal'); });
document.getElementById('btn-close-tasks').addEventListener('click', () => closeModal('tasks-modal'));
document.getElementById('btn-gift').addEventListener('click', claimLogin);
document.getElementById('btn-close-settings').addEventListener('click', () => closeModal('settings-modal'));
document.getElementById('btn-open-stats').addEventListener('click', () => { renderStats(); openModal('stats-modal'); });
document.getElementById('btn-close-stats').addEventListener('click', () => closeModal('stats-modal'));
document.getElementById('btn-open-rules').addEventListener('click', () => openModal('rules-modal'));
document.getElementById('btn-close-rules').addEventListener('click', () => closeModal('rules-modal'));
document.getElementById('btn-refill').addEventListener('click', () => {
    if (state.money.player >= 100) { showMessage('Chỉ nạp được khi xu dưới 100!'); return; }
    state.money.player += 500;
    updateMoneyUI();
    saveMoney();
    saveGame();
    syncSettingsForm();
    showMessage('Đã nạp lại 500 xu!');
});
function bindSetting(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { fn(el); saveSettings(); applySettings(); });
}
bindSetting('set-sound', el => settings.sound = el.checked);
bindSetting('set-music', el => settings.music = el.checked);
bindSetting('set-voice', el => settings.voice = el.checked);
bindSetting('set-autoplay', el => settings.autoPlay = el.checked);
bindSetting('set-speed', el => settings.botSpeed = el.value);
bindSetting('set-difficulty', el => settings.difficulty = el.value);
bindSetting('set-bet', el => settings.bet = parseInt(el.value, 10) || 100);
bindSetting('set-table', el => settings.tableColor = el.value);
bindSetting('set-back', el => settings.backStyle = el.value);
bindSetting('set-swear', el => { settings.swearLevel = el.value; try { aiClearPool('left'); aiClearPool('top'); aiClearPool('right'); } catch (e) {} });
bindSetting('set-persona-left', el => { settings.personaLeft = el.value; try { aiClearPool('left'); } catch (e) {} });
bindSetting('set-persona-top', el => { settings.personaTop = el.value; try { aiClearPool('top'); } catch (e) {} });
bindSetting('set-persona-right', el => { settings.personaRight = el.value; try { aiClearPool('right'); } catch (e) {} });
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
