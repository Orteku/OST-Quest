// Logros de progresión que concede el servidor (quests perfectas y ranking semanal)
// y lista de logros de tag que el cliente puede desbloquear.

const TAG_LEVELS = [10, 30, 50];
const GAME_TAGS  = ['rpg', 'japanese', 'war', 'shooter', 'fighting', 'horror', 'indie', 'sport', 'platformer', 'puzzle', 'rhythm', 'strategy'];
const TRACK_TAGS = ['asian', 'lyrics', 'retro', 'rock'];

// Compañías (clave → niveles). La clave coincide con DEV_ACHIEVEMENT_TERMS de js/achievements.js
const DEV_LEVELS = {
  nintendo: [10, 20, 30], squareenix: [10, 20, 30], sony: [10, 20, 30], microsoft: [10, 20, 30],
  ubisoft:  [10, 20, 30], capcom:     [10, 20, 30], ea:   [10, 20, 30],
  sega: [10, 20], konami: [10, 20], blizzard: [10, 20], bethesda: [10, 20], koeitecmo: [10, 20],
  valve: [5, 10], obsidian: [5, 10], fromsoftware: [5, 10], bioware: [5, 10], rockstar: [5, 10],
};

// Logros que cuenta el navegador (aciertos por tag, por tag de canción y por compañía) y que el cliente puede desbloquear.
// Mantener sincronizado con los bloques tag_* / track_* / dev_* de ACHIEVEMENTS_DB en js/achievements.js
export const COUNTED_ACHIEVEMENT_IDS = new Set([
  ...GAME_TAGS.flatMap(t  => TAG_LEVELS.map(n => `tag_${t}_${n}`)),
  ...TRACK_TAGS.flatMap(t => TAG_LEVELS.map(n => `track_${t}_${n}`)),
  ...Object.entries(DEV_LEVELS).flatMap(([k, levels]) => levels.map(n => `dev_${k}_${n}`)),
]);

const PERFECT_LEVELS = [1, 10, 30, 50];

// Fechas desde las que cuentan estos logros. No son retroactivos:
// lo anterior se jugó sin saber que había logro en juego.
const PERFECT_ACHIEVEMENTS_FROM = '2026-10-19';  // primera quest que cuenta para los plenos
const WEEKLY_ACHIEVEMENTS_FROM  = '2026-10-19';  // primer lunes que cuenta para el ranking semanal

// Contadores de los logros que concede el servidor (desde sus fechas de inicio).
// Los usa checkServerAchievements y /scores/stats, para mostrar el progreso en el perfil.
// Cada consulta va protegida: si falta la vista o la columna en Supabase, cuenta 0 y no rompe nada.
export async function getServerProgress(db, userId) {
  // Las dos consultas a la vez: el panel final espera al envío de la puntuación para mostrar la posición
  const [perfect, ranks] = await Promise.all([
    db.getPerfectOnTimeCount(userId, PERFECT_ACHIEVEMENTS_FROM)
      .catch(e => { console.error('perfect achievements:', e.message); return 0; }),
    db.getClosedWeekRanks(userId, WEEKLY_ACHIEVEMENTS_FROM)
      .catch(e => { console.error('weekly achievements:', e.message); return []; }),
  ]);
  return {
    perfect,
    top1Weeks: ranks.filter(r => r === 1).length,
    top3Weeks: ranks.filter(r => r <= 3).length,
  };
}

// Devuelve los IDs que el usuario cumple y aún no tiene. `have` = Set de IDs ya desbloqueados.
export async function checkServerAchievements(db, userId, have) {
  const { perfect, top1Weeks, top3Weeks } = await getServerProgress(db, userId);
  const earned = [];
  for (const n of PERFECT_LEVELS) if (perfect >= n) earned.push(`perfect_${n}`);
  if (top1Weeks >= 1) earned.push('week_top1');
  if (top3Weeks >= 1) earned.push('week_top3');
  if (top3Weeks >= 3) earned.push('week_top3_x3');
  return earned.filter(id => !have.has(id));
}
