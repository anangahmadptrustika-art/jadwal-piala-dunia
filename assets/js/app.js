/* =====================================================================
   APP  -  Rendering UI & interaksi
   Mendengarkan realtime engine dan menggambar ulang tampilan.
   ===================================================================== */

(function (global) {
  'use strict';

  const RT = global.WC.realtime;
  const DATA = global.WC.data;

  const STAGE_LABEL = {
    r32: 'Babak 32 Besar', r16: 'Babak 16 Besar',
    qf: 'Perempat Final', sf: 'Semifinal',
    third: 'Perebutan Juara 3', final: 'Final'
  };

  let activeTab = 'live';
  let scheduleFilter = 'all';
  let lastDerived = null;
  let adminOpen = false;

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // Gambar bendera asli dari flagcdn (tampil di semua perangkat, termasuk Windows
  // yang tidak punya font emoji bendera). Mendukung Inggris (gb-eng) & Skotlandia (gb-sct).
  function flagImg(team, cls) {
    if (!team || !team.iso) return '';
    return '<img class="flag ' + (cls || '') + '" src="https://flagcdn.com/' + team.iso +
      '.svg" alt="' + team.code + '" loading="lazy" decoding="async">';
  }
  function flagFromIso(iso, cls) {
    if (!iso) return '';
    return '<img class="flag ' + (cls || '') + '" src="https://flagcdn.com/' + iso +
      '.svg" alt="" loading="lazy" decoding="async">';
  }

  function teamCell(team, label, flip) {
    if (team) {
      const name = flagImg(team) + '<span class="t-name">' + team.name + '</span>';
      return '<span class="team' + (flip ? ' flip' : '') + '">' + name + '</span>';
    }
    return '<span class="team tbd' + (flip ? ' flip' : '') + '"><span class="t-name">' + (label || 'TBD') + '</span></span>';
  }

  function fmtDate(iso) {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const parts = iso.split('-');
    const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return days[d.getUTCDay()] + ', ' + (+parts[2]) + ' ' + months[+parts[1] - 1] + ' ' + parts[0];
  }

  function scoreOrTime(m) {
    if (m.status === 'finished' || m.status === 'live') {
      let s = '<b>' + (m.score.home == null ? 0 : m.score.home) + '</b> - <b>' + (m.score.away == null ? 0 : m.score.away) + '</b>';
      if (m.penalties && m.penalties.home != null && m.penalties.away != null) {
        s += '<span class="pens">(' + m.penalties.home + '-' + m.penalties.away + ' p)</span>';
      }
      return s;
    }
    return '<span class="ko-time">' + m.time + '</span>';
  }

  function statusBadge(m) {
    if (m.status === 'live') {
      return '<span class="badge live"><span class="dot"></span>LIVE ' + m.minute + "'</span>";
    }
    if (m.status === 'finished') return '<span class="badge ft">Selesai</span>';
    return '<span class="badge sched">' + fmtDate(m.date) + ' &middot; ' + m.time + '</span>';
  }

  /* ============================ LIVE / BERANDA ============================ */
  function renderLive(state, derived) {
    const root = el('div', 'view view-live');

    const live = RT.allMatches().filter(function (m) { return m.status === 'live'; });
    const today = RT.allMatches().filter(function (m) { return m.date === '2026-06-25' && m.status !== 'finished'; });
    const recent = RT.allMatches().filter(function (m) { return m.status === 'finished'; }).slice(-6).reverse();

    // Hero ringkasan turnamen
    const champ = derived ? winnerLabel(state) : null;
    const hero = el('div', 'hero');
    hero.innerHTML =
      '<div class="hero-grid">' +
        statCard('48', 'Tim') +
        statCard('12', 'Grup') +
        statCard('104', 'Laga') +
        statCard(String(countFinished()), 'Selesai') +
        statCard(String(live.length), 'Live', live.length ? 'accent' : '') +
        statCard(champ ? flagImg(champ, 'flag-stat') : '—', 'Juara', champ ? 'gold' : '') +
      '</div>';
    root.appendChild(hero);

    // Bagian LIVE
    const liveSec = el('section', 'section');
    liveSec.appendChild(sectionTitle('🔴 Sedang Berlangsung', live.length ? null : 'Tidak ada laga live saat ini'));
    if (live.length) {
      const grid = el('div', 'match-grid');
      live.forEach(function (m) { grid.appendChild(liveCard(m)); });
      liveSec.appendChild(grid);
    } else {
      const hint = el('div', 'empty-hint');
      hint.innerHTML = 'Aktifkan <b>Mode Live</b> di panel kontrol untuk melihat simulasi skor realtime menggerakkan klasemen &amp; bagan.';
      liveSec.appendChild(hint);
    }
    root.appendChild(liveSec);

    // Laga hari ini
    if (today.length) {
      const sec = el('section', 'section');
      sec.appendChild(sectionTitle('📅 Jadwal Hari Ini (25 Jun 2026)'));
      const grid = el('div', 'match-grid');
      today.forEach(function (m) { grid.appendChild(matchCard(m)); });
      sec.appendChild(grid);
      root.appendChild(sec);
    }

    // Hasil terbaru
    if (recent.length) {
      const sec = el('section', 'section');
      sec.appendChild(sectionTitle('✅ Hasil Terbaru'));
      const grid = el('div', 'match-grid');
      recent.forEach(function (m) { grid.appendChild(matchCard(m)); });
      sec.appendChild(grid);
      root.appendChild(sec);
    }

    return root;
  }

  function winnerLabel(state) {
    const finalM = RT.findMatch('M104');
    if (finalM && finalM.status === 'finished') {
      return global.WC.engine.winnerOf(finalM);
    }
    return null;
  }
  function countFinished() {
    return RT.allMatches().filter(function (m) { return m.status === 'finished'; }).length;
  }

  function statCard(value, label, mod) {
    return '<div class="stat ' + (mod || '') + '"><div class="stat-val">' + value + '</div><div class="stat-lbl">' + label + '</div></div>';
  }
  function sectionTitle(text, sub) {
    const e = el('div', 'section-title');
    e.innerHTML = '<h2>' + text + '</h2>' + (sub ? '<span class="sub">' + sub + '</span>' : '');
    return e;
  }

  function liveCard(m) {
    const card = el('div', 'match-card live');
    card.innerHTML =
      '<div class="mc-top"><span class="mc-stage">' + (m.group ? 'Grup ' + m.group : (STAGE_LABEL[m.stage] || '')) + '</span>' + statusBadge(m) + '</div>' +
      '<div class="mc-body">' +
        '<div class="mc-team home">' + teamCell(m.homeTeam, m._homeLabel) + '</div>' +
        '<div class="mc-score">' + scoreOrTime(m) + '</div>' +
        '<div class="mc-team away">' + teamCell(m.awayTeam, m._awayLabel, true) + '</div>' +
      '</div>' +
      '<div class="mc-foot">' + m.venue.stadium + ', ' + m.venue.city + ' ' + m.venue.country + '</div>';
    return card;
  }

  function matchCard(m) {
    const card = el('div', 'match-card' + (m.status === 'finished' ? ' done' : ''));
    card.innerHTML =
      '<div class="mc-top"><span class="mc-stage">' + (m.group ? 'Grup ' + m.group : (STAGE_LABEL[m.stage] || '')) + '</span>' + statusBadge(m) + '</div>' +
      '<div class="mc-body">' +
        '<div class="mc-team home">' + teamCell(m.homeTeam, m._homeLabel) + '</div>' +
        '<div class="mc-score">' + scoreOrTime(m) + '</div>' +
        '<div class="mc-team away">' + teamCell(m.awayTeam, m._awayLabel, true) + '</div>' +
      '</div>' +
      '<div class="mc-foot">' + m.venue.stadium + ', ' + m.venue.city + ' ' + m.venue.country + '</div>';
    return card;
  }

  /* ============================ JADWAL ============================ */
  function renderSchedule(state) {
    const root = el('div', 'view view-schedule');

    const filters = el('div', 'filters');
    const opts = [['all', 'Semua'], ['group', 'Fase Grup'], ['r32', '32 Besar'], ['r16', '16 Besar'],
                  ['qf', 'Perempat'], ['sf', 'Semifinal'], ['final', 'Final & Juara 3']];
    opts.forEach(function (o) {
      const b = el('button', 'chip' + (scheduleFilter === o[0] ? ' active' : ''), o[1]);
      b.onclick = function () { scheduleFilter = o[0]; rerender(); };
      filters.appendChild(b);
    });
    root.appendChild(filters);

    let matches = RT.allMatches();
    if (scheduleFilter === 'group') matches = matches.filter(function (m) { return m.stage === 'group'; });
    else if (scheduleFilter === 'final') matches = matches.filter(function (m) { return m.stage === 'final' || m.stage === 'third'; });
    else if (scheduleFilter !== 'all') matches = matches.filter(function (m) { return m.stage === scheduleFilter; });

    // kelompokkan per tanggal
    const byDate = {};
    matches.forEach(function (m) { (byDate[m.date] = byDate[m.date] || []).push(m); });
    const dates = Object.keys(byDate).sort();

    dates.forEach(function (d) {
      const day = el('div', 'day-group');
      day.appendChild(el('div', 'day-head', '<span>' + fmtDate(d) + '</span><span class="day-count">' + byDate[d].length + ' laga</span>'));
      const list = el('div', 'day-list');
      byDate[d].sort(function (a, b) { return a.time.localeCompare(b.time) || a.no - b.no; });
      byDate[d].forEach(function (m) { list.appendChild(scheduleRow(m)); });
      day.appendChild(list);
      root.appendChild(day);
    });

    if (!dates.length) root.appendChild(el('div', 'empty-hint', 'Tidak ada laga pada filter ini.'));
    return root;
  }

  function scheduleRow(m) {
    const row = el('div', 'sched-row ' + m.status);
    row.innerHTML =
      '<div class="sr-time"><span class="sr-clock">' + m.time + '</span><span class="sr-tag">' + (m.group ? 'Grup ' + m.group : (STAGE_LABEL[m.stage] || '')) + '</span></div>' +
      '<div class="sr-match">' +
        '<div class="sr-team">' + teamCell(m.homeTeam, m._homeLabel) + '</div>' +
        '<div class="sr-mid">' + scoreOrTime(m) + (m.status === 'live' ? '<span class="sr-live">LIVE ' + m.minute + "'</span>" : '') + '</div>' +
        '<div class="sr-team away">' + teamCell(m.awayTeam, m._awayLabel, true) + '</div>' +
      '</div>' +
      '<div class="sr-venue">' + m.venue.city + ' ' + m.venue.country + '</div>';
    return row;
  }

  /* ============================ KLASEMEN ============================ */
  function renderStandings(state, derived) {
    const root = el('div', 'view view-standings');
    const tables = derived.tables;

    const grid = el('div', 'groups-grid');
    DATA.GROUP_KEYS.forEach(function (gk) {
      const card = el('div', 'group-card');
      card.appendChild(el('div', 'group-head', 'Grup ' + gk));
      const tbl = el('table', 'std-table');
      tbl.innerHTML =
        '<thead><tr><th>#</th><th class="tl">Tim</th><th>M</th><th>M</th><th>S</th><th>K</th><th>SG</th><th>Poin</th></tr></thead>';
      const tb = el('tbody');
      tables[gk].forEach(function (r, i) {
        const qual = i < 2 ? 'q1' : (i === 2 ? 'q3' : '');
        const tr = el('tr', qual);
        tr.innerHTML =
          '<td class="pos">' + (i + 1) + '</td>' +
          '<td class="tl">' + flagImg(r.team) + r.team.name + '</td>' +
          '<td>' + r.P + '</td><td>' + r.W + '</td><td>' + r.D + '</td><td>' + r.L + '</td>' +
          '<td>' + (r.GD > 0 ? '+' : '') + r.GD + '</td>' +
          '<td class="pts">' + r.Pts + '</td>';
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      card.appendChild(tbl);
      grid.appendChild(card);
    });
    root.appendChild(grid);

    // Peringkat 3 terbaik
    const third = el('div', 'thirds-card');
    third.appendChild(el('div', 'group-head', 'Peringkat 3 Terbaik (8 lolos)'));
    const tt = el('table', 'std-table');
    tt.innerHTML = '<thead><tr><th>#</th><th class="tl">Tim</th><th>Grup</th><th>M</th><th>SG</th><th>Poin</th><th>Status</th></tr></thead>';
    const ttb = el('tbody');
    derived.thirds.forEach(function (r, i) {
      const tr = el('tr', i < 8 ? 'q3' : 'out');
      tr.innerHTML =
        '<td class="pos">' + (i + 1) + '</td>' +
        '<td class="tl">' + flagImg(r.team) + r.team.name + '</td>' +
        '<td>' + r.group + '</td><td>' + r.P + '</td>' +
        '<td>' + (r.GD > 0 ? '+' : '') + r.GD + '</td><td class="pts">' + r.Pts + '</td>' +
        '<td>' + (i < 8 ? '<span class="ok">Lolos</span>' : '<span class="no">Gugur</span>') + '</td>';
      ttb.appendChild(tr);
    });
    tt.appendChild(ttb);
    third.appendChild(tt);
    root.appendChild(third);

    return root;
  }

  /* ============================ BAGAN (dua sisi) ============================ */
  function renderBracket(state) {
    const root = el('div', 'view view-bracket');

    const champ = winnerLabel(state);
    if (champ) {
      const banner = el('div', 'champ-banner');
      banner.innerHTML = '<div class="champ-trophy">🏆</div><div class="champ-text"><div class="champ-lbl">JUARA DUNIA 2026</div><div class="champ-team">' + flagImg(champ, 'flag-lg') + ' ' + champ.name + '</div></div>';
      root.appendChild(banner);
    }

    root.appendChild(el('div', 'bracket-note',
      'Bagan dua sisi (kiri &amp; kanan) yang bertemu di Final tengah. Terisi &amp; memperbarui diri otomatis mengikuti hasil laga secara realtime — geser horizontal bila perlu.'));

    const ko = {};
    state.koMatches.forEach(function (m) { ko[m.id] = m; });

    const wrap = el('div', 'bracket-wrap');
    const board = el('div', 'bracket2');

    // --- Sisi kiri: r32(73-80) -> r16(89-92) -> qf(97-98) -> sf(101) ---
    const left = el('div', 'bk-side left');
    left.appendChild(bkCol('32 Besar', 'r32', range(73, 80), ko, 'left', false));
    left.appendChild(bkCol('16 Besar', 'r16', range(89, 92), ko, 'left', true));
    left.appendChild(bkCol('Perempat', 'qf', range(97, 98), ko, 'left', true));
    left.appendChild(bkCol('Semifinal', 'sf', [101], ko, 'left', true));

    // --- Tengah: Final + Juara + Perebutan Juara 3 ---
    const center = el('div', 'bk-center');
    center.appendChild(el('div', 'bk-col-title center-title', '🏆 Final'));
    const cbody = el('div', 'bk-center-body');
    cbody.appendChild(finalTie(ko['M104'], false));
    const cm = el('div', 'champ-mini');
    if (champ) {
      cm.innerHTML = '<div class="cm-trophy">🏆</div><div class="cm-flag">' + flagImg(champ, 'flag-xl') + '</div><div class="cm-name">' + champ.name + '</div><div class="cm-lbl">Juara Dunia 2026</div>';
    } else {
      cm.innerHTML = '<div class="cm-trophy dim">🏆</div><div class="cm-lbl dim">Menanti sang juara…</div>';
    }
    cbody.appendChild(cm);
    cbody.appendChild(el('div', 'third-title', '🥉 Perebutan Juara 3'));
    cbody.appendChild(finalTie(ko['M103'], true));
    center.appendChild(cbody);

    // --- Sisi kanan: sf(102) <- qf(99-100) <- r16(93-96) <- r32(81-88) ---
    const right = el('div', 'bk-side right');
    right.appendChild(bkCol('Semifinal', 'sf', [102], ko, 'right', true));
    right.appendChild(bkCol('Perempat', 'qf', range(99, 100), ko, 'right', true));
    right.appendChild(bkCol('16 Besar', 'r16', range(93, 96), ko, 'right', true));
    right.appendChild(bkCol('32 Besar', 'r32', range(81, 88), ko, 'right', false));

    board.appendChild(left);
    board.appendChild(center);
    board.appendChild(right);
    wrap.appendChild(board);
    root.appendChild(wrap);

    return root;
  }

  function bkCol(title, key, idList, ko, side, recv) {
    const col = el('div', 'bk-col bk-' + key + (recv ? ' recv' : ''));
    col.appendChild(el('div', 'bk-col-title', title));
    const body = el('div', 'bk-col-body');
    idList.forEach(function (n) {
      const slot = el('div', 'bk-slot');
      slot.appendChild(bracketTie(ko['M' + n], side));
      body.appendChild(slot);
    });
    col.appendChild(body);
    return col;
  }

  function bracketTie(m, side) {
    if (!m) return el('div', 'br-tie');
    const tie = el('div', 'br-tie ' + m.status + (side === 'right' ? ' rt' : ''));
    const winSide = global.WC.engine.effectiveWinnerSide(m);
    tie.innerHTML =
      '<div class="bt-no">' + m.id + ' &middot; ' + shortDate(m.date) + '</div>' +
      btRow(m, 'home', winSide === 'home', side) +
      btRow(m, 'away', winSide === 'away', side) +
      (m.status === 'live' ? '<div class="bt-live">LIVE ' + m.minute + "'</div>" : '');
    return tie;
  }

  // Bendera kandidat untuk slot yang belum pasti (mis. semua tim Grup A).
  function refFlags(ref) {
    if (/^[WR][A-L]$/.test(ref)) {
      return DATA.GROUPS[ref[1]].map(function (t) { return t.iso; });
    }
    return null;
  }
  function flagStrip(isoList) {
    return isoList.map(function (iso) { return flagFromIso(iso, 'flag-xs'); }).join('');
  }

  // Label ringkas untuk slot bagan yang belum terisi.
  function slotLabel(ref, fullLabel) {
    if (/^W[A-L]$/.test(ref)) return 'Juara ' + ref[1];
    if (/^R[A-L]$/.test(ref)) return 'Ke-2 ' + ref[1];
    if (/^T[1-8]$/.test(ref)) return 'Pos-3 #' + ref[1];
    return fullLabel || 'TBD';
  }

  function btRow(m, sideKey, isWin, side) {
    const team = sideKey === 'home' ? m.homeTeam : m.awayTeam;
    const label = sideKey === 'home' ? m._homeLabel : m._awayLabel;
    const ref = sideKey === 'home' ? m.home.ref : m.away.ref;
    let sc = '';
    if (m.status === 'finished' || m.status === 'live') {
      sc = m.score[sideKey] == null ? 0 : m.score[sideKey];
      if (m.penalties && m.penalties[sideKey] != null) sc += ' <small>(' + m.penalties[sideKey] + ')</small>';
    }
    let nameHtml;
    if (team) {
      nameHtml = '<span class="bt-id">' + flagImg(team) + '<span class="bt-name">' + team.name + '</span></span>';
    } else {
      const flags = refFlags(ref);
      const strip = flags ? '<span class="bt-flags">' + flagStrip(flags) + '</span>' : '';
      nameHtml = '<span class="bt-id">' + strip + '<span class="bt-name tbd">' + slotLabel(ref, label) + '</span></span>';
    }
    return '<div class="bt-row' + (isWin ? ' win' : '') + '">' + nameHtml + '<span class="bt-score">' + sc + '</span></div>';
  }

  // Kartu Final / Perebutan Juara 3 di tengah bagan.
  function finalTie(m, isThird) {
    const c = el('div', 'final-tie' + (isThird ? ' third' : ''));
    if (!m) return c;
    const winSide = global.WC.engine.effectiveWinnerSide(m);
    c.innerHTML =
      '<div class="ft-head">' + m.id + ' &middot; ' + shortDate(m.date) + ' &middot; ' + m.venue.city + '</div>' +
      ftRow(m, 'home', winSide === 'home') +
      '<div class="ft-vs">' + (m.status === 'scheduled' ? m.time : 'vs') + '</div>' +
      ftRow(m, 'away', winSide === 'away') +
      (m.status === 'live' ? '<div class="bt-live">LIVE ' + m.minute + "'</div>" : '');
    return c;
  }

  function ftRow(m, sideKey, isWin) {
    const team = sideKey === 'home' ? m.homeTeam : m.awayTeam;
    const label = sideKey === 'home' ? m._homeLabel : m._awayLabel;
    const ref = sideKey === 'home' ? m.home.ref : m.away.ref;
    let sc = '';
    if (m.status === 'finished' || m.status === 'live') {
      sc = m.score[sideKey] == null ? 0 : m.score[sideKey];
      if (m.penalties && m.penalties[sideKey] != null) sc += ' <small>(' + m.penalties[sideKey] + 'p)</small>';
    }
    let nameHtml;
    if (team) {
      nameHtml = flagImg(team) + ' ' + team.name;
    } else {
      const flags = refFlags(ref);
      nameHtml = (flags ? '<span class="bt-flags">' + flagStrip(flags) + '</span> ' : '') + '<span class="tbd">' + slotLabel(ref, label) + '</span>';
    }
    return '<div class="ft-row' + (isWin ? ' win' : '') + '"><span class="ft-team">' + nameHtml + '</span><span class="ft-score">' + sc + '</span></div>';
  }

  function shortDate(iso) {
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const p = iso.split('-');
    return (+p[2]) + ' ' + mo[+p[1] - 1];
  }

  function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

  /* ============================ PANEL KONTROL (ADMIN) ============================ */
  function renderAdmin(state) {
    const panel = $('#admin-panel');
    if (!panel) return;
    panel.classList.toggle('open', adminOpen);

    const simOn = RT.isSimulating();
    $('#sim-toggle').textContent = simOn ? '⏸ Hentikan Mode Live' : '▶ Mulai Mode Live';
    $('#sim-toggle').classList.toggle('on', simOn);

    // daftar laga yang bisa diatur (live + scheduled siap)
    const listWrap = $('#admin-matches');
    listWrap.innerHTML = '';

    const editable = RT.allMatches().filter(function (m) {
      if (m.stage === 'group') return true;
      return m.homeTeam && m.awayTeam; // KO hanya jika tim sudah jelas
    });

    // tampilkan yang live & terdekat dulu
    editable.sort(function (a, b) {
      const order = { live: 0, scheduled: 1, finished: 2 };
      return (order[a.status] - order[b.status]) || a.no - b.no;
    });

    editable.slice(0, 60).forEach(function (m) {
      listWrap.appendChild(adminRow(m));
    });
  }

  function adminRow(m) {
    const row = el('div', 'adm-row ' + m.status);
    const hName = m.homeTeam ? flagImg(m.homeTeam, 'flag-xs') + ' ' + m.homeTeam.code : (m._homeLabel || 'TBD');
    const aName = m.awayTeam ? m.awayTeam.code + ' ' + flagImg(m.awayTeam, 'flag-xs') : (m._awayLabel || 'TBD');

    row.innerHTML =
      '<div class="adm-info"><span class="adm-id">' + m.id + '</span> ' +
        (m.group ? 'Grup ' + m.group : STAGE_LABEL[m.stage]) +
        ' <span class="adm-status ' + m.status + '">' + (m.status === 'live' ? 'LIVE ' + m.minute + "'" : m.status) + '</span></div>' +
      '<div class="adm-controls">' +
        '<span class="adm-team">' + hName + '</span>' +
        '<button class="adm-btn" data-act="dec" data-side="home">−</button>' +
        '<span class="adm-sc">' + (m.score.home == null ? 0 : m.score.home) + '</span>' +
        '<button class="adm-btn" data-act="inc" data-side="home">+</button>' +
        '<span class="adm-vs">:</span>' +
        '<button class="adm-btn" data-act="dec" data-side="away">−</button>' +
        '<span class="adm-sc">' + (m.score.away == null ? 0 : m.score.away) + '</span>' +
        '<button class="adm-btn" data-act="inc" data-side="away">+</button>' +
        '<span class="adm-team">' + aName + '</span>' +
      '</div>' +
      '<div class="adm-actions">' +
        '<button class="adm-mini" data-act="live">Live</button>' +
        '<button class="adm-mini" data-act="finish">Selesai</button>' +
        '<button class="adm-mini" data-act="reset">Reset</button>' +
      '</div>';

    row.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const side = btn.getAttribute('data-side');
      if (act === 'inc') RT.adjustScore(m.id, side, 1);
      else if (act === 'dec') RT.adjustScore(m.id, side, -1);
      else if (act === 'live') RT.setStatus(m.id, 'live');
      else if (act === 'finish') RT.setStatus(m.id, 'finished');
      else if (act === 'reset') RT.setStatus(m.id, 'scheduled');
    });

    return row;
  }

  /* ============================ KERANGKA / RE-RENDER ============================ */
  function rerender() {
    const state = RT.getState();
    const derived = lastDerived || global.WC.engine.resolveBracket(state);
    const mount = $('#view-mount');
    mount.innerHTML = '';
    let view;
    if (activeTab === 'live') view = renderLive(state, derived);
    else if (activeTab === 'schedule') view = renderSchedule(state);
    else if (activeTab === 'standings') view = renderStandings(state, derived);
    else if (activeTab === 'bracket') view = renderBracket(state);
    mount.appendChild(view);

    $$('.nav-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === activeTab);
    });

    renderAdmin(state);
    updateStatusBar(state);
  }

  function updateStatusBar(state) {
    const live = RT.allMatches().filter(function (m) { return m.status === 'live'; }).length;
    const bar = $('#status-bar');
    if (!bar) return;
    const dot = live ? '<span class="rt-dot on"></span>' : '<span class="rt-dot"></span>';
    const ts = new Date(state.updatedAt);
    const hh = ('0' + ts.getHours()).slice(-2) + ':' + ('0' + ts.getMinutes()).slice(-2) + ':' + ('0' + ts.getSeconds()).slice(-2);
    bar.innerHTML = dot + (live ? live + ' laga LIVE' : 'Realtime aktif') +
      ' <span class="rt-sep">·</span> sinkron ' + hh +
      (RT.isSimulating() ? ' <span class="rt-sep">·</span> <span class="rt-sim">SIMULASI</span>' : '');
  }

  /* ============================ INIT ============================ */
  function bindChrome() {
    $$('.nav-tab').forEach(function (t) {
      t.onclick = function () { activeTab = t.getAttribute('data-tab'); rerender(); };
    });

    $('#admin-fab').onclick = function () { adminOpen = !adminOpen; rerender(); };
    $('#admin-close').onclick = function () { adminOpen = false; rerender(); };

    $('#sim-toggle').onclick = function () {
      if (RT.isSimulating()) RT.stopSimulator();
      else RT.startSimulator(parseInt($('#sim-speed').value, 10) || 5);
    };
    $('#sim-speed').onchange = function () {
      RT.setSimSpeed(parseInt(this.value, 10) || 1);
      $('#sim-speed-val').textContent = this.value + '×';
    };
    $('#reset-all').onclick = function () {
      if (confirm('Reset semua hasil ke jadwal awal?')) RT.resetAll();
    };
  }

  function start() {
    RT.subscribe(function (state, derived, reason) {
      lastDerived = derived;
      rerender();
    });
    bindChrome();
    RT.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window);
