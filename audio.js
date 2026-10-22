// ============================================================
//  TIẾN LÊN MIỀN NAM — audio.js: ÂM THANH + GIỌNG ĐỌC
// ============================================================

function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

let audioCtx = null;
let soundOn = true;
let voiceOn = true;
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

// ===== HIỂN THỊ PHỤ: vòng giờ, nhãn bỏ lượt, bong bóng, tiền bay, confetti =====

function speak(text, actorIdx) {
    showBubble(actorIdx, text);
    try {
        if (!voiceOn) return;
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


function toggleSound() {
    soundOn = !soundOn;
    if (typeof settings !== 'undefined') { settings.sound = soundOn; if (typeof saveSettings === 'function') saveSettings(); }
    const b = document.getElementById('btn-sound');
    if (b) b.textContent = soundOn ? '🔊' : '🔇';
    if (typeof syncSettingsForm === 'function') syncSettingsForm();
    if (soundOn) playClick();
}

