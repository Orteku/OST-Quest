// OST Quest — Eventos especiales
// date: 'YYYY-MM-DD' (fecha exacta) o 'MM-DD' (se repite cada año)
// gameIds: IDs de GAME_DB que pueden salir como respuesta Y como señuelo.
//          Necesita mínimo ~12 IDs para que el algoritmo funcione cómodamente.

const SPECIAL_EVENTS = [
  {
    date:    '2026-09-12',
    label:   'BlizzCon 2026',
    gameIds: [51, 140, 141, 160, 325, 663, 66, 328, 335, 336, 83, 589, 129, 142, 636],
  },
];

function getSpecialForDate(dateStr) {
  const mmdd = dateStr.slice(5); // 'MM-DD'
  return SPECIAL_EVENTS.find(e => e.date === dateStr || e.date === mmdd) || null;
}

module.exports = { SPECIAL_EVENTS, getSpecialForDate };
