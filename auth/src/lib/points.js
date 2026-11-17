// Puntuación de una quest: 3 puntos por acierto (3/6/9), +1 por pleno (3/3 = 10) y +1 con racha de 2 o más días seguidos.
// Si cambia, recalcular las partidas guardadas en Supabase (points, streak_bonus, total_points).
export const pointsForScore = score => [0, 1, 2, 3].includes(score) ? score * 3 + (score === 3 ? 1 : 0) : 0;
export const STREAK_BONUS = 1;
