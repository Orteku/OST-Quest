import { json } from '../lib/cors.js';
import { requireAuth } from './user.js';
import { checkServerAchievements, getServerProgress } from '../lib/achievements.js';

const RESULTS_RE = /^[01]{3}$/;
const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;

// GET /scores/stats — estadísticas calculadas desde la BD (sin localStorage)
export async function handleGetStats(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  const [stats, achievementProgress] = await Promise.all([
    db.calcStats(payload.sub),
    getServerProgress(db, payload.sub),  // plenos y semanas en el podio, para el progreso de los logros
  ]);
  // Sincronizar racha en player_accounts si cambió
  await db.updateUser(payload.sub, { streak: stats.streak });
  return json({ ...stats, achievementProgress }, 200, request);
}

// POST /scores  { gameDate, score, results: '101', stats: { streak } }
export async function handleSubmitScore(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { gameDate, score, stats } = body;
  if (!gameDate || score === undefined) return json({ error: 'missing_fields' }, 400, request);

  // Cada quest se puntúa una sola vez: si ya hay resultado (otro dispositivo, almacenamiento borrado…), se conserva
  if (await db.hasScoreForDate(payload.sub, gameDate)) {
    return json({ ok: true, duplicate: true, newAchievements: [] }, 200, request);
  }

  const pts = score === 3 ? 100 : score === 2 ? 66 : score === 1 ? 33 : 0;
  // Columnas acertadas, para los logros de tag. Solo se acepta si cuadra con la puntuación.
  const results = RESULTS_RE.test(body.results || '') && [...body.results].filter(c => c === '1').length === score
    ? body.results : undefined;

  // Upsert primero para que calcStreakFromScores ya cuente el día de hoy
  const playedAt = new Date().toISOString();
  await db.upsertScore({
    user_id:      payload.sub,
    game_date:    gameDate,
    score,
    points:       pts,
    streak_bonus: 0,       // se recalcula abajo
    total_points: pts,
    played_at:    playedAt,
    ...(results && { results }),
  });

  // Racha calculada en el servidor desde los registros reales
  const streak = await db.calcStreakFromScores(payload.sub);
  const bonus  = streak >= 2 ? 10 : 0;

  await Promise.all([
    db.upsertScore({
      user_id:      payload.sub,
      game_date:    gameDate,
      score,
      points:       pts,
      streak_bonus: bonus,
      total_points: pts + bonus,
      played_at:    playedAt,
      ...(results && { results }),
    }),
    db.updateUser(payload.sub, { streak }),
  ]);

  // Comprobar logros de progresión
  const newAchievements = [];
  const [unlocked, playedCount, user] = await Promise.all([
    db.getUserAchievements(payload.sub),
    db.getPlayedCount(payload.sub),
    db.getUserById(payload.sub),
  ]);
  const unlockedIds = new Set((unlocked || []).map(a => a.achievement_id));

  if (!unlockedIds.has('streak_7') && streak >= 7)   newAchievements.push('streak_7');
  if (!unlockedIds.has('played_30') && playedCount >= 30) newAchievements.push('played_30');
  if (!unlockedIds.has('anniversary') && user?.created_at) {
    const ageMs = Date.now() - new Date(user.created_at).getTime();
    if (ageMs >= 365 * 24 * 3600 * 1000) newAchievements.push('anniversary');
  }
  newAchievements.push(...await checkServerAchievements(db, payload.sub, unlockedIds));
  if (newAchievements.length) {
    await Promise.all(newAchievements.map(id => db.unlockAchievement(payload.sub, id)));
  }

  return json({ ok: true, streak, newAchievements }, 200, request);
}

// POST /scores/migrate  { played: { [date]: { score, total } } }
// Migra el historial de localStorage al primer login
export async function handleMigrateScores(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { played } = body;
  if (!played || typeof played !== 'object') return json({ error: 'invalid_played' }, 400, request);

  // Solo partidas jugadas en su día (ts = momento en que se jugó): las del Quest Log no suman puntos
  const rows = [];
  for (const date of Object.keys(played).filter(d => DATE_RE.test(d))) {
    const res = played[date];
    if (![0, 1, 2, 3].includes(res?.score) || !res.ts) continue;
    const playedAt = new Date(res.ts).toISOString();
    if (!db._isOnTime(date, playedAt)) continue;
    const pts = res.score === 3 ? 100 : res.score === 2 ? 66 : res.score === 1 ? 33 : 0;
    rows.push({ user_id: payload.sub, game_date: date, score: res.score, points: pts, streak_bonus: 0, total_points: pts, played_at: playedAt });
  }

  // Nunca pisa lo que ya hay en el servidor; solo añade lo que falta
  const added = rows.length ? await db.upsertScores(rows) : [];
  if (added.length) {
    // La bonificación de racha se recalcula desde el primer día añadido (también la de los días siguientes,
    // que se calcularon sin él) y la racha se actualiza desde la BD
    await db.recalcStreakBonuses(payload.sub, added.sort()[0]);
    const streak = await db.calcStreakFromScores(payload.sub);
    await db.updateUser(payload.sub, { streak });
  }

  return json({ ok: true, migrated: added.length }, 200, request);
}

// GET /scores/history — todas las partidas del usuario, para restaurar el estado en un navegador nuevo
export async function handleGetHistory(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;
  return json(await db.getScoreHistory(payload.sub), 200, request);
}

// GET /scores/results — columnas acertadas de las quests jugadas en su día (logros de tag)
export async function handleGetResults(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;
  return json(await db.getOnTimeResults(payload.sub), 200, request);
}

// POST /scores/results  { results: { 'YYYY-MM-DD': '101' } }
// Completa partidas antiguas (anteriores a guardar results) con lo que tenga el navegador.
// Solo rellena filas existentes sin results y cuyo número de aciertos cuadre con la puntuación.
export async function handleFillResults(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }
  const input = body?.results;
  if (!input || typeof input !== 'object') return json({ error: 'invalid_results' }, 400, request);

  const scores = await db.getScoresWithResults(payload.sub);
  const byDate = Object.fromEntries(scores.map(s => [s.game_date, s]));
  let filled = 0;
  for (const [date, res] of Object.entries(input)) {
    const row = byDate[date];
    if (!DATE_RE.test(date) || !RESULTS_RE.test(res) || !row || row.results) continue;
    if ([...res].filter(c => c === '1').length !== row.score) continue;
    await db.fillMissingResults(payload.sub, date, res);
    filled++;
  }
  return json({ ok: true, filled }, 200, request);
}
