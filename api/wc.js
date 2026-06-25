/* =====================================================================
   Vercel Serverless Function — /api/wc
   Mengambil data Piala Dunia 2026 dari TheSportsDB (server-side, bebas CORS),
   lalu menormalkannya menjadi JSON ringkas untuk front-end.

   Konfigurasi via Environment Variables (opsional):
     SPORTSDB_KEY     (default "3" — kunci uji gratis TheSportsDB)
     SPORTSDB_LEAGUE  (default "4429" — id liga FIFA World Cup)
     SPORTSDB_SEASON  (default "2026")
   ===================================================================== */

const KEY = process.env.SPORTSDB_KEY || '3';
const LEAGUE = process.env.SPORTSDB_LEAGUE || '4429';
const SEASON = process.env.SPORTSDB_SEASON || '2026';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const base = 'https://www.thesportsdb.com/api/v1/json/' + KEY;
  const url = base + '/eventsseason.php?id=' + LEAGUE + '&s=' + encodeURIComponent(SEASON);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'wc2026-app/1.0' } });
    if (!r.ok) throw new Error('upstream HTTP ' + r.status);
    const j = await r.json();
    const events = (j && j.events) || [];
    const matches = events.map(normalize);
    const groups = {};
    matches.forEach(function (m) { if (m.group) groups[m.group] = true; });

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json({
      ok: matches.length > 0,
      source: 'TheSportsDB',
      league: LEAGUE,
      season: SEASON,
      groupsFound: Object.keys(groups).sort(),
      count: matches.length,
      updatedAt: Date.now(),
      matches: matches
    });
  } catch (e) {
    res.status(200).json({
      ok: false,
      source: 'TheSportsDB',
      league: LEAGUE,
      season: SEASON,
      error: String((e && e.message) || e),
      hint: 'Jika kosong/eror, sesuaikan SPORTSDB_LEAGUE/SPORTSDB_SEASON atau pakai SPORTSDB_KEY berbayar.',
      matches: []
    });
  }
};

function num(v) {
  return (v === null || v === undefined || v === '') ? null : parseInt(v, 10);
}

function normalize(e) {
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
    venue: (e.strVenue || '').trim(),
    status: status,
    minute: minute,
    raw: raw
  };
}
