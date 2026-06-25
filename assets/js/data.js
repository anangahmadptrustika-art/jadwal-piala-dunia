/* =====================================================================
   DATA PIALA DUNIA 2026  (FIFA World Cup 2026 - USA / Canada / Mexico)
   ---------------------------------------------------------------------
   Format baru: 48 tim, 12 grup (A-L), 104 pertandingan.
   - Fase Grup        : 72 laga (11-27 Juni 2026)
   - Babak 32 Besar   : 16 laga
   - Babak 16 Besar   : 8 laga
   - Perempat Final   : 4 laga
   - Semifinal        : 2 laga
   - Perebutan Juara 3 : 1 laga
   - Final            : 1 laga
   Struktur jadwal/venue di-generate agar koheren & mudah disesuaikan.
   ===================================================================== */

(function (global) {
  'use strict';

  // 16 kota tuan rumah resmi (3 negara)
  const VENUES = [
    { city: 'Mexico City', stadium: 'Estadio Azteca', country: '🇲🇽' },
    { city: 'Guadalajara', stadium: 'Estadio Akron', country: '🇲🇽' },
    { city: 'Monterrey', stadium: 'Estadio BBVA', country: '🇲🇽' },
    { city: 'Toronto', stadium: 'BMO Field', country: '🇨🇦' },
    { city: 'Vancouver', stadium: 'BC Place', country: '🇨🇦' },
    { city: 'New York/NJ', stadium: 'MetLife Stadium', country: '🇺🇸' },
    { city: 'Los Angeles', stadium: 'SoFi Stadium', country: '🇺🇸' },
    { city: 'Dallas', stadium: 'AT&T Stadium', country: '🇺🇸' },
    { city: 'San Francisco', stadium: "Levi's Stadium", country: '🇺🇸' },
    { city: 'Miami', stadium: 'Hard Rock Stadium', country: '🇺🇸' },
    { city: 'Atlanta', stadium: 'Mercedes-Benz Stadium', country: '🇺🇸' },
    { city: 'Seattle', stadium: 'Lumen Field', country: '🇺🇸' },
    { city: 'Houston', stadium: 'NRG Stadium', country: '🇺🇸' },
    { city: 'Kansas City', stadium: 'Arrowhead Stadium', country: '🇺🇸' },
    { city: 'Philadelphia', stadium: 'Lincoln Financial Field', country: '🇺🇸' },
    { city: 'Boston', stadium: 'Gillette Stadium', country: '🇺🇸' }
  ];

  // 48 tim dalam 12 grup — hasil drawing resmi Piala Dunia 2026 (5 Des 2025).
  // Urutan posisi 1–4 mengikuti pot unggulan (Pot 1 → Pot 4).
  // Argumen: nama, kode 3-huruf, emoji bendera (fallback), kode ISO untuk gambar bendera.
  let GROUPS = {
    A: [t('Meksiko', 'MEX', '🇲🇽', 'mx'), t('Korea Selatan', 'KOR', '🇰🇷', 'kr'), t('Afrika Selatan', 'RSA', '🇿🇦', 'za'), t('Ceko', 'CZE', '🇨🇿', 'cz')],
    B: [t('Kanada', 'CAN', '🇨🇦', 'ca'), t('Swiss', 'SUI', '🇨🇭', 'ch'), t('Qatar', 'QAT', '🇶🇦', 'qa'), t('Bosnia-Herzegovina', 'BIH', '🇧🇦', 'ba')],
    C: [t('Brasil', 'BRA', '🇧🇷', 'br'), t('Maroko', 'MAR', '🇲🇦', 'ma'), t('Skotlandia', 'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'gb-sct'), t('Haiti', 'HAI', '🇭🇹', 'ht')],
    D: [t('Amerika Serikat', 'USA', '🇺🇸', 'us'), t('Australia', 'AUS', '🇦🇺', 'au'), t('Paraguay', 'PAR', '🇵🇾', 'py'), t('Turki', 'TUR', '🇹🇷', 'tr')],
    E: [t('Jerman', 'GER', '🇩🇪', 'de'), t('Ekuador', 'ECU', '🇪🇨', 'ec'), t('Pantai Gading', 'CIV', '🇨🇮', 'ci'), t('Curaçao', 'CUW', '🇨🇼', 'cw')],
    F: [t('Belanda', 'NED', '🇳🇱', 'nl'), t('Jepang', 'JPN', '🇯🇵', 'jp'), t('Tunisia', 'TUN', '🇹🇳', 'tn'), t('Swedia', 'SWE', '🇸🇪', 'se')],
    G: [t('Belgia', 'BEL', '🇧🇪', 'be'), t('Iran', 'IRN', '🇮🇷', 'ir'), t('Mesir', 'EGY', '🇪🇬', 'eg'), t('Selandia Baru', 'NZL', '🇳🇿', 'nz')],
    H: [t('Spanyol', 'ESP', '🇪🇸', 'es'), t('Uruguay', 'URU', '🇺🇾', 'uy'), t('Arab Saudi', 'KSA', '🇸🇦', 'sa'), t('Tanjung Verde', 'CPV', '🇨🇻', 'cv')],
    I: [t('Prancis', 'FRA', '🇫🇷', 'fr'), t('Senegal', 'SEN', '🇸🇳', 'sn'), t('Norwegia', 'NOR', '🇳🇴', 'no'), t('Irak', 'IRQ', '🇮🇶', 'iq')],
    J: [t('Argentina', 'ARG', '🇦🇷', 'ar'), t('Austria', 'AUT', '🇦🇹', 'at'), t('Aljazair', 'ALG', '🇩🇿', 'dz'), t('Yordania', 'JOR', '🇯🇴', 'jo')],
    K: [t('Portugal', 'POR', '🇵🇹', 'pt'), t('Kolombia', 'COL', '🇨🇴', 'co'), t('Uzbekistan', 'UZB', '🇺🇿', 'uz'), t('DR Kongo', 'COD', '🇨🇩', 'cd')],
    L: [t('Inggris', 'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'gb-eng'), t('Kroasia', 'CRO', '🇭🇷', 'hr'), t('Panama', 'PAN', '🇵🇦', 'pa'), t('Ghana', 'GHA', '🇬🇭', 'gh')]
  };

  function t(name, code, flag, iso) {
    return { name: name, code: code, flag: flag, iso: iso };
  }

  let GROUP_KEYS = Object.keys(GROUPS);

  // Mengganti komposisi grup saat data live tersedia (mis. dari TheSportsDB).
  function setGroups(obj) {
    GROUPS = obj;
    GROUP_KEYS = Object.keys(obj).sort();
    global.WC.data.GROUPS = GROUPS;
    global.WC.data.GROUP_KEYS = GROUP_KEYS;
  }

  // ---- Generator jadwal fase grup (round-robin 4 tim, 3 matchday) ----
  // Pola pertemuan klasik untuk indeks tim [0,1,2,3]
  const RR_ROUNDS = [
    [[0, 1], [2, 3]], // Matchday 1
    [[0, 2], [3, 1]], // Matchday 2
    [[0, 3], [1, 2]]  // Matchday 3
  ];

  const KICKOFFS = ['16:00', '19:00', '22:00', '02:00'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(month, day) { return '2026-' + pad(month) + '-' + pad(day); }

  function buildGroupMatches() {
    const matches = [];
    let mid = 1;
    let venueIdx = 0;

    // Sebar 3 matchday di rentang 11-27 Juni
    // MD1: 11-16, MD2: 17-22, MD3: 23-27 (tanggal kepastian fase grup)
    const mdDateBase = [
      { month: 6, startDay: 11 },
      { month: 6, startDay: 17 },
      { month: 6, startDay: 23 }
    ];

    RR_ROUNDS.forEach(function (round, mdIndex) {
      GROUP_KEYS.forEach(function (gk, gIdx) {
        const teams = GROUPS[gk];
        round.forEach(function (pair, pIdx) {
          const dayOffset = Math.floor((gIdx * 2 + pIdx) / 6); // sebar di beberapa hari
          const base = mdDateBase[mdIndex];
          const day = Math.min(base.startDay + dayOffset, base.startDay + 5);
          const venue = VENUES[venueIdx % VENUES.length];
          venueIdx++;

          matches.push({
            id: 'M' + pad(mid),
            no: mid,
            stage: 'group',
            group: gk,
            round: 'Matchday ' + (mdIndex + 1),
            home: { type: 'team', group: gk, idx: pair[0], ref: gk + (pair[0] + 1) },
            away: { type: 'team', group: gk, idx: pair[1], ref: gk + (pair[1] + 1) },
            homeTeam: teams[pair[0]],
            awayTeam: teams[pair[1]],
            date: dateStr(base.month, day),
            time: KICKOFFS[(mid - 1) % KICKOFFS.length],
            venue: venue,
            score: { home: null, away: null },
            status: 'scheduled', // scheduled | live | finished
            minute: 0
          });
          mid++;
        });
      });
    });

    return matches;
  }

  /* =================================================================
     STRUKTUR BABAK GUGUR
     Slot R32 dirujuk dari posisi grup:
       W{grup}  = juara grup
       R{grup}  = runner-up grup
       T1..T8   = 8 peringkat-3 terbaik (diurutkan otomatis)
     Babak berikut dirujuk dari pemenang/kalah laga sebelumnya:
       W#M73 = pemenang laga M73,  L#M101 = yang kalah di M101
     ================================================================= */
  function buildKnockoutMatches() {
    const ko = [];

    // --- Babak 32 Besar (M73-M88) ---
    const r32 = [
      ['WA', 'T1'], ['WB', 'T2'], ['WC', 'T3'], ['WD', 'T4'],
      ['WE', 'T5'], ['WF', 'T6'], ['WG', 'T7'], ['WH', 'T8'],
      ['WI', 'RA'], ['WJ', 'RB'], ['WK', 'RC'], ['WL', 'RD'],
      ['RE', 'RF'], ['RG', 'RH'], ['RI', 'RJ'], ['RK', 'RL']
    ];
    const r32Dates = [
      ['2026-06-28', '16:00'], ['2026-06-28', '20:00'],
      ['2026-06-29', '16:00'], ['2026-06-29', '20:00'],
      ['2026-06-30', '16:00'], ['2026-06-30', '20:00'],
      ['2026-07-01', '16:00'], ['2026-07-01', '20:00'],
      ['2026-07-02', '16:00'], ['2026-07-02', '20:00'],
      ['2026-07-03', '16:00'], ['2026-07-03', '20:00'],
      ['2026-07-03', '23:00'], ['2026-07-02', '23:00'],
      ['2026-07-01', '23:00'], ['2026-06-30', '23:00']
    ];
    r32.forEach(function (pair, i) {
      ko.push(koMatch('M' + (73 + i), 73 + i, 'r32', 'Babak 32 Besar',
        pair[0], pair[1], r32Dates[i][0], r32Dates[i][1], i));
    });

    // --- Babak 16 Besar (M89-M96) ---
    const r16Pairs = [
      ['W#M73', 'W#M74'], ['W#M75', 'W#M76'], ['W#M77', 'W#M78'], ['W#M79', 'W#M80'],
      ['W#M81', 'W#M82'], ['W#M83', 'W#M84'], ['W#M85', 'W#M86'], ['W#M87', 'W#M88']
    ];
    const r16Dates = [
      ['2026-07-04', '16:00'], ['2026-07-04', '20:00'],
      ['2026-07-05', '16:00'], ['2026-07-05', '20:00'],
      ['2026-07-06', '16:00'], ['2026-07-06', '20:00'],
      ['2026-07-07', '16:00'], ['2026-07-07', '20:00']
    ];
    r16Pairs.forEach(function (pair, i) {
      ko.push(koMatch('M' + (89 + i), 89 + i, 'r16', 'Babak 16 Besar',
        pair[0], pair[1], r16Dates[i][0], r16Dates[i][1], i));
    });

    // --- Perempat Final (M97-M100) ---
    const qfPairs = [
      ['W#M89', 'W#M90'], ['W#M91', 'W#M92'], ['W#M93', 'W#M94'], ['W#M95', 'W#M96']
    ];
    const qfDates = [
      ['2026-07-09', '16:00'], ['2026-07-09', '20:00'],
      ['2026-07-11', '16:00'], ['2026-07-11', '20:00']
    ];
    qfPairs.forEach(function (pair, i) {
      ko.push(koMatch('M' + (97 + i), 97 + i, 'qf', 'Perempat Final',
        pair[0], pair[1], qfDates[i][0], qfDates[i][1], i));
    });

    // --- Semifinal (M101-M102) ---
    ko.push(koMatch('M101', 101, 'sf', 'Semifinal', 'W#M97', 'W#M98', '2026-07-14', '20:00', 0));
    ko.push(koMatch('M102', 102, 'sf', 'Semifinal', 'W#M99', 'W#M100', '2026-07-15', '20:00', 1));

    // --- Perebutan Juara 3 (M103) ---
    ko.push(koMatch('M103', 103, 'third', 'Perebutan Juara 3', 'L#M101', 'L#M102', '2026-07-18', '20:00', 0));

    // --- Final (M104) ---
    ko.push(koMatch('M104', 104, 'final', 'Final', 'W#M101', 'W#M102', '2026-07-19', '20:00', 0));

    return ko;
  }

  function koMatch(id, no, stage, label, homeRef, awayRef, date, time, venueOffset) {
    return {
      id: id,
      no: no,
      stage: stage,
      round: label,
      home: { type: 'ref', ref: homeRef },
      away: { type: 'ref', ref: awayRef },
      homeTeam: null,
      awayTeam: null,
      date: date,
      time: time,
      venue: VENUES[(no + venueOffset) % VENUES.length],
      score: { home: null, away: null },
      penalties: { home: null, away: null },
      status: 'scheduled',
      minute: 0
    };
  }

  global.WC = global.WC || {};
  global.WC.data = {
    VENUES: VENUES,
    GROUPS: GROUPS,
    GROUP_KEYS: GROUP_KEYS,
    setGroups: setGroups,
    buildGroupMatches: buildGroupMatches,
    buildKnockoutMatches: buildKnockoutMatches
  };

})(window);
