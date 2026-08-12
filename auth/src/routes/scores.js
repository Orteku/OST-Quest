import { json } from '../lib/cors.js';
import { requireAuth } from './user.js';

// GET /scores/stats — estadísticas calculadas desde la BD (sin localStorage)
export async function handleGetStats(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  const stats = await db.calcStats(payload.sub);
  // Sincronizar racha en player_accounts si cambió
  await db.updateUser(payload.sub, { streak: stats.streak });
  return json(stats, 200, request);
}

// POST /scores  { gameDate, score, stats: { streak } }
export async function handleSubmitScore(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { gameDate, score, stats } = body;
  if (!gameDate || score === undefined) return json({ error: 'missing_fields' }, 400, request);

  const pts = score === 3 ? 100 : score === 2 ? 66 : score === 1 ? 33 : 0;

  // Upsert primero para que calcStreakFromScores ya cuente el día de hoy
  await db.upsertScore({
    user_id:      payload.sub,
    game_date:    gameDate,
    score,
    points:       pts,
    streak_bonus: 0,       // se recalcula abajo
    total_points: pts,
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
    }),
    db.updateUser(payload.sub, { streak }),
  ]);

  return json({ ok: true, streak }, 200, request);
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

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dates = Object.keys(played).filter(d => DATE_RE.test(d)).sort();
  let last = null, streakLocal = 0;
  const rows = [];

  for (const date of dates) {
    const res = played[date];
    if (res?.score === undefined) continue;
    const prevNext = last
      ? (() => { const d = new Date(last + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })()
      : null;
    streakLocal = (prevNext === date) ? streakLocal + 1 : 1;
    const pts   = res.score === 3 ? 100 : res.score === 2 ? 66 : res.score === 1 ? 33 : 0;
    const bonus = streakLocal >= 2 ? 10 : 0;
    rows.push({ user_id: payload.sub, game_date: date, score: res.score, points: pts, streak_bonus: bonus, total_points: pts + bonus });
    last = date;
  }

  if (rows.length) {
    await db.upsertScores(rows);
    // Racha calculada desde la BD, no desde el historial del cliente
    const streak = await db.calcStreakFromScores(payload.sub);
    await db.updateUser(payload.sub, { streak });
  }

  return json({ ok: true, migrated: rows.length }, 200, request);
}
