// Oesti Quest — Definiciones de logros
// Para añadir un logro: copiar un bloque existente y rellenar los campos.
// Las imágenes van en img/achievements/
// Los logros de especiales se generan automáticamente desde SPECIAL_EVENTS (specials.js).

const ACHIEVEMENTS_DB = [

  // ─── Cuenta ──────────────────────────────────────────────────────────────────
  {
    id:     'register',
    hidden: false,
    image:  'register.webp',
    es: { name: '¡Un jugador salvaje apareció!',  desc: 'Has hecho una misión muy difícil: registrarte' },
    en: { name: 'A wild player appeared!',       desc: "You've completed a very difficult mission: creating an account" },
  },

  // ─── Progresión ──────────────────────────────────────────────────────────────
  {
    id:     'streak_7',
    hidden: false,
    image:  'streak_7.webp',
    es: { name: 'Ah shit, here we go again',   desc: 'Has pasado por aquí 7 días seguidos' },
    en: { name: 'Ah shit, here we go again',      desc: "You've been here 7 days in a row" },
  },
  {
    id:     'played_30',
    hidden: false,
    image:  'played_30.webp',
    es: { name: 'Hey! Listen!',          desc: 'Completa 30 quests en total, no hacen falta que sean seguidas' },
    en: { name: 'Hey! Listen!',           desc: "Complete 30 quests in total — they don't have to be consecutive" },
  },
  {
    id:     'anniversary',
    hidden: false,
    image:  'anniversary.webp',
    es: { name: 'The cake is a lie',  desc: 'No hay tarta, pero tu cuenta cumple un año' },
    en: { name: 'The cake is a lie', desc: 'There is no cake, but your account turns one year old' },
  },
  {
    id:     'share',
    hidden: false,
    image:  'share.webp',
    es: { name: 'Corre la voz', desc: 'Comparte tu resultado' },
    en: { name: 'Spread the word', desc: 'Share your result' },
  },

  // ─── Quests perfectas (las 3 canciones acertadas en la quest del día) ────────
  {
    id:     'perfect_1',
    hidden: false,
    image:  'perfect_1.webp',
    es: { name: 'Pleno', desc: 'Acierta las 3 canciones de una quest en su día' },
    en: { name: 'Perfect', desc: 'Guess all 3 songs of a quest on its day' },
  },
  {
    id:     'perfect_10',
    hidden: false,
    image:  'perfect_10.webp',
    es: { name: 'Pleno x10', desc: 'Acierta las 3 canciones de 10 quests en su día' },
    en: { name: 'Perfect x10', desc: 'Guess all 3 songs of 10 quests on their day' },
  },
  {
    id:     'perfect_30',
    hidden: false,
    image:  'perfect_30.webp',
    es: { name: 'Pleno x30', desc: 'Acierta las 3 canciones de 30 quests en su día' },
    en: { name: 'Perfect x30', desc: 'Guess all 3 songs of 30 quests on their day' },
  },
  {
    id:     'perfect_50',
    hidden: false,
    image:  'perfect_50.webp',
    es: { name: 'Pleno x50', desc: 'Acierta las 3 canciones de 50 quests en su día' },
    en: { name: 'Perfect x50', desc: 'Guess all 3 songs of 50 quests on their day' },
  },

  // ─── Ranking semanal (semanas ya cerradas; los empates comparten puesto) ─────
  {
    id:     'week_top1',
    hidden: false,
    image:  'week_top1.webp',
    es: { name: 'Campeón semanal', desc: 'Termina una semana en el primer puesto del ranking' },
    en: { name: 'Weekly champion', desc: 'Finish a week in first place in the ranking' },
  },
  {
    id:     'week_top3',
    hidden: false,
    image:  'week_top3.webp',
    es: { name: 'Podio', desc: 'Termina una semana entre los 3 primeros del ranking' },
    en: { name: 'Podium', desc: 'Finish a week in the top 3 of the ranking' },
  },
  {
    id:     'week_top3_x3',
    hidden: false,
    image:  'week_top3_x3.webp',
    es: { name: 'Habitual del podio', desc: 'Termina 3 semanas entre los 3 primeros del ranking' },
    en: { name: 'Podium regular', desc: 'Finish 3 weeks in the top 3 of the ranking' },
  },

  // ─── Easter eggs (ocultos hasta desbloquear) ─────────────────────────────────
  {
    id:     'easter_line',
    hidden: true,
    image:  'easter_line.webp',
    es: { name: 'Jackpot!', desc: '¡Has encontrado un secreto!' },
    en: { name: 'Jackpot!', desc: 'You found a secret!' },
  },
  {
    id:     'easter_wasted',
    hidden: true,
    image:  'easter_wasted.webp',
    es: { name: '¡No estás preparado!', desc: 'Al menos has encontrado un secreto, algo es algo.' },
    en: { name: 'You are not prepared!', desc: 'At least you found a secret — something is something.' },
  },
  {
    id:     'easter_both',
    hidden: true,
    image:  'easter_both.webp',
    es: { name: 'Wheee! Whooo!', desc: 'Has encontrado el secreto y el "secreto".' },
    en: { name: 'Wheee! Whooo!', desc: 'You found the secret and the "secret".' },
  },

];

// Genera logros de especiales automáticamente desde SPECIAL_EVENTS (solo los que tienen pool; los visuales no dan logro)
// ID: 'special_' + special.date  (ej: 'special_10-31', 'special_2026-09-12')
// Imagen: 'special_' + date sin guiones + '.webp' (ej: 'special_1031.webp')
if (typeof SPECIAL_EVENTS !== 'undefined') {
  for (const sp of SPECIAL_EVENTS.filter(hasGameData)) {
    const label = sp.label || sp.name;
    ACHIEVEMENTS_DB.push({
      id:     'special_' + sp.date,
      hidden: false,
      image:  'special_' + sp.date.replace(/-/g, '') + '.webp',
      es: { name: label, desc: 'Completa el evento especial de ' + label },
      en: { name: label, desc: 'Complete the ' + label + ' special event' },
    });
  }
}

// Logros de aciertos por tag (solo quests del día; cada acierto suma aunque se repita el juego)
// ID: 'tag_rpg_10' (tag de juego) o 'track_lyrics_10' (tag de canción). Imagen: mismo ID + '.webp'
// Mantener sincronizado con TAG_ACHIEVEMENT_IDS en auth/src/lib/achievements.js
const TAG_ACHIEVEMENT_LEVELS = [10, 30, 50];
const TAG_ACHIEVEMENT_TAGS = {
  game: {
    rpg:        { es: ['RPG',         'juegos de RPG'],        en: ['RPG',        'RPG games'] },
    japanese:   { es: ['Japón',       'juegos japoneses'],     en: ['Japan',      'Japanese games'] },
    war:        { es: ['Bélico',      'juegos bélicos'],       en: ['War',        'war games'] },
    shooter:    { es: ['Shooter',     'shooters'],             en: ['Shooter',    'shooters'] },
    fighting:   { es: ['Lucha',       'juegos de lucha'],      en: ['Fighting',   'fighting games'] },
    horror:     { es: ['Terror',      'juegos de terror'],     en: ['Horror',     'horror games'] },
    indie:      { es: ['Indie',       'juegos indie'],         en: ['Indie',      'indie games'] },
    sport:      { es: ['Deportes',    'juegos de deportes'],   en: ['Sports',     'sports games'] },
    platformer: { es: ['Plataformas', 'juegos de plataformas'], en: ['Platformer', 'platformers'] },
    puzzle:     { es: ['Puzles',      'juegos de puzles'],     en: ['Puzzle',     'puzzle games'] },
    rhythm:     { es: ['Ritmo',       'juegos de ritmo'],      en: ['Rhythm',     'rhythm games'] },
    strategy:   { es: ['Estrategia',  'juegos de estrategia'], en: ['Strategy',   'strategy games'] },
  },
  track: {
    asian:  { es: ['Asia',   'canciones de estilo asiático'], en: ['Asia',   'Asian-style songs'] },
    lyrics: { es: ['Letras', 'canciones con letra'],          en: ['Lyrics', 'songs with lyrics'] },
    retro:  { es: ['Retro',  'canciones retro'],              en: ['Retro',  'retro songs'] },
    rock:   { es: ['Rock',   'canciones de rock'],            en: ['Rock',   'rock songs'] },
  },
};

for (const kind of ['game', 'track']) {
  for (const [tag, names] of Object.entries(TAG_ACHIEVEMENT_TAGS[kind])) {
    TAG_ACHIEVEMENT_LEVELS.forEach((n, i) => {
      const id = `${kind === 'game' ? 'tag' : 'track'}_${tag}_${n}`;
      const roman = ['I', 'II', 'III'][i];
      ACHIEVEMENTS_DB.push({
        id,
        hidden: false,
        image:  id + '.webp',
        es: { name: `${names.es[0]} ${roman}`, desc: `Acierta ${n} ${names.es[1]} en la quest del día` },
        en: { name: `${names.en[0]} ${roman}`, desc: `Guess ${n} ${names.en[1]} in the daily quest` },
      });
    });
  }
}

// Un logro sin imagen en img/achievements/ es provisional: no se muestra ni se desbloquea desde el cliente
const _achImageChecks = {};
function achievementHasImage(a) {
  if (!a?.image || typeof Image === 'undefined') return Promise.resolve(false);
  return _achImageChecks[a.id] ??= new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'img/achievements/' + a.image;
  });
}

async function getAvailableAchievements() {
  const ok = await Promise.all(ACHIEVEMENTS_DB.map(achievementHasImage));
  return ACHIEVEMENTS_DB.filter((_, i) => ok[i]);
}

// Busca un logro por ID
function getAchievement(id) {
  return ACHIEVEMENTS_DB.find(a => a.id === id) || null;
}

// Devuelve { name, desc } en el idioma dado ('es' o 'en')
function getAchievementLabel(achievement, lang) {
  return achievement[lang] || achievement.es;
}

if (typeof module !== 'undefined') module.exports = { ACHIEVEMENTS_DB, getAchievement, getAchievementLabel };
