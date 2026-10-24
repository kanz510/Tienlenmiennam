// ============================================================
//  MẬU BINH (Binh Xập Xám) — bàn chơi thứ 2, mở từ sảnh chờ.
//  Luật + tính điểm làm theo HoangTran0410/gamehub24
//  (client/src/games/maubinh): giá trị chi thống nhất,
//  binh lủng khi chi sau YẾU HƠN chi trước (bằng nhau được),
//  ăn trắng có thứ tự ưu tiên, thưởng đặc biệt cộng thêm,
//  sập +3, bắt sập làng +6, thưởng xếp tay +1.
//  Cơ chế xếp kiểu game mẫu: bài chia ra đã nằm sẵn 3 hàng
//  theo cách xếp tối ưu (chi cuối*3 + chi giữa*2 + chi đầu),
//  người chơi bấm 2 lá để đổi chỗ; nút Tự động xếp lại,
//  nút Xong để so bài.
//  Quy ước tên chi (VN): chi đầu = 3 lá (yếu nhất),
//  chi giữa = 5 lá, chi cuối = 5 lá (mạnh nhất).
// ============================================================

// ---- Giá trị lá bài cho Mậu Binh: 2 thấp nhất, A cao nhất.
// Suits chỉ dùng để xét thùng, không so chất khi so chi. ----
const MB_RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const MB_SUIT_LETTER = { '♠': 'S', '♣': 'C', '♦': 'D', '♥': 'H' };
const MB_CAT_NAME = { 1: 'Mậu thầu', 2: 'Đôi', 3: 'Thú', 4: 'Sám cô', 5: 'Sảnh', 6: 'Thùng', 7: 'Cù lũ', 8: 'Tứ quý', 9: 'Thùng phá sảnh' };
const MB_CAT_NAME_3 = { 1: 'Mậu thầu', 2: 'Đôi', 3: 'Sám cô' };

function mbCardKey(c) { return c.rank + MB_SUIT_LETTER[c.suit]; }
function mbArt(c) { return (typeof CARD_ART !== 'undefined' && CARD_ART[mbCardKey(c)]) ? CARD_ART[mbCardKey(c)] : ''; }

// ---- Đánh giá 1 chi (hạng + tiebreak, dùng khi so 2 chi cùng cỡ) ----
// Trả về { cat, tb } với cat: 1..9 (chi 5 lá) hoặc 1..3 (chi 3 lá),
// tb: mảng tiebreak so từ điển (lá lớn trước).
function mbEvalChi(cards) {
    const n = cards.length;
    const counts = {};
    cards.forEach(c => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
    const groups = Object.keys(counts).map(r => ({ r, n: counts[r] }))
        .sort((a, b) => (b.n - a.n) || (MB_RANK_VAL[b.r] - MB_RANK_VAL[a.r]));
    const vals = cards.map(c => MB_RANK_VAL[c.rank]).sort((a, b) => a - b);
    const flush = cards.every(c => c.suit === cards[0].suit);
    let straight = false, straightHigh = 0;
    if (n === 5) {
        if (vals.join(',') === '2,3,4,5,14') { straight = true; straightHigh = 5; }
        else if (vals[4] - vals[0] === 4 && new Set(vals).size === 5) { straight = true; straightHigh = vals[4]; }
    }
    const V = r => MB_RANK_VAL[r];
    if (n === 3) {
        if (groups[0].n === 3) return { cat: 3, tb: [V(groups[0].r)] };
        if (groups[0].n === 2) return { cat: 2, tb: [V(groups[0].r), V(groups[1].r)] };
        return { cat: 1, tb: vals.slice().reverse() };
    }
    if (groups[0].n === 4) return { cat: 8, tb: [V(groups[0].r), V(groups[1].r)] };
    if (groups[0].n === 3 && groups[1].n === 2) return { cat: 7, tb: [V(groups[0].r), V(groups[1].r)] };
    if (straight && flush) return { cat: 9, tb: [straightHigh] };
    if (flush) return { cat: 6, tb: vals.slice().reverse() };
    if (straight) return { cat: 5, tb: [straightHigh] };
    if (groups[0].n === 3) {
        const kick = groups.slice(1).map(g => V(g.r)).sort((a, b) => b - a);
        return { cat: 4, tb: [V(groups[0].r)].concat(kick) };
    }
    if (groups[0].n === 2 && groups[1].n === 2) return { cat: 3, tb: [V(groups[0].r), V(groups[1].r), V(groups[2].r)] };
    if (groups[0].n === 2) {
        const kick = groups.slice(1).map(g => V(g.r)).sort((a, b) => b - a);
        return { cat: 2, tb: [V(groups[0].r)].concat(kick) };
    }
    return { cat: 1, tb: vals.slice().reverse() };
}

// So 2 kết quả mbEvalChi cùng cỡ: 1 = A hơn, 0 = hòa, -1 = A kém.
function mbCmpEval(A, B) {
    if (A.cat !== B.cat) return A.cat > B.cat ? 1 : -1;
    const n = Math.max(A.tb.length, B.tb.length);
    for (let i = 0; i < n; i++) {
        const x = A.tb[i] || 0, y = B.tb[i] || 0;
        if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
}

// So 2 chi cùng số lá: 1 = a thắng, 0 = hòa, -1 = a thua.
function mbCompareChi(a, b) {
    return mbCmpEval(mbEvalChi(a), mbEvalChi(b));
}

// So chi đầu (3 lá) với chi giữa (5 lá) để xét binh lủng, theo mặt bài thật:
// đổi hạng sám 3 lá (3) về hạng sám cô 5 lá (4); cùng hạng thì so từng lá
// từ lớn xuống nhỏ trên số lá chung (đôi: đôi rồi kicker 1; mậu thầu: 3 lá cao nhất).
// 1 = chi đầu mạnh hơn chi giữa (lủng), 0 = ngang nhau, -1 = chi đầu yếu hơn.
function mbCmpDauGiuaEval(D, G) {
    const dc = D.cat === 3 ? 4 : D.cat;
    if (dc !== G.cat) return dc > G.cat ? 1 : -1;
    const n = Math.min(D.tb.length, G.tb.length);
    for (let i = 0; i < n; i++) {
        if (D.tb[i] !== G.tb[i]) return D.tb[i] > G.tb[i] ? 1 : -1;
    }
    return 0;
}
function mbCompareDauToGiua(dau, giua) {
    return mbCmpDauGiuaEval(mbEvalChi(dau), mbEvalChi(giua));
}

// Giá trị thống nhất của 1 chi (port theo evaluate3/5CardHand của
// gamehub24: hạng chi * 1e8 + tiebreak). Dùng chung thang cho cả
// chi 3 lá và 5 lá nên mới so được chi nọ với chi kia khi xét
// binh lủng: 3 lá sám (3e8) mạnh hơn 5 lá đôi (1e8), v.v.
function mbHandValue(cards) {
    const n = cards.length;
    const counts = {};
    cards.forEach(c => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
    const groups = Object.keys(counts).map(r => ({ r, n: counts[r] }))
        .sort((a, b) => (b.n - a.n) || (MB_RANK_VAL[b.r] - MB_RANK_VAL[a.r]));
    const V = r => MB_RANK_VAL[r];
    const vals = cards.map(c => V(c.rank)).sort((a, b) => b - a);
    if (n === 3) {
        if (groups[0].n === 3) return 3e8 + V(groups[0].r) * 1e4;
        if (groups[0].n === 2) return 1e8 + V(groups[0].r) * 1e4 + V(groups[1].r);
        return vals[0] * 1e4 + vals[1] * 15 + vals[2];
    }
    const flush = cards.every(c => c.suit === cards[0].suit);
    const uniq = [...new Set(vals)].sort((a, b) => b - a);
    let straight = false, straightHigh = 0;
    if (uniq.length === 5) {
        if (uniq[0] - uniq[4] === 4) { straight = true; straightHigh = uniq[0]; }
        else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) { straight = true; straightHigh = 5; }
    }
    if (flush && straight) return 8e8 + straightHigh * 1e4;
    if (groups[0].n === 4) return 7e8 + V(groups[0].r) * 1e4 + V(groups[1].r);
    if (groups[0].n === 3 && groups[1].n === 2) return 6e8 + V(groups[0].r) * 1e4 + V(groups[1].r);
    if (flush) { let v = 5e8; uniq.forEach((r, i) => { v += r * Math.pow(15, 4 - i); }); return v; }
    if (straight) return 4e8 + straightHigh * 1e4;
    if (groups[0].n === 3) {
        const kick = groups.slice(1).map(g => V(g.r)).sort((a, b) => b - a);
        return 3e8 + V(groups[0].r) * 1e4 + kick[0] * 15 + kick[1];
    }
    if (groups[0].n === 2 && groups[1].n === 2) {
        const p1 = Math.max(V(groups[0].r), V(groups[1].r)), p2 = Math.min(V(groups[0].r), V(groups[1].r));
        return 2e8 + p1 * 1e4 + p2 * 15 + V(groups[2].r);
    }
    if (groups[0].n === 2) {
        const kick = groups.slice(1).map(g => V(g.r)).sort((a, b) => b - a);
        return 1e8 + V(groups[0].r) * 1e4 + kick[0] * 225 + kick[1] * 15 + kick[2];
    }
    let v = 0; uniq.forEach((r, i) => { v += r * Math.pow(15, 4 - i); }); return v;
}

// Một cách xếp: { cuoi: [5], giua: [5], dau: [3] }.
// Theo gamehub24: chỉ lủng khi chi sau YẾU HƠN chi trước
// (cuoi < giua hoặc giua < dau); bằng nhau vẫn được.
// Lủng khi chi cuối yếu hơn chi giữa, hoặc chi đầu mạnh hơn chi giữa
// (bằng nhau vẫn được). Chi đầu 3 lá so với chi giữa 5 lá theo mặt bài.
function mbIsBinhLung(arr) {
    if (!arr || arr.cuoi.length !== 5 || arr.giua.length !== 5 || arr.dau.length !== 3) return true;
    return mbCompareChi(arr.cuoi, arr.giua) < 0 || mbCompareDauToGiua(arr.dau, arr.giua) > 0;
}

// Liệt kê mọi cách xếp 5-5-3 (C(13,5)*C(8,5) = 72.072) rồi lọc
// hợp lệ — đúng cách làm của solver (generate + validate).
// Tổ hợp chỉ số dùng chung, tính 1 lần.
function mbCombos(n, k) {
    const out = [];
    (function rec(start, cur) {
        if (cur.length === k) { out.push(cur.slice()); return; }
        for (let i = start; i <= n - (k - cur.length); i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
}
const MB_C13_5 = mbCombos(13, 5);
const MB_C8_5 = mbCombos(8, 5);
const MB_C8_5_COMP = MB_C8_5.map(p => [0, 1, 2, 3, 4, 5, 6, 7].filter(i => p.indexOf(i) < 0));

function mbMaskOf(idxs) { let m = 0; for (let i = 0; i < idxs.length; i++) m |= 1 << idxs[i]; return m; }

// Duyệt mọi cách xếp 5-5-3 (72.072), nhưng chỉ chấm mỗi tập lá 1 lần
// (cache theo mặt nạ bit) thay vì chấm lại cho từng cách xếp.
// onValid(cuoiIdx, giuaIdx, dauIdx, score) gọi cho mỗi cách xếp không lủng.
function mbSearchArrangements(cards13, onValid) {
    const cache5 = new Map(), cache3 = new Map();
    const info = (cache, mask, idxs) => {
        let r = cache.get(mask);
        if (!r) {
            const cs = idxs.map(i => cards13[i]);
            r = { ev: mbEvalChi(cs), val: mbHandValue(cs) };
            cache.set(mask, r);
        }
        return r;
    };
    const all = cards13.map((_, i) => i);
    for (let a = 0; a < MB_C13_5.length; a++) {
        const cuoiIdx = MB_C13_5[a];
        const maskA = mbMaskOf(cuoiIdx);
        const rest = all.filter(i => !(maskA & (1 << i)));
        const A = info(cache5, maskA, cuoiIdx);
        for (let b = 0; b < MB_C8_5.length; b++) {
            const giuaIdx = MB_C8_5[b].map(p => rest[p]);
            const B = info(cache5, mbMaskOf(giuaIdx), giuaIdx);
            if (mbCmpEval(A.ev, B.ev) < 0) continue;            // chi cuối < chi giữa
            const dauIdx = MB_C8_5_COMP[b].map(p => rest[p]);
            const D = info(cache3, mbMaskOf(dauIdx), dauIdx);
            if (mbCmpDauGiuaEval(D.ev, B.ev) > 0) continue;     // chi đầu > chi giữa
            onValid(cuoiIdx, giuaIdx, dauIdx, A.val * 3 + B.val * 2 + D.val);
        }
    }
}

function mbAllValidArrangements(cards13) {
    const out = [];
    mbSearchArrangements(cards13, (c, g, d) => {
        out.push({ cuoi: c.map(i => cards13[i]), giua: g.map(i => cards13[i]), dau: d.map(i => cards13[i]) });
    });
    return out;
}

// Điểm heuristic cho 1 chi để chọn cách xếp tự động: dùng đúng
// giá trị thống nhất của gamehub24 (back*3 + middle*2 + front).
function mbChiScore(cards) {
    return mbHandValue(cards);
}

// Xếp tự động: chọn cách xếp hợp lệ có tổng điểm cao nhất.
function mbAutoArrange(cards13) {
    let bestScore = -1, bc = null, bg = null, bd = null;
    mbSearchArrangements(cards13, (c, g, d, s) => {
        if (s > bestScore) { bestScore = s; bc = c.slice(); bg = g.slice(); bd = d.slice(); }
    });
    if (!bc) return null;
    return { cuoi: bc.map(i => cards13[i]), giua: bg.map(i => cards13[i]), dau: bd.map(i => cards13[i]) };
}

// ---- Ăn trắng (theo gamehub24, có thứ tự ưu tiên) ----
// Sảnh rồng (2→A không đồng chất) > Đồng màu 13 lá > Đồng màu
// 12 lá (đỏ = ♦♥, đen = ♠♣) > Lục phé bôn / Năm đôi 1 sám >
// Ba thùng > Ba sảnh. Ba thùng / ba sảnh xét trên cách xếp
// THỰC TẾ của người chơi (không phải mọi cách xếp có thể).
// Trả về { name, rank } hoặc null.
function mbInstantWin(hand13, arr) {
    const vals = hand13.map(c => MB_RANK_VAL[c.rank]).sort((a, b) => a - b);
    const isDragon = vals.join(',') === '2,3,4,5,6,7,8,9,10,11,12,13,14';
    if (isDragon && !hand13.every(c => c.suit === hand13[0].suit)) return { name: 'Sảnh rồng', rank: 6 };
    let red = 0, black = 0;
    hand13.forEach(c => { if (c.suit === '♦' || c.suit === '♥') red++; else black++; });
    if (red >= 13 || black >= 13) return { name: 'Đồng màu 13 lá', rank: 5 };
    if (red >= 12 || black >= 12) return { name: 'Đồng màu 12 lá', rank: 4 };
    const counts = {};
    hand13.forEach(c => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
    const cvals = Object.values(counts);
    const pairs = cvals.filter(v => v >= 2).length;
    const triples = cvals.filter(v => v >= 3).length;
    const countVals = cvals.slice().sort((a, b) => b - a);
    if (countVals.join(',') === '3,2,2,2,2,2') return { name: 'Năm đôi 1 sám', rank: 3 };
    if (pairs >= 6 || (pairs >= 5 && triples >= 1)) return { name: 'Lục phé bôn', rank: 3 };
    if (arr) {
        const flushLike = g => g.length >= 3 && g.every(c => c.suit === g[0].suit);
        if (flushLike(arr.dau) && flushLike(arr.giua) && flushLike(arr.cuoi)) return { name: 'Ba thùng', rank: 2 };
        const straightLike = g => {
            const v = g.map(c => MB_RANK_VAL[c.rank]).sort((a, b) => a - b);
            if (g.length === 3) return v[2] - v[0] === 2 && new Set(v).size === 3;
            if (v.join(',') === '2,3,4,5,14') return true;
            return v[4] - v[0] === 4 && new Set(v).size === 5;
        };
        if (straightLike(arr.dau) && straightLike(arr.giua) && straightLike(arr.cuoi)) return { name: 'Ba sảnh', rank: 1 };
    }
    return null;
}

// ---- So 2 cách xếp, tính điểm theo chi (theo gamehub24) ----
// Điểm tính bằng chi (1 chi = 1 mức cược). Thưởng đặc biệt CỘNG
// THÊM vào điểm chi thắng (không nhân đôi):
// sám chi đầu +3, cù lũ chi giữa +2, tứ quý chi giữa +8,
// thùng phá sảnh chi giữa +10, tứ quý chi cuối +4,
// thùng phá sảnh chi cuối +5. Sập (thắng cả 3 chi) +3.
// Trả về từ phía người chơi: { chi, base, pBonus, bBonus,
// pScoop, bScoop, total, bonusLabels }.
function mbScorePair(pArr, bArr, pInst, bInst, pFouled, bFouled) {
    const chiKeys = ['cuoi', 'giua', 'dau'];
    const chi = [];
    let pBonus = 0, bBonus = 0;
    const bonusLabels = [];
    const SPECS = [
        { key: 'dau', cat: 3, pts: 3, label: 'Sám chi đầu' },
        { key: 'giua', cat: 7, pts: 2, label: 'Cù lũ chi giữa' },
        { key: 'giua', cat: 8, pts: 8, label: 'Tứ quý chi giữa' },
        { key: 'giua', cat: 9, pts: 10, label: 'Thùng phá sảnh chi giữa' },
        { key: 'cuoi', cat: 8, pts: 4, label: 'Tứ quý chi cuối' },
        { key: 'cuoi', cat: 9, pts: 5, label: 'Thùng phá sảnh chi cuối' }
    ];
    if (pInst && bInst) {
        const s = pInst.rank > bInst.rank ? 1 : (pInst.rank < bInst.rank ? -1 : 0);
        chiKeys.forEach(k => chi.push({ key: k, res: s, aCat: mbEvalChi(pArr[k]).cat, bCat: mbEvalChi(bArr[k]).cat }));
    } else if (pInst || bInst) {
        const s = pInst ? 1 : -1;
        chiKeys.forEach(k => chi.push({ key: k, res: s, aCat: mbEvalChi(pArr[k]).cat, bCat: mbEvalChi(bArr[k]).cat }));
    } else if (pFouled && bFouled) {
        chiKeys.forEach(k => chi.push({ key: k, res: 0, aCat: mbEvalChi(pArr[k]).cat, bCat: mbEvalChi(bArr[k]).cat }));
    } else if (pFouled || bFouled) {
        const s = pFouled ? -1 : 1;
        chiKeys.forEach(k => chi.push({ key: k, res: s, aCat: mbEvalChi(pArr[k]).cat, bCat: mbEvalChi(bArr[k]).cat }));
    } else {
        chiKeys.forEach(k => {
            const res = mbCompareChi(pArr[k], bArr[k]);
            const aCat = mbEvalChi(pArr[k]).cat, bCat = mbEvalChi(bArr[k]).cat;
            let pB = 0, bB = 0, label = '';
            if (res === 1) {
                const sp = SPECS.find(s => s.key === k && s.cat === aCat);
                if (sp) { pB = sp.pts; label = sp.label + ' +' + sp.pts; }
            } else if (res === -1) {
                const sp = SPECS.find(s => s.key === k && s.cat === bCat);
                if (sp) { bB = sp.pts; label = sp.label + ' +' + sp.pts + ' (đối thủ)'; }
            }
            pBonus += pB; bBonus += bB;
            if (label) bonusLabels.push(label);
            chi.push({ key: k, res, aCat, bCat, pB, bB });
        });
    }
    const base = chi.reduce((s, c) => s + c.res, 0);
    const pWins = chi.filter(c => c.res === 1).length;
    const bWins = chi.filter(c => c.res === -1).length;
    const pScoop = pWins === 3 ? 3 : 0;
    const bScoop = bWins === 3 ? 3 : 0;
    const total = base + pBonus + pScoop - bBonus - bScoop;
    return { chi, base, pBonus, bBonus, pScoop, bScoop, total, bonusLabels };
}

// ============================================================
//  LUỒNG CHƠI + GIAO DIỆN
// ============================================================
const MB_BOTS = ['left', 'top', 'right'];
const MB_BOT_NAMES = { left: 'Hùng Sấm Sét', top: 'Tuấn Cao Thủ', right: 'Nam Lì Đòn' };
const MB_BOT_AVATARS = { left: '🐯', top: '🐻', right: '🦊' };
const MB_CHI_ORDER = ['dau', 'giua', 'cuoi']; // thứ tự hiển thị: đầu → giữa → cuối
const MB_CHI_LABEL = { dau: 'Chi đầu · 3 lá', giua: 'Chi giữa · 5 lá', cuoi: 'Chi cuối · 5 lá' };
const MB_CHI_SIZE = { dau: 3, giua: 5, cuoi: 5 };

let mbState = null;
let mbTimerId = null;

function mbBet() {
    try { return (typeof settings !== 'undefined' && settings.bet) ? settings.bet : 100; } catch (e) { return 100; }
}

function mbEl(id) { return document.getElementById(id); }

function mbCardEl(card, cls) {
    const img = document.createElement('img');
    img.className = 'mb-card' + (cls ? ' ' + cls : '');
    img.src = mbArt(card);
    img.alt = card.rank + card.suit;
    img.dataset.key = mbCardKey(card);
    return img;
}

function mbFindCard(list, key) {
    for (let i = 0; i < list.length; i++) if (mbCardKey(list[i]) === key) return i;
    return -1;
}

function mbRenderBots(reveal) {
    MB_BOTS.forEach(k => {
        const box = mbEl('mb-bot-' + k);
        if (!box) return;
        box.querySelector('.mb-bot-money').textContent = '💰 ' + (mbState.money[k] ?? 1000);
        const cardsBox = box.querySelector('.mb-bot-cards');
        cardsBox.innerHTML = '';
        if (!reveal) {
            const backs = document.createElement('div');
            backs.className = 'mb-bot-backs';
            backs.textContent = '✓ Xếp xong';
            cardsBox.appendChild(backs);
            return;
        }
        const arr = mbState.botArr[k];
        MB_CHI_ORDER.forEach(chiKey => {
            const row = document.createElement('div');
            row.className = 'mb-bot-chi';
            arr[chiKey].forEach(c => row.appendChild(mbCardEl(c, 'mini')));
            const nm = document.createElement('span');
            nm.className = 'mb-bot-chi-name';
            nm.textContent = mbEvalChi(arr[chiKey]).cat === 0 ? '' : (chiKey === 'dau' ? MB_CAT_NAME_3[mbEvalChi(arr[chiKey]).cat] : MB_CAT_NAME[mbEvalChi(arr[chiKey]).cat]);
            row.appendChild(nm);
            cardsBox.appendChild(row);
        });
    });
}

function mbChiName(chiKey, cards) {
    if (!cards.length) return '';
    const cat = mbEvalChi(cards).cat;
    return chiKey === 'dau' ? MB_CAT_NAME_3[cat] : MB_CAT_NAME[cat];
}

// Cơ chế xếp bài kiểu game mẫu: bài chia ra đã nằm sẵn 3 hàng
// (xếp tối ưu), người chơi bấm 1 lá rồi bấm lá khác để ĐỔI CHỖ.
// Số lá mỗi chi không đổi (3/5/5) nên không bao giờ thiếu lá;
// chỉ thứ tự mạnh yếu mới quyết định lủng hay không.
let mbSelected = null; // { key, index } của lá đang chọn để đổi chỗ

// Nút Xong: đỏ khi hợp lệ, cam khi lủng; nút 🔄 Sửa chỉ hiện
// khi lủng (bấm để tự sửa); huy hiệu ăn trắng thô hiện ngay
// khi chia bài (chỉ để báo, bài vẫn tự tính lúc so bài).
function mbUpdateActions() {
    if (!mbState || mbState.phase !== 'arrange') return;
    const p = mbState.playerArr;
    const lung = !mbInstantWin(mbState.hands.player, p) && mbIsBinhLung(p);
    const done = mbEl('btn-mb-done');
    if (done) {
        done.classList.toggle('lung', lung);
        done.textContent = lung ? 'Xong (Lủng!)' : 'Xong';
    }
    const fix = mbEl('btn-mb-fix');
    if (fix) fix.classList.toggle('hidden', !lung);
    const badge = mbEl('mb-instant-badge');
    if (badge) {
        const inst = mbInstantWin(mbState.hands.player, null);
        badge.classList.toggle('hidden', !inst);
        if (inst) badge.textContent = '✨ Ăn trắng: ' + inst.name + ' — sẽ tính lúc so bài';
    }
}

function mbRenderPlayer() {
    const p = mbState.playerArr;
    MB_CHI_ORDER.forEach(chiKey => {
        const row = mbEl('mb-chi-' + chiKey);
        if (!row) return;
        const box = row.querySelector('.mb-chi-cards');
        box.innerHTML = '';
        p[chiKey].forEach((c, i) => {
            const el = mbCardEl(c);
            if (mbSelected && mbSelected.key === chiKey && mbSelected.index === i) el.classList.add('sel');
            el.addEventListener('click', () => mbOnCardClick(chiKey, i));
            box.appendChild(el);
        });
        row.querySelector('.mb-chi-name').textContent = mbChiName(chiKey, p[chiKey]);
        row.querySelector('.mb-chi-count').textContent = p[chiKey].length + '/' + MB_CHI_SIZE[chiKey];
    });
    const lung = !mbInstantWin(mbState.hands.player, p) && mbIsBinhLung(p);
    const warn = mbEl('mb-lung-warn');
    if (warn) warn.classList.toggle('hidden', !lung);
    // 👍 hiện ở mỗi hàng khi xếp chuẩn (không lủng) — kiểu game mẫu.
    MB_CHI_ORDER.forEach(chiKey => {
        const row = mbEl('mb-chi-' + chiKey);
        const like = row && row.querySelector('.mb-chi-like');
        if (like) like.style.display = lung ? 'none' : '';
    });
    mbEl('mb-money').textContent = '💰 ' + (mbState.money.player ?? 1000);
    mbUpdateActions();
}

// Tự sửa khi xếp sai: tìm 1 lần đổi chỗ giữa 2 chi khác nhau
// để bài hết lủng (giữ nguyên càng nhiều lá càng tốt); nếu không
// có lần đổi nào sửa được thì xếp tối ưu lại từ đầu.
function mbFixArrangement(arr) {
    if (!mbIsBinhLung(arr)) return arr;
    const keys = ['dau', 'giua', 'cuoi'];
    let best = null, bestScore = -Infinity;
    for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
        const ka = keys[a], kb = keys[b];
        for (let i = 0; i < arr[ka].length; i++) for (let j = 0; j < arr[kb].length; j++) {
            const cand = { dau: arr.dau.slice(), giua: arr.giua.slice(), cuoi: arr.cuoi.slice() };
            const tmp = cand[ka][i]; cand[ka][i] = cand[kb][j]; cand[kb][j] = tmp;
            if (mbIsBinhLung(cand)) continue;
            const s = mbChiScore(cand.cuoi) * 3 + mbChiScore(cand.giua) * 2 + mbChiScore(cand.dau);
            if (s > bestScore) { bestScore = s; best = cand; }
        }
    }
    if (best) return best;
    const hand = [...arr.dau, ...arr.giua, ...arr.cuoi];
    return mbAutoArrange(hand) || arr;
}

function mbFixAndRender() {
    if (!mbState || mbState.phase !== 'arrange') return;
    mbState.playerArr = mbFixArrangement(mbState.playerArr);
    mbSelected = null;
    mbState.usedAuto = true; // sửa tự động thì tính là dùng auto
    mbRenderPlayer();
    mbMsg('Đã tự sửa cho hết lủng.');
}

// Bấm lá: chưa chọn lá nào → chọn lá đó; bấm lại lá đang chọn →
// bỏ chọn; bấm lá khác → đổi chỗ 2 lá (kể cả khác chi).
function mbOnCardClick(chiKey, index) {
    if (!mbState || mbState.phase !== 'arrange') return;
    const p = mbState.playerArr;
    if (!mbSelected) {
        mbSelected = { key: chiKey, index };
        mbMsg('Đã chọn 1 lá — bấm lá khác để đổi chỗ.');
    } else if (mbSelected.key === chiKey && mbSelected.index === index) {
        mbSelected = null;
        mbMsg('');
    } else {
        const a = p[mbSelected.key][mbSelected.index];
        const b = p[chiKey][index];
        p[mbSelected.key][mbSelected.index] = b;
        p[chiKey][index] = a;
        mbSelected = null;
        mbState.usedAuto = false; // đổi tay thì lấy lại quyền thưởng xếp tay
        mbMsg('Đã đổi chỗ 2 lá.');
    }
    mbRenderPlayer();
}

function mbMsg(t) {
    const el = mbEl('mb-msg');
    if (el) el.textContent = t || '';
}

function mbStopTimer() {
    if (mbTimerId) { clearInterval(mbTimerId); mbTimerId = null; }
}

function mbStartTimer() {
    mbStopTimer();
    mbState.timeLeft = 90;
    const el = mbEl('mb-timer');
    mbTimerId = setInterval(() => {
        mbState.timeLeft--;
        if (el) el.textContent = '⏳ ' + mbState.timeLeft;
        if (mbState.timeLeft <= 0) {
            mbStopTimer();
            mbMsg('Hết giờ — tự xếp bài rồi so luôn.');
            mbAutoAndShowdown();
        }
    }, 1000);
}

// Kho tiền: dùng state.money của game chính nếu có, không thì giữ cục bộ
// (để tiền thắng/thua không bị mất).
let mbLocalMoney = { player: 1000, left: 1000, top: 1000, right: 1000 };
function mbMoneyStore() {
    try { if (typeof state !== 'undefined' && state && state.money) return state.money; } catch (e) {}
    return mbLocalMoney;
}

// Khóa nhận dạng 1 cách xếp (tập lá của từng chi, không phụ thuộc thứ tự).
function mbArrangementKey(arr) {
    return ['dau', 'giua', 'cuoi'].map(k => arr[k].map(mbCardKey).sort().join(',')).join('|');
}

function mbNewGame() {
    mbStopTimer();
    try { if (typeof loadMoney === 'function') loadMoney(); } catch (e) {}
    const deck = shuffle(createDeck());
    const hands = {
        player: deck.slice(0, 13),
        left: deck.slice(13, 26),
        top: deck.slice(26, 39),
        right: deck.slice(39, 52)
    };
    const botArr = {};
    MB_BOTS.forEach(k => { botArr[k] = mbAutoArrange(hands[k]) || { cuoi: hands[k].slice(0, 5), giua: hands[k].slice(5, 10), dau: hands[k].slice(10, 13) }; });
    const money = mbMoneyStore();
    // Bài chia ra đã nằm sẵn 3 hàng theo cách xếp tối ưu (kiểu
    // game mẫu); người chơi chỉ đổi chỗ các lá nếu muốn.
    const best = mbAutoArrange(hands.player) || { cuoi: hands.player.slice(0, 5), giua: hands.player.slice(5, 10), dau: hands.player.slice(10, 13) };
    mbState = {
        phase: 'arrange', hands, botArr, money,
        playerArr: { dau: best.dau, giua: best.giua, cuoi: best.cuoi },
        autoKey: mbArrangementKey(best),
        usedAuto: true, timeLeft: 90, results: null
    };
    mbSelected = null;
    const res = mbEl('mb-result');
    if (res) res.classList.add('hidden');
    const acts = mbEl('mb-actions');
    if (acts) acts.classList.remove('hidden');
    mbRenderBots(false);
    mbRenderPlayer();
    mbMsg('Bài đã xếp sẵn. Bấm 1 lá rồi bấm lá khác để đổi chỗ, xong bấm Xong.');
    const tel = mbEl('mb-timer');
    if (tel) tel.textContent = '⏳ 90';
    mbStartTimer();
}

function mbAutoAndShowdown() {
    mbState.usedAuto = true;
    mbSelected = null;
    const best = mbAutoArrange(mbState.hands.player);
    if (best) {
        mbState.playerArr = { dau: best.dau, giua: best.giua, cuoi: best.cuoi };
        mbRenderPlayer();
    }
    mbShowdown();
}

function mbSettlePlayer(deltaByBot) {
    // Cộng/trừ tiền vào kho tiền dùng chung với Tiến Lên. Dùng ?? chứ không dùng ||
    // (tiền = 0 không được hồi sinh về 1000) và không cho xuống âm.
    const store = mbMoneyStore();
    Object.keys(deltaByBot).forEach(k => {
        store[k] = Math.max(0, (store[k] ?? 1000) + deltaByBot[k]);
    });
    try {
        if (store !== mbLocalMoney) {
            if (typeof saveMoney === 'function') saveMoney();
            if (typeof updateMoneyUI === 'function') updateMoneyUI();
        }
    } catch (e) {}
    mbState.money = store;
}

function mbShowdown() {
    mbStopTimer();
    mbSelected = null;
    const p = mbState.playerArr;
    const bet = mbBet();
    // Ăn trắng xét theo cách xếp thực tế; binh lủng chỉ tính khi
    // không có ăn trắng (đúng thứ tự xét của gamehub24).
    const pInst = mbInstantWin(mbState.hands.player, p);
    const pFouled = !pInst && mbIsBinhLung(p);
    const delta = { player: 0, left: 0, top: 0, right: 0 };
    const lines = [];
    if (pInst) lines.push('🎉 Bạn ăn trắng: <span class="mb-badge mb-badge-amber">' + pInst.name + '</span> — thắng cả 3 chi trước mọi nhà chưa có ăn trắng mạnh hơn.');
    else if (pFouled) lines.push('⚠️ <span class="mb-badge mb-badge-red">BINH LỦNG</span> — chi sau yếu hơn chi trước, thua cả 3 chi trước mọi nhà.');
    let sweepAll = true;
    MB_BOTS.forEach(k => {
        const bArr = mbState.botArr[k];
        const bInst = mbInstantWin(mbState.hands[k], bArr);
        const sc = mbScorePair(p, bArr, pInst, bInst, pFouled, false);
        const chiTxt = sc.chi.map(c => {
            const label = c.key === 'dau' ? 'Chi đầu' : (c.key === 'giua' ? 'Chi giữa' : 'Chi cuối');
            const aN = c.key === 'dau' ? MB_CAT_NAME_3[c.aCat] : MB_CAT_NAME[c.aCat];
            const bN = c.key === 'dau' ? MB_CAT_NAME_3[c.bCat] : MB_CAT_NAME[c.bCat];
            const r = c.res === 1 ? 'thắng' : (c.res === -1 ? 'thua' : 'hòa');
            return label + ': ' + aN + ' vs ' + bN + ' — ' + r;
        }).join(' · ');
        let extra = '';
        if (bInst) extra += ' <span class="mb-badge mb-badge-amber">' + MB_BOT_NAMES[k] + ' ăn trắng: ' + bInst.name + '</span>';
        if (sc.pScoop) extra += ' <span class="mb-badge mb-badge-red">Sập +3</span>';
        if (sc.bScoop) extra += ' <span class="mb-badge mb-badge-red">Bị sập</span>';
        if (sc.bonusLabels.length) extra += ' <span class="mb-badge mb-badge-indigo">Thưởng: ' + sc.bonusLabels.join(', ') + '</span>';
        const detail = 'vs ' + MB_BOT_NAMES[k] + ': ' + (sc.total > 0 ? '+' : '') + (sc.total * bet) + ' xu (' + chiTxt + ')' + extra;
        delta.player += sc.total * bet;
        delta[k] -= sc.total * bet;
        if (!sc.chi.every(c => c.res === 1)) sweepAll = false;
        lines.push(detail);
    });
    // Bắt sập làng: thắng cả 3 chi trước cả 3 nhà → +6 chi,
    // mỗi nhà còn lại -2 chi (theo gamehub24).
    if (sweepAll) {
        delta.player += 6 * bet;
        MB_BOTS.forEach(k => { delta[k] -= 2 * bet; });
        lines.push('🏆 <span class="mb-badge mb-badge-gold">BẮT SẬP LÀNG</span> — thắng cả 3 chi trước cả 3 nhà: +6 chi, mỗi nhà -2 chi.');
    }
    // Thưởng xếp tay: tự xếp (không dùng Xếp tự động), không
    // binh lủng, tổng dương → +1 chi (theo gamehub24).
    if (!mbState.usedAuto && mbArrangementKey(p) !== mbState.autoKey && !pFouled && delta.player > 0) {
        delta.player += 1 * bet;
        lines.push('✋ <span class="mb-badge mb-badge-green">Thưởng xếp tay +1 chi</span>.');
    }
    mbSettlePlayer(delta);
    mbState.phase = 'result';
    mbRenderBots(true);
    const title = delta.player > 0 ? '🎉 BẠN THẮNG' : (delta.player < 0 ? '😞 BẠN THUA' : '🤝 HÒA');
    mbShowResult(title, delta.player, lines);
}

function mbShowResult(title, totalDelta, lines) {
    const box = mbEl('mb-result');
    const acts = mbEl('mb-actions');
    if (acts) acts.classList.add('hidden');
    mbEl('mb-result-title').textContent = title;
    mbEl('mb-result-money').textContent = (totalDelta > 0 ? '+' : '') + totalDelta + ' xu';
    const bd = mbEl('mb-result-breakdown');
    bd.innerHTML = '';
    lines.forEach(t => {
        const d = document.createElement('div');
        d.className = 'mb-bd-row';
        d.innerHTML = t; // các dòng đều do code tự sinh, không có nhập liệu người dùng
        bd.appendChild(d);
    });
    box.classList.remove('hidden');
    mbEl('mb-money').textContent = '💰 ' + (mbState.money.player ?? 1000);
}

function mbEnter() {
    const lobby = mbEl('lobby');
    if (lobby) lobby.classList.add('hidden');
    const gc = mbEl('game-container');
    if (gc) gc.classList.add('hidden');
    const mb = mbEl('maubinh');
    if (mb) mb.classList.remove('hidden');
    try { if (typeof inLobby !== 'undefined') inLobby = false; } catch (e) {}
    try { if (typeof applyRotation === 'function') applyRotation(); } catch (e) {}
    mbNewGame();
}

function mbBackToLobby() {
    mbStopTimer();
    const mb = mbEl('maubinh');
    if (mb) mb.classList.add('hidden');
    const gc = mbEl('game-container');
    if (gc) gc.classList.add('hidden');
    const ov = mbEl('overlay');
    if (ov) ov.classList.add('hidden');
    try { if (typeof showLobby === 'function') showLobby(false); } catch (e) {}
    try { if (typeof applyRotation === 'function') applyRotation(); } catch (e) {}
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const b = mbEl('btn-maubinh');
        if (b) b.addEventListener('click', mbEnter);
        const bl = mbEl('btn-mb-lobby');
        if (bl) bl.addEventListener('click', mbBackToLobby);
        const ba = mbEl('btn-mb-auto');
        if (ba) ba.addEventListener('click', () => { if (mbState && mbState.phase === 'arrange') mbAutoAndShowdownPreview(); });
        const bf = mbEl('btn-mb-fix');
        if (bf) bf.addEventListener('click', () => { if (mbState && mbState.phase === 'arrange') mbFixAndRender(); });
        const bd = mbEl('btn-mb-done');
        if (bd) bd.addEventListener('click', () => { if (mbState && mbState.phase === 'arrange') mbShowdown(); });
        const bn = mbEl('btn-mb-new');
        if (bn) bn.addEventListener('click', mbNewGame);
        const bl2 = mbEl('btn-mb-result-lobby');
        if (bl2) bl2.addEventListener('click', mbBackToLobby);
    });
}

// Nút "Tự động" chỉ xếp lại (không so) — khác với hết giờ (xếp + so).
// Dùng nút này thì mất quyền nhận thưởng xếp tay (theo gamehub24).
function mbAutoAndShowdownPreview() {
    mbState.usedAuto = true;
    mbSelected = null;
    const best = mbAutoArrange(mbState.hands.player);
    if (!best) { mbMsg('Bài này không xếp được cách nào hợp lệ.'); return; }
    mbState.playerArr = { dau: best.dau, giua: best.giua, cuoi: best.cuoi };
    mbRenderPlayer();
    mbMsg('Đã xếp tự động. Bấm 2 lá để đổi chỗ nếu muốn, rồi bấm Xong.');
}
