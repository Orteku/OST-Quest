// OST Quest — Eventos especiales
// date: 'YYYY-MM-DD' (fecha exacta) o 'MM-DD' (anual)
// dateTo: 'YYYY-MM-DD' o 'MM-DD' opcional — extiende el evento a un rango de fechas
// Pool (opcional): 'gameIds', 'tag' o 'search'. Sin pool → evento puramente visual (no altera quests).
// Assets opcionales: img/specials/logo_{date sin guiones}.png y banner_{...}.png (ej. logo_1031.png, logo_20261211.png)

const SPECIAL_EVENTS = [
  {
    date:    "05-04",
    label:   "Star Wars",
    name:    "Star Wars",
    color:   "#888888",
    search:    "Star Wars",
  },
  {
    date:    "10-31",
    label:   "Halloween",
    name:    "Halloween",
    color:   "#E8720C",
    tag:       "horror",
  },
  {
    date:    "2026-09-12",
    label:   "BlizzCon 2026",
    name:    "BlizzCon",
    color:   "#216EC0",
    gameIds:   [51, 140, 141, 160, 325, 663, 66, 328, 335, 336, 83, 589, 129, 142, 636],
  },
  {
    date:    "2026-12-11",
    label:   "The Game Awards 2026",
    name:    "The Game Awards",
    color:   "#C9C9C9",
  },
  {
    date:    "2027-02-06",
    label:   "Chinese New Year",
    name:    "Año Chino",
    color:   "#a81717",
    tag:       "asian",
  }
];

function hasGameData(e) {
  return !!(e.gameIds?.length || e.search || e.tag);
}

function getSpecialForDate(dateStr) {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const mmdd = dateStr.slice(5);
  return SPECIAL_EVENTS.find(e => {
    if (!e.dateTo) return e.date === dateStr || e.date === mmdd;
    // Rango: normalizar start y end al año de la consulta
    if (e.date.length === 10) {
      // Fecha exacta con rango
      return dateStr >= e.date && dateStr <= e.dateTo;
    }
    // Rango anual (MM-DD a MM-DD), revisar año actual y anterior por si cruza año
    for (const y of [year - 1, year]) {
      const start = y + '-' + e.date;
      const end = e.dateTo < e.date
        ? (y + 1) + '-' + e.dateTo   // cruza año (ej. 12-28 → 01-02)
        : y + '-' + e.dateTo;
      if (dateStr >= start && dateStr <= end) return true;
    }
    return false;
  }) || null;
}

// Cuántos días de especiales CON pool de juego caen entre QUEST_START (inclusive) y dateStr (exclusive).
// Eventos visuales (sin gameIds/search/tag) no afectan la numeración de quests.
function countSpecialsBefore(dateStr) {
  const start     = typeof QUEST_START !== 'undefined' ? QUEST_START : '2026-06-08';
  const startYear = parseInt(start.slice(0, 4), 10);
  const endYear   = parseInt(dateStr.slice(0, 4), 10);
  let count = 0;
  for (const e of SPECIAL_EVENTS) {
    if (!hasGameData(e)) continue;
    if (e.date.length === 10) {
      // Evento de año exacto: contar cada día del rango [date, dateTo] dentro de [start, dateStr)
      const eEnd = e.dateTo || e.date;
      for (let d = new Date(e.date + 'T12:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)) {
        const ds = d.toISOString().slice(0, 10);
        if (ds >= dateStr || ds > eEnd) break;
        if (ds >= start) count++;
      }
    } else {
      // Evento anual: iterar años posibles
      for (let y = startYear; y <= endYear; y++) {
        const yStart = y + '-' + e.date;
        const yEnd = e.dateTo
          ? (e.dateTo < e.date ? (y + 1) + '-' + e.dateTo : y + '-' + e.dateTo)
          : yStart;
        for (let d = new Date(yStart + 'T12:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)) {
          const ds = d.toISOString().slice(0, 10);
          if (ds >= dateStr || ds > yEnd) break;
          if (ds >= start) count++;
        }
      }
    }
  }
  return count;
}

if (typeof module !== 'undefined') module.exports = { SPECIAL_EVENTS, getSpecialForDate, countSpecialsBefore, hasGameData };