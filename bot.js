// ============================================================
//  TIẾN LÊN MIỀN NAM — bot.js: AI CỦA BOT (3 ĐỘ KHÓ)
// ============================================================

// Tốc độ bot theo cài đặt
function botDelay() {
    const base = settings.botSpeed === 'cham' ? 1300 : settings.botSpeed === 'nhanh' ? 350 : 800;
    // Đệm tiếng: câu cà khịa đang đọc dở thì chờ đọc xong mới ra bài tiếp,
    // tránh tiếng chồng chéo (tối đa chờ thêm 1.8 giây). Tắt giọng thì không chờ.
    try {
        if (typeof voiceOn !== 'undefined' && voiceOn && typeof voiceBusyUntil !== 'undefined') {
            const wait = voiceBusyUntil - Date.now();
            if (wait > 0) return base + Math.min(wait, 1800);
        }
    } catch (e) {}
    return base;
}

function botPlay() {
    if (state.gameOver || inLobby) return; // ở sảnh chờ thì bot không chạy nền (r67)
    const who0 = PLAYERS[state.turn];
    if (who0 === 'player') return;
    // Đã bỏ lượt trong vòng này thì bị khóa như người chơi: tự bỏ qua cho đến hết vòng
    if (state.passed && state.passed[who0] && state.lastPlay) { doPass(); return; }
    const diff = settings.difficulty || 'thuong';
    if (diff === 'de') return botPlayEasy(who0);
    if (diff === 'kho') return botPlayHard(who0);
    if (diff === 'sieukho') return botPlaySuper(who0);
    return botPlayNormal();
}

// ===== r62: TÍNH CÁCH BOT (cố định theo vị trí) =====
const BOT_STYLE = { left: 'hunghang', top: 'giubai', right: 'chan' };
const BOT_STYLE_NAME = { hunghang: 'Hung hăng', giubai: 'Giữ bài', chan: 'Chuyên chặn' };

// DỄ: đánh ngẫu nhiên có chọn lọc trong các nước hợp lệ
function botPlayEasy(who) {
    const hand = state.hands[who];
    const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
    let cardsToPlay = null;
    if (state.firstMove) {
        const pick = pickFirstMove(hand, false);
        if (pick) cardsToPlay = pick.cards;
    } else if (!state.lastPlay) {
        const leads = leadCandidates(hand).filter(x => !isSpecialCombo(x.combo));
        if (leads.length && Math.random() < 0.7) cardsToPlay = rnd(leads).cards;
        else cardsToPlay = [hand[0]];
    } else {
        const cands = findCandidates(hand, state.lastPlay.combo);
        if (cands.length) cardsToPlay = rnd(cands).cards;
    }
    botCommit(who, cardsToPlay);
}

// KHÓ: Thường + dẫn bằng bộ, chặn mạnh khi đối thủ còn 1-2 lá, đếm bài đã ra để giữ/xả hàng
function botPlayHard(who) {
    const hand = state.hands[who];
    const style = BOT_STYLE[who] || null;
    const opponentCombo = state.lastPlay ? state.lastPlay.combo : null;
    const minOpp = Math.min(...[0, 1, 2, 3].filter(i => i !== state.turn).map(i => state.hands[PLAYERS[i]].length));
    const danger = minOpp <= 2;
    const usesReserve = c => isSpecialCombo(c.combo);
    let cardsToPlay = null;

    if (!opponentCombo) {
        if (state.firstMove) {
            const pick = pickFirstMove(hand, true);
            if (pick) cardsToPlay = pick.cards;
        } else if (getCombo(hand)) {
            cardsToPlay = hand; // còn đúng một bộ: về đích luôn
        } else {
            // Dẫn bằng bộ nguyên vẹn (nhiều lá nhất trong các bộ yếu nhất), tránh phá đôi/sảnh và giữ hàng đặc biệt
            const leads = leadCandidates(hand).filter(x => !usesReserve(x));
            if (leads.length) {
                leads.sort((a, b2) => (b2.cards.length - a.cards.length) || (a.combo.rank - b2.combo.rank));
                cardsToPlay = leads[0].cards;
            } else {
                const counts = {};
                hand.forEach(c => counts[rankValue(c)] = (counts[rankValue(c)] || 0) + 1);
                const trash = hand.find(c => counts[rankValue(c)] === 1 && rankValue(c) !== RANK_2);
                cardsToPlay = [trash || hand[0]];
            }
        }
    } else {
        const candidates = findCandidates(hand, opponentCombo);
        if (candidates.length) {
            candidates.sort((a, b2) => {
                const aSame = a.combo.type === opponentCombo.type;
                const bSame = b2.combo.type === opponentCombo.type;
                if (aSame !== bSame) return bSame ? 1 : -1;
                return a.combo.rank - b2.combo.rank;
            });
            let pool = candidates;
            if (!danger) {
                // Chỉ xả hàng đặc biệt khi đánh ra là hết bài, hoặc khi mọi heo khác đã ra (đếm bài) và đây là nước chốt
                const heosOut = state.playedCards.filter(c => c.rank === '2').length;
                const nonReserve = candidates.filter(c => !usesReserve(c));
                const finishing = candidates.filter(c => c.cards.length === hand.length);
                if (finishing.length) pool = finishing;
                else if (nonReserve.length) pool = nonReserve;
                else if (heosOut >= 3) pool = candidates;
            }
            if (style === 'giubai' && !danger && pool.every(c => usesReserve(c)) && !candidates.some(c => c.cards.length === hand.length)) {
                // Giữ bài (mức Khó): chưa bị dồn thì không xả hàng đặc biệt, bỏ lượt giữ hàng
            } else {
                cardsToPlay = (danger || style === 'hunghang' ? pool[pool.length - 1] : pool[0]).cards;
            }
        }
    }
    botCommit(who, cardsToPlay);
}

// Phần chốt nước đánh dùng chung cho cả 3 độ khó (logic Thường nằm ở botPlayNormal)
function botCommit(who, cardsToPlay) {
    if (!cardsToPlay) {
        showMessage(`${PLAYER_NAMES[who]} bỏ lượt`);
        setTimeout(() => doPass(), 400);
        return;
    }
    const flySrc = captureFlySource(who, cardsToPlay); // chụp vị trí tay bot trước khi cắt bài
    const hand = state.hands[who];
    const idx = cardsToPlay.map(c => hand.indexOf(c));
    idx.sort((a, b) => b - a).forEach(i => hand.splice(i, 1));

    const combo = getCombo(cardsToPlay);
    const prevPlay = state.lastPlay;
    state.lastPlay = { player: state.turn, cards: cardsToPlay, combo };
    trackPlay(who, cardsToPlay, combo, prevPlay);
    state.firstMove = false;
    state.passCount = 0;

    playClick();
    speakPlay(combo, state.turn, { prevCombo: prevPlay ? prevPlay.combo : null, remaining: hand.length, prevOwnerIdx: prevPlay ? prevPlay.player : null, cards: cardsToPlay });
    render();
    playFlyAnimation(who, flySrc);
    if (!state.lastPlayWasChop) showMessage(`${PLAYER_NAMES[who]} đánh ${formatCombo(combo)}`);

    if (hand.length === 0) {
        return endGame(state.turn);
    }

    if (state.gameOver) return;
    nextTurn();
}

function botPlayNormal() {
    if (state.gameOver) return;
    const who = PLAYERS[state.turn];
    if (who === 'player') return;
    const cardsToPlay = chooseNormalMove(who);
    if (!cardsToPlay) {
        showMessage(`${PLAYER_NAMES[who]} bỏ lượt`);
        setTimeout(() => doPass(), 400);
        return;
    }
    botCommit(who, cardsToPlay);
}

// Chọn nước đi kiểu Thường cho một người chơi bất kỳ (bot dùng, và máy dùng khi đánh thay người lúc hết giờ)
function chooseNormalMove(who) {
    const hand = state.hands[who];
    const style = BOT_STYLE[who] || null;
    const opponentCombo = state.lastPlay ? state.lastPlay.combo : null;

    let cardsToPlay = null;

    // Đối thủ đang còn chơi chỉ còn 1 lá -> phải chặn
    const danger = [0, 1, 2, 3].some(i => i !== state.turn && state.hands[PLAYERS[i]].length <= (style === 'chan' ? 2 : 1));
    // Nước dùng lá 2 hoặc hàng chặt (tứ quý/đôi thông) là "hàng dự trữ": giữ lại, chỉ dùng khi cần
    // Hung hăng: heo không bị coi là hàng dự trữ (dám dùng sớm); các kiểu khác giữ heo như hàng dự trữ
    const usesReserve = style === 'hunghang'
        ? (c => c.combo.type === 'quad' || c.combo.type === 'double_straight')
        : (c => c.combo.type === 'quad' || c.combo.type === 'double_straight' || c.cards.some(card => rankValue(card) === RANK_2));

    if (!opponentCombo) {
        if (state.firstMove) {
            const pick = pickFirstMove(hand, true);
            if (pick) cardsToPlay = pick.cards;
        } else if (danger) {
            // Dẫn vòng khi cần chặn: đánh lá đơn cao nhất
            cardsToPlay = [hand[hand.length - 1]];
        } else {
            // Dẫn vòng: ưu tiên đánh BỘ (đôi/sám/sảnh/đôi thông — bộ nhiều lá nhất trong
            // các bộ yếu nhất, bỏ qua hàng đặc biệt); không có bộ mới xả lá đơn rác.
            const allLeads = leadCandidates(hand);
            const finishing = allLeads.find(x => x.cards.length === hand.length);
            if (finishing) {
                cardsToPlay = finishing.cards;
            } else {
                const leads = allLeads.filter(x => !usesReserve(x));
                if (leads.length) {
                    leads.sort((a, b) => (b.cards.length - a.cards.length) || (style === 'hunghang' ? (b.combo.rank - a.combo.rank) : (a.combo.rank - b.combo.rank)));
                    cardsToPlay = leads[0].cards;
                }
            }
            if (!cardsToPlay) {
            // Xả lá rác (lá lẻ không thuộc đôi/sảnh nào) nhỏ nhất trước
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
            let giveUp = false;
            if (!danger) {
                const nonReserve = candidates.filter(c => !usesReserve(c));
                if (nonReserve.length > 0) pool = nonReserve;
                // Giữ bài: nước đè duy nhất là hàng đặc biệt và không phải nước hết bài -> bỏ lượt để giữ hàng
                else if (style === 'giubai' && !candidates.some(c => c.cards.length === hand.length)) giveUp = true;
            }
            // Cần chặn (hoặc Hung hăng) thì lấy nước mạnh nhất, bình thường lấy nước yếu nhất trong pool
            if (!giveUp) cardsToPlay = (danger || style === 'hunghang' ? pool[pool.length - 1] : pool[0]).cards;
        }
    }
    return cardsToPlay;
}


// ===== r62: SIÊU KHÓ — mô phỏng ngẫu nhiên (Monte Carlo) =====
// Còn nhiều bài thì dùng khung Khó; từ 8 lá trở xuống, mỗi nước ứng viên được chơi thử
// 24 ván với bài đối thủ chia ngẫu nhiên từ các lá chưa lộ, chọn nước có điểm cao nhất.
function botPlaySuper(who) {
    const hand = state.hands[who];
    if (state.firstMove || hand.length > 8) return botPlayHard(who);
    let cands;
    if (state.lastPlay) {
        cands = findCandidates(hand, state.lastPlay.combo);
    } else {
        cands = leadCandidates(hand).filter(x => !isSpecialCombo(x.combo));
        if (!cands.length) cands = leadCandidates(hand);
        if (!cands.length) { botCommit(who, [hand[0]]); return; }
    }
    if (!cands.length) { botCommit(who, null); return; }
    if (cands.length === 1) { botCommit(who, cands[0].cards); return; }
    if (cands.length > 6) {
        const step = (cands.length - 1) / 5, picked = [];
        for (let i = 0; i < 6; i++) picked.push(cands[Math.round(i * step)]);
        cands = [...new Set(picked)];
    }
    const myIdx = state.turn;
    let best = cands[0], bestScore = -Infinity;
    for (const cand of cands) {
        let score = 0;
        for (let s = 0; s < 24; s++) score += simAfterMove(who, myIdx, cand.cards);
        if (score > bestScore) { bestScore = score; best = cand; }
    }
    botCommit(who, best.cards);
}

// Chơi thử một ván từ sau nước ứng viên; thắng +1, thua trừ theo số lá mình còn (càng ít càng đỡ tệ)
function simAfterMove(who, myIdx, myCards) {
    const key = c => c.rank + '|' + c.suit;
    const seen = new Set();
    state.playedCards.forEach(c => seen.add(key(c)));
    state.hands[who].forEach(c => seen.add(key(c)));
    const unseen = [];
    RANKS.forEach(r => SUITS.forEach(s => { const c = { rank: r, suit: s }; if (!seen.has(key(c))) unseen.push(c); }));
    for (let i = unseen.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = unseen[i]; unseen[i] = unseen[j]; unseen[j] = t; }
    const hands = [[], [], [], []];
    hands[myIdx] = state.hands[who].filter(c => !myCards.includes(c));
    if (hands[myIdx].length === 0) return 1;
    let p = 0;
    for (let i = 0; i < 4; i++) {
        if (i === myIdx) continue;
        const n = state.hands[PLAYERS[i]].length;
        hands[i] = unseen.slice(p, p + n); p += n;
    }
    let lastPlay = { player: myIdx, cards: myCards, combo: getCombo(myCards) };
    const passed = { player: !!state.passed.player, left: !!state.passed.left, top: !!state.passed.top, right: !!state.passed.right };
    passed[who] = false;
    let passCount = 0;
    let turn = (myIdx + 1) % 4;
    for (let step = 0; step < 300; step++) {
        const k = PLAYERS[turn];
        if (lastPlay && passed[k]) {
            passCount++;
            if (passCount >= 3) { turn = lastPlay.player; lastPlay = null; passCount = 0; PLAYERS.forEach(x => passed[x] = false); }
            else turn = (turn + 1) % 4;
            continue;
        }
        const mv = simChoose(hands[turn], lastPlay);
        if (!mv) {
            passed[k] = true; passCount++;
            if (passCount >= 3) { turn = lastPlay.player; lastPlay = null; passCount = 0; PLAYERS.forEach(x => passed[x] = false); }
            else turn = (turn + 1) % 4;
            continue;
        }
        mv.forEach(c => { const ix = hands[turn].indexOf(c); if (ix >= 0) hands[turn].splice(ix, 1); });
        lastPlay = { player: turn, cards: mv, combo: getCombo(mv) };
        passCount = 0;
        if (hands[turn].length === 0) return turn === myIdx ? 1 : -hands[myIdx].length / 13;
        turn = (turn + 1) % 4;
    }
    return -hands[myIdx].length / 13;
}

// Chính sách chơi nhanh trong mô phỏng: đè bằng nước yếu nhất không phải hàng đặc biệt
function simChoose(hand, lastPlay) {
    if (!lastPlay) {
        const leads = leadCandidates(hand).filter(x => !isSpecialCombo(x.combo));
        if (leads.length) { leads.sort((a, b) => a.combo.rank - b.combo.rank); return leads[0].cards; }
        return [hand[0]];
    }
    const cands = findCandidates(hand, lastPlay.combo);
    if (!cands.length) return null;
    const nonReserve = cands.filter(x => !isSpecialCombo(x.combo));
    return (nonReserve.length ? nonReserve : cands)[0].cards;
}
