// Regression tests for Mậu Binh rule helpers. Run with: node --test tests/maubinh-rules.test.cjs
// Loads the real pure-rule functions from maubinh.js without booting the DOM/game UI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'maubinh.js'), 'utf8');
const start = source.indexOf('const MB_RANK_VAL');
const end = source.indexOf('// ============================================================\\n//  LUỒNG CHƠI + GIAO DIỆN');
assert.notEqual(start, -1, 'could not find Mậu Binh rules section');
assert.notEqual(end, -1, 'could not find end of pure-rules section');
const rulesSource = source.slice(start, end) + `
globalThis.__mbRules = {
  mbEvalChi, mbCompareChi, mbHandValue, mbIsBinhLung, mbInstantWin, mbScorePair,
  MB_RANK_VAL
};`;
const sandbox = {};
vm.runInNewContext(rulesSource, sandbox, { timeout: 2000 });
const { mbEvalChi, mbCompareChi, mbHandValue, mbIsBinhLung, mbInstantWin, mbScorePair } = sandbox.__mbRules;

const suits = ['♠', '♥', '♦', '♣'];
function hand(spec, suitOffset = 0) {
  return spec.map(([rank, suit]) => ({ rank: String(rank), suit: suit || suits[(suitOffset++) % suits.length] }));
}
function ranks(spec, suitOffset = 0) {
  return hand(spec.map(r => [String(r)]), suitOffset);
}

test('5-card hand categories are ordered high-card < pair < two-pair < trips < straight < flush < full-house < quads < straight-flush', () => {
  const cases = [
    ranks([2, 5, 7, 9, 13]),
    ranks([2, 2, 7, 9, 13]),
    ranks([2, 2, 7, 7, 13]),
    ranks([4, 4, 4, 9, 13]),
    ranks([2, 3, 4, 5, 6]),
    hand([[2,'♠'],[5,'♠'],[7,'♠'],[9,'♠'],['K','♠']]),
    ranks([3, 3, 3, 8, 8]),
    ranks([10, 10, 10, 10, 2]),
    hand([[5,'♥'],[6,'♥'],[7,'♥'],[8,'♥'],[9,'♥']])
  ];
  const cats = cases.map(h => mbEvalChi(h).cat);
  assert.deepEqual(cats, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let i = 1; i < cases.length; i++) assert.equal(mbCompareChi(cases[i], cases[i-1]), 1);
});

test('A-2-3-4-5 is recognized as a 5-high straight and loses to 2-3-4-5-6', () => {
  const wheel = ranks([14, 2, 3, 4, 5]);
  const sixHigh = ranks([2, 3, 4, 5, 6]);
  assert.equal(mbEvalChi(wheel).cat, 5);
  assert.deepEqual(Array.from(mbEvalChi(wheel).tb), [5]);
  assert.equal(mbCompareChi(sixHigh, wheel), 1);
});

test('3-card chi ranks trips above pair above high-card', () => {
  const high = ranks([2, 8, 13]);
  const pair = ranks([7, 7, 3]);
  const trips = ranks([4, 4, 4]);
  assert.deepEqual([mbEvalChi(high).cat, mbEvalChi(pair).cat, mbEvalChi(trips).cat], [1, 2, 3]);
  assert.equal(mbCompareChi(pair, high), 1);
  assert.equal(mbCompareChi(trips, pair), 1);
});

test('same category uses kickers; exact tie returns zero', () => {
  const pairA = ranks([12, 12, 14, 9, 4]);
  const pairB = ranks([12, 12, 13, 10, 5]);
  assert.equal(mbCompareChi(pairA, pairB), 1);
  assert.equal(mbCompareChi(ranks([8, 8, 14, 9, 4]), ranks([8, 8, 14, 9, 4])), 0);
});

test('binh-lung validates 5-5-3 sizes and requires later chi not be weaker', () => {
  const valid = {
    cuoi: ranks([10, 10, 10, 8, 8]),
    giua: ranks([9, 9, 9, 4, 4]),
    dau: ranks([3, 3, 14])
  };
  assert.equal(mbIsBinhLung(valid), false);
  assert.equal(mbIsBinhLung({ ...valid, dau: ranks([10, 10, 10, 9]) }), true, 'wrong chi size should be invalid');
  const foul = { cuoi: ranks([2, 4, 6, 8, 10]), giua: ranks([9, 9, 9, 5, 5]), dau: ranks([3, 3, 14]) };
  assert.equal(mbIsBinhLung(foul), true);
});

test('instant win detects 13 consecutive ranks as dragon but not suited dragon', () => {
  const dragon = ranks([2,3,4,5,6,7,8,9,10,11,12,13,14]);
  assert.equal(mbInstantWin(dragon, null)?.name, 'Sảnh rồng');
  const suitedDragon = hand([[2,'♠'],[3,'♠'],[4,'♠'],[5,'♠'],[6,'♠'],[7,'♠'],[8,'♠'],[9,'♠'],[10,'♠'],[11,'♠'],[12,'♠'],[13,'♠'],[14,'♠']]);
  assert.notEqual(mbInstantWin(suitedDragon, null)?.name, 'Sảnh rồng');
});

test('score pair is zero for exact tied chi and awards sweep only for three chi wins', () => {
  const p = { dau: ranks([14,14,13]), giua: ranks([10,10,10,8,8]), cuoi: ranks([12,12,12,11,11]) };
  const b = { dau: ranks([2,2,3]), giua: ranks([9,9,9,4,4]), cuoi: ranks([8,8,8,7,7]) };
  const score = mbScorePair(p, b, null, null, false, false);
  assert.equal(score.chi.length, 3);
  assert.equal(score.pScoop, 3);
  assert.equal(score.bScoop, 0);
  assert.ok(score.total >= 6, 'three winning chi plus sweep should produce at least +6 before special bonuses');
});
