// OST Quest - Daily Game Logic

// ── Fechas ────────────────────────────────────────────────────────────────────

const QUEST_START = '2026-06-08';

function getQuestNumber(dateStr) {
  const _sp = getSpecialForDate(dateStr);
  if (_sp && hasGameData(_sp)) return null;
  const start = new Date(QUEST_START + 'T12:00:00Z');
  const date  = new Date(dateStr  + 'T12:00:00Z');
  const total = Math.round((date - start) / 86400000) + 1;
  return total - countSpecialsBefore(dateStr);
}

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

// Sin parámetro anti-caché: GitHub Pages lo sirve con 10 min de caché y ETag, así que el navegador
// lo reutiliza y comprueba si ha cambiado en vez de bajarlo entero en cada visita.
// Los días ya jugados nunca cambian; una quest de hoy regenerada tarda como mucho esos 10 min en llegar.
async function loadGamesJson() {
  if (_gamesCache) return _gamesCache;
  try {
    const res  = await fetch('games.json');
    if (!res.ok) throw new Error('games.json no encontrado');
    _gamesCache = await res.json();
    return _gamesCache;
  } catch (e) {
    console.warn('⚠️ No se pudo cargar games.json:', e.message);
    return null;
  }
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

// Quest de un día desde games.json, o null si no se puede cargar o el día no está.
// No se genera nada en el navegador: una quest inventada aquí no sería la de los demás jugadores
// y la puntuación y los logros contarían otros juegos.
async function generateDailyGame(dateStr) {
  const games  = await loadGamesJson();
  const groups = games?.[dateStr] ? reconstructFromIds(games[dateStr]) : [];
  if (groups.length === 3) return groups;
  console.warn('⚠️ No hay quest en games.json para', dateStr);
  return null;
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
      played: 0, wins: 0, totalHits: 0, streak: 0, maxStreak: 0, perfectQuests: 0, lastPlayedDay: null
    };
  } catch { return { played: 0, wins: 0, totalHits: 0, streak: 0, maxStreak: 0, perfectQuests: 0, lastPlayedDay: null }; }
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

function recordDailyResult(dateStr, score, total, results) {
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
    if (score === total) stats.perfectQuests = (stats.perfectQuests || 0) + 1;
    stats.lastPlayedDay = today;
    saveStats(stats);
    if (typeof submitScoreToSupabase === 'function') submitScoreToSupabase(dateStr, score, stats, results);
  }

  savePlayedDay(dateStr, { score, total, ts: Date.now() });
}
