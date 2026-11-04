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

// ── Cargar eventos especiales ─────────────────────────────────────────────────

const { getSpecialForDate, hasGameData, getSpecialPool } = require('./js/specials.js');

// ── Cargar algoritmo compartido ───────────────────────────────────────────────

const algoSrc     = fs.readFileSync(path.join(__dirname, 'js', 'algorithm.js'), 'utf8');
const tmpAlgoPath = path.join(__dirname, '_tmp_algo.js');
fs.writeFileSync(tmpAlgoPath, algoSrc + '\nmodule.exports = { generateGameForDate };');
let generateGameForDate;
try {
  ({ generateGameForDate } = require(tmpAlgoPath));
} finally {
  fs.unlinkSync(tmpAlgoPath);
  delete require.cache[tmpAlgoPath];
}

// ── Generación ────────────────────────────────────────────────────────────────

function getPoolForDate(dateStr) {
  const special = getSpecialForDate(dateStr);
  const pool    = getSpecialPool(special, GAME_DB);
  if (!pool) return GAME_DB;
  if (pool.length < 4) {
    console.warn(`⚠️  Especial "${special.label}" (${dateStr}): solo ${pool.length} juegos en DB, se usará DB completa`);
    return GAME_DB;
  }
  console.log(`🎉 Especial: ${special.label} (${dateStr}) — pool de ${pool.length} juegos`);
  return pool;
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

const _todayGameSpecial = (() => { const s = getSpecialForDate(today); return s && hasGameData(s) ? s : null; })();

// Hoy solo se regenera si es especial y su quest aún no es del especial (p. ej. evento añadido el mismo día).
// Si ya lo es, puede haberse jugado: cambiarla descuadraría los resultados de quien ya ha jugado.
const _todayNeedsSpecial = (() => {
  if (!_todayGameSpecial) return false;
  const poolIds = new Set(getPoolForDate(today).map(g => g.id));
  return !(existing[today] || []).length || existing[today].some(g => !poolIds.has(g.answerId));
})();

// 1. Preservar días pasados y hoy, salvo que haya que pasar hoy al especial.
for (const [dateStr, game] of Object.entries(existing)) {
  if (dateStr < today || (dateStr === today && !_todayNeedsSpecial)) {
    result[dateStr] = game;
    preserved++;
  }
}

// 2. Regenerar hoy si hay que pasarlo al especial
if (_todayNeedsSpecial) {
  result[today] = generateGameForDate(today, getPoolForDate(today));
  generated++;
}

// 3. Regenerar desde mañana hasta 365 días adelante
for (let i = 0; i < 365; i++) {
  const dateStr = addDays(tomorrow, i);
  result[dateStr] = generateGameForDate(dateStr, getPoolForDate(dateStr));
  generated++;
}

// ── Guardar ───────────────────────────────────────────────────────────────────

// Un día por línea: pesa la mitad que con sangría y los cambios siguen viéndose bien en git
const daysJson = Object.keys(result).sort().map(d => `  ${JSON.stringify(d)}: ${JSON.stringify(result[d])}`);
fs.writeFileSync(gamesPath, `{\n${daysJson.join(',\n')}\n}\n`, 'utf8');

console.log(`\n✅ games.json actualizado:`);
console.log(`   📌 Preservados (hasta hoy):      ${preserved} días`);
console.log(`   🔄 Regenerados (desde mañana):   ${generated} días`);
console.log(`   📅 Total:                         ${Object.keys(result).length} días`);
console.log(`   📆 Hasta:                         ${addDays(tomorrow, 364)}`);

// ── Generar HTML estático en soundtracks.html ─────────────────────────────────

const esGames = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'games-es.json'), 'utf8'));

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function localizeEs(game) {
  const ov = esGames[String(game.id)];
  return ov ? { ...game, ...ov } : game;
}

const stSorted = [...GAME_DB].sort((a, b) =>
  localizeEs(a).game.localeCompare(localizeEs(b).game, 'es')
);

const stEntries = stSorted.map(game => {
  const lg    = localizeEs(game);
  const year  = game.year ? `<span class="st-year">${game.year}</span>` : '';
  const tracks = game.tracks.map(tr => {
    const artist = tr.artist ? `<span class="st-track__artist">${escHtml(tr.artist)}</span>` : '';
    return `<li class="st-track"><span class="st-track__title">${escHtml(tr.title || '—')}</span>${artist}</li>`;
  }).join('');
  return `<div class="st-entry"><h2 class="st-game">${escHtml(lg.game)}${year}</h2><ul class="st-tracks">${tracks}</ul></div>`;
}).join('\n');

const stPath    = path.join(__dirname, 'soundtracks.html');
let   stHtml    = fs.readFileSync(stPath, 'utf8');
const ST_START  = '<!-- SOUNDTRACKS_START -->';
const ST_END    = '<!-- SOUNDTRACKS_END -->';
const si        = stHtml.indexOf(ST_START);
const ei        = stHtml.indexOf(ST_END);

if (si === -1 || ei === -1) {
  console.warn('⚠️  Marcadores SOUNDTRACKS_START/END no encontrados en soundtracks.html');
} else {
  stHtml = stHtml.slice(0, si + ST_START.length) + '\n' + stEntries + '\n' + stHtml.slice(ei);
  fs.writeFileSync(stPath, stHtml, 'utf8');
  console.log(`🎵 soundtracks.html generado (${GAME_DB.length} juegos)`);
}

// ── Lista de imágenes de logros ───────────────────────────────────────────────
// La web la usa para saber qué logros tienen imagen (los que no, son provisionales) con una sola petición.
// Hay que volver a correr update.js al añadir imágenes de logros.

const achDir   = path.join(__dirname, 'img', 'achievements');
const achFiles = fs.readdirSync(achDir).filter(f => /\.(webp|png)$/i.test(f)).sort();
fs.writeFileSync(path.join(achDir, 'manifest.json'), JSON.stringify(achFiles) + '\n', 'utf8');
console.log(`🏆 img/achievements/manifest.json: ${achFiles.length} imágenes de logros`);

// ── Generar placeholder en ranking.html ───────────────────────────────────────

const rkPath   = path.join(__dirname, 'ranking.html');
let   rkHtml   = fs.readFileSync(rkPath, 'utf8');
const RK_START = '<!-- RANKING_START -->';
const RK_END   = '<!-- RANKING_END -->';
const rsi      = rkHtml.indexOf(RK_START);
const rei      = rkHtml.indexOf(RK_END);

if (rsi === -1 || rei === -1) {
  console.warn('⚠️  Marcadores RANKING_START/END no encontrados en ranking.html');
} else {
  const rkContent = '\n<p class="rank-empty">Cargando ranking...</p>\n';
  rkHtml = rkHtml.slice(0, rsi + RK_START.length) + rkContent + rkHtml.slice(rei);
  fs.writeFileSync(rkPath, rkHtml, 'utf8');
  console.log('🏆 ranking.html actualizado');
}

console.log(`\n👉 Haz commit de games.json, database.js, soundtracks.html, ranking.html e img/achievements/manifest.json para publicar los cambios.\n`);
