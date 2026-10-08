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

// Genera logros de especiales automáticamente desde SPECIAL_EVENTS
// ID: 'special_' + special.date  (ej: 'special_10-31', 'special_2026-09-12')
// Imagen: 'special_' + date sin guiones + '.png' (ej: 'special_1031.png')
if (typeof SPECIAL_EVENTS !== 'undefined') {
  for (const sp of SPECIAL_EVENTS) {
    const label = sp.label || sp.name;
    ACHIEVEMENTS_DB.push({
      id:     'special_' + sp.date,
      hidden: false,
      image:  'special_' + sp.date.replace(/-/g, '') + '.webp',
      es: { name: label, desc: 'Completa el evento especial de ' + label + ' en su día' },
      en: { name: label, desc: 'Complete the ' + label + ' special event on its day' },
    });
  }
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
