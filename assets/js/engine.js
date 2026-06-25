/* =====================================================================
   ENGINE  -  Logika klasemen & resolusi bagan babak gugur
   Murni fungsi: menerima state (daftar match), menghasilkan turunan.
   ===================================================================== */

(function (global) {
  'use strict';

  const data = global.WC.data;

  function emptyRow(team, group, idx) {
    return {
      team: team, group: group, idx: idx,
      P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0,
      pos: 0
    };
  }

  // Hitung klasemen seluruh grup dari daftar laga grup yang sudah/ sedang dimainkan.
  function computeStandings(groupMatches) {
    const tables = {};
    data.GROUP_KEYS.forEach(function (gk) {
      tables[gk] = data.GROUPS[gk].map(function (team, i) {
        return emptyRow(team, gk, i);
      });
    });

    groupMatches.forEach(function (m) {
      if (m.score.home == null || m.score.away == null) return;
      if (m.status !== 'finished' && m.status !== 'live') return;

      const row = tables[m.group];
      const h = row[m.home.idx];
      const a = row[m.away.idx];
      const hs = m.score.home, as = m.score.away;

      h.P++; a.P++;
      h.GF += hs; h.GA += as;
      a.GF += as; a.GA += hs;

      if (hs > as) { h.W++; a.L++; h.Pts += 3; }
      else if (hs < as) { a.W++; h.L++; a.Pts += 3; }
      else { h.D++; a.D++; h.Pts += 1; a.Pts += 1; }
    });

    // Urutkan tiap grup
    data.GROUP_KEYS.forEach(function (gk) {
      tables[gk].forEach(function (r) { r.GD = r.GF - r.GA; });
      tables[gk].sort(cmpRow);
      tables[gk].forEach(function (r, i) { r.pos = i + 1; });
    });

    return tables;
  }

  function cmpRow(a, b) {
    if (b.Pts !== a.Pts) return b.Pts - a.Pts;
    if (b.GD !== a.GD) return b.GD - a.GD;
    if (b.GF !== a.GF) return b.GF - a.GF;
    return a.team.name.localeCompare(b.team.name);
  }

  // Peringkat 8 tim peringkat-3 terbaik (lintas grup).
  function rankThirdPlaced(tables) {
    const thirds = data.GROUP_KEYS.map(function (gk) {
      const r = tables[gk][2]; // posisi ke-3
      return Object.assign({}, r, { group: gk });
    });
    thirds.sort(cmpRow);
    return thirds; // [0..7] adalah T1..T8
  }

  // Apakah seluruh laga grup sudah selesai? (untuk validasi peringkat-3 final)
  function groupStageComplete(groupMatches) {
    return groupMatches.every(function (m) { return m.status === 'finished'; });
  }

  // Map grup -> apakah seluruh 6 laga grup itu sudah selesai.
  function groupCompletion(groupMatches) {
    const done = {};
    data.GROUP_KEYS.forEach(function (gk) { done[gk] = true; });
    groupMatches.forEach(function (m) {
      if (m.status !== 'finished') done[m.group] = false;
    });
    return done;
  }

  /* Resolusi referensi slot babak gugur menjadi tim konkret.
     Mengembalikan map: refKey -> { team, label, resolved } */
  function buildSlotResolver(tables, thirds, koMatches, groupDone, allGroupsDone, thirdSlotMap) {
    const cache = {};

    // Tampilkan tim yang menempati posisi itu bila grup sudah punya hasil.
    // 'confirmed' = grup selesai (pasti); selain itu = posisi sementara.
    function groupTeam(letter, pos) {
      const t = tables[letter];
      if (!t) return null;
      const row = t[pos - 1];
      if (!row) return null;
      const hasData = t.some(function (r) { return r.P > 0; });
      return hasData ? row.team : null;
    }

    function resolveRef(ref) {
      if (cache[ref] !== undefined) return cache[ref];
      let res = { team: null, label: ref, resolved: false };

      if (/^W[A-L]$/.test(ref)) {
        const team = groupTeam(ref[1], 1);
        const done = groupDone[ref[1]];
        res = { team: team, label: 'Juara Grup ' + ref[1], resolved: done, provisional: !!team && !done };
      } else if (/^R[A-L]$/.test(ref)) {
        const team = groupTeam(ref[1], 2);
        const done = groupDone[ref[1]];
        res = { team: team, label: 'Runner-up Grup ' + ref[1], resolved: done, provisional: !!team && !done };
      } else if (/^T:/.test(ref)) {
        // Peringkat-3: dialokasikan ke slot sesuai tabel FIFA (himpunan grup asal).
        // Baru pasti bila SELURUH fase grup selesai.
        const team = allGroupsDone && thirdSlotMap ? (thirdSlotMap[ref] || null) : null;
        const letters = ref.slice(2).split('').join('/');
        res = { team: team, label: 'Peringkat-3 ' + letters, resolved: !!team };
      } else if (/^W#M\d+$/.test(ref)) {
        const mid = ref.split('#')[1];
        const m = koMatches[mid];
        const w = winnerOf(m);
        res = { team: w, label: 'Pemenang ' + mid, resolved: !!w };
      } else if (/^L#M\d+$/.test(ref)) {
        const mid = ref.split('#')[1];
        const m = koMatches[mid];
        const l = loserOf(m);
        res = { team: l, label: 'Kalah ' + mid, resolved: !!l };
      }
      cache[ref] = res;
      return res;
    }

    return resolveRef;
  }

  function effectiveWinnerSide(m) {
    if (!m || m.status !== 'finished') return null;
    const hs = m.score.home, as = m.score.away;
    if (hs == null || as == null) return null;
    if (hs > as) return 'home';
    if (as > hs) return 'away';
    // imbang -> adu penalti
    const ph = m.penalties ? m.penalties.home : null;
    const pa = m.penalties ? m.penalties.away : null;
    if (ph != null && pa != null) return ph > pa ? 'home' : (pa > ph ? 'away' : null);
    return null;
  }

  function winnerOf(m) {
    const side = effectiveWinnerSide(m);
    if (!side) return null;
    return side === 'home' ? m.homeTeam : m.awayTeam;
  }
  function loserOf(m) {
    const side = effectiveWinnerSide(m);
    if (!side) return null;
    return side === 'home' ? m.awayTeam : m.homeTeam;
  }

  /* Alokasikan 8 peringkat-3 terbaik ke slot R32 sesuai tabel FIFA.
     Tiap slot 'T:XYZ' hanya menerima peringkat-3 dari grup pada himpunan XYZ.
     Dipecahkan sebagai pencocokan bipartit (backtracking) — selalu ada solusi
     valid untuk kombinasi 8-dari-12 mana pun. */
  function allocateThirds(koMatches, thirds) {
    const map = {};
    // kumpulkan slot 'T:...' dari bagan
    const slots = [];
    Object.keys(koMatches).forEach(function (id) {
      const m = koMatches[id];
      [m.home.ref, m.away.ref].forEach(function (ref) {
        if (/^T:/.test(ref) && slots.indexOf(ref) < 0) slots.push(ref);
      });
    });
    if (!slots.length) return map;

    const qualifying = thirds.slice(0, slots.length); // 8 peringkat-3 terbaik
    const groups = qualifying.map(function (r) { return r.group; });
    const teamOfGroup = {};
    qualifying.forEach(function (r) { teamOfGroup[r.group] = r.team; });

    // urutkan slot dari yang paling sedikit kandidat (lebih cepat konvergen)
    const order = slots.slice().sort(function (a, b) {
      return candCount(a, groups) - candCount(b, groups);
    });
    function candCount(slot, gs) {
      const allowed = slot.slice(2);
      return gs.filter(function (g) { return allowed.indexOf(g) >= 0; }).length;
    }

    const used = {};
    const pick = {};
    function bt(i) {
      if (i === order.length) return true;
      const slot = order[i];
      const allowed = slot.slice(2);
      for (let k = 0; k < groups.length; k++) {
        const g = groups[k];
        if (!used[g] && allowed.indexOf(g) >= 0) {
          used[g] = true; pick[slot] = g;
          if (bt(i + 1)) return true;
          used[g] = false; delete pick[slot];
        }
      }
      return false;
    }

    if (bt(0)) {
      slots.forEach(function (slot) {
        if (pick[slot]) map[slot] = teamOfGroup[pick[slot]];
      });
    }
    return map;
  }

  /* Isi homeTeam/awayTeam pada seluruh laga babak gugur sesuai hasil terkini.
     Dilakukan berulang sampai stabil (karena ada rantai ketergantungan). */
  function resolveBracket(state) {
    const tables = computeStandings(state.groupMatches);
    const thirds = rankThirdPlaced(tables);
    const groupDone = groupCompletion(state.groupMatches);
    const allGroupsDone = data.GROUP_KEYS.every(function (gk) { return groupDone[gk]; });
    const koIndex = {};
    state.koMatches.forEach(function (m) { koIndex[m.id] = m; });

    const thirdSlotMap = allGroupsDone ? allocateThirds(koIndex, thirds) : {};

    // beberapa iterasi untuk merambatkan pemenang ke ronde berikut
    for (let pass = 0; pass < 8; pass++) {
      const resolve = buildSlotResolver(tables, thirds, koIndex, groupDone, allGroupsDone, thirdSlotMap);
      state.koMatches.forEach(function (m) {
        const h = resolve(m.home.ref);
        const a = resolve(m.away.ref);
        m.homeTeam = h.team;
        m.awayTeam = a.team;
        m._homeLabel = h.label;
        m._awayLabel = a.label;
        m._homeProvisional = !!h.provisional;
        m._awayProvisional = !!a.provisional;
      });
    }

    return { tables: tables, thirds: thirds, thirdSlotMap: thirdSlotMap };
  }

  global.WC.engine = {
    computeStandings: computeStandings,
    rankThirdPlaced: rankThirdPlaced,
    groupStageComplete: groupStageComplete,
    groupCompletion: groupCompletion,
    resolveBracket: resolveBracket,
    winnerOf: winnerOf,
    loserOf: loserOf,
    effectiveWinnerSide: effectiveWinnerSide
  };

})(window);
