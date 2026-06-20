#!/usr/bin/env node
// check-links.js — Comprueba que los enlaces de audio directos en database.js siguen activos
// Uso: node check-links.js

const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

// ── Cargar GAME_DB (igual que update.js) ─────────────────────────────────────

const dbPath = path.join(__dirname, 'js', 'database.js');
let GAME_DB;
try {
  const code    = fs.readFileSync(dbPath, 'utf8') + '\nmodule.exports = GAME_DB;';
  const tmpPath = path.join(__dirname, '_tmp_db.js');
  fs.writeFileSync(tmpPath, code);
  GAME_DB = require(tmpPath);
  fs.unlinkSync(tmpPath);
  delete require.cache[require.resolve(tmpPath)];
} catch (e) {
  console.error('❌ Error al cargar database.js:', e.message);
  process.exit(1);
}

// ── Comprobación de URL ───────────────────────────────────────────────────────

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; OestiQuestChecker/1.0)' };
const TIMEOUT = 12000;
const MAX_REDIRECTS = 5;

function checkUrl(url, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: TIMEOUT, headers: HEADERS }, (res) => {
      const { statusCode, headers } = res;
      // Seguir redirecciones
      if ([301, 302, 307, 308].includes(statusCode) && headers.location && redirectsLeft > 0) {
        const next = headers.location.startsWith('http')
          ? headers.location
          : new URL(headers.location, url).href;
        return resolve(checkUrl(next, redirectsLeft - 1));
      }
      // Algunos servidores rechazan HEAD pero sirven GET: reintentar con rango mínimo
      if (statusCode === 405) {
        return resolve(checkUrlGet(url));
      }
      resolve({ ok: statusCode >= 200 && statusCode < 400, status: statusCode });
    });
    req.on('error',   (e) => resolve({ ok: false, status: null, error: e.message }));
    req.on('timeout', ()  => { req.destroy(); resolve({ ok: false, status: null, error: 'timeout' }); });
    req.end();
  });
}

function checkUrlGet(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, {
      method: 'GET', timeout: TIMEOUT,
      headers: { ...HEADERS, Range: 'bytes=0-0' },
    }, (res) => {
      res.destroy();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
    });
    req.on('error',   (e) => resolve({ ok: false, status: null, error: e.message }));
    req.on('timeout', ()  => { req.destroy(); resolve({ ok: false, status: null, error: 'timeout' }); });
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const toCheck = [];

  for (const game of GAME_DB) {
    for (let i = 0; i < game.tracks.length; i++) {
      const track = game.tracks[i];
      const url   = track.mp3Url || track.url || null;
      if (url) toCheck.push({ game: game.game, trackIndex: i, url });
    }
  }

  if (toCheck.length === 0) {
    console.log('ℹ️  No hay enlaces directos en la base de datos. Solo YouTube/SoundCloud.');
    return;
  }

  console.log(`🔍 Comprobando ${toCheck.length} enlace(s) directo(s)...\n`);

  const broken = [];

  for (const item of toCheck) {
    process.stdout.write(`  ${item.game} — track ${item.trackIndex + 1}... `);
    const result = await checkUrl(item.url);
    if (result.ok) {
      console.log(`✅  ${result.status}`);
    } else {
      const reason = result.error ? `error: ${result.error}` : `HTTP ${result.status}`;
      console.log(`❌  ${reason}`);
      broken.push({ ...item, reason });
    }
  }

  console.log();
  if (broken.length === 0) {
    console.log('✅ Todos los enlaces funcionan correctamente.\n');
  } else {
    console.log(`⚠️  ${broken.length} enlace(s) con problemas:\n`);
    for (const b of broken) {
      console.log(`  ❌  ${b.game} — track ${b.trackIndex + 1}`);
      console.log(`      ${b.url}`);
      console.log(`      ${b.reason}\n`);
    }
    process.exit(1);
  }
}

main();
