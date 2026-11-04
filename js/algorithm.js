// Group selection algorithm — used by update.js (generates games.json) and game.js (GM mode)

const WEIGHTS = {
  strict: { year: 0.55, tags: 0.35, random: 0.10 },
  normal: { year: 0.30, tags: 0.15, random: 0.55 },
};

function getYearScore(a, b) {
  const diff = Math.abs((a.year || 2000) - (b.year || 2000));
  return Math.max(0, 1 - diff / 7);
}

function getTagScore(tagsA, tagsB) {
  if (!tagsA.length || !tagsB.length) return 0;
  const setA   = new Set(tagsA);
  const shared = tagsB.filter(t => setA.has(t)).length;
  const union  = new Set([...tagsA, ...tagsB]).size;
  return shared / union;
}

// track: the specific track being played (answer); null for candidates (union of all track tags)
function effectiveTags(game, track = null) {
  const base = new Set(game.tags || []);
  if (track) {
    // Respuesta: tags del track concreto que se está jugando
    for (const tag of (track.tags || [])) base.add(tag);
  } else {
    // Señuelos: unión de tags de todos los tracks del juego
    for (const t of (game.tracks || [])) {
      for (const tag of (t.tags || [])) base.add(tag);
    }
  }
  return [...base];
}

// Weighted random sample without replacement.
// answerEffTags: precomputed effective tags for the answer (game.tags + 'lyrics' if applicable)
// rng: function returning a float in [0, 1) — seededRng() or Math.random
function weightedPickN(candidates, answer, answerEffTags, weights, rng, count) {
  const scored = candidates.map(c => ({
    c,
    w: Math.max(
      getYearScore(answer, c)                      * weights.year  +
      getTagScore(answerEffTags, effectiveTags(c))  * weights.tags  +
      rng()                                         * weights.random,
      0.001
    )
  }));

  const result = [];
  for (let n = 0; n < count && scored.length > 0; n++) {
    const total = scored.reduce((s, x) => s + x.w, 0);
    let r = rng() * total, idx = scored.length - 1;
    for (let i = 0; i < scored.length; i++) {
      r -= scored[i].w;
      if (r <= 0) { idx = i; break; }
    }
    result.push(scored[idx].c);
    scored.splice(idx, 1);
  }
  return result;
}

// ── Generación de la quest de un día (la usa update.js para games.json) ──────────
// Determinista: la misma fecha, base de datos y pool dan siempre la misma quest.

function seededRng(seed) {
  let s = seed;
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tres grupos { answerId, coverIds, trackIndex } elegidos de `pool` (toda la base o la de un especial)
function generateGameForDate(dateStr, pool) {
  const seed = dateToSeed(dateStr);
  const rng  = seededRng(seed);
  const used = new Set();
  const groups = [];
  const shuffled = seededShuffle(pool, rng);

  const strictGroupIndex = Math.floor(rng() * 3);

  for (let gi = 0; gi < 3; gi++) {
    let answer = null;
    for (const g of shuffled) {
      if (!used.has(g.id)) { answer = g; break; }
    }
    if (!answer) break;
    used.add(answer.id);

    const trackIndex    = Math.floor(rng() * answer.tracks.length);
    const answerEffTags = effectiveTags(answer, answer.tracks[trackIndex]);

    const weights    = gi === strictGroupIndex ? WEIGHTS.strict : WEIGHTS.normal;
    const candidates = pool.filter(g => !used.has(g.id) && Math.abs(g.pop - answer.pop) <= 1);

    let distractors = weightedPickN(candidates, answer, answerEffTags, weights, rng, 3);

    if (distractors.length < 3) {
      const distIds = new Set(distractors.map(d => d.id));
      const fallback = pool.filter(g => !used.has(g.id) && !distIds.has(g.id));
      const extra    = weightedPickN(fallback, answer, answerEffTags, WEIGHTS.normal, rng, 3 - distractors.length);
      distractors    = [...distractors, ...extra];
    }

    distractors.forEach(d => used.add(d.id));
    groups.push({
      answerId: answer.id,
      coverIds: seededShuffle([answer, ...distractors], rng).map(g => g.id),
      trackIndex,
    });
  }

  return groups;
}
