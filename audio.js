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

// ===== NHẠC NỀN JAZZ PIANO (sinh bằng Web Audio — không cần file nhạc) =====
// Vòng I–VI–II–V kiểu jazz (Cmaj9 - A7 - Dm9 - G13), 76 BPM, bước 1/8 có swing.
// Tiếng piano mô phỏng: lớp "dây" sine ngân dài + lớp "búa" hài cao tắt nhanh.
// Đệm hợp âm rải nốt kiểu jazz comping, bass đi bộ 4 nốt/ô, chổi quét rất nhẹ.
const MUSIC_CHORDS = [
    { root: 130.81, tones: [261.63, 329.63, 392.00, 493.88, 587.33] },
    { root: 110.00, tones: [220.00, 277.18, 329.63, 392.00] },
    { root: 146.83, tones: [293.66, 349.23, 440.00, 523.25, 659.25] },
    { root: 98.00,  tones: [196.00, 246.94, 293.66, 349.23, 659.25] }
];
const MUSIC_MELODY = [
    0, 0, 659.25, 0, 0, 587.33, 493.88, 0,
    523.25, 0, 0, 440.00, 0, 554.37, 659.25, 0,
    587.33, 0, 0, 0, 523.25, 0, 440.00, 0,
    493.88, 0, 587.33, 0, 783.99, 0, 659.25, 587.33
];
const MUSIC_WALK = [1, 1.4983, 1.3348, 1.1892];
let musicGain = null, musicTimer = null, musicStep = 0, musicNextTime = 0, musicArmed = false, musicNoiseBuf = null, musicStepDur = 60 / 76 / 2;

function musicPiano(freq, t, vol, dur) {
    const ctx = audioCtx; if (!ctx || !musicGain) return;
    const body = ctx.createGain();
    body.gain.setValueAtTime(0.0001, t);
    body.gain.exponentialRampToValueAtTime(vol, t + 0.007);
    body.gain.exponentialRampToValueAtTime(Math.max(vol * 0.3, 0.0011), t + 0.3);
    body.gain.exponentialRampToValueAtTime(0.001, t + dur);
    body.connect(musicGain);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    o.connect(body); o.start(t); o.stop(t + dur + 0.05);
    const bd = Math.min(dur, 0.38);
    const bright = ctx.createGain();
    bright.gain.setValueAtTime(0.0001, t);
    bright.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.005);
    bright.gain.exponentialRampToValueAtTime(0.001, t + bd);
    bright.connect(musicGain);
    [[2, 0.5], [3, 0.16], [1, 0.5]].forEach(pair => {
        const oo = ctx.createOscillator();
        oo.type = pair[0] === 1 ? 'triangle' : 'sine';
        oo.frequency.value = freq * pair[0];
        const og = ctx.createGain(); og.gain.value = pair[1];
        oo.connect(og); og.connect(bright); oo.start(t); oo.stop(t + bd + 0.05);
    });
}
function musicBrush(t) {
    const ctx = audioCtx; if (!ctx || !musicGain) return;
    if (!musicNoiseBuf) {
        const len = Math.floor(ctx.sampleRate * 0.16);
        musicNoiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = musicNoiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource(); src.buffer = musicNoiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.011;
    src.connect(f); f.connect(g); g.connect(musicGain);
    src.start(t);
}
function musicScheduleStep(step, t) {
    const bar = Math.floor(step / 8) % 4;
    const s8 = step % 8;
    const ch = MUSIC_CHORDS[bar];
    const te = s8 % 2 === 1 ? t + musicStepDur * 0.3 : t; // swing cho nốt lẻ
    if (s8 % 2 === 0) musicPiano(ch.root * MUSIC_WALK[s8 / 2], te, 0.05, 0.55); // bass đi bộ
    if (s8 === 3) { // comping rải nốt
        [1, 2, 3].forEach((k, i2) => { if (ch.tones[k]) musicPiano(ch.tones[k], te + i2 * 0.045, 0.027, 1.1); });
    }
    if (s8 === 6) {
        [2, 3, 4].forEach((k, i2) => { const fr = ch.tones[k] || ch.tones[1]; if (fr) musicPiano(fr, te + i2 * 0.04, 0.022, 1.0); });
        musicBrush(te);
    }
    if (s8 === 2) musicBrush(te);
    const mel = MUSIC_MELODY[step % 32];
    if (mel) musicPiano(mel, te, 0.058, 1.6);
}
function musicStart() {
    musicArmed = true;
    if (musicTimer) return;
    if (typeof settings !== 'undefined' && settings && settings.music === false) return;
    if (!soundOn) return;
    const ctx = ensureAudio(); if (!ctx) return;
    if (!musicGain) { musicGain = ctx.createGain(); musicGain.gain.value = 0.9; musicGain.connect(ctx.destination); }
    musicStep = 0;
    musicNextTime = ctx.currentTime + 0.08;
    musicTimer = setInterval(() => {
        if (!audioCtx || !musicGain) return;
        while (musicNextTime < audioCtx.currentTime + 0.45) {
            musicScheduleStep(musicStep, musicNextTime);
            musicStep++;
            musicNextTime += musicStepDur;
        }
    }, 200);
}
function musicStop() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (musicGain && audioCtx) {
        try {
            const g = musicGain; musicGain = null;
            g.gain.setValueAtTime(g.gain.value, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 250);
        } catch (e) { musicGain = null; }
    }
}
function musicSync() {
    const want = musicArmed && soundOn && !(typeof settings !== 'undefined' && settings && settings.music === false);
    if (want) musicStart(); else musicStop();
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

// ===== GIỌNG ĐỌC AI (qua trạm trung chuyển, model xkiro-voice) =====
// Thay luôn giọng máy của điện thoại theo ý Bảo — không làm mục tùy chọn.
// Mỗi bot một giọng riêng + tốc độ phát riêng cho khác chất. Gọi tiếng lỗi
// (hết hạn mức, mất mạng...) thì tự lùi về giọng máy cũ để game không bị câm.
const TTS_VOICES = {
    player: { voice: 'confident-male-vietnamese', rate: 1.0 },
    left:   { voice: 'confident-male-vietnamese', rate: 1.09 },  // Hùng: nam Việt, nói nhanh hổ báo
    top:    { voice: 'standard-female-vietnamese',  rate: 0.92 },  // Tuấn: nữ Việt chuẩn, chậm, thâm trầm (giọng Tây đọc chữ Việt thành tiếng Anh nên đã bỏ)
    right:  { voice: 'sweet-female-vietnamese',     rate: 1.12 }   // Nam: nữ ngọt, nhanh, láu cá
};
const ttsCache = {};   // "giong|cau" -> object URL của file tiếng
let ttsCacheKeys = [];
let ttsAudio = null;     // file tiếng đang phát (để ngắt khi có câu mới)
let ttsFailUntil = 0;    // sau 1 lần lỗi, nghỉ gọi AI 30 giây (chơi bằng giọng máy tạm)
let voiceBusyUntil = 0;  // mốc thời gian câu đang đọc dự kiến đọc xong (bot chờ tới đó)
let speakSeq = 0;        // số thứ tự câu nói — câu nào về trễ, đã qua lượt, thì không phát nữa
function markVoiceBusy(text, rate) {
    const dur = Math.max(900, Math.min(4600, 500 + String(text).length * 92)) / (rate || 1);
    voiceBusyUntil = Date.now() + dur;
}

function speakNative(text, actorIdx) {
    try {
        markVoiceBusy(text, 1);
        if (ttsAudio) { try { ttsAudio.pause(); } catch (e) {} }
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

function ttsPlay(url, rate, actorIdx, text) {
    if (text) markVoiceBusy(text, rate);
    try {
        if (ttsAudio) { try { ttsAudio.pause(); } catch (e) {} }
        try { if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
        const au = new Audio(url);
        au.playbackRate = rate || 1;
        try { au.preservesPitch = false; } catch (e) {}
        try { au.webkitPreservesPitch = false; } catch (e) {}
        ttsAudio = au;
        if (typeof bubbleSyncAudio === 'function') bubbleSyncAudio(actorIdx, au);
        const p = au.play();
        if (p && p.catch) p.catch(() => {});
    } catch (e) {}
}

// Lấy file tiếng của 1 câu về lưu vào bộ nhớ đệm (dùng chung cho lúc nói và nạp trước).
function ttsFetchToCache(text, conf) {
    const ck = conf.voice + '|' + text;
    if (ttsCache[ck]) return Promise.resolve(ttsCache[ck]);
    if (typeof fetch !== 'function' || Date.now() < ttsFailUntil) return Promise.resolve(null);
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const to = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 7000) : null;
    return fetch(AI_CHAT_URL + 'tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: conf.voice }),
        signal: ctrl ? ctrl.signal : undefined
    }).then(r => {
        if (to) clearTimeout(to);
        if (!r || !r.ok) throw new Error('tts http');
        return r.blob();
    }).then(blob => {
        if (!blob || blob.size < 800) throw new Error('tts rong');
        const url = URL.createObjectURL(blob);
        ttsCache[ck] = url;
        ttsCacheKeys.push(ck);
        if (ttsCacheKeys.length > 40) { const oldK = ttsCacheKeys.shift(); try { URL.revokeObjectURL(ttsCache[oldK]); } catch (e) {} delete ttsCache[oldK]; }
        return url;
    }).catch(() => {
        if (to) clearTimeout(to);
        ttsFailUntil = Date.now() + 30000;
        return null;
    });
}

// Nạp sẵn tiếng cho các câu vừa vào kho: tới lúc bot nói là phát ngay, khớp với chữ.
const ttsPending = {};
let ttsChain = Promise.resolve();
function aiPrefetchTTS(botKey, lines) {
    const conf = TTS_VOICES[botKey];
    if (!conf || typeof fetch !== 'function') return;
    (lines || []).slice(0, 2).forEach(line => {
        const ck = conf.voice + '|' + line;
        if (ttsCache[ck] || ttsPending[ck]) return;
        ttsPending[ck] = 1;
        ttsChain = ttsChain.then(() => ttsFetchToCache(line, conf)).then(() => { delete ttsPending[ck]; }).catch(() => { delete ttsPending[ck]; });
    });
}

function speakAI(text, actorIdx) {
    const mySeq = ++speakSeq;
    const key = PLAYERS[actorIdx || 0];
    const conf = TTS_VOICES[key] || TTS_VOICES.player;
    const ck = conf.voice + '|' + text;
    if (ttsCache[ck]) { ttsPlay(ttsCache[ck], conf.rate, actorIdx, text); return; }
    if (typeof fetch !== 'function' || Date.now() < ttsFailUntil) { speakNative(text, actorIdx); return; }
    if (typeof bubbleKeep === 'function') bubbleKeep(actorIdx, 5000); // giữ chữ chờ tiếng về
    ttsFetchToCache(text, conf).then(url => {
        if (mySeq !== speakSeq) return; // câu này về trễ, bot đã nói câu khác — bỏ qua kẻo chồng tiếng
        if (url) ttsPlay(url, conf.rate, actorIdx, text);
        else speakNative(text, actorIdx);
    });
}

function speak(text, actorIdx) {
    // r101: dẹp giọng đọc (AI + máy) theo ý Bảo — bot chỉ CHAT CHỮ trong bong bóng.
    // Công tắc cũ "Giọng cà khịa" (settings.voice) nay là bật/tắt chat chữ của bot.
    try { if (typeof voiceOn !== 'undefined' && !voiceOn) return; } catch (e) {}
    showBubble(actorIdx, text);
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
function speakPlay(combo, actorIdx, ctx) {
    try {
        let group = 'play';
        if (combo && (combo.type === 'quad' || combo.type === 'double_straight')) group = 'big';
        else if (ctx && ctx.remaining === 1) {
            aiSayNow(actorIdx, 'Bạn vừa đánh và chỉ còn đúng 1 lá bài trên tay — sắp thắng ván này rồi.', tauntFor('big'));
            return;
        }
        else if (ctx && ctx.remaining === 2) group = 'winsoon';
        else if (ctx && combo && combo.cards && combo.cards.length) {
            const hi = rankValue(combo.cards[combo.cards.length - 1]);
            if (ctx.prevCombo && hi >= 9) group = 'press';
            else if (!ctx.prevCombo && hi <= 5) group = 'probe';
        }
        const cards = (combo && combo.cards) || (ctx && ctx.cards) || [];
        const notable = actorIdx > 0 && (group === 'big' || group === 'press' || group === 'winsoon' || cards.some(c => c.rank === '2'));
        if (notable) {
            // Nước đáng nói: sinh câu tại chỗ bám đúng nước đi này (đánh gì, đè ai, còn mấy lá)
            let ev = 'Bạn vừa đánh ' + aiDescribeCombo(combo, cards);
            if (ctx && ctx.prevCombo && ctx.prevOwnerIdx != null && PLAYERS[ctx.prevOwnerIdx]) ev += ' đè bài của ' + (AI_NAMES[PLAYERS[ctx.prevOwnerIdx]] || 'đối thủ');
            if (ctx && typeof ctx.remaining === 'number') ev += '. Sau nước này bạn còn ' + ctx.remaining + ' lá bài trên tay';
            ev += '.';
            aiSayNow(actorIdx, ev, aiLine(actorIdx, group, tauntFor(combo ? combo.type : 'single')));
            return;
        }
        if (combo && Math.random() < 0.5) {
            const line = cardSpeech(combo);
            if (line) return speak(line, actorIdx);
        }
        speak(aiLine(actorIdx, group, tauntFor(combo ? combo.type : 'single')), actorIdx);
    } catch (e) {}
}


function toggleSound() {
    soundOn = !soundOn;
    if (typeof settings !== 'undefined') { settings.sound = soundOn; if (typeof saveSettings === 'function') saveSettings(); }
    const b = document.getElementById('btn-sound');
    if (b) b.textContent = soundOn ? '🔊' : '🔇';
    if (typeof syncSettingsForm === 'function') syncSettingsForm();
    try { musicSync(); } catch (e) {}
    if (soundOn) playClick();
}



// ===== BOT NÓI CHUYỆN BẰNG AI (xKiro) — chỉ giọng điệu, cách đánh bài giữ nguyên =====
// Key xKiro nằm ở trạm trung chuyển của Bảo (Worker), vì xKiro chặn trình
// duyệt gọi chéo domain. Game giữ "kho câu" cho
// từng bot: nạp nền từ trước, khi cần nói thì lấy ngay (không chờ mạng).
// Hết kho / lỗi mạng / không có fetch -> tự dùng câu mẫu TAUNTS như cũ.
const AI_CHAT_KEY = ''; // key nằm ở TRẠM TRUNG CHUYỂN (Cloudflare Worker), game không giữ key nữa
const AI_CHAT_MODEL = 'qwen/qwen3.5-flash:free';
const AI_CHAT_MODEL_FALLBACK = 'mistralai/mistral-large-2512'; // Qwen bị bộ lọc chặn câu tục thì Mistral (thoáng hơn) nạp thay
const AI_CHAT_URL = 'https://soft-fog-4383.tanbaonguyen2409.workers.dev/'; // trạm trung chuyển của Bảo (gắn key + mở CORS rồi gọi xKiro hộ)
const AI_PERSONA = {
    left:  'Bạn là Hùng Sấm Sét, dân chơi Tiến Lên Miền Nam tính hổ báo, hung hăng, nói cộc lốc, thích đe dọa đối thủ.',
    top:   'Bạn là Tuấn Cao Thủ, dân chơi Tiến Lên Miền Nam thâm trầm, ít nói, lạnh lùng khinh khỉnh, câu nào chất câu đó.',
    right: 'Bạn là Nam Lì Đòn, dân chơi Tiến Lên Miền Nam láu cá, lì đòn, chuyên cà khịa dai và cười đểu đối thủ.'
};
const AI_SITUATION = {
    play: 'Bạn vừa đánh ra một nước bài trong ván Tiến Lên.',
    big:  'Bạn vừa tung hàng khủng (tứ quý hoặc đôi thông) hoặc vừa chặt heo của đối thủ trong ván Tiến Lên.',
    pass: 'Bạn bị đối thủ dồn ép nên phải bỏ lượt trong ván Tiến Lên, trong lòng đang cay cú.',
    probe: 'Bạn vừa đánh một nước nhỏ thăm dò đối thủ trong ván Tiến Lên.',
    press: 'Bạn vừa đánh một nước to đè lên nước của đối thủ trong ván Tiến Lên, đang áp đảo.',
    winsoon: 'Bạn sắp thắng ván Tiến Lên này, trên tay chỉ còn đúng 2 lá bài.',
    passbig: 'Bạn bị đối thủ tung hàng quá to dồn ép nên phải bỏ lượt trong ván Tiến Lên, cực kỳ cay cú.'
};
// Phong cách nói chuyện chọn thêm trong Cài đặt (mặc định: tính cách gốc của bot).
// 'vangtuc' = chợ búa văng tục kiểu bạn bè thân chơi bài — Bảo yêu cầu.
const AI_STYLE = {
    hien:    'Nói năng hiền lành, thân thiện, vui vẻ động viên đối thủ, tuyệt đối không chửi thề, không cà khịa gắt.',
    vangtuc: 'Nói giọng chợ búa như bạn bè thân thiết ngồi chơi bài với nhau: văng tục tự nhiên, vừa phải để gây cười bằng các từ viết ĐẦY ĐỦ như đù má, địt mẹ, đéo mẹ, đụ mạ, vãi, tổ sư, mẹ kiếp, chó má — mọi từ chửi phải viết đầy đủ, tuyệt đối không viết tắt kiểu đm vì game sẽ đọc thành tiếng. Chửi cái thế bài và sự đời cho vui, không xúc phạm nặng nề cá nhân, không kỳ thị.',
    rapper:  'Nói câu nào cũng gieo vần như đang rap, có nhịp điệu, chơi chữ.',
    genz:    'Nói kiểu cà khịa Gen Z: lồng tiếng lóng và câu trend đang hot một cách tự nhiên, ví dụ: ê nha, keo quá, đỉnh nóc kịch trần, hết nước chấm, xịt keo cứng họng, ô dề, gì dợ, báo quá báo, flex nhẹ, SOS, khum, u là trời, mê chữ ê kéo dài. Hài hước, bắt trend, không gượng ép, mỗi câu chỉ lồng 1-2 tiếng lóng thôi.',
    thayboi: 'Nói như thầy bói phán quẻ, mở đầu kiểu "ta xem quẻ thì...", phán về vận mệnh ván bài của đối thủ một cách huyền bí, hài hước.'
};
// MỨC ĐỘ CHỬI — phủ lên MỌI bot, MỌI tính cách (trừ khi tắt). Bảo yêu cầu câu nào cũng tục.
const AI_SWEAR = {
    vua: 'Nói giọng chợ búa như bạn bè thân chơi bài: thỉnh thoảng văng tục tự nhiên để gây cười (đù má, địt mẹ, vãi, tổ sư, chó má — viết đầy đủ, không viết tắt).',
    tuc: 'Câu nào mở miệng cũng phải văng tục chợ búa bằng từ viết ĐẦY ĐỦ (đù má, địt mẹ, đỉ mẹ, đéo mẹ, địt con mẹ, đụ mạ, vãi, tổ sư, chó má, mẹ kiếp), không sót câu nào, chửi phong phú không lặp lại, tuyệt đối không viết tắt kiểu đm vì game đọc thành tiếng. Chửi cho vui kiểu bạn bè thân, không kỳ thị, không nhắm đặc điểm cá nhân nhạy cảm.'
};
function aiSwearLevel() {
    try { if (typeof settings !== 'undefined' && settings && settings.swearLevel) return settings.swearLevel; } catch (e) {}
    return 'tuc';
}
// Câu mẫu tục dùng khi hết kho câu AI ở mức chửi cao nhất — giữ đúng tông chợ búa.
const TAUNTS_TUC = {
    play: ['Đù má, đánh nè con', 'Vãi lồn, đỡ đi nè', 'Tổ sư nó, to chưa', 'Chó má, chặn thử coi', 'Mẹ kiếp, qua được không'],
    big:  ['Địt mẹ, hàng khủng nè', 'Địt con mẹ, chặt chết mày chưa', 'Vãi lồn, tứ quý nè con', 'Tổ sư, bố mày tới rồi nè'],
    pass: ['Đụ mạ, cay vãi lồn', 'Chó má, nhường nè', 'Mẹ kiếp, đợi đó', 'Đéo mẹ, ván sau tính sổ']
};
function tucFallback(group) {
    const arr = TAUNTS_TUC[group] || (group === 'passbig' ? TAUNTS_TUC.pass : TAUNTS_TUC.play);
    return arr[Math.floor(Math.random() * arr.length)];
}

// Bộ lọc câu lỗi: loại câu bị chêm từ nước ngoài lạ (model dự phòng Mistral
// tiếng Việt yếu, từng sinh câu kiểu "Mutter cita..."). Một "từ" bị coi là lạ
// nếu dài >= 4 ký tự, toàn chữ Latin không dấu và không có trong danh sách cho phép.
const AI_WORD_OK = { flex: 1, game: 1, over: 1, trend: 1, xong: 1, chua: 1, ngang: 1, sang: 1, phang: 1, choang: 1, shock: 1, live: 1, like: 1, dead: 1, win: 1, chill: 1, stress: 1 };
function aiForeignFree(line) {
    const toks = String(line).toLowerCase().replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ\s]/g, ' ').split(/\s+/);
    for (const t of toks) {
        if (t.length >= 4 && /^[a-z]+$/.test(t) && !/[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳý]/.test(t) && !AI_WORD_OK[t]) return false;
    }
    return true;
}

function aiPersonaFor(botKey) {
    let p = AI_PERSONA[botKey] || '';
    try {
        if (typeof settings !== 'undefined' && settings) {
            const field = 'persona' + botKey.charAt(0).toUpperCase() + botKey.slice(1);
            const st = settings[field];
            if (st && st !== 'goc' && AI_STYLE[st]) p += ' ' + AI_STYLE[st];
            const sw = aiSwearLevel();
            if (sw !== 'off' && AI_SWEAR[sw]) p += ' ' + AI_SWEAR[sw];
        }
    } catch (e) {}
    return p;
}
function aiClearPool(botKey) {
    Object.keys(aiPool).forEach(k => { if (k.indexOf(botKey + '|') === 0) delete aiPool[k]; });
}

const aiPool = {};       // "botKey|nhom" -> [câu, ...]
let aiBusy = false;      // chỉ 1 request tại một thời điểm
let aiLastCall = 0;      // mốc request gần nhất (cooldown chống spam)

function aiEnabled() { return !!AI_CHAT_URL && typeof fetch === 'function'; }

function aiRefill(botKey, group) {
    if (!aiEnabled() || aiBusy) return;
    const now = Date.now();
    if (now - aiLastCall < 5000) return;
    const persona = aiPersonaFor(botKey);
    if (!persona) return;
    aiBusy = true; aiLastCall = now;
    const userMsg = (AI_SITUATION[group] || AI_SITUATION.play) + ' Viết đúng 3 câu cà khịa NGẮN bằng tiếng Việt (mỗi câu tối đa 9 từ), mỗi câu một dòng, không đánh số, không ngoặc kép, không emoji, ba câu khác nhau, tránh câu sáo rỗng. Chỉ viết tiếng Việt, tuyệt đối không chêm từ tiếng nước ngoài.';
    const safePersona = (AI_PERSONA[botKey] || '') + ' Nói chợ búa nhẹ nhàng bằng các từ viết đầy đủ: đù má, đéo mẹ, đụ mạ, vãi, tổ sư, mẹ kiếp.';
    const attempt = (model, personaText, stage) => {
        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const to = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 8000) : null;
        const done = (lines) => {
            if (to) clearTimeout(to);
            if (lines && lines.length) {
                aiBusy = false;
                const k = botKey + '|' + group;
                aiPool[k] = (aiPool[k] || []).concat(lines).slice(0, 6);
                // r101: đã bỏ giọng đọc nên không nạp tiếng trước nữa
            } else if (stage === 0) {
                attempt(AI_CHAT_MODEL, safePersona, 1); // bị bộ lọc chặn -> thử lại model chính bằng giọng nhẹ
            } else if (stage === 1) {
                attempt(AI_CHAT_MODEL_FALLBACK, persona, 2); // vẫn lỗi -> model dự phòng thoáng hơn
            } else {
                aiBusy = false;
            }
        };
        fetch(AI_CHAT_URL, {
            method: 'POST',
            headers: AI_CHAT_KEY ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_CHAT_KEY } : { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: personaText },
                    { role: 'user', content: userMsg }
                ],
                max_tokens: 130, temperature: 1.05
            }),
            signal: ctrl ? ctrl.signal : undefined
        }).then(r => (r && r.ok) ? r.json() : null).then(j => {
            const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
            if (!txt) return done(null);
            const lines = String(txt).split('\n').map(s => s.replace(/^[\d\.\-\*\u201C"\s]+/, '').replace(/[\u201D"]+$/, '').trim()).map(s => s.replace(/đm+/gi, 'địt mẹ')).filter(s => s.length >= 4 && s.length <= 60 && aiForeignFree(s));
            done(lines.length ? lines : null);
        }).catch(() => done(null));
    };
    attempt(AI_CHAT_MODEL, persona, 0);
}

// ===== SINH CÂU TẠI CHỖ THEO NGỮ CẢNH (phương án C) =====
// Dành cho khoảnh khắc lớn: chặt heo, còn 1 lá, thắng/thua ván. Game gửi kèm
// "bản tin ván bài" (số lá từng người, mức cược, sự kiện) để câu bám đúng ván.
const AI_NAMES = { player: 'người chơi', left: 'Hùng', top: 'Tuấn', right: 'Nam' };
let aiNowBusy = false;
let aiNowLast = 0;
// Mô tả một bộ bài thành chữ trung tính cho AI dễ bám ngữ cảnh: "đôi Át", "sảnh 6 lá tới K"...
function aiDescribeCombo(combo, cards) {
    try {
        if (!combo || !cards || !cards.length) return 'một nước bài';
        const hi = cards.reduce((m, c) => (rankValue(c) > rankValue(m) ? c : m), cards[0]);
        switch (combo.type) {
            case 'single': return 'lá ' + hi.rank + (hi.suit || '');
            case 'pair': return 'đôi ' + hi.rank;
            case 'triple': return 'sám ' + hi.rank;
            case 'quad': return 'tứ quý ' + hi.rank;
            case 'straight': return 'sảnh ' + cards.length + ' lá tới ' + hi.rank;
            case 'double_straight': return (cards.length / 2) + ' đôi thông';
            default: return 'một bộ bài';
        }
    } catch (e) { return 'một nước bài'; }
}
// Nhật ký 5 hành động gần nhất của ván — AI đọc cái này để câu nói bám sát diễn biến
function aiLogPush(text) {
    try {
        if (typeof state === 'undefined' || !state) return;
        if (!Array.isArray(state.aiLog)) state.aiLog = [];
        state.aiLog.push(text);
        while (state.aiLog.length > 5) state.aiLog.shift();
    } catch (e) {}
}
function aiContextLine() {
    try {
        const parts = PLAYERS.map(k => (AI_NAMES[k] || k) + ' còn ' + (state.hands[k] ? state.hands[k].length : '?') + ' lá, có ' + ((state.money && state.money[k] != null) ? state.money[k] : '?') + ' xu');
        let s = 'Tình hình ván Tiến Lên hiện tại: ' + parts.join('; ') + '. Mức cược ' + ((typeof settings !== 'undefined' && settings && settings.bet) || 100) + ' xu.';
        if (state.lastPlay && state.lastPlay.combo) s += ' Bài đang trên bàn là ' + aiDescribeCombo(state.lastPlay.combo, state.lastPlay.cards) + ' của ' + (AI_NAMES[PLAYERS[state.lastPlay.player]] || 'ai đó') + '.';
        if (state.aiLog && state.aiLog.length) s += ' Diễn biến gần đây: ' + state.aiLog.join(' -> ') + '.';
        return s;
    } catch (e) { return ''; }
}
function aiSayNow(actorIdx, eventText, fallbackText, onSaid, urgent) {
    try {
        const botKey = PLAYERS[actorIdx || 0];
        if (!botKey || botKey === 'player' || !aiEnabled() || aiNowBusy || (!urgent && Date.now() - aiNowLast < 5000)) {
            if (fallbackText) speak(fallbackText, actorIdx);
            return;
        }
        aiNowBusy = true; aiNowLast = Date.now();
        const persona = aiPersonaFor(botKey);
        const userMsg = aiContextLine() + ' Sự kiện vừa xảy ra: ' + eventText + ' Hãy viết đúng 1 câu cà khịa NGẮN bằng tiếng Việt (tối đa 12 từ) bám đúng sự kiện và tình hình này, nhắc tên người liên quan nếu có. Chỉ viết 1 câu duy nhất, không ngoặc kép, không emoji, chỉ tiếng Việt, không chêm từ nước ngoài.';
        const attempt = (model, isRetry) => {
            const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const to = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 5000) : null;
            const fail = () => {
                if (to) clearTimeout(to);
                if (!isRetry) { attempt(AI_CHAT_MODEL_FALLBACK, true); }
                else { aiNowBusy = false; if (fallbackText) speak(fallbackText, actorIdx); }
            };
            fetch(AI_CHAT_URL, {
                method: 'POST',
                headers: AI_CHAT_KEY ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_CHAT_KEY } : { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: persona },
                        { role: 'user', content: userMsg }
                    ],
                    max_tokens: 70, temperature: 1.05
                }),
                signal: ctrl ? ctrl.signal : undefined
            }).then(r => (r && r.ok) ? r.json() : null).then(j => {
                if (to) clearTimeout(to);
                const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
                let line = txt ? String(txt).split('\n')[0].replace(/^[\d\.\-\*\u201C"\s]+/, '').replace(/[\u201D"]+$/, '').trim().replace(/đm+/gi, 'địt mẹ') : '';
                if (line && line.length >= 4 && line.length <= 90 && aiForeignFree(line)) {
                    aiNowBusy = false;
                    speak(line, actorIdx);
                    if (onSaid) { try { onSaid(line); } catch (e) {} }
                } else fail();
            }).catch(fail);
        };
        attempt(AI_CHAT_MODEL, false);
    } catch (e) { aiNowBusy = false; if (fallbackText) speak(fallbackText, actorIdx); }
}

// Lấy 1 câu nói cho bot: ưu tiên câu AI trong kho; chưa có thì câu mẫu + nạp nền.
function aiLine(actorIdx, group, fallback) {
    try {
        const botKey = PLAYERS[actorIdx || 0];
        if (!botKey || botKey === 'player' || !aiEnabled()) return fallback;
        const k = botKey + '|' + group;
        const pool = aiPool[k] || [];
        if (pool.length) {
            const line = pool.shift();
            if (pool.length < 2) aiRefill(botKey, group);
            return line;
        }
        aiRefill(botKey, group);
        if (aiSwearLevel() === 'tuc') return tucFallback(group);
        return fallback;
    } catch (e) { return fallback; }
}

// ===== CHAT TỰ DO GIỮA CÁC BOT (r101) =====
// Giữa ván, các bot tự tương tác với nhau bằng chữ: đứa này chọc đứa kia,
// đứa kia đáp trả, có khi chốt hạ qua lại 3 câu; thỉnh thoảng một đứa nói
// nhảm xàm xàm không liên quan ván bài; đôi khi quay sang cà khịa người chơi.
// Chạy bằng vòng hẹn giờ riêng, tự ngủ khi ở sảnh chờ hoặc ván đã kết thúc.
let banterTimer = null;
function banterStart() {
    if (banterTimer) return;
    const loop = () => {
        banterTimer = setTimeout(loop, 7000 + Math.random() * 6000);
        try { banterTick(); } catch (e) {}
    };
    banterTimer = setTimeout(loop, 4500);
}
function banterTick() {
    if (typeof state === 'undefined' || !state || state.gameOver) return;
    if (typeof inLobby !== 'undefined' && inLobby) return;
    if (typeof voiceOn !== 'undefined' && !voiceOn) return;
    if (Math.random() > 0.6) return; // không phải nhịp nào cũng có chuyện
    const bots = [1, 2, 3];
    const a = bots[Math.floor(Math.random() * 3)];
    const others = bots.filter(x => x !== a);
    const b = others[Math.floor(Math.random() * others.length)];
    const aKey = PLAYERS[a], bKey = PLAYERS[b];
    const mode = Math.random();
    if (mode < 0.45) {
        // A chọc B, B đáp trả (70%), A chốt hạ (35%)
        aiSayNow(a, 'Giữa ván đang rảnh, hãy chọc ghẹo ' + AI_NAMES[bKey] + ' một câu cho vui (hắn đang còn ' + state.hands[bKey].length + ' lá bài trên tay).', null, (line) => {
            if (Math.random() > 0.7) return;
            setTimeout(() => {
                try {
                    aiSayNow(b, AI_NAMES[aKey] + ' vừa chọc bạn: "' + line + '" — hãy đáp trả, chửi lại một câu thật gắt cho vui.', null, (line2) => {
                        if (Math.random() > 0.35) return;
                        setTimeout(() => { try { aiSayNow(a, AI_NAMES[bKey] + ' vừa đáp trả bạn: "' + line2 + '" — kết luận, chốt hạ một câu cho cả bàn cười.', null, null, true); } catch (e) {} }, 2600 + Math.random() * 2000);
                    }, true);
                } catch (e) {}
            }, 2600 + Math.random() * 2000);
        });
    } else if (mode < 0.7) {
        // Quay sang cà khịa người chơi
        aiSayNow(a, 'Giữa ván đang rảnh, hãy quay sang cà khịa người chơi một câu cho vui (người chơi đang còn ' + state.hands.player.length + ' lá bài trên tay).', null);
    } else {
        // Nói xàm xàm tầm bậy cho vui
        aiSayNow(a, 'Hãy nói một câu nhảm nhí, xàm xàm, tầm bậy bất thình lình cho cả bàn cười, không cần liên quan gì tới ván bài (than thở đời, khoe khoang, triết lý vớ vẩn...).', null);
    }
}

// Đầu mỗi ván: nạp trước kho câu cho cả 3 bot (so le để không dồn request).
function aiWarmUp() {
    if (!aiEnabled()) return;
    ['left', 'top', 'right'].forEach((k, i) => {
        setTimeout(() => aiRefill(k, 'play'), 600 + i * 2600);
        setTimeout(() => aiRefill(k, 'big'), 2100 + i * 2600);
        setTimeout(() => aiRefill(k, 'winsoon'), 3400 + i * 2600);
    });
}
