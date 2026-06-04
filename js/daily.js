// OST Quest - Daily Game Logic

// Devuelve "YYYY-MM-DD" del día de juego actual (cambia a las 03:00 UTC)
function getGameDay(date) {
  const d = date ? new Date(date) : new Date();
  // Si es antes de las 03:00 UTC, pertenece al día anterior
  if (d.getUTCHours() < 3) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

// Genera "YYYY-MM-DD" de hace N días (sin aplicar corrección de 3am, ya la aplica getGameDay)
function getPastGameDay(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return getGameDay(d);
}

// ── RNG determinista (mulberry32) ────────────────────────────────────────────

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

// ── Generación del juego diario ───────────────────────────────────────────────

function generateDailyGame(dateStr) {
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
      GAME_DB.filter(g => !used.has(g.id) && Math.abs(g.pop - answer.pop) <= 2),
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
    groups.push({ answer, covers: seededShuffle([answer, ...distractors], rng) });
  }

  return groups;
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
      played: 0, wins: 0, streak: 0, maxStreak: 0, lastPlayedDay: null
    };
  } catch { return { played: 0, wins: 0, streak: 0, maxStreak: 0, lastPlayedDay: null }; }
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

// FIX 4: guardar progreso funciona tanto para hoy como para días del archivo
function saveDayProgress(dateStr, colStates) {
  localStorage.setItem(`ostquest_prog_${dateStr}`, JSON.stringify(colStates));
}

function loadDayProgress(dateStr) {
  try {
    const raw = localStorage.getItem(`ostquest_prog_${dateStr}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Registra resultado de una partida completada
// Solo actualiza estadísticas/racha si es el juego del día actual
function recordDailyResult(dateStr, score, total) {
  const played = loadPlayedDays();
  const today  = getGameDay();

  // Actualizar stats/racha solo para el juego de hoy y solo la primera vez
  if (dateStr === today && !played[dateStr]) {
    const stats = loadStats();
    stats.played++;
    if (score === total) stats.wins++;
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

  // Guardar resultado siempre (hoy o archivo), sobreescribiendo si ya existe
  savePlayedDay(dateStr, { score, total, ts: Date.now() });
}
