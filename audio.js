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
        speak(aiLine(actorIdx, (combo && (combo.type === 'quad' || combo.type === 'double_straight')) ? 'big' : 'play', tauntFor(combo ? combo.type : 'single')), actorIdx);
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
    pass: 'Bạn bị đối thủ dồn ép nên phải bỏ lượt trong ván Tiến Lên, trong lòng đang cay cú.'
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
    const arr = TAUNTS_TUC[group] || TAUNTS_TUC.play;
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

// Đầu mỗi ván: nạp trước kho câu cho cả 3 bot (so le để không dồn request).
function aiWarmUp() {
    if (!aiEnabled()) return;
    ['left', 'top', 'right'].forEach((k, i) => {
        setTimeout(() => aiRefill(k, 'play'), 600 + i * 2600);
        setTimeout(() => aiRefill(k, 'big'), 2100 + i * 2600);
    });
}
