/* =====================================================================
   Vercel Serverless Function — /api/wc
   Mengambil data Piala Dunia 2026 (server-side, bebas CORS) lalu
   menormalkannya menjadi JSON ringkas untuk front-end.

   Sumber data (otomatis pilih yang tersedia):
   1) football-data.org  — bila FOOTBALL_DATA_KEY diisi (DISARANKAN; gratis,
      tier-nya mencakup kompetisi "WC", skor & klasemen live).
   2) TheSportsDB        — fallback bila tidak ada kunci.

   Environment Variables:
     FOOTBALL_DATA_KEY     token gratis dari football-data.org  (utama)
     FOOTBALL_DATA_COMP    default "WC"
     FOOTBALL_DATA_SEASON  default "2026"
     SPORTSDB_KEY/LEAGUE/SEASON  konfigurasi fallback TheSportsDB
   ===================================================================== */

const FD_KEY = process.env.FOOTBALL_DATA_KEY || process.env.FD_KEY || '';
const FD_COMP = process.env.FOOTBALL_DATA_COMP || 'WC';
const FD_SEASON = process.env.FOOTBALL_DATA_SEASON || '2026';

const SDB_KEY = process.env.SPORTSDB_KEY || '3';
const SDB_LEAGUE = process.env.SPORTSDB_LEAGUE || '4429';
const SDB_SEASON = process.env.SPORTSDB_SEASON || '2026';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const result = FD_KEY ? await fromFootballData() : await fromSportsDB();
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json(result);
  } catch (e) {
    res.status(200).json({
      ok: false,
      source: FD_KEY ? 'football-data.org' : 'TheSportsDB',
      error: String((e && e.message) || e),
      hint: FD_KEY
        ? 'Periksa token FOOTBALL_DATA_KEY / FOOTBALL_DATA_SEASON, atau batas rate (10 req/menit).'
        : 'Isi FOOTBALL_DATA_KEY untuk data live, atau sesuaikan SPORTSDB_LEAGUE/SEASON.',
      matches: []
    });
  }
};

/* ----------------------- football-data.org ----------------------- */
async function fromFootballData() {
  const url = 'https://api.football-data.org/v4/competitions/' + FD_COMP +
    '/matches?season=' + encodeURIComponent(FD_SEASON);
  const r = await fetch(url, { headers: { 'X-Auth-Token': FD_KEY } });
  if (!r.ok) throw new Error('football-data HTTP ' + r.status);
  const j = await r.json();
  const matches = (j.matches || []).map(normFD);
  const groups = {};
  matches.forEach(function (m) { if (m.group) groups[m.group] = true; });
  return {
    ok: matches.length > 0,
    source: 'football-data.org',
    comp: FD_COMP, season: FD_SEASON,
    groupsFound: Object.keys(groups).sort(),
    count: matches.length,
    updatedAt: Date.now(),
    matches: matches
  };
}

function normFD(m) {
  const stage = (m.stage === 'GROUP_STAGE') ? 'group' : 'ko';
  const grp = m.group ? String(m.group).replace(/group[_ ]?/i, '').trim().toUpperCase() : null;
  const ft = (m.score && m.score.fullTime) || {};
  const hs = (ft.home == null) ? null : ft.home;
  const as = (ft.away == null) ? null : ft.away;
  const st = (m.status || '').toUpperCase();
  let status = 'scheduled', minute = 0;
  if (st === 'FINISHED' || st === 'AWARDED') status = 'finished';
  else if (st === 'IN_PLAY' || st === 'PAUSED' || st === 'LIVE' || st === 'SUSPENDED') {
    status = 'live'; minute = parseInt(m.minute, 10) || 0;
  }
  const wib = utcToWIB(m.utcDate);
  return {
    id: 'FD' + m.id,
    stage: stage,
    group: stage === 'group' ? grp : null,
    round: m.stage || '',
    home: teamName(m.homeTeam),
    away: teamName(m.awayTeam),
    homeScore: hs,
    awayScore: as,
    date: wib.date,
    time: wib.time,
    tz: 'WIB',
    venue: m.venue || '',
    status: status,
    minute: minute,
    raw: st
  };
}

function teamName(t) {
  if (!t) return '';
  return t.name || t.shortName || t.tla || '';
}

function utcToWIB(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const w = new Date(d.getTime() + 7 * 3600 * 1000); // WIB = UTC+7
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return {
    date: w.getUTCFullYear() + '-' + pad(w.getUTCMonth() + 1) + '-' + pad(w.getUTCDate()),
    time: pad(w.getUTCHours()) + ':' + pad(w.getUTCMinutes())
  };
}

/* --------------------------- TheSportsDB --------------------------- */
async function fromSportsDB() {
  const url = 'https://www.thesportsdb.com/api/v1/json/' + SDB_KEY +
    '/eventsseason.php?id=' + SDB_LEAGUE + '&s=' + encodeURIComponent(SDB_SEASON);
  const r = await fetch(url, { headers: { 'User-Agent': 'wc2026-app/1.0' } });
  if (!r.ok) throw new Error('upstream HTTP ' + r.status);
  const j = await r.json();
  const events = (j && j.events) || [];
  const matches = events.map(normSDB);
  const groups = {};
  matches.forEach(function (m) { if (m.group) groups[m.group] = true; });
  return {
    ok: matches.length > 0,
    source: 'TheSportsDB',
    league: SDB_LEAGUE, season: SDB_SEASON,
    groupsFound: Object.keys(groups).sort(),
    count: matches.length,
    updatedAt: Date.now(),
    matches: matches
  };
}

function num(v) {
  return (v === null || v === undefined || v === '') ? null : parseInt(v, 10);
}

function normSDB(e) {
  const grpRaw = (e.strGroup || '').trim();
  const isGroup = /group/i.test(grpRaw);
  const hs = num(e.intHomeScore);
  const as = num(e.intAwayScore);
  const raw = (e.strStatus || '').trim();
  const prog = (e.strProgress || '').trim();
  const rawLow = raw.toLowerCase();

  const finished = ['match finished', 'ft', 'aet', 'after extra time', 'ap', 'pen', 'finished'];
  const live = ['1h', '2h', 'ht', 'et', 'bt', 'p', 'live', 'in play'];

  let status = 'scheduled', minute = 0;
  if (finished.indexOf(rawLow) >= 0) {
    status = 'finished';
  } else if (live.indexOf(rawLow) >= 0) {
    status = 'live';
    const mm = /(\d+)/.exec(prog); if (mm) minute = parseInt(mm[1], 10);
  } else if (hs != null && as != null && rawLow.indexOf('not started') < 0 && rawLow !== 'ns' && raw !== '') {
    status = 'finished';
  }

  return {
    id: e.idEvent,
    stage: isGroup ? 'group' : 'ko',
    group: isGroup ? grpRaw.replace(/group\s*/i, '').trim().toUpperCase() : null,
    round: (e.strRound || grpRaw || '').trim(),
    home: (e.strHomeTeam || '').trim(),
    away: (e.strAwayTeam || '').trim(),
    homeScore: hs,
    awayScore: as,
    date: e.dateEvent || '',
    time: (e.strTime || '').slice(0, 5),
    tz: 'WIB',
    venue: (e.strVenue || '').trim(),
    status: status,
    minute: minute,
    raw: raw
  };
}
