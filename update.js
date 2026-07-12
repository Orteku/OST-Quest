#!/usr/bin/env node
// OST Quest — update.js
// Genera/actualiza games.json con los juegos de cada día.
// - Preserva todos los días hasta HOY (inclusive)
// - Regenera desde MAÑANA en adelante (365 días)
//
// Uso: node update.js

const fs   = require('fs');
const path = require('path');

// ── Cargar base de datos ──────────────────────────────────────────────────────

// Extraer GAME_DB del archivo database.js sin ejecutar el módulo completo
const dbPath  = path.join(__dirname, 'js', 'database.js');
const dbSrc   = fs.readFileSync(dbPath, 'utf8');

// Evaluar el archivo para obtener GAME_DB
let GAME_DB;
try {
  const code = dbSrc + '\nmodule.exports = GAME_DB;';
  // Escribir un temp file para requerirlo limpiamente
  const tmpPath = path.join(__dirname, '_tmp_db.js');
  fs.writeFileSync(tmpPath, code);
  GAME_DB = require(tmpPath);
  fs.unlinkSync(tmpPath);
  // Limpiar caché de require
  delete require.cache[tmpPath];
} catch (e) {
  console.error('❌ Error al cargar database.js:', e.message);
  process.exit(1);
}

console.log(`📦 Base de datos cargada: ${GAME_DB.length} juegos`);

// ── Cargar algoritmo compartido ───────────────────────────────────────────────

const algoSrc     = fs.readFileSync(path.join(__dirname, 'js', 'algorithm.js'), 'utf8');
const tmpAlgoPath = path.join(__dirname, '_tmp_algo.js');
fs.writeFileSync(tmpAlgoPath, algoSrc + '\nmodule.exports = { WEIGHTS, getYearScore, getTagScore, effectiveTags, weightedPickN };');
let WEIGHTS, getYearScore, getTagScore, effectiveTags, weightedPickN;
try {
  ({ WEIGHTS, getYearScore, getTagScore, effectiveTags, weightedPickN } = require(tmpAlgoPath));
} finally {
  fs.unlinkSync(tmpAlgoPath);
  delete require.cache[tmpAlgoPath];
}

// ── RNG y utilidades ──────────────────────────────────────────────────────────

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

// ── Generación ────────────────────────────────────────────────────────────────

function generateGameForDate(dateStr) {
  const seed = dateToSeed(dateStr);
  const rng  = seededRng(seed);
  const used = new Set();
  const groups = [];
  const shuffled = seededShuffle(GAME_DB, rng);

  const strictGroupIndex = Math.floor(rng() * 3);

  for (let gi = 0; gi < 3; gi++) {
    let answer = null;
    for (const g of shuffled) {
      if (!used.has(g.id)) { answer = g; break; }
    }
    used.add(answer.id);

    const trackIndex    = Math.floor(rng() * answer.tracks.length);
    const answerEffTags = effectiveTags(answer, answer.tracks[trackIndex]);

    const weights    = gi === strictGroupIndex ? WEIGHTS.strict : WEIGHTS.normal;
    const candidates = GAME_DB.filter(g => !used.has(g.id) && Math.abs(g.pop - answer.pop) <= 1);

    let distractors = weightedPickN(candidates, answer, answerEffTags, weights, rng, 3);

    if (distractors.length < 3) {
      const distIds = new Set(distractors.map(d => d.id));
      const fallback = GAME_DB.filter(g => !used.has(g.id) && !distIds.has(g.id));
      const extra    = weightedPickN(fallback, answer, answerEffTags, WEIGHTS.normal, rng, 3 - distractors.length);
      distractors    = [...distractors, ...extra];
    }

    distractors.forEach(d => used.add(d.id));
    groups.push({
      answerId: answer.id,
      coverIds: seededShuffle([answer, ...distractors], rng).map(g => g.id),
      trackIndex,
    });
  }

  return groups;
}

// ── Fechas ────────────────────────────────────────────────────────────────────

function getGameDay(date) {
  const d = date ? new Date(date) : new Date();
  if (d.getUTCHours() < 3) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Cargar games.json existente ───────────────────────────────────────────────

const gamesPath = path.join(__dirname, 'games.json');
let existing = {};

if (fs.existsSync(gamesPath)) {
  try {
    existing = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
    console.log(`📂 games.json existente: ${Object.keys(existing).length} días guardados`);
  } catch (e) {
    console.warn('⚠️  No se pudo leer games.json, se creará uno nuevo');
  }
}

// ── Generar ───────────────────────────────────────────────────────────────────

const today    = getGameDay();
const tomorrow = addDays(today, 1);

const result = {};
let preserved = 0;
let generated = 0;

// 1. Preservar todos los días hasta hoy (inclusive)
for (const [dateStr, game] of Object.entries(existing)) {
  if (dateStr <= today) {
    result[dateStr] = game;
    preserved++;
  }
}

// 2. Regenerar desde mañana hasta 365 días adelante
for (let i = 0; i < 365; i++) {
  const dateStr = addDays(tomorrow, i);
  result[dateStr] = generateGameForDate(dateStr);
  generated++;
}

// ── Guardar ───────────────────────────────────────────────────────────────────

fs.writeFileSync(gamesPath, JSON.stringify(result, null, 2), 'utf8');

console.log(`\n✅ games.json actualizado:`);
console.log(`   📌 Preservados (hasta hoy):      ${preserved} días`);
console.log(`   🔄 Regenerados (desde mañana):   ${generated} días`);
console.log(`   📅 Total:                         ${Object.keys(result).length} días`);
console.log(`   📆 Hasta:                         ${addDays(tomorrow, 364)}`);
console.log(`\n👉 Haz commit de games.json y database.js para publicar los cambios.\n`);
