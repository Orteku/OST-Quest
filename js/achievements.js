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
    es: { name: 'For those who come after', desc: 'Corre la voz y comparte tu resultado, por los que vendrán después' },
    en: { name: 'For those who come after', desc: 'Spread the word and share your result, for those who come after' },
  },

  // ─── Quests perfectas (las 3 canciones acertadas en la quest del día) ────────
  {
    id:     'perfect_1',
    hidden: false,
    image:  'perfect_1.webp',
    es: { name: 'Another epic victory!', desc: 'Consigue tu primer pleno de aciertos' },
    en: { name: 'Another epic victory!', desc: 'Achieve your first perfect score' },
  },
  {
    id:     'perfect_10',
    hidden: false,
    image:  'perfect_10.webp',
    es: { name: 'You\'re pretty good', desc: 'Consigue 10 plenos de aciertos' },
    en: { name: 'You\'re pretty good', desc: 'Achieve 10 perfect scores' },
  },
  {
    id:     'perfect_30',
    hidden: false,
    image:  'perfect_30.webp',
    es: { name: 'Praise the Sun!', desc: 'Consigue 30 plenos de aciertos' },
    en: { name: 'Praise the Sun!', desc: 'Achieve 30 perfect scores' },
  },
  {
    id:     'perfect_50',
    hidden: false,
    image:  'perfect_50.webp',
    es: { name: 'And I Have Never Known Defeat', desc: 'Consigue 50 plenos de aciertos' },
    en: { name: 'And I Have Never Known Defeat', desc: 'Achieve 50 perfect scores' },
  },

  // ─── Ranking semanal (semanas ya cerradas; los empates comparten puesto) ─────
  {
    id:     'week_top1',
    hidden: false,
    image:  'week_top1.webp',
    es: { name: 'Dominating!', desc: 'Termina una semana en el primer puesto del ranking' },
    en: { name: 'Dominating!', desc: 'Finish a week in first place in the ranking' },
  },
  {
    id:     'week_top3',
    hidden: false,
    image:  'week_top3.webp',
    es: { name: 'Legendary!', desc: 'Termina una semana entre los 3 primeros del ranking' },
    en: { name: 'Legendary!', desc: 'Finish a week in the top 3 of the ranking' },
  },
  {
    id:     'week_top3_x3',
    hidden: false,
    image:  'week_top3_x3.webp',
    es: { name: 'Rampage!', desc: 'Termina 3 semanas entre los 3 primeros del ranking' },
    en: { name: 'Rampage!', desc: 'Finish 3 weeks in the top 3 of the ranking' },
  },

  // ─── Aciertos por tag de juego (id: tag_{tag}_{n}) ────────────────────
  // Solo quests del día; cada acierto suma aunque se repita el juego. El navegador cuenta los aciertos
  // de cada tag/nivel a partir de estos id. Mantener sincronizado con COUNTED_ACHIEVEMENT_IDS del worker.
  {
    id:     'tag_rpg_20',
    hidden: false,
    image:  'tag_rpg_20.webp',
    es: { name: 'Let\'s Achieve!', desc: 'Acierta 20 juegos de RPG en la quest del día' },
    en: { name: 'Let\'s Achieve!', desc: 'Guess 20 RPG games in the daily quest' },
  },
  {
    id:     'tag_rpg_35',
    hidden: false,
    image:  'tag_rpg_35.webp',
    es: { name: 'These Trophies Have Seen Everything', desc: 'Acierta 35 juegos de RPG en la quest del día' },
    en: { name: 'These Trophies Have Seen Everything', desc: 'Guess 35 RPG games in the daily quest' },
  },
  {
    id:     'tag_rpg_50',
    hidden: false,
    image:  'tag_rpg_50.webp',
    es: { name: 'Despite Everything, It\'s Still Your Trophy', desc: 'Acierta 50 juegos de RPG en la quest del día' },
    en: { name: 'Despite Everything, It\'s Still Your Trophy', desc: 'Guess 50 RPG games in the daily quest' },
  },
  {
    id:     'tag_japanese_20',
    hidden: false,
    image:  'tag_japanese_20.webp',
    es: { name: 'Looking Cool, Player!', desc: 'Acierta 20 juegos japoneses en la quest del día' },
    en: { name: 'Looking Cool, Player!', desc: 'Guess 20 Japanese games in the daily quest' },
  },
  {
    id:     'tag_japanese_35',
    hidden: false,
    image:  'tag_japanese_35.webp',
    es: { name: '¡Trofeos a la humanidad!', desc: 'Acierta 35 juegos japoneses en la quest del día' },
    en: { name: 'Trophies to Mankind!', desc: 'Guess 35 Japanese games in the daily quest' },
  },
  {
    id:     'tag_japanese_50',
    hidden: false,
    image:  'tag_japanese_50.webp',
    es: { name: 'Dame da ne 🎵', desc: 'Acierta 50 juegos japoneses en la quest del día' },
    en: { name: 'Dame da ne 🎵', desc: 'Guess 50 Japanese games in the daily quest' },
  },
  {
    id:     'tag_war_10',
    hidden: false,
    image:  'tag_war_10.webp',
    es: { name: 'Press F to Pay Respects to the Trophy', desc: 'Acierta 10 juegos bélicos en la quest del día' },
    en: { name: 'Press F to Pay Respects to the Trophy', desc: 'Guess 10 war games in the daily quest' },
  },
  {
    id:     'tag_war_20',
    hidden: false,
    image:  'tag_war_20.webp',
    es: { name: 'Jugador, la misión ha terminado', desc: 'Acierta 20 juegos bélicos en la quest del día' },
    en: { name: 'Player, the Mission Is Over', desc: 'Guess 20 war games in the daily quest' },
  },
  {
    id:     'tag_war_30',
    hidden: false,
    image:  'tag_war_30.webp',
    es: { name: 'War. War Never Changes', desc: 'Acierta 30 juegos bélicos en la quest del día' },
    en: { name: 'War. War Never Changes', desc: 'Guess 30 war games in the daily quest' },
  },
  {
    id:     'tag_shooter_10',
    hidden: false,
    image:  'tag_shooter_10.webp',
    es: { name: '¡Victoria Magistral!', desc: 'Acierta 10 shooters en la quest del día' },
    en: { name: 'Victory Royale!', desc: 'Guess 10 shooters in the daily quest' },
  },
  {
    id:     'tag_shooter_30',
    hidden: false,
    image:  'tag_shooter_30.webp',
    es: { name: 'How About a Nice Cup of Liber-Trophy?', desc: 'Acierta 30 shooters en la quest del día' },
    en: { name: 'How About a Nice Cup of Liber-Trophy?', desc: 'Guess 30 shooters in the daily quest' },
  },
  {
    id:     'tag_shooter_50',
    hidden: false,
    image:  'tag_shooter_50.webp',
    es: { name: 'No Gods or Kings. Only Trophy', desc: 'Acierta 50 shooters en la quest del día' },
    en: { name: 'No Gods or Kings. Only Trophy', desc: 'Guess 50 shooters in the daily quest' },
  },
  {
    id:     'tag_fighting_10',
    hidden: false,
    image:  'tag_fighting_10.webp',
    es: { name: 'Hadouken!', desc: 'Acierta 10 juegos de lucha en la quest del día' },
    en: { name: 'Hadouken!', desc: 'Guess 10 fighting games in the daily quest' },
  },
  {
    id:     'tag_fighting_20',
    hidden: false,
    image:  'tag_fighting_20.webp',
    es: { name: 'Perfect!', desc: 'Acierta 20 juegos de lucha en la quest del día' },
    en: { name: 'Perfect!', desc: 'Guess 20 fighting games in the daily quest' },
  },
  {
    id:     'tag_fighting_30',
    hidden: false,
    image:  'tag_fighting_30.webp',
    es: { name: 'Fatality!', desc: 'Acierta 30 juegos de lucha en la quest del día' },
    en: { name: 'Fatality!', desc: 'Guess 30 fighting games in the daily quest' },
  },
  {
    id:     'tag_horror_10',
    hidden: false,
    image:  'tag_horror_10.webp',
    es: { name: 'There Was a Trophy Here. It\'s Gone Now.', desc: 'Acierta 10 juegos de terror en la quest del día' },
    en: { name: 'There Was a Trophy Here. It\'s Gone Now.', desc: 'Guess 10 horror games in the daily quest' },
  },
  {
    id:     'tag_horror_30',
    hidden: false,
    image:  'tag_horror_30.webp',
    es: { name: 'Devuélvenos a los logros', desc: 'Acierta 30 juegos de terror en la quest del día' },
    en: { name: 'Make Us a Whole Trophy', desc: 'Guess 30 horror games in the daily quest' },
  },
  {
    id:     'tag_horror_50',
    hidden: false,
    image:  'tag_horror_50.webp',
    es: { name: 'Show Me the Champion of Trophies!', desc: 'Acierta 50 juegos de terror en la quest del día' },
    en: { name: 'Show Me the Champion of Trophies!', desc: 'Guess 50 horror games in the daily quest' },
  },
  {
    id:     'tag_indie_10',
    hidden: false,
    image:  'tag_indie_10.webp',
    es: { name: 'Bapanada', desc: 'Acierta 10 juegos indie en la quest del día' },
    en: { name: 'Bapanada', desc: 'Guess 10 indie games in the daily quest' },
  },
  {
    id:     'tag_indie_30',
    hidden: false,
    image:  'tag_indie_30.webp',
    es: { name: 'A Knockout!', desc: 'Acierta 30 juegos indie en la quest del día' },
    en: { name: 'A Knockout!', desc: 'Guess 30 indie games in the daily quest' },
  },
  {
    id:     'tag_indie_50',
    hidden: false,
    image:  'tag_indie_50.webp',
    es: { name: '¡Trofeos para Arstotzka!', desc: 'Acierta 50 juegos indie en la quest del día' },
    en: { name: 'Trophies for Arstotzka!', desc: 'Guess 50 indie games in the daily quest' },
  },
  {
    id:     'tag_sport_5',
    hidden: false,
    image:  'tag_sport_5.webp',
    es: { name: 'BOOMSHAKALAKA!', desc: 'Acierta 5 juegos de deportes en la quest del día' },
    en: { name: 'BOOMSHAKALAKA!', desc: 'Guess 5 sports games in the daily quest' },
  },
  {
    id:     'tag_sport_10',
    hidden: false,
    image:  'tag_sport_10.webp',
    es: { name: '¡MANO CELESTIAL!', desc: 'Acierta 10 juegos de deportes en la quest del día' },
    en: { name: 'GOD HAND!', desc: 'Guess 10 sports games in the daily quest' },
  },
  {
    id:     'tag_platformer_10',
    hidden: false,
    image:  'tag_platformer_10.webp',
    es: { name: '¡Oh, trofeo!', desc: 'Acierta 10 juegos de plataformas en la quest del día' },
    en: { name: 'Oh, Trophy!', desc: 'Guess 10 platformers in the daily quest' },
  },
  {
    id:     'tag_platformer_30',
    hidden: false,
    image:  'tag_platformer_30.webp',
    es: { name: 'Siempre recordaremos el trofeo', desc: 'Acierta 30 juegos de plataformas en la quest del día' },
    en: { name: 'We Shall Always Remember the Trophy', desc: 'Guess 30 platformers in the daily quest' },
  },
  {
    id:     'tag_platformer_50',
    hidden: false,
    image:  'tag_platformer_50.webp',
    es: { name: '¡Qwarktástico!', desc: 'Acierta 50 juegos de plataformas en la quest del día' },
    en: { name: 'Qwarktastic!', desc: 'Guess 50 platformers in the daily quest' },
  },
  {
    id:     'tag_puzzle_10',
    hidden: false,
    image:  'tag_puzzle_10.webp',
    es: { name: 'Logro rápido entra, logro rápido sale', desc: 'Acierta 10 juegos de puzles en la quest del día' },
    en: { name: 'Speedy Trophy Goes In, Speedy Trophy Comes Out', desc: 'Guess 10 puzzle games in the daily quest' },
  },
  {
    id:     'tag_puzzle_30',
    hidden: false,
    image:  'tag_puzzle_30.webp',
    es: { name: '¡Todo logro tiene solución!', desc: 'Acierta 30 juegos de puzles en la quest del día' },
    en: { name: 'Every Trophy Has an Answer!', desc: 'Guess 30 puzzle games in the daily quest' },
  },
  {
    id:     'tag_puzzle_50',
    hidden: false,
    image:  'tag_puzzle_50.webp',
    es: { name: 'TROPHY IS YOU', desc: 'Acierta 50 juegos de puzles en la quest del día' },
    en: { name: 'TROPHY IS YOU', desc: 'Guess 50 puzzle games in the daily quest' },
  },
  {
    id:     'tag_rhythm_5',
    hidden: false,
    image:  'tag_rhythm_5.webp',
    es: { name: 'Pata Pata Pata Pon', desc: 'Acierta 5 juegos de ritmo en la quest del día' },
    en: { name: 'Pata Pata Pata Pon', desc: 'Guess 5 rhythm games in the daily quest' },
  },
  {
    id:     'tag_rhythm_10',
    hidden: false,
    image:  'tag_rhythm_10.webp',
    es: { name: 'YOU ROCK!', desc: 'Acierta 10 juegos de ritmo en la quest del día' },
    en: { name: 'YOU ROCK!', desc: 'Guess 10 rhythm games in the daily quest' },
  },
  {
    id:     'tag_strategy_10',
    hidden: false,
    image:  'tag_strategy_10.webp',
    es: { name: 'Wololó', desc: 'Acierta 10 juegos de estrategia en la quest del día' },
    en: { name: 'Wololo', desc: 'Guess 10 strategy games in the daily quest' },
  },
  {
    id:     'tag_strategy_30',
    hidden: false,
    image:  'tag_strategy_30.webp',
    es: { name: 'Debes construir trofeos adicionales', desc: 'Acierta 30 juegos de estrategia en la quest del día' },
    en: { name: 'You Must Construct Additional Trophies', desc: 'Guess 30 strategy games in the daily quest' },
  },
  {
    id:     'tag_strategy_50',
    hidden: false,
    image:  'tag_strategy_50.webp',
    es: { name: '¡Genial! ¿Y qué era un trofeo?', desc: 'Acierta 50 juegos de estrategia en la quest del día' },
    en: { name: 'Awesome! What\'s a trophy again?', desc: 'Guess 50 strategy games in the daily quest' },
  },

  // ─── Aciertos por tag de canción (id: track_{tag}_{n}) ─────────────────
  {
    id:     'track_asian_5',
    hidden: false,
    image:  'track_asian_5.webp',
    es: { name: 'No Shame in Taking Trophies', desc: 'Acierta 5 canciones de estilo asiático en la quest del día' },
    en: { name: 'No Shame in Taking Trophies', desc: 'Guess 5 Asian-style songs in the daily quest' },
  },
  {
    id:     'track_asian_10',
    hidden: false,
    image:  'track_asian_10.webp',
    es: { name: 'Que tus trofeos sean... eternos', desc: 'Acierta 10 canciones de estilo asiático en la quest del día' },
    en: { name: 'May Your Memories Live On... Forever', desc: 'Guess 10 Asian-style songs in the daily quest' },
  },
  {
    id:     'track_lyrics_10',
    hidden: false,
    image:  'track_lyrics_10.webp',
    es: { name: 'No te pares nunca', desc: 'Acierta 10 canciones con letra en la quest del día' },
    en: { name: 'Keep on keeping on', desc: 'Guess 10 songs with lyrics in the daily quest' },
  },
  {
    id:     'track_lyrics_30',
    hidden: false,
    image:  'track_lyrics_30.webp',
    es: { name: 'You Zetta Sons of Trophies!', desc: 'Acierta 30 canciones con letra en la quest del día' },
    en: { name: 'You Zetta Sons of Trophies!', desc: 'Guess 30 songs with lyrics in the daily quest' },
  },
  {
    id:     'track_lyrics_50',
    hidden: false,
    image:  'track_lyrics_50.webp',
    es: { name: 'Clem!', desc: 'Acierta 50 canciones con letra en la quest del día' },
    en: { name: 'Clem!', desc: 'Guess 50 songs with lyrics in the daily quest' },
  },
  {
    id:     'track_retro_10',
    hidden: false,
    image:  'track_retro_10.webp',
    es: { name: 'Let\'s Go!', desc: 'Acierta 10 canciones retro en la quest del día' },
    en: { name: 'Let\'s Go!', desc: 'Guess 10 retro songs in the daily quest' },
  },
  {
    id:     'track_retro_30',
    hidden: false,
    image:  'track_retro_30.webp',
    es: { name: '¡Salve al rey, nena!', desc: 'Acierta 30 canciones retro en la quest del día' },
    en: { name: 'Hail to the King, Baby!', desc: 'Guess 30 retro songs in the daily quest' },
  },
  {
    id:     'track_retro_50',
    hidden: false,
    image:  'track_retro_50.webp',
    es: { name: 'Se ruega a los jugadores que no fallen en los pasillos', desc: 'Acierta 50 canciones retro en la quest del día' },
    en: { name: 'Players Are Asked Not to Fail in the Corridors', desc: 'Guess 50 retro songs in the daily quest' },
  },
  {
    id:     'track_rock_10',
    hidden: false,
    image:  'track_rock_10.webp',
    es: { name: 'Let\'s Rock!', desc: 'Acierta 10 canciones de rock en la quest del día' },
    en: { name: 'Let\'s Rock!', desc: 'Guess 10 rock songs in the daily quest' },
  },
  {
    id:     'track_rock_30',
    hidden: false,
    image:  'track_rock_30.webp',
    es: { name: 'Nanotrophies, Son!', desc: 'Acierta 30 canciones de rock en la quest del día' },
    en: { name: 'Nanotrophies, Son!', desc: 'Guess 30 rock songs in the daily quest' },
  },
  {
    id:     'track_rock_50',
    hidden: false,
    image:  'track_rock_50.webp',
    es: { name: 'Logra y desgarra', desc: 'Acierta 50 canciones de rock en la quest del día' },
    en: { name: 'Achieve and Tear', desc: 'Guess 50 rock songs in the daily quest' },
  },

  // ─── Aciertos por compañía (id: dev_{clave}_{n}) ──────────────────────────────
  // Igual que los de tag. La compañía se busca por palabras en el campo developer (ver DEV_ACHIEVEMENT_TERMS)
  // y el número de aciertos sale del id. Mantener sincronizado con COUNTED_ACHIEVEMENT_IDS del worker.
  {
    id:     'dev_nintendo_10',
    hidden: false,
    image:  'dev_nintendo_10.webp',
    es: { name: 'It\'s dangerous to go alone! Take this trophy!', desc: 'Acierta 10 juegos de Nintendo en la quest del día' },
    en: { name: 'It\'s dangerous to go alone! Take this trophy!', desc: 'Guess 10 Nintendo games in the daily quest' },
  },
  {
    id:     'dev_nintendo_20',
    hidden: false,
    image:  'dev_nintendo_20.webp',
    es: { name: 'Achieve a Barrel Roll!', desc: 'Acierta 20 juegos de Nintendo en la quest del día' },
    en: { name: 'Achieve a Barrel Roll!', desc: 'Guess 20 Nintendo games in the daily quest' },
  },
  {
    id:     'dev_nintendo_30',
    hidden: false,
    image:  'dev_nintendo_30.webp',
    es: { name: 'It\'s-a me, a Trophy!', desc: 'Acierta 30 juegos de Nintendo en la quest del día' },
    en: { name: 'It\'s-a me, a Trophy!', desc: 'Guess 30 Nintendo games in the daily quest' },
  },
  {
    id:     'dev_squareenix_10',
    hidden: false,
    image:  'dev_squareenix_10.webp',
    es: { name: '¡Se acerca un trofeo!', desc: 'Acierta 10 juegos de Square Enix en la quest del día' },
    en: { name: 'A trophy draws near!', desc: 'Guess 10 Square Enix games in the daily quest' },
  },
  {
    id:     'dev_squareenix_20',
    hidden: false,
    image:  'dev_squareenix_20.webp',
    es: { name: 'Allé voy', desc: 'Acierta 20 juegos de Square Enix en la quest del día' },
    en: { name: 'Allé voy', desc: 'Guess 20 Square Enix games in the daily quest' },
  },
  {
    id:     'dev_squareenix_30',
    hidden: false,
    image:  'dev_squareenix_30.webp',
    es: { name: 'Que tu trofeo te sirva de guía', desc: 'Acierta 30 juegos de Square Enix en la quest del día' },
    en: { name: 'May Your Trophy Be Your Guiding Key', desc: 'Guess 30 Square Enix games in the daily quest' },
  },
  {
    id:     'dev_sony_10',
    hidden: false,
    image:  'dev_sony_10.webp',
    es: { name: 'Whoa!', desc: 'Acierta 10 juegos de Sony en la quest del día' },
    en: { name: 'Whoa!', desc: 'Guess 10 Sony games in the daily quest' },
  },
  {
    id:     'dev_sony_20',
    hidden: false,
    image:  'dev_sony_20.webp',
    es: { name: 'Sic Parvis Magna', desc: 'Acierta 20 juegos de Sony en la quest del día' },
    en: { name: 'Sic Parvis Magna', desc: 'Guess 20 Sony games in the daily quest' },
  },
  {
    id:     'dev_sony_30',
    hidden: false,
    image:  'dev_sony_30.webp',
    es: { name: '¡Sony! ¡Dame un trofeo, y mi vida es tuya!', desc: 'Acierta 30 juegos de Sony en la quest del día' },
    en: { name: 'Sony! Give me a trophy, and my life is yours!', desc: 'Guess 30 Sony games in the daily quest' },
  },
  {
    id:     'dev_microsoft_10',
    hidden: false,
    image:  'dev_microsoft_10.webp',
    es: { name: 'Necesito un trofeo', desc: 'Acierta 10 juegos de Microsoft en la quest del día' },
    en: { name: 'I need a trophy', desc: 'Guess 10 Microsoft games in the daily quest' },
  },
  {
    id:     'dev_microsoft_20',
    hidden: false,
    image:  'dev_microsoft_20.webp',
    es: { name: 'Cazalogros', desc: 'Acierta 20 juegos de Microsoft en la quest del día' },
    en: { name: 'Trophy Chaser', desc: 'Guess 20 Microsoft games in the daily quest' },
  },
  {
    id:     'dev_microsoft_30',
    hidden: false,
    image:  'dev_microsoft_30.webp',
    es: { name: 'Hermanos de logros hasta el fin', desc: 'Acierta 30 juegos de Microsoft en la quest del día' },
    en: { name: 'Trophy Brothers to the End', desc: 'Guess 30 Microsoft games in the daily quest' },
  },
  {
    id:     'dev_ubisoft_10',
    hidden: false,
    image:  'dev_ubisoft_10.webp',
    es: { name: 'Nada es verdad, todo trofeo está permitido', desc: 'Acierta 10 juegos de Ubisoft en la quest del día' },
    en: { name: 'Nothing Is True. Every Trophy Is Permitted', desc: 'Guess 10 Ubisoft games in the daily quest' },
  },
  {
    id:     'dev_ubisoft_20',
    hidden: false,
    image:  'dev_ubisoft_20.webp',
    es: { name: 'BWAAAH!', desc: 'Acierta 20 juegos de Ubisoft en la quest del día' },
    en: { name: 'BWAAAH!', desc: 'Guess 20 Ubisoft games in the daily quest' },
  },
  {
    id:     'dev_ubisoft_30',
    hidden: false,
    image:  'dev_ubisoft_30.webp',
    es: { name: '¿Te he contado alguna vez la definición de logro?', desc: 'Acierta 30 juegos de Ubisoft en la quest del día' },
    en: { name: 'Did I Ever Tell You the Definition of Trophy?', desc: 'Guess 30 Ubisoft games in the daily quest' },
  },
  {
    id:     'dev_capcom_10',
    hidden: false,
    image:  'dev_capcom_10.webp',
    es: { name: '¡Protesto!', desc: 'Acierta 10 juegos de Capcom en la quest del día' },
    en: { name: 'Objection!', desc: 'Guess 10 Capcom games in the daily quest' },
  },
  {
    id:     'dev_capcom_20',
    hidden: false,
    image:  'dev_capcom_20.webp',
    es: { name: '¿Qué estás logrando?', desc: 'Acierta 20 juegos de Capcom en la quest del día' },
    en: { name: 'What Are Ya Achievin\'?', desc: 'Guess 20 Capcom games in the daily quest' },
  },
  {
    id:     'dev_capcom_30',
    hidden: false,
    image:  'dev_capcom_30.webp',
    es: { name: '¡Misión completada!', desc: 'Acierta 30 juegos de Capcom en la quest del día' },
    en: { name: 'Quest Complete!', desc: 'Guess 30 Capcom games in the daily quest' },
  },
  {
    id:     'dev_ea_10',
    hidden: false,
    image:  'dev_ea_10.webp',
    es: { name: 'Sul Sul!', desc: 'Acierta 10 juegos de Electronic Arts en la quest del día' },
    en: { name: 'Sul Sul!', desc: 'Guess 10 Electronic Arts games in the daily quest' },
  },
  {
    id:     'dev_ea_20',
    hidden: false,
    image:  'dev_ea_20.webp',
    es: { name: 'It\'s in the Game!', desc: 'Acierta 20 juegos de Electronic Arts en la quest del día' },
    en: { name: 'It\'s in the Game!', desc: 'Guess 20 Electronic Arts games in the daily quest' },
  },
  {
    id:     'dev_ea_30',
    hidden: false,
    image:  'dev_ea_30.webp',
    es: { name: 'Challenge Everything', desc: 'Acierta 30 juegos de Electronic Arts en la quest del día' },
    en: { name: 'Challenge Everything', desc: 'Guess 30 Electronic Arts games in the daily quest' },
  },
  {
    id:     'dev_sega_10',
    hidden: false,
    image:  'dev_sega_10.webp',
    es: { name: 'Gotta Go Fast!', desc: 'Acierta 10 juegos de Sega en la quest del día' },
    en: { name: 'Gotta Go Fast!', desc: 'Guess 10 Sega games in the daily quest' },
  },
  {
    id:     'dev_sega_20',
    hidden: false,
    image:  'dev_sega_20.webp',
    es: { name: 'It\'s Time to Get Some Crazy Achievements!', desc: 'Acierta 20 juegos de Sega en la quest del día' },
    en: { name: 'It\'s Time to Get Some Crazy Achievements!', desc: 'Guess 20 Sega games in the daily quest' },
  },
  {
    id:     'dev_konami_10',
    hidden: false,
    image:  'dev_konami_10.webp',
    es: { name: 'En mis sueños más inquietos veo ese trofeo', desc: 'Acierta 10 juegos de Konami en la quest del día' },
    en: { name: 'In my restless dreams, I see that trophy', desc: 'Guess 10 Konami games in the daily quest' },
  },
  {
    id:     'dev_konami_20',
    hidden: false,
    image:  'dev_konami_20.webp',
    es: { name: 'Kept You Waiting, Huh?', desc: 'Acierta 20 juegos de Konami en la quest del día' },
    en: { name: 'Kept You Waiting, Huh?', desc: 'Guess 20 Konami games in the daily quest' },
  },
  {
    id:     'dev_blizzard_10',
    hidden: false,
    image:  'dev_blizzard_10.webp',
    es: { name: 'Trabajo, trabajo', desc: 'Acierta 10 juegos de Blizzard en la quest del día' },
    en: { name: 'Work, Work', desc: 'Guess 10 Blizzard games in the daily quest' },
  },
  {
    id:     'dev_blizzard_20',
    hidden: false,
    image:  'dev_blizzard_20.webp',
    es: { name: '¡Los trofeos nunca mueren!', desc: 'Acierta 20 juegos de Blizzard en la quest del día' },
    en: { name: 'Trophies Never Die!', desc: 'Guess 20 Blizzard games in the daily quest' },
  },
  {
    id:     'dev_bethesda_10',
    hidden: false,
    image:  'dev_bethesda_10.webp',
    es: { name: 'Yo solía ganar logros como tú...', desc: 'Acierta 10 juegos de Bethesda en la quest del día' },
    en: { name: 'I Used to Get Trophies Like You...', desc: 'Guess 10 Bethesda games in the daily quest' },
  },
  {
    id:     'dev_bethesda_20',
    hidden: false,
    image:  'dev_bethesda_20.webp',
    es: { name: 'Otro trofeo necesita tu ayuda', desc: 'Acierta 20 juegos de Bethesda en la quest del día' },
    en: { name: 'Another Trophy Needs Your Help', desc: 'Guess 20 Bethesda games in the daily quest' },
  },
  {
    id:     'dev_koeitecmo_10',
    hidden: false,
    image:  'dev_koeitecmo_10.webp',
    es: { name: '¡No persigas a Lu Bu!', desc: 'Acierta 10 juegos de Koei Tecmo en la quest del día' },
    en: { name: 'Do Not Pursue Lu Bu!', desc: 'Guess 10 Koei Tecmo games in the daily quest' },
  },
  {
    id:     'dev_koeitecmo_20',
    hidden: false,
    image:  'dev_koeitecmo_20.webp',
    es: { name: '¡Barril!', desc: 'Acierta 20 juegos de Koei Tecmo en la quest del día' },
    en: { name: 'Barrel!', desc: 'Guess 20 Koei Tecmo games in the daily quest' },
  },
  {
    id:     'dev_valve_5',
    hidden: false,
    image:  'dev_valve_5.webp',
    es: { name: 'Trophy Has Been Planted', desc: 'Acierta 5 juegos de Valve en la quest del día' },
    en: { name: 'Trophy Has Been Planted', desc: 'Guess 5 Valve games in the daily quest' },
  },
  {
    id:     'dev_valve_10',
    hidden: false,
    image:  'dev_valve_10.webp',
    es: { name: 'Manos al trofeo, señor Freeman', desc: 'Acierta 10 juegos de Valve en la quest del día' },
    en: { name: 'Rise and Achieve, Mr. Freeman', desc: 'Guess 10 Valve games in the daily quest' },
  },
  {
    id:     'dev_obsidian_5',
    hidden: false,
    image:  'dev_obsidian_5.webp',
    es: { name: 'La apatía es la muerte', desc: 'Acierta 5 juegos de Obsidian en la quest del día' },
    en: { name: 'Apathy Is Death', desc: 'Guess 5 Obsidian games in the daily quest' },
  },
  {
    id:     'dev_obsidian_10',
    hidden: false,
    image:  'dev_obsidian_10.webp',
    es: { name: 'El juego estaba amañado desde el principio', desc: 'Acierta 10 juegos de Obsidian en la quest del día' },
    en: { name: 'The Game Was Rigged from the Start', desc: 'Guess 10 Obsidian games in the daily quest' },
  },
  {
    id:     'dev_fromsoftware_5',
    hidden: false,
    image:  'dev_fromsoftware_5.webp',
    es: { name: 'Hesitation Is Defeat', desc: 'Acierta 5 juegos de FromSoftware en la quest del día' },
    en: { name: 'Hesitation Is Defeat', desc: 'Guess 5 FromSoftware games in the daily quest' },
  },
  {
    id:     'dev_fromsoftware_10',
    hidden: false,
    image:  'dev_fromsoftware_10.webp',
    es: { name: 'Fear the Old Trophy', desc: 'Acierta 10 juegos de FromSoftware en la quest del día' },
    en: { name: 'Fear the Old Trophy', desc: 'Guess 10 FromSoftware games in the daily quest' },
  },
  {
    id:     'dev_bioware_5',
    hidden: false,
    image:  'dev_bioware_5.webp',
    es: { name: '¡Tírate a sus logros, Bubú!', desc: 'Acierta 5 juegos de BioWare en la quest del día' },
    en: { name: 'Go for the Trophies, Boo!', desc: 'Guess 5 BioWare games in the daily quest' },
  },
  {
    id:     'dev_bioware_10',
    hidden: false,
    image:  'dev_bioware_10.webp',
    es: { name: 'Soy el comandante Shepard y este es mi trofeo favorito', desc: 'Acierta 10 juegos de BioWare en la quest del día' },
    en: { name: 'I\'m Commander Shepard, and This Is My Favorite Trophy', desc: 'Guess 10 BioWare games in the daily quest' },
  },
  {
    id:     'dev_rockstar_5',
    hidden: false,
    image:  'dev_rockstar_5.webp',
    es: { name: 'Canis Canem Edit', desc: 'Acierta 5 juegos de Rockstar en la quest del día' },
    en: { name: 'Canis Canem Edit', desc: 'Guess 5 Rockstar games in the daily quest' },
  },
  {
    id:     'dev_rockstar_10',
    hidden: false,
    image:  'dev_rockstar_10.webp',
    es: { name: 'Have Some Goddamn Trophies!', desc: 'Acierta 10 juegos de Rockstar en la quest del día' },
    en: { name: 'Have Some Goddamn Trophies!', desc: 'Guess 10 Rockstar games in the daily quest' },
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
    en: { name: 'You are not prepared!', desc: 'At least you found a secret — better than nothing.' },
  },
  {
    id:     'easter_fast',
    hidden: true,
    image:  'easter_fast.webp',
    es: { name: 'Estamos a 7 segundos del fin', desc: 'Pues sí fue suficiente tiempo para ti.' },
    en: { name: '7 seconds till the end', desc: 'Indeed time enough for you.' },
  },
  {
    id:     'easter_konami',
    hidden: true,
    image:  'easter_konami.webp',
    es: { name: 'A miserable little pile of secrets!', desc: '¡Has encontrado el código de una civilización antigua!' },
    en: { name: 'A miserable little pile of secrets!', desc: 'You have found the code of an ancient civilization!' },
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

// Palabras que se buscan en el campo developer de cada juego (minúsculas, palabras completas; basta con una).
// La clave es la de los id dev_{clave}_{n}. Para una compañía nueva: añadirla aquí, sus bloques arriba y su id en el worker.
const DEV_ACHIEVEMENT_TERMS = {
  nintendo:     ['nintendo'],
  squareenix:   ['square', 'enix'],         // Square y Enix eran compañías distintas antes de fusionarse
  sony:         ['sony'],
  microsoft:    ['microsoft', 'xbox'],      // muchos juegos figuran como "Xbox Game Studios"
  ubisoft:      ['ubisoft'],
  capcom:       ['capcom'],
  ea:           ['electronic arts'],
  sega:         ['sega', 'atlus'],          // Atlus es de Sega desde 2013
  konami:       ['konami'],
  blizzard:     ['blizzard'],
  bethesda:     ['bethesda'],
  koeitecmo:    ['koei', 'tecmo'],
  valve:        ['valve'],
  obsidian:     ['obsidian'],
  fromsoftware: ['fromsoftware', 'from software'],
  bioware:      ['bioware'],
  rockstar:     ['rockstar'],
};

// Un logro sin imagen en img/achievements/ es provisional: no se muestra ni se desbloquea desde el cliente
const _achImageChecks = {};
const _achImageOk     = {};
// Los resultados se guardan una hora en localStorage: el navegador no cachea las peticiones HEAD,
// y sin esto cada página repetía todas las comprobaciones. Un logro nuevo tarda como mucho una hora en aparecer.
const _ACH_IMG_CACHE_KEY = 'ostquest_ach_img';
const _ACH_IMG_CACHE_TTL = 60 * 60 * 1000;
const _achImgCache = (() => {
  try {
    const c = JSON.parse(localStorage.getItem(_ACH_IMG_CACHE_KEY));
    if (c && Date.now() - c.ts < _ACH_IMG_CACHE_TTL) return c;
  } catch {}
  return { ts: Date.now(), ok: {} };
})();

// Petición HEAD: pregunta si el archivo existe sin descargarlo, para no esperar a imágenes pesadas
function achievementHasImage(a) {
  if (!a?.image || typeof fetch === 'undefined') return Promise.resolve(false);
  if (a.image in _achImgCache.ok) {
    _achImageOk[a.id] = _achImgCache.ok[a.image];
    return Promise.resolve(_achImageOk[a.id]);
  }
  return _achImageChecks[a.id] ??= fetch('img/achievements/' + a.image, { method: 'HEAD' })
    .then(res => {
      _achImgCache.ok[a.image] = res.ok;
      try { localStorage.setItem(_ACH_IMG_CACHE_KEY, JSON.stringify(_achImgCache)); } catch {}
      return res.ok;
    }, () => false)  // error de red: no se guarda, se reintenta la próxima vez
    .then(ok => { _achImageOk[a.id] = ok; return ok; });
}

// Versión síncrona: true solo si ya se comprobó que NO tiene imagen (lo no comprobado aún cuenta como válido)
function achievementImageMissing(a) {
  return _achImageOk[a?.id] === false;
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
