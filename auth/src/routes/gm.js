// Rutas del bestiario, el editor de la base de juegos (knowledge/bestiary.html). Solo para cuentas con el rol GM
// (columna is_gm de player_accounts, que se activa a mano en Supabase).
//
// El editor tiene su propia sesión: un token de 12 horas con purpose 'gm', que no sirve como sesión
// del juego (requireAuth rechaza los tokens con purpose) y viceversa. En cada petición se vuelve a
// mirar is_gm en la base de datos: quitar el rol corta el acceso al momento, aunque haya sesión abierta.
import { json } from '../lib/cors.js';
import { signJwt, verifyJwt } from '../lib/jwt.js';
import { checkCredentials } from './email.js';

const GM_SESSION_SECONDS = 12 * 3600;
const MAX_ROWS = 5000;  // muy por encima de lo real; evita peticiones desmesuradas
const LANG_RE  = /^[a-z]{2}$/;

async function requireGm(request, env, db) {
  const auth    = request.headers.get('Authorization') || '';
  const payload = auth.startsWith('Bearer ') ? await verifyJwt(auth.slice(7), env.JWT_SECRET) : null;
  if (payload?.purpose !== 'gm') return [null, json({ error: 'unauthorized' }, 401, request)];
  const user = await db.getUserById(payload.sub);
  if (user?.is_gm !== true) return [null, json({ error: 'not_gm' }, 403, request)];
  return [user, null];
}

// Filas que manda el editor: array de objetos y de tamaño razonable
function rowsFrom(body) {
  const rows = body?.rows;
  return Array.isArray(rows) && rows.length <= MAX_ROWS && rows.every(r => r && typeof r === 'object' && !Array.isArray(r))
    ? rows : null;
}

// Lista de ids de juego a borrar (opcional en el cuerpo: si falta, no se borra nada)
function gameIdsFrom(value) {
  const ids = value ?? [];
  return Array.isArray(ids) && ids.length <= MAX_ROWS && ids.every(id => Number.isInteger(id) && id >= 0) ? ids : null;
}

// Id de una fila de editor_specials (número o texto, según cómo se creó la columna)
function isRowId(id) {
  return Number.isInteger(id) || (typeof id === 'string' && id.length > 0 && id.length <= 64);
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

// POST /gm/login  { login, password }  →  { token, username }
export async function handleGmLogin(request, env, db) {
  const body = await readBody(request);
  if (!body) return json({ error: 'invalid_json' }, 400, request);
  const [user, err] = await checkCredentials(request, env, db, body);
  if (err) return err;
  if (user.is_gm !== true) return json({ error: 'not_gm' }, 403, request);
  const token = await signJwt({ sub: user.id, purpose: 'gm' }, env.JWT_SECRET, GM_SESSION_SECONDS);
  return json({ token, username: user.username }, 200, request);
}

// GET /gm/games
export async function handleGmGetGames(request, env, db) {
  const [, err] = await requireGm(request, env, db);
  if (err) return err;
  return json(await db.getEditorGames(), 200, request);
}

// POST /gm/games/upsert  { rows, deleteIds }  — "Guardar": sube los juegos nuevos y modificados y borra los quitados
export async function handleGmSaveGames(request, env, db) {
  const [, err] = await requireGm(request, env, db);
  if (err) return err;
  const body      = await readBody(request);
  const rows      = rowsFrom(body);
  const deleteIds = gameIdsFrom(body?.deleteIds);
  if (!rows || !deleteIds || !rows.every(r => Number.isInteger(r.id) && r.id >= 0)) return json({ error: 'invalid_rows' }, 400, request);
  if (deleteIds.length) await db.deleteEditorGames(deleteIds);
  if (rows.length)      await db.upsertEditorGames(rows);
  return json({ ok: true, count: rows.length, deleted: deleteIds.length }, 200, request);
}

// GET /gm/translations?lang=es
export async function handleGmGetTranslations(request, env, db) {
  const [, err] = await requireGm(request, env, db);
  if (err) return err;
  const lang = new URL(request.url).searchParams.get('lang') || '';
  if (!LANG_RE.test(lang)) return json({ error: 'invalid_lang' }, 400, request);
  return json(await db.getEditorTranslations(lang), 200, request);
}

// POST /gm/translations  { rows: [{ game_id, lang, name }], lang, deleteIds: [game_id] }
// deleteIds borra las traducciones de esos juegos en el idioma lang
export async function handleGmSaveTranslations(request, env, db) {
  const [, err] = await requireGm(request, env, db);
  if (err) return err;
  const body      = await readBody(request);
  const rows      = rowsFrom(body);
  const deleteIds = gameIdsFrom(body?.deleteIds);
  if (!rows || !deleteIds || !rows.every(r => Number.isInteger(Number(r.game_id)) && LANG_RE.test(r.lang) && typeof r.name === 'string')) {
    return json({ error: 'invalid_rows' }, 400, request);
  }
  if (deleteIds.length) {
    if (!LANG_RE.test(body?.lang || '')) return json({ error: 'invalid_lang' }, 400, request);
    await db.deleteEditorTranslations(body.lang, deleteIds);
  }
  if (rows.length) await db.upsertEditorTranslations(rows);
  return json({ ok: true, count: rows.length, deleted: deleteIds.length }, 200, request);
}

// GET /gm/specials
export async function handleGmGetSpecials(request, env, db) {
  const [, err] = await requireGm(request, env, db);
  if (err) return err;
  return json(await db.getEditorSpecials(), 200, request);
}

// POST /gm/specials  { deleteIds: [id], update: [fila con id], insert: [fila sin id] }  →  lista actualizada
export async function handleGmSaveSpecials(request, env, db) {
  const [, err] = await requireGm(request, env, db);
  if (err) return err;
  const body      = await readBody(request);
  const deleteIds = Array.isArray(body?.deleteIds) && body.deleteIds.every(isRowId) ? body.deleteIds : null;
  const update    = rowsFrom({ rows: body?.update ?? [] });
  const insert    = rowsFrom({ rows: body?.insert ?? [] });
  if (!deleteIds || !update || !insert || !update.every(r => isRowId(r.id))) {
    return json({ error: 'invalid_rows' }, 400, request);
  }
  await db.saveEditorSpecials({ deleteIds, update, insert: insert.map(({ id, ...row }) => row) });
  return json(await db.getEditorSpecials(), 200, request);
}
