/* =====================================================================
   REALTIME ENGINE
   ---------------------------------------------------------------------
   Mengelola sumber kebenaran (state) dan menyiarkan perubahan secara
   realtime ke seluruh UI dan antar-tab browser.

   Mekanisme realtime:
   1. Pub/Sub internal      -> UI langsung re-render saat state berubah.
   2. localStorage          -> persistensi hasil antar sesi.
   3. BroadcastChannel      -> sinkron realtime antar tab/jendela.
   4. storage event         -> fallback sinkron antar tab.
   5. Simulator live (tick) -> menggerakkan menit & skor laga "LIVE"
                               sehingga klasemen + bagan berubah realtime.
   ===================================================================== */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'wc2026:state:v1';
  const CHANNEL_NAME = 'wc2026-realtime';

  const subscribers = [];
  let channel = null;
  let simTimer = null;
  let simSpeed = 1; // multiplier
  let clientId = 'c' + Math.floor(performance.now()).toString(36) + (global.crypto && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36) : '');

  let state = null;

  function freshState() {
    return {
      version: 1,
      updatedAt: Date.now(),
      groupMatches: global.WC.data.buildGroupMatches(),
      koMatches: global.WC.data.buildKnockoutMatches(),
      liveMode: false
    };
  }

  function allMatches() {
    return state.groupMatches.concat(state.koMatches);
  }

  function findMatch(id) {
    return allMatches().filter(function (m) { return m.id === id; })[0] || null;
  }

  /* ---------- Persistensi ---------- */
  function save(broadcast) {
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, serialize());
    } catch (e) { /* storage penuh / mode privat */ }
    if (broadcast !== false) postUpdate();
  }

  // Hanya simpan bagian yang dinamis agar struktur tetap segar dari kode.
  function serialize() {
    const slim = {
      version: state.version,
      updatedAt: state.updatedAt,
      liveMode: state.liveMode,
      g: state.groupMatches.map(slimMatch),
      k: state.koMatches.map(slimMatch)
    };
    return JSON.stringify(slim);
  }
  function slimMatch(m) {
    return {
      id: m.id,
      sh: m.score.home, sa: m.score.away,
      ph: m.penalties ? m.penalties.home : null,
      pa: m.penalties ? m.penalties.away : null,
      st: m.status, mn: m.minute
    };
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    state = freshState();
    if (!raw) return;
    try {
      const slim = JSON.parse(raw);
      const map = {};
      (slim.g || []).concat(slim.k || []).forEach(function (s) { map[s.id] = s; });
      allMatches().forEach(function (m) {
        const s = map[m.id];
        if (!s) return;
        m.score.home = s.sh; m.score.away = s.sa;
        if (m.penalties) { m.penalties.home = s.ph; m.penalties.away = s.pa; }
        m.status = s.st || 'scheduled';
        m.minute = s.mn || 0;
      });
      state.liveMode = !!slim.liveMode;
    } catch (e) { /* korupsi -> pakai fresh */ }
  }

  /* ---------- Pub/Sub ---------- */
  function subscribe(fn) {
    subscribers.push(fn);
    return function () {
      const i = subscribers.indexOf(fn);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }
  function emit(reason) {
    // resolusi bagan dilakukan sebelum setiap emit agar UI selalu konsisten
    const derived = global.WC.engine.resolveBracket(state);
    subscribers.forEach(function (fn) {
      try { fn(state, derived, reason); } catch (e) { console.error(e); }
    });
  }

  /* ---------- Sinkron antar-tab ---------- */
  function setupChannel() {
    if ('BroadcastChannel' in global) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = function (ev) {
        if (!ev.data || ev.data.from === clientId) return;
        if (ev.data.type === 'state') {
          applyRemote(ev.data.payload);
        }
      };
    }
    // fallback: storage event
    global.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { applyRemote(e.newValue); } catch (err) {}
      }
    });
  }

  function postUpdate() {
    if (channel) {
      channel.postMessage({ type: 'state', from: clientId, payload: serialize() });
    }
    emit('local');
  }

  function applyRemote(payloadStr) {
    try {
      const slim = JSON.parse(payloadStr);
      const map = {};
      (slim.g || []).concat(slim.k || []).forEach(function (s) { map[s.id] = s; });
      allMatches().forEach(function (m) {
        const s = map[m.id];
        if (!s) return;
        m.score.home = s.sh; m.score.away = s.sa;
        if (m.penalties) { m.penalties.home = s.ph; m.penalties.away = s.pa; }
        m.status = s.st || 'scheduled';
        m.minute = s.mn || 0;
      });
      state.liveMode = !!slim.liveMode;
      state.updatedAt = slim.updatedAt || Date.now();
      emit('remote');
    } catch (e) {}
  }

  /* ---------- API publik untuk update skor ---------- */
  function setScore(id, home, away) {
    const m = findMatch(id);
    if (!m) return;
    m.score.home = (home === '' || home == null) ? null : Math.max(0, parseInt(home, 10) || 0);
    m.score.away = (away === '' || away == null) ? null : Math.max(0, parseInt(away, 10) || 0);
    if (m.score.home != null && m.score.away != null && m.status === 'scheduled') {
      m.status = 'live';
    }
    save();
  }

  function setStatus(id, status) {
    const m = findMatch(id);
    if (!m) return;
    m.status = status;
    if (status === 'live' && m.minute === 0) m.minute = 1;
    if (status === 'finished') {
      if (m.score.home == null) m.score.home = 0;
      if (m.score.away == null) m.score.away = 0;
    }
    if (status === 'scheduled') {
      m.score.home = null; m.score.away = null; m.minute = 0;
      if (m.penalties) { m.penalties.home = null; m.penalties.away = null; }
    }
    save();
  }

  function setPenalties(id, home, away) {
    const m = findMatch(id);
    if (!m || !m.penalties) return;
    m.penalties.home = (home === '' || home == null) ? null : parseInt(home, 10);
    m.penalties.away = (away === '' || away == null) ? null : parseInt(away, 10);
    save();
  }

  function adjustScore(id, side, delta) {
    const m = findMatch(id);
    if (!m) return;
    const cur = m.score[side] == null ? 0 : m.score[side];
    m.score[side] = Math.max(0, cur + delta);
    if (m.score.home == null) m.score.home = 0;
    if (m.score.away == null) m.score.away = 0;
    if (m.status === 'scheduled') m.status = 'live';
    save();
  }

  function resetAll() {
    stopSimulator();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    state = freshState();
    save();
  }

  /* ---------- Simulator LIVE ----------
     Memajukan menit pada laga berstatus 'live' dan sesekali mencetak gol,
     lalu menyelesaikan laga di menit 90+. Semua perubahan disiarkan
     realtime sehingga klasemen & bagan ikut berubah. */
  function startSimulator(speed) {
    simSpeed = speed || simSpeed || 1;
    state.liveMode = true;
    if (simTimer) clearInterval(simTimer);
    simTimer = setInterval(simTick, 1000);
    save();
  }
  function stopSimulator() {
    if (simTimer) { clearInterval(simTimer); simTimer = null; }
    state.liveMode = false;
    save();
  }
  function isSimulating() { return !!simTimer; }

  function pseudoRandom(seed) {
    // deterministik-ish per detik agar tidak butuh Math.random global yang dibatasi
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  let tickCounter = 0;
  function simTick() {
    tickCounter++;
    let changed = false;
    const live = allMatches().filter(function (m) { return m.status === 'live'; });

    // Jika tidak ada laga live, mulai laga terdekat yang belum dimainkan
    if (live.length === 0) {
      const next = pickNextStartable();
      if (next) {
        next.status = 'live';
        next.minute = 1;
        next.score.home = 0; next.score.away = 0;
        changed = true;
      }
    }

    live.forEach(function (m) {
      for (let s = 0; s < simSpeed; s++) {
        m.minute++;
        const r = pseudoRandom(tickCounter * 13.37 + m.no * 7.7 + m.minute);
        // peluang gol kecil tiap menit
        if (r > 0.965) {
          if (pseudoRandom(r * 100) > 0.5) m.score.home++;
          else m.score.away++;
        }
        if (m.minute >= 90) {
          finishLive(m);
          break;
        }
      }
      changed = true;
    });

    if (changed) save();
  }

  function finishLive(m) {
    m.minute = 90;
    m.status = 'finished';
    // babak gugur tidak boleh imbang -> adu penalti
    const isKO = m.stage !== 'group';
    if (isKO && m.score.home === m.score.away) {
      const r = pseudoRandom(m.no * 3.3 + 1);
      const ph = 3 + Math.floor(pseudoRandom(r) * 3);
      let pa = 3 + Math.floor(pseudoRandom(r * 2) * 3);
      if (pa === ph) pa = pa === 5 ? 4 : pa + 1;
      m.penalties.home = ph; m.penalties.away = pa;
    }
  }

  function pickNextStartable() {
    // Prioritas: laga grup belum selesai dengan nomor terkecil.
    const candidates = allMatches().filter(function (m) {
      return m.status === 'scheduled';
    });
    // Untuk babak gugur, hanya mulai jika kedua tim sudah terisi.
    const ready = candidates.filter(function (m) {
      if (m.stage === 'group') return true;
      return m.homeTeam && m.awayTeam;
    });
    ready.sort(function (a, b) { return a.no - b.no; });
    return ready[0] || null;
  }

  /* ---------- Init ---------- */
  function init() {
    load();
    setupChannel();
    // resolusi awal
    emit('init');
  }

  global.WC = global.WC || {};
  global.WC.realtime = {
    init: init,
    getState: function () { return state; },
    allMatches: allMatches,
    findMatch: findMatch,
    subscribe: subscribe,
    setScore: setScore,
    setStatus: setStatus,
    setPenalties: setPenalties,
    adjustScore: adjustScore,
    resetAll: resetAll,
    startSimulator: startSimulator,
    stopSimulator: stopSimulator,
    isSimulating: isSimulating,
    setSimSpeed: function (s) { simSpeed = s; },
    getSimSpeed: function () { return simSpeed; }
  };

})(window);
