// ============================================================
//  TIẾN LÊN MIỀN NAM — rules.js: HẰNG SỐ + LUẬT CHƠI THUẦN
// ============================================================

// ==== CONSTANTS ====
const SUITS = ['♠', '♣', '♦', '♥'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const RANK_2 = 12; // index của '2'

const PLAYERS = ['player', 'left', 'top', 'right'];
const PLAYER_NAMES = {
    player: 'Bạn',
    left: 'Hùng Sấm Sét',
    right: 'Nam Lì Đòn',
    top: 'Tuấn Cao Thủ'
};

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


// ============================================================
//  LUẬT BỔ SUNG: TỚI TRẮNG, GIÁ HEO, BỘ DẪN VÒNG, XẾP THEO BỘ
// ============================================================
// Giá đền của một lá heo: heo đỏ (♥♦) 100, heo đen (♠♣) 50 (chưa nhân mức cược)
function heoValue(card) { return (card.suit === '♥' || card.suit === '♦') ? 100 : 50; }

// Bộ "đặc biệt": tứ quý / đôi thông / bộ chứa heo
function isSpecialCombo(combo) {
    return !!combo && (combo.type === 'quad' || combo.type === 'double_straight' || combo.cards.some(c => c.rank === '2'));
}

// TỚI TRẮNG: kiểm tra một tay bài ngay khi chia. Trả {type, label} hoặc null.
function checkToiTrang(hand) {
    const counts = {};
    hand.forEach(c => { const rv = rankValue(c); counts[rv] = (counts[rv] || 0) + 1; });
    if (counts[RANK_2] === 4) return { type: 'tu-quy-heo', label: 'tứ quý heo' };
    let dragon = true;
    for (let rv = 0; rv <= 11; rv++) if (!counts[rv]) { dragon = false; break; }
    if (dragon) return { type: 'sanh-rong', label: 'sảnh rồng 3→A' };
    for (let start = 0; start + 4 <= 11; start++) {
        let ok = true;
        for (let rv = start; rv < start + 5; rv++) if ((counts[rv] || 0) < 2) { ok = false; break; }
        if (ok) return { type: 'nam-doi-thong', label: '5 đôi thông' };
    }
    let pairs = 0;
    Object.values(counts).forEach(n => { pairs += Math.floor(n / 2); });
    if (pairs >= 6) return { type: 'sau-doi', label: '6 đôi' };
    return null;
}

// Kiểm tra cả 4 tay theo thứ tự lượt bắt đầu từ người đi trước
function checkToiTrangAll(hands, startIdx) {
    for (let n = 0; n < 4; n++) {
        const idx = (startIdx + n) % 4;
        const key = PLAYERS[idx];
        const t = checkToiTrang(hands[key]);
        if (t) return { player: key, type: t.type, label: t.label };
    }
    return null;
}

// Mọi bộ nguyên vẹn có trong tay (đôi/sám/tứ quý/sảnh/đôi thông) — dùng cho bot khó + gợi ý khi dẫn vòng
function leadCandidates(hand) {
    const results = [];
    const byRank = {};
    hand.forEach(c => { const rv = rankValue(c); (byRank[rv] = byRank[rv] || []).push(c); });
    Object.keys(byRank).forEach(rk => {
        const g = [...byRank[rk]].sort((a, b) => suitValue(a) - suitValue(b));
        if (g.length >= 2) results.push({ cards: g.slice(0, 2), combo: getCombo(g.slice(0, 2)) });
        if (g.length >= 3) results.push({ cards: g.slice(0, 3), combo: getCombo(g.slice(0, 3)) });
        if (g.length === 4) results.push({ cards: [...g], combo: getCombo(g) });
    });
    const ranks = Object.keys(byRank).map(Number).filter(rv => rv < RANK_2).sort((a, b) => a - b);
    for (let i = 0; i < ranks.length; i++) {
        for (let j = i + 2; j < ranks.length && ranks[j] === ranks[i] + (j - i); j++) {
            const cards = ranks.slice(i, j + 1).map(rv => byRank[rv][0]);
            results.push({ cards, combo: getCombo(cards) });
        }
    }
    const pairRanks = ranks.filter(rv => byRank[rv].length >= 2);
    for (let i = 0; i < pairRanks.length; i++) {
        for (let j = i + 2; j < pairRanks.length && pairRanks[j] === pairRanks[i] + (j - i); j++) {
            const cards = [];
            pairRanks.slice(i, j + 1).forEach(rv => cards.push(byRank[rv][0], byRank[rv][1]));
            results.push({ cards, combo: getCombo(cards) });
        }
    }
    return results.filter(x => x.combo);
}

// Xếp tay theo bộ: lẻ tăng dần → đôi → sám → sảnh → đôi thông → tứ quý
function sortHandByCombo(hand) {
    const rest = [...hand];
    const take = cards => {
        cards.forEach(c => { const i = rest.indexOf(c); if (i >= 0) rest.splice(i, 1); });
        return [...cards].sort(compareCards);
    };
    const leads = leadCandidates(hand);
    const pick = type => leads.filter(x => x.combo.type === type)
        .sort((a, b) => (b.cards.length - a.cards.length) || (a.combo.rank - b.combo.rank));
    const quads = pick('quad'), dStraights = pick('double_straight'), straights = pick('straight'),
          triples = pick('triple'), pairs = pick('pair');
    const used = new Set();
    const ordered = [];
    [quads, dStraights, straights, triples, pairs].forEach(list => list.forEach(x => {
        if (x.cards.some(c => used.has(c))) return;
        x.cards.forEach(c => used.add(c));
        ordered.push(x.cards);
    }));
    const comboCards = ordered.flat();
    const singles = take(hand.filter(c => !used.has(c)));
    const pairCards = ordered.filter(g => getCombo(g).type === 'pair').flat();
    const tripleCards = ordered.filter(g => getCombo(g).type === 'triple').flat();
    const straightCards = ordered.filter(g => getCombo(g).type === 'straight').flat();
    const dsCards = ordered.filter(g => getCombo(g).type === 'double_straight').flat();
    const quadCards = ordered.filter(g => getCombo(g).type === 'quad').flat();
    return [...singles, ...pairCards, ...tripleCards, ...straightCards, ...dsCards, ...quadCards];
}
