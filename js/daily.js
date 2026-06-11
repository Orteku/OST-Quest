// OST Quest - Daily Game Logic

// ── Fechas ────────────────────────────────────────────────────────────────────

function getGameDay(date) {
  const d = date ? new Date(date) : new Date();
  if (d.getUTCHours() < 3) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getPastGameDay(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return getGameDay(d);
}

// ── Carga de games.json ───────────────────────────────────────────────────────

let _gamesCache = null;

async function loadGamesJson() {
  if (_gamesCache) return _gamesCache;
  try {
    const res  = await fetch('games.json?v=' + Date.now());
    if (!res.ok) throw new Error('games.json no encontrado');
    _gamesCache = await res.json();
    return _gamesCache;
  } catch (e) {
    console.warn('⚠️ No se pudo cargar games.json, usando generación por semilla:', e.message);
    return null;
  }
}

// ── RNG determinista (fallback si no hay games.json) ─────────────────────────

function seededRng(seed) {
  let s = seed;
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Genera el juego con semilla (fallback)
function generateFromSeed(dateStr) {
  const seed = dateToSeed(dateStr);
  const rng  = seededRng(seed);
  const used = new Set();
  const groups = [];
  const shuffled = seededShuffle(GAME_DB, rng);

  for (let gi = 0; gi < 3; gi++) {
    let answer = null;
    for (const g of shuffled) {
      if (!used.has(g.id)) { answer = g; break; }
    }
    used.add(answer.id);

    let distractors = seededShuffle(
      GAME_DB.filter(g => !used.has(g.id) && Math.abs(g.pop - answer.pop) <= 1),
      rng
    ).slice(0, 3);

    if (distractors.length < 3) {
      const fallback = seededShuffle(
        GAME_DB.filter(g => !used.has(g.id) && !distractors.find(d => d.id === g.id)),
        rng
      );
      distractors = [...distractors, ...fallback].slice(0, 3);
    }

    distractors.forEach(d => used.add(d.id));
    const trackIndex = Math.floor(rng() * answer.tracks.length);
    groups.push({ answer, covers: seededShuffle([answer, ...distractors], rng), trackIndex });
  }

  return groups;
}

// Reconstruye el juego desde IDs guardados en games.json
function reconstructFromIds(stored) {
  const byId = Object.fromEntries(GAME_DB.map(g => [g.id, g]));
  return stored.map(group => {
    const answer = byId[group.answerId];
    const covers = group.coverIds.map(id => byId[id]).filter(Boolean);
    if (!answer || covers.length < 4) return null;
    return { answer, covers, trackIndex: group.trackIndex || 0 };
  }).filter(Boolean);
}

// Punto de entrada principal — usa games.json si existe, semilla como fallback
async function generateDailyGame(dateStr) {
  const games = await loadGamesJson();

  if (games && games[dateStr]) {
    const groups = reconstructFromIds(games[dateStr]);
    if (groups.length === 3) return groups;
    console.warn('⚠️ Juego en games.json incompleto para', dateStr, '— usando semilla');
  }

  // Fallback: generación por semilla (útil durante desarrollo sin games.json)
  return generateFromSeed(dateStr);
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function timeUntilNextGame() {
  const now  = new Date();
  const next = new Date(now);
  next.setUTCHours(3, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next - now;
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

// ── Persistencia ──────────────────────────────────────────────────────────────

const STATS_KEY  = 'ostquest_stats';
const PLAYED_KEY = 'ostquest_played';

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || {
      played: 0, wins: 0, totalHits: 0, streak: 0, maxStreak: 0, lastPlayedDay: null
    };
  } catch { return { played: 0, wins: 0, totalHits: 0, streak: 0, maxStreak: 0, lastPlayedDay: null }; }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function loadPlayedDays() {
  try {
    return JSON.parse(localStorage.getItem(PLAYED_KEY)) || {};
  } catch { return {}; }
}

function savePlayedDay(dateStr, result) {
  const days = loadPlayedDays();
  days[dateStr] = result;
  localStorage.setItem(PLAYED_KEY, JSON.stringify(days));
}

function saveDayProgress(dateStr, colStates) {
  localStorage.setItem(`ostquest_prog_${dateStr}`, JSON.stringify(colStates));
}

function loadDayProgress(dateStr) {
  try {
    const raw = localStorage.getItem(`ostquest_prog_${dateStr}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function recordDailyResult(dateStr, score, total) {
  const played = loadPlayedDays();
  const today  = getGameDay();

  if (dateStr === today && !played[dateStr]) {
    const stats = loadStats();
    stats.played++;
    if (score === total) stats.wins++;
    stats.totalHits = (stats.totalHits || 0) + score;
    const yesterday = getPastGameDay(1);
    if (stats.lastPlayedDay === yesterday) {
      stats.streak++;
    } else if (stats.lastPlayedDay !== today) {
      stats.streak = 1;
    }
    stats.maxStreak     = Math.max(stats.maxStreak, stats.streak);
    stats.lastPlayedDay = today;
    saveStats(stats);
  }

  savePlayedDay(dateStr, { score, total, ts: Date.now() });
}
