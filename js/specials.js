// OST Quest — Eventos especiales
// date: 'YYYY-MM-DD' (fecha exacta) o 'MM-DD' (se repite cada año)
// Pool: usar 'gameIds' (lista de IDs) o 'tag' (filtra GAME_DB por tag). Mínimo ~12 juegos.

const SPECIAL_EVENTS = [
  {
    date:    '2026-09-12',
    label:   'BlizzCon 2026',  // nombre completo (archive, compartir)
    name:    'BlizzCon',       // nombre corto (cabecera)
    color:   '#216EC0',
    gameIds: [51, 140, 141, 160, 325, 663, 66, 328, 335, 336, 83, 589, 129, 142, 636],
  },
  {
    date:    '10-31',          // se repite cada año
    label:   'Halloween',
    name:    'Halloween',
    color:   '#E8720C',
    tag:     'horror',         // filtra GAME_DB por este tag
  },
  {
    date:    '2026-12-11',     // jueves aprox. — actualizar cuando se confirme
    label:   'The Game Awards 2026',
    name:    'The Game Awards',
    color:   '#C9C9C9',
    gameIds: [],               // pendiente: añadir IDs con los nominados
  },
];

function getSpecialForDate(dateStr) {
  const mmdd = dateStr.slice(5);
  return SPECIAL_EVENTS.find(e => e.date === dateStr || e.date === mmdd) || null;
}

// Cuántos especiales caen entre QUEST_START (inclusive) y dateStr (exclusive).
// QUEST_START se define en daily.js — solo se llama desde el browser.
function countSpecialsBefore(dateStr) {
  const start     = typeof QUEST_START !== 'undefined' ? QUEST_START : '2026-06-08';
  const startYear = parseInt(start.slice(0, 4), 10);
  const endYear   = parseInt(dateStr.slice(0, 4), 10);
  let count = 0;
  for (const e of SPECIAL_EVENTS) {
    if (e.date.length === 10) {
      if (e.date >= start && e.date < dateStr) count++;
    } else {
      for (let y = startYear; y <= endYear; y++) {
        const full = `${y}-${e.date}`;
        if (full >= start && full < dateStr) count++;
      }
    }
  }
  return count;
}

if (typeof module !== 'undefined') module.exports = { SPECIAL_EVENTS, getSpecialForDate, countSpecialsBefore };
