// OST Quest — Eventos especiales
// date: 'YYYY-MM-DD' (fecha exacta) o 'MM-DD' (se repite cada año)
// dateTo: 'YYYY-MM-DD' o 'MM-DD' opcional — extiende el evento a un rango de fechas
// Pool: 'gameIds' (lista de IDs), 'tag' (tags de juego o de pista, separados por comas) y 'search' (texto en nombre, desarrolladora
// y compositor, separado por comas). Se pueden combinar: entra todo lo que case con cualquiera. Mínimo ~12 juegos.
// Si un filtro solo casa con algunas pistas de un juego (tag de pista, compositor), solo suenan esas.
// Imágenes opcionales en img/specials/ con la fecha sin guiones: banner_1031.png (header) y logo_1031.png (favicon)

const SPECIAL_EVENTS = [
  {
    date:    "02-27",
    label:   "Pokémon Day",
    name:    "pokemon",
    color:   "#ffca02",
    search:    "pokémon",
  },
  {
    date:    "05-04",
    label:   "Star Wars",
    name:    "Star Wars",
    color:   "#cacaca",
    search:    "Star Wars",
  },
  {
    date:    "10-31",
    dateTo:  "11-01",
    label:   "Halloween",
    name:    "Halloween",
    color:   "#E8720C",
    tag:       "horror",
  },
  {
    date:    "12-20",
    dateTo:  "12-26",
    label:   "Navidad",
    name:    "Navidad",
    color:   "#1e823f",
  },
  {
    date:    "2026-09-12",
    label:   "BlizzCon 2026",
    name:    "BlizzCon",
    color:   "#216EC0",
    gameIds:   [51, 140, 141, 160, 325, 663, 66, 328, 335, 336, 83, 589, 129, 142, 636, 762],
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

// Tags del campo `tag` de un especial (admite varios separados por comas)
function specialTagList(sp) {
  return String(sp?.tag || '').split(',').map(t => t.trim()).filter(Boolean);
}

// Pistas de `game` que entran en el especial `sp` (índices de game.tracks). Los tres filtros se suman:
// el juego entra si casa con cualquiera de ellos.
//  - gameIds: esos juegos, con todas sus pistas
//  - tag: uno o varios separados por comas; juegos con alguno de ellos (todas las pistas) o solo las pistas que lo tengan
//  - search: términos separados por comas; si casan con el juego (nombre, desarrolladora) valen
//    todas sus pistas, y si solo casan con algunas pistas (compositor) solo esas,
//    para que no suene otra canción del juego.
// Sin especial o sin pool: todas.
function getSpecialTrackIndexes(sp, game) {
  const all = game.tracks.map((_, i) => i);
  if (!sp || !hasGameData(sp)) return all;
  if (sp.gameIds?.length && sp.gameIds.map(Number).includes(Number(game.id))) return all;
  const lc = s => (s || '').toLowerCase();
  const terms = (sp.search || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const tags = specialTagList(sp);
  if (tags.some(t => (game.tags || []).includes(t))) return all;
  if (terms.some(term =>
    lc(game.game).includes(term) || lc(game.developer).includes(term)
  )) return all;
  return all.filter(i => {
    const tr = game.tracks[i];
    if (tags.some(t => (tr.tags || []).includes(t))) return true;
    return terms.some(term => lc(tr.artist).includes(term));
  });
}

// Juegos entre los que se elige la quest de un especial: lista de IDs, tag (de juego o de pista)
// y búsqueda de texto en nombre, desarrolladora y compositor de las pistas (se suman).
// null si el especial no tiene pool. Lo usan update.js (al generar games.json) y el modo GM;
// la pista que suena se elige con getSpecialTrackIndexes.
function getSpecialPool(sp, db) {
  if (!sp || !hasGameData(sp)) return null;
  return db.filter(g => getSpecialTrackIndexes(sp, g).length > 0);
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

if (typeof module !== 'undefined') module.exports = { SPECIAL_EVENTS, getSpecialForDate, countSpecialsBefore, hasGameData, getSpecialPool, getSpecialTrackIndexes };
