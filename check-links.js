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
      resolve({ ok: statusCode >= 200 && statusCode < 400, status: statusCode, contentType: headers['content-type'] || '' });
    });
    req.on('error',   (e) => resolve({ ok: false, status: null, error: e.message }));
    req.on('timeout', ()  => { req.destroy(); resolve({ ok: false, status: null, error: 'timeout' }); });
    req.end();
  });
}

// ── Formato ───────────────────────────────────────────────────────────────────
// mp3 y m4a (AAC) suenan en todos los navegadores y móviles. El resto funciona en muchos casos,
// pero no en todos o pesa demasiado: conviene cambiarlo por un mp3.

const FORMAT_NOTES = {
  ogg:  'no suena en Safari antiguo (iPhones sin actualizar)',
  oga:  'no suena en Safari antiguo (iPhones sin actualizar)',
  opus: 'no suena en Safari antiguo (iPhones sin actualizar)',
  webm: 'no suena en Safari antiguo (iPhones sin actualizar)',
  flac: 'sin pérdida y pesado; Safari puede rechazarlo si el servidor no lo declara como audio',
  wav:  'sin comprimir y muy pesado; tarda en empezar en móvil',
};

// Archive.org sirve cualquier .mp4 como video/mp4, lleve imagen o no. Sus metadatos sí lo indican (width/height).
const _archiveMeta = {};
function getJson(url) {
  return new Promise(resolve => {
    https.get(url, { headers: HEADERS, timeout: TIMEOUT }, res => {
      let s = '';
      res.on('data', d => s += d);
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch { resolve(null); } });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}
async function archiveHasVideo(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?archive\.org\/download\/([^/]+)\/(.+)$/);
  if (!m) return null;  // no es Archive.org: no se puede saber
  const [, item, filePath] = m;
  _archiveMeta[item] ??= getJson(`https://archive.org/metadata/${item}/files`);
  const files = (await _archiveMeta[item])?.result || [];
  const file  = files.find(f => f.name === decodeURIComponent(filePath.split('?')[0]));
  return file ? !!(file.width || file.height) : null;
}

async function formatWarning(url, contentType) {
  const ext = (url.split('?')[0].match(/\.([a-z0-9]{2,4})$/i)?.[1] || '').toLowerCase();
  if (ext === 'mp3' || ext === 'm4a') return null;
  if (ext === 'mp4' || contentType.toLowerCase().startsWith('video/')) {
    const video = await archiveHasVideo(url);
    if (video === false) return null;  // .mp4 solo de audio: suena en todas partes
    return video
      ? 'es un vídeo (lleva imagen): se descarga también la imagen, mucho más pesado'
      : `.${ext || '?'} servido como ${contentType || 'desconocido'}: comprobar que no lleva imagen`;
  }
  return `.${ext || '?'}: ${FORMAT_NOTES[ext] || 'formato poco habitual, comprobar que suena en móvil'}`;
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
    console.log('ℹ️  No hay enlaces de audio en la base de datos.');
    return;
  }

  console.log(`🔍 Comprobando ${toCheck.length} enlace(s) directo(s)...\n`);

  const broken   = [];
  const warnings = [];

  for (const item of toCheck) {
    process.stdout.write(`  ${item.game} — track ${item.trackIndex + 1}... `);
    const result = await checkUrl(item.url);
    const warn   = await formatWarning(item.url, result.contentType || '');
    if (warn) warnings.push({ ...item, warn });
    if (result.ok) {
      console.log(`✅  ${result.status}${warn ? '  ⚠️ formato' : ''}`);
    } else {
      const reason = result.error ? `error: ${result.error}` : `HTTP ${result.status}`;
      console.log(`❌  ${reason}`);
      broken.push({ ...item, reason });
    }
  }

  console.log();
  // Avisos de formato: no cuentan como error (el enlace funciona), pero conviene cambiarlos por mp3
  if (warnings.length) {
    console.log(`🎵 ${warnings.length} pista(s) en un formato que conviene cambiar por mp3:\n`);
    for (const w of warnings) {
      console.log(`  ⚠️  ${w.game} — track ${w.trackIndex + 1}`);
      console.log(`      ${w.url}`);
      console.log(`      ${w.warn}\n`);
    }
  }
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
