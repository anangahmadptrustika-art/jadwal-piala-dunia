/* Tes logika inti tanpa browser.
   Menyiapkan shim `window` lalu memuat skrip data, engine, dan realtime. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- Shim lingkungan browser minimal ----
const store = {};
const sandbox = {
  console: console,
  performance: { now: () => 1234.5 },
  crypto: { getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = i + 7; return arr; } },
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  setInterval: () => 0,
  clearInterval: () => {},
  addEventListener: () => {},
  Math: Math, JSON: JSON, Date: Date, parseInt: parseInt, Object: Object, Array: Array
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);

function loadScript(rel) {
  const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

loadScript('assets/js/data.js');
loadScript('assets/js/engine.js');
loadScript('assets/js/realtime.js');

const WC = sandbox.WC;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.error('  ✗ ' + msg); failed++; }
}

console.log('\n== Tes Data ==');
const groupMatches = WC.data.buildGroupMatches();
const koMatches = WC.data.buildKnockoutMatches();
assert(groupMatches.length === 72, 'Fase grup menghasilkan 72 laga (dapat ' + groupMatches.length + ')');
assert(koMatches.length === 32, 'Babak gugur menghasilkan 32 laga (dapat ' + koMatches.length + ')');
assert(groupMatches.length + koMatches.length === 104, 'Total 104 laga');
assert(WC.data.GROUP_KEYS.length === 12, '12 grup (A-L)');

// setiap grup punya 6 laga & 4 tim unik
const perGroup = {};
groupMatches.forEach(m => { perGroup[m.group] = (perGroup[m.group] || 0) + 1; });
assert(Object.values(perGroup).every(c => c === 6), 'Setiap grup punya 6 laga');

console.log('\n== Tes Realtime Engine ==');
WC.realtime.init();
// id unik
const ids = WC.realtime.allMatches().map(m => m.id);
assert(new Set(ids).size === 104, 'Semua ID laga unik');

console.log('\n== Tes Klasemen ==');
// Mainkan semua laga grup dengan hasil deterministik: tim indeks lebih kecil menang.
const state = WC.realtime.getState();
state.groupMatches.forEach(m => {
  const homeStronger = m.home.idx < m.away.idx;
  m.score.home = homeStronger ? 2 : 0;
  m.score.away = homeStronger ? 0 : 2;
  m.status = 'finished';
});
const tables = WC.engine.computeStandings(state.groupMatches);
assert(tables.A[0].P === 3, 'Tim teratas Grup A main 3 laga');
assert(tables.A[0].Pts >= tables.A[3].Pts, 'Klasemen terurut menurun berdasarkan poin');
const sumPts = WC.data.GROUP_KEYS.reduce((s, gk) => s + tables[gk].reduce((a, r) => a + r.Pts, 0), 0);
// tiap laga membagikan total 3 poin (menang/kalah) -> 72*3 = 216
assert(sumPts === 72 * 3, 'Total poin keseluruhan = 216 (dapat ' + sumPts + ')');

console.log('\n== Tes Peringkat-3 & Bagan ==');
const derived = WC.engine.resolveBracket(state);
assert(derived.thirds.length === 12, '12 tim peringkat-3 diperingkat');
const r32 = state.koMatches.filter(m => m.stage === 'r32');
assert(r32.every(m => m.homeTeam && m.awayTeam), 'Semua slot 32 Besar terisi setelah fase grup selesai');

// Selesaikan seluruh babak gugur: tim "home" selalu menang
function resolveRound(stage) {
  state.koMatches.filter(m => m.stage === stage).forEach(m => {
    if (!m.homeTeam || !m.awayTeam) return;
    m.score.home = 1; m.score.away = 0; m.status = 'finished';
  });
  WC.engine.resolveBracket(state);
}
['r32', 'r16', 'qf', 'sf', 'third', 'final'].forEach(resolveRound);

const finalM = state.koMatches.find(m => m.id === 'M104');
assert(finalM.homeTeam && finalM.awayTeam, 'Final memiliki dua tim');
const champ = WC.engine.winnerOf(finalM);
assert(!!champ, 'Ada juara setelah final selesai: ' + (champ ? champ.name : 'TIDAK ADA'));

// Konsistensi: pemenang semifinal = finalis
const sf1 = state.koMatches.find(m => m.id === 'M101');
const sf1Winner = WC.engine.winnerOf(sf1);
assert(finalM.homeTeam.code === sf1Winner.code, 'Pemenang Semifinal-1 menjadi finalis (home)');

console.log('\n== Tes Adu Penalti (babak gugur imbang) ==');
const koDraw = WC.data.buildKnockoutMatches()[0];
koDraw.homeTeam = { name: 'X', code: 'X' }; koDraw.awayTeam = { name: 'Y', code: 'Y' };
koDraw.score.home = 1; koDraw.score.away = 1; koDraw.status = 'finished';
koDraw.penalties.home = 4; koDraw.penalties.away = 2;
assert(WC.engine.winnerOf(koDraw).code === 'X', 'Pemenang ditentukan adu penalti saat imbang');

console.log('\n' + (failed === 0 ? '✅ SEMUA TES LULUS' : '❌ ' + failed + ' TES GAGAL'));
process.exit(failed === 0 ? 0 : 1);
