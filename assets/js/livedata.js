/* =====================================================================
   LIVE DATA — menarik data nyata Piala Dunia 2026 dari /api/wc (TheSportsDB)
   lalu memasukkannya ke engine secara realtime (polling).

   Aman: bila API gagal / data belum lengkap, aplikasi tetap memakai data
   bawaan (fallback) dan menampilkan status sumber data.
   ===================================================================== */

(function (global) {
  'use strict';

  const POLL_MS = 30000;
  let timer = null;
  let lastSig = '';

  /* Peta nama negara (Inggris, dari TheSportsDB) -> tampilan Indonesia + kode + ISO bendera. */
  const MAP = {
    'mexico': ['Meksiko', 'MEX', 'mx'],
    'canada': ['Kanada', 'CAN', 'ca'],
    'united states': ['Amerika Serikat', 'USA', 'us'], 'usa': ['Amerika Serikat', 'USA', 'us'],
    'argentina': ['Argentina', 'ARG', 'ar'],
    'brazil': ['Brasil', 'BRA', 'br'],
    'france': ['Prancis', 'FRA', 'fr'],
    'england': ['Inggris', 'ENG', 'gb-eng'],
    'spain': ['Spanyol', 'ESP', 'es'],
    'portugal': ['Portugal', 'POR', 'pt'],
    'netherlands': ['Belanda', 'NED', 'nl'],
    'belgium': ['Belgia', 'BEL', 'be'],
    'germany': ['Jerman', 'GER', 'de'],
    'croatia': ['Kroasia', 'CRO', 'hr'],
    'morocco': ['Maroko', 'MAR', 'ma'],
    'colombia': ['Kolombia', 'COL', 'co'],
    'uruguay': ['Uruguay', 'URU', 'uy'],
    'switzerland': ['Swiss', 'SUI', 'ch'],
    'japan': ['Jepang', 'JPN', 'jp'],
    'senegal': ['Senegal', 'SEN', 'sn'],
    'iran': ['Iran', 'IRN', 'ir'], 'ir iran': ['Iran', 'IRN', 'ir'],
    'south korea': ['Korea Selatan', 'KOR', 'kr'], 'korea republic': ['Korea Selatan', 'KOR', 'kr'],
    'ecuador': ['Ekuador', 'ECU', 'ec'],
    'austria': ['Austria', 'AUT', 'at'],
    'australia': ['Australia', 'AUS', 'au'],
    'norway': ['Norwegia', 'NOR', 'no'],
    'panama': ['Panama', 'PAN', 'pa'],
    'egypt': ['Mesir', 'EGY', 'eg'],
    'algeria': ['Aljazair', 'ALG', 'dz'],
    'scotland': ['Skotlandia', 'SCO', 'gb-sct'],
    'paraguay': ['Paraguay', 'PAR', 'py'],
    'tunisia': ['Tunisia', 'TUN', 'tn'],
    'ivory coast': ['Pantai Gading', 'CIV', 'ci'], "cote d'ivoire": ['Pantai Gading', 'CIV', 'ci'], 'cote divoire': ['Pantai Gading', 'CIV', 'ci'],
    'uzbekistan': ['Uzbekistan', 'UZB', 'uz'],
    'qatar': ['Qatar', 'QAT', 'qa'],
    'saudi arabia': ['Arab Saudi', 'KSA', 'sa'],
    'south africa': ['Afrika Selatan', 'RSA', 'za'],
    'jordan': ['Yordania', 'JOR', 'jo'],
    'costa rica': ['Kosta Rika', 'CRC', 'cr'],
    'cape verde': ['Tanjung Verde', 'CPV', 'cv'], 'cabo verde': ['Tanjung Verde', 'CPV', 'cv'],
    'ghana': ['Ghana', 'GHA', 'gh'],
    'curacao': ['Curaçao', 'CUW', 'cw'],
    'haiti': ['Haiti', 'HAI', 'ht'],
    'new zealand': ['Selandia Baru', 'NZL', 'nz'],
    'czechia': ['Ceko', 'CZE', 'cz'], 'czech republic': ['Ceko', 'CZE', 'cz'],
    'bosnia and herzegovina': ['Bosnia-Herzegovina', 'BIH', 'ba'], 'bosnia': ['Bosnia-Herzegovina', 'BIH', 'ba'],
    'turkey': ['Turki', 'TUR', 'tr'], 'turkiye': ['Turki', 'TUR', 'tr'],
    'dr congo': ['DR Kongo', 'COD', 'cd'], 'congo dr': ['DR Kongo', 'COD', 'cd'], 'democratic republic of congo': ['DR Kongo', 'COD', 'cd'],
    'italy': ['Italia', 'ITA', 'it'],
    'poland': ['Polandia', 'POL', 'pl'],
    'nigeria': ['Nigeria', 'NGA', 'ng'],
    'cameroon': ['Kamerun', 'CMR', 'cm'],
    'denmark': ['Denmark', 'DEN', 'dk'],
    'ukraine': ['Ukraina', 'UKR', 'ua'],
    'sweden': ['Swedia', 'SWE', 'se'],
    'albania': ['Albania', 'ALB', 'al'],
    'romania': ['Rumania', 'ROU', 'ro'],
    'slovakia': ['Slovakia', 'SVK', 'sk'],
    'kosovo': ['Kosovo', 'KVX', 'xk'],
    'north macedonia': ['Makedonia Utara', 'MKD', 'mk'],
    'wales': ['Wales', 'WAL', 'gb-wls'],
    'republic of ireland': ['Irlandia', 'IRL', 'ie'], 'ireland': ['Irlandia', 'IRL', 'ie'],
    'bolivia': ['Bolivia', 'BOL', 'bo'],
    'peru': ['Peru', 'PER', 'pe'],
    'iraq': ['Irak', 'IRQ', 'iq'],
    'united arab emirates': ['Uni Emirat Arab', 'UAE', 'ae'],
    'suriname': ['Suriname', 'SUR', 'sr'],
    'jamaica': ['Jamaika', 'JAM', 'jm'],
    'venezuela': ['Venezuela', 'VEN', 've'],
    'chile': ['Cile', 'CHI', 'cl'],
    'nigeria republic': ['Nigeria', 'NGA', 'ng']
  };

  function normKey(name) {
    let s = (name || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* abaikan */ }
    return s.replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  }

  function teamFromName(name) {
    const key = normKey(name);
    const hit = MAP[key];
    if (hit) return { name: hit[0], code: hit[1], iso: hit[2], flag: '' };
    // fallback: pakai nama asli + kode 3 huruf, tanpa ISO (bendera turun ke teks kode)
    const code = (name || 'TBD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TBD';
    return { name: name || 'TBD', code: code, iso: '', flag: '' };
  }

  function setStatus(ok, label, detail) {
    const el = document.getElementById('data-source');
    if (el) {
      el.className = 'data-source ' + (ok ? 'live' : 'sample');
      el.innerHTML = (ok ? '🟢 ' : '🟡 ') + label + (detail ? ' <span class="ds-detail">' + detail + '</span>' : '');
    }
    global.WC.liveStatus = { ok: ok, label: label, detail: detail };
  }

  async function pull() {
    try {
      const r = await fetch('/api/wc', { cache: 'no-store' });
      const data = await r.json();
      if (!data || !data.ok || !data.matches || !data.matches.length) {
        setStatus(false, 'Data contoh', 'API live belum tersedia');
        return;
      }
      ingest(data);
    } catch (e) {
      setStatus(false, 'Data contoh', 'gagal menghubungi API');
    }
  }

  function ingest(data) {
    const matches = data.matches;

    // Kumpulkan tim per grup
    const groupTeams = {};
    matches.forEach(function (m) {
      if (m.stage !== 'group' || !m.group || !/^[A-L]$/.test(m.group)) return;
      const g = (groupTeams[m.group] = groupTeams[m.group] || {});
      if (m.home) g[m.home] = true;
      if (m.away) g[m.away] = true;
    });

    const letters = Object.keys(groupTeams).sort();
    const complete = letters.filter(function (g) { return Object.keys(groupTeams[g]).length === 4; });

    // Butuh 12 grup lengkap (4 tim) untuk beralih ke data live secara utuh.
    if (complete.length < 12) {
      setStatus(false, 'Data contoh', 'data live ' + complete.length + '/12 grup — menunggu lengkap');
      return;
    }

    // Bangun GROUPS + indeks tim
    const GROUPS = {};
    const idxOf = {};
    letters.forEach(function (g) {
      const names = Object.keys(groupTeams[g]).sort();
      GROUPS[g] = names.map(function (n, i) {
        idxOf[g + '|' + n] = i;
        return teamFromName(n);
      });
    });

    // Bangun pertandingan grup dari data live
    const groupMatches = [];
    let no = 1;
    matches.forEach(function (m) {
      if (m.stage !== 'group' || !/^[A-L]$/.test(m.group || '')) return;
      const hi = idxOf[m.group + '|' + m.home];
      const ai = idxOf[m.group + '|' + m.away];
      if (hi == null || ai == null) return;
      groupMatches.push({
        id: 'L' + m.id, no: no++, stage: 'group', group: m.group,
        round: m.round || 'Grup',
        home: { type: 'team', group: m.group, idx: hi, ref: m.group + (hi + 1) },
        away: { type: 'team', group: m.group, idx: ai, ref: m.group + (ai + 1) },
        homeTeam: GROUPS[m.group][hi], awayTeam: GROUPS[m.group][ai],
        date: m.date, time: m.time || '',
        venue: { stadium: m.venue || '', city: '', country: '' },
        score: { home: m.homeScore, away: m.awayScore },
        status: m.status, minute: m.minute || 0
      });
    });

    // Babak gugur: turunkan otomatis dari klasemen nyata (struktur bagan bawaan)
    const koMatches = global.WC.data.buildKnockoutMatches();

    global.WC.realtime.ingestLive(GROUPS, groupMatches, koMatches, data.source || 'Live');

    // hindari render berulang bila tidak ada perubahan
    const sig = JSON.stringify(matches.map(function (m) {
      return m.id + ':' + m.homeScore + ':' + m.awayScore + ':' + m.status + ':' + m.minute;
    }));
    lastSig = sig;

    const liveCount = matches.filter(function (m) { return m.status === 'live'; }).length;
    setStatus(true, 'Data Live • ' + (data.source || 'API'),
      data.count + ' laga' + (liveCount ? ' · ' + liveCount + ' LIVE' : ''));
  }

  function start() {
    setStatus(false, 'Menghubungkan…', 'mengambil data live');
    pull();
    if (timer) clearInterval(timer);
    timer = setInterval(pull, POLL_MS);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  global.WC = global.WC || {};
  global.WC.livedata = { start: start, stop: stop, refresh: pull };

})(window);
