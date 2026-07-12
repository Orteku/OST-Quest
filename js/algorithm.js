// Group selection algorithm — used by daily.js (seed fallback), game.js (GM mode) and update.js

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

// track: the specific track being played (answer); null for candidates (any-lyrics heuristic)
function effectiveTags(game, track = null) {
  const base = [...(game.tags || [])];
  if (track) {
    if (track.tags?.includes('lyrics')) base.push('lyrics');
  } else {
    if (game.tracks?.some(t => t.tags?.includes('lyrics'))) base.push('lyrics');
  }
  return base;
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
