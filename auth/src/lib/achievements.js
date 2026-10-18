// Logros de progresión que concede el servidor (quests perfectas y ranking semanal)
// y lista de logros de tag que el cliente puede desbloquear.

const TAG_LEVELS = [10, 30, 50];
const GAME_TAGS  = ['rpg', 'japanese', 'war', 'shooter', 'fighting', 'horror', 'indie', 'sport', 'platformer', 'puzzle', 'rhythm', 'strategy'];
const TRACK_TAGS = ['asian', 'lyrics', 'retro', 'rock'];

// Mantener sincronizado con TAG_ACHIEVEMENT_TAGS en js/achievements.js
export const TAG_ACHIEVEMENT_IDS = new Set([
  ...GAME_TAGS.flatMap(t  => TAG_LEVELS.map(n => `tag_${t}_${n}`)),
  ...TRACK_TAGS.flatMap(t => TAG_LEVELS.map(n => `track_${t}_${n}`)),
]);

const PERFECT_LEVELS = [1, 10, 30, 50];

// Fechas desde las que cuentan estos logros. No son retroactivos:
// lo anterior se jugó sin saber que había logro en juego.
const PERFECT_ACHIEVEMENTS_FROM = '2026-10-19';  // primera quest que cuenta para los plenos
const WEEKLY_ACHIEVEMENTS_FROM  = '2026-10-19';  // primer lunes que cuenta para el ranking semanal

// Devuelve los IDs que el usuario cumple y aún no tiene. `have` = Set de IDs ya desbloqueados.
// Cada bloque va protegido: si falta la vista o la columna en Supabase, no rompe el envío de la puntuación.
export async function checkServerAchievements(db, userId, have) {
  const earned = [];

  try {
    const perfect = await db.getPerfectOnTimeCount(userId, PERFECT_ACHIEVEMENTS_FROM);
    for (const n of PERFECT_LEVELS) if (perfect >= n) earned.push(`perfect_${n}`);
  } catch (e) { console.error('perfect achievements:', e.message); }

  try {
    const ranks = await db.getClosedWeekRanks(userId, WEEKLY_ACHIEVEMENTS_FROM);
    const top1  = ranks.filter(r => r === 1).length;
    const top3  = ranks.filter(r => r <= 3).length;
    if (top1 >= 1) earned.push('week_top1');
    if (top3 >= 1) earned.push('week_top3');
    if (top3 >= 3) earned.push('week_top3_x3');
  } catch (e) { console.error('weekly achievements:', e.message); }

  return earned.filter(id => !have.has(id));
}
