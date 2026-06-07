#!/usr/bin/env node
// OST Quest — backfill.js
// Genera entradas en games.json para los últimos 30 días (sin sobreescribir los existentes)
// Uso: node backfill.js
// Ejecutar UNA SOLA VEZ para rellenar el historial pasado.

const fs   = require('fs');
const path = require('path');

// ── Cargar base de datos ──────────────────────────────────────────────────────

const dbPath = path.join(__dirname, 'js', 'database.js');
const dbSrc  = fs.readFileSync(dbPath, 'utf8');

let GAME_DB;
try {
  const tmpPath = path.join(__dirname, '_tmp_db.js');
  fs.writeFileSync(tmpPath, dbSrc + '\nmodule.exports = GAME_DB;');
  GAME_DB = require(tmpPath);
  fs.unlinkSync(tmpPath);
  delete require.cache[tmpPath];
} catch (e) {
  console.error('❌ Error al cargar database.js:', e.message);
  process.exit(1);
}

console.log(`📦 Base de datos cargada: ${GAME_DB.length} juegos`);

// ── Algoritmo de generación ───────────────────────────────────────────────────

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

function generateGameForDate(dateStr) {
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

    groups.push({
      answerId: answer.id,
      coverIds: seededShuffle([answer, ...distractors], rng).map(g => g.id),
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
    console.log(`📂 games.json existente: ${Object.keys(existing).length} días`);
  } catch (e) {
    console.warn('⚠️  No se pudo leer games.json');
  }
}

// ── Backfill ──────────────────────────────────────────────────────────────────

const today = getGameDay();
const DAYS_BACK = 30;

let added = 0;
let skipped = 0;

for (let i = DAYS_BACK; i >= 1; i--) {
  const dateStr = addDays(today, -i);
  if (existing[dateStr]) {
    skipped++;
  } else {
    existing[dateStr] = generateGameForDate(dateStr);
    added++;
  }
}

// ── Guardar ───────────────────────────────────────────────────────────────────

fs.writeFileSync(gamesPath, JSON.stringify(existing, null, 2), 'utf8');

console.log(`\n✅ Backfill completado:`);
console.log(`   ➕ Días añadidos:   ${added}`);
console.log(`   ⏭️  Días omitidos:   ${skipped} (ya existían)`);
console.log(`   📅 Total en JSON:   ${Object.keys(existing).length} días`);
console.log(`\n👉 Haz commit de games.json para publicar los cambios.\n`);
