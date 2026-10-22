// ============================================================
//  TIẾN LÊN MIỀN NAM — bot.js: AI CỦA BOT (3 ĐỘ KHÓ)
// ============================================================

// Tốc độ bot theo cài đặt
function botDelay() {
    return settings.botSpeed === 'cham' ? 1300 : settings.botSpeed === 'nhanh' ? 350 : 800;
}

function botPlay() {
    if (state.gameOver) return;
    const who0 = PLAYERS[state.turn];
    if (who0 === 'player') return;
    const diff = settings.difficulty || 'thuong';
    if (diff === 'de') return botPlayEasy(who0);
    if (diff === 'kho') return botPlayHard(who0);
    return botPlayNormal();
}

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
            cardsToPlay = (danger ? pool[pool.length - 1] : pool[0]).cards;
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
    speakPlay(combo, state.turn);
    render();
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
            // Dẫn vòng: ưu tiên đánh BỘ (đôi/sám/sảnh/đôi thông — bộ nhiều lá nhất trong
            // các bộ yếu nhất, bỏ qua hàng đặc biệt); không có bộ mới xả lá đơn rác.
            const allLeads = leadCandidates(hand);
            const finishing = allLeads.find(x => x.cards.length === hand.length);
            if (finishing) {
                cardsToPlay = finishing.cards;
            } else {
                const leads = allLeads.filter(x => !usesReserve(x));
                if (leads.length) {
                    leads.sort((a, b) => (b.cards.length - a.cards.length) || (a.combo.rank - b.combo.rank));
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
            if (!danger) {
                const nonReserve = candidates.filter(c => !usesReserve(c));
                if (nonReserve.length > 0) pool = nonReserve;
            }
            // Cần chặn thì lấy nước mạnh nhất, bình thường lấy nước yếu nhất trong pool
            cardsToPlay = (danger ? pool[pool.length - 1] : pool[0]).cards;
        }
    }
    return cardsToPlay;
}

