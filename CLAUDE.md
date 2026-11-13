# Oesti Quest — Contexto del proyecto

Juego diario de adivinar bandas sonoras de videojuegos. El jugador escucha
un fragmento de audio y selecciona a qué juego pertenece entre cuatro portadas.
Hay tres columnas (rondas) por día. Publicado en GitHub Pages como sitio estático
(HTML/CSS/JS puro, sin framework, sin bundler). Cuentas, puntos y logros van por
un Cloudflare Worker (`auth/`) con Supabase como base de datos.

## Arquitectura general

- **`index.html`** — página del juego (`<body data-page="game">`)
- **`profile.html`, `ranking.html`, `soundtracks.html`, `about.html`, `privacy.html`, `terms.html`** — resto de páginas
- **`css/style.css`** — todos los estilos
- **`js/database.js`** — `GAME_DB`: array con los ~800 juegos
- **`js/specials.js`** — eventos especiales (`SPECIAL_EVENTS`, `getSpecialForDate`, `getSpecialPool`,
  `getSpecialTrackIndexes`); también lo usa `update.js`. Si el filtro de un especial (tag de pista,
  compositor en `search`) solo casa con algunas pistas de un juego, solo suenan esas
- **`js/achievements.js`** — `ACHIEVEMENTS_DB`, `DEV_ACHIEVEMENT_TERMS`, `TRACK_ACHIEVEMENT_MAX_YEAR`, comprobación de imágenes
- **`js/algorithm.js`** — selección de grupos y generación de quests (`generateGameForDate`, la usa update.js; el modo GM usa `weightedPickN`)
- **`js/daily.js`** — carga `games.json`, utilidades de fecha, persistencia localStorage
- **`js/header.js`** — header y controles comunes a todas las páginas (botones, Quest Log, estadísticas,
  idioma, tema, tema de especiales, contador) y arranque de i18n y sesión (`siteI18nReady`, `siteAuthReady`)
- **`js/auth.js`** — sesión, perfil, ranking, tarjeta de jugador, logros (comprobación y avisos), `customConfirm()`
- **`js/game.js`** — lógica del juego, modales de partida, modo GM (solo en `index.html`)
- **`js/player.js`** — reproductor de audio HTML5
- **`js/assets.js`** — extrae portada y URL de audio de cada entrada
- **`js/i18n.js`** — internacionalización (es/en); el título de cada página sale de `<body data-title-key>`
- **`js/supabase.js`** — `supabaseSelect()`: fetch de solo lectura a las vistas `ranking_weekly` / `ranking_global` (sin librería de Supabase)
- **`js/ranking.js`, `js/soundtracks.js`** — scripts propios de esas páginas
- **`games.json`** — quests pregeneradas (generado por `update.js`)
- **`update.js`** — script Node.js que regenera `games.json`, `soundtracks.html` e `img/achievements/manifest.json` (correr tras cambios en la DB, el algoritmo, los especiales o las imágenes de logros)
- **`check-links.js`** — verifica que las URLs de audio de `database.js` siguen activas
- **`auth/`** — Cloudflare Worker: login (email, Google, Discord, Twitch, Steam), puntuaciones, logros
- **`knowledge/`** — bestiario (`bestiary.html`): editor interno de la base de juegos, solo rol GM (ver su `CLAUDE.md`)
- **`GLOSARIO.md`** — terminología del proyecto (leer antes de nombrar elementos de la UI)

Orden de carga de scripts en el browser (página del juego):
`database.js` → `i18n.js` → `specials.js` → `achievements.js` → `daily.js` → `algorithm.js` → `assets.js`
→ `player.js` → `supabase.js` → `auth.js` → `header.js` → `game.js`

Las demás páginas cargan lo común (`i18n`, `specials`, `achievements`, `daily`, `supabase`, `auth`, `header`)
más su propio script si lo tienen (`ranking.js`, `soundtracks.js`). El header no se escribe en el HTML:
cada página tiene `<div class="site-header-wrap" id="site-header">` y `<div id="site-controls">`, que
rellena `header.js`. La página del juego lleva `<body data-page="game">` (contador, volumen, tutorial).

## Estructura de GAME_DB

Cada entrada en `js/database.js`:

```js
{
  id: 1,
  game: "Nombre del juego",
  cover: "URL de la portada",
  developer: "Nombre del estudio",  // opcional; lo usan los logros de compañía
  pop: 5,          // popularidad 1-6, usada como filtro en la selección de grupos
  year: 2025,      // año de lanzamiento
  tags: ['rpg', 'adventure'],  // tags de género del juego
  tracks: [
    {
      title: "Nombre de la canción",
      artist: "Compositor",     // opcional
      mp3Url: "URL del audio",
      startSeconds: 30,         // opcional
      tags: ['lyrics'],         // opcional
    }
  ]
}
```

Tags de juego en uso: `action`, `adventure`, `arcade`, `fighting`, `horror`, `indie`, `japanese`, `mmo`,
`platformer`, `puzzle`, `rhythm`, `rpg`, `sandbox`, `shooter`, `sport`, `strategy`, `war`.

Tags de pista: `lyrics` (letra vocal), `rock`, `electronic`, `retro`, `asian`.

## Flujo de generación de quests

1. `update.js` genera grupos para los próximos 365 días usando `generateGameForDate()`
   (con el pool del especial si el día lo es)
2. Cada grupo = 1 respuesta + 3 señuelos, seleccionados por el algoritmo ponderado
3. `games.json` guarda solo IDs: `{ answerId, coverIds[], trackIndex }`
4. En el browser, `daily.js` carga `games.json` y `reconstructFromIds()` reconstruye
   los objetos completos desde `GAME_DB`
5. Tras cualquier cambio en el algoritmo, la base de datos o los especiales, correr `node update.js`.
   Preserva los días pasados y hoy (hoy solo se regenera si es especial y su quest aún no es del especial)

## Algoritmo de selección de grupos (`js/algorithm.js`)

- **Filtro duro**: señuelos con `|pop_señuelo - pop_respuesta| ≤ 1`
- **Scoring ponderado** (`weightedPickN`): año cercano + Jaccard de effective tags + aleatoriedad
- **Effective tags**: `game.tags` + los tags de la pista seleccionada (respuesta)
  o de cualquier pista (señuelos)
- **Modo normal** `{ year:0.30, tags:0.15, random:0.55 }` — predomina la aleatoriedad
- **Modo estricto** `{ year:0.55, tags:0.35, random:0.10 }` — prima año y tags
- Cada quest asigna aleatoriamente el modo estricto a uno de sus tres grupos
- `update.js` carga `algorithm.js` vía archivo temporal (mismo patrón que `database.js`)

## Worker y logros

- Día de juego: de 03:00 UTC a 02:59 UTC (`getGameDay()` en el cliente, `_isOnTime` / `gameDay()` en el worker)
- La partida se registra al responder la tercera columna (`_recordFinishedQuest` en `game.js`)
- Logros de tag/pista/compañía (`tag_*`, `track_*`, `dev_*`): los cuenta el navegador (`checkTagAchievements`)
  en cada acierto de la quest del día, no al terminarla,
  y el worker solo acepta los ids de `auth/src/lib/achievements.js`. Al añadir o cambiar niveles,
  actualizar los dos archivos y las imágenes de `img/achievements/`
- Un logro sin imagen es provisional: no se muestra ni se concede. La web lo sabe por `img/achievements/manifest.json`
  (lo genera `update.js`: correrlo tras añadir imágenes)
- El navegador no genera quests: solo las lee de `games.json`
- Login con email o nombre de usuario; los nombres no distinguen mayúsculas (`ilike` en el worker)
- Login social: `state` firmado + cookie `oq_oauth_state`; vincular usa un ticket de `/auth/link-ticket`
- Límite de intentos (`lib/ratelimit.js`, bindings de `wrangler.jsonc`): 20/min por IP y 5/min por cuenta
  en login, registro, recuperación y cambio de contraseña
- **Rol GM** (`is_gm` en `player_accounts`, se activa a mano en Supabase): da acceso al editor de la base
  de juegos (bestiario, `knowledge/bestiary.html`, rutas `/gm/*`). Sesión propia de 12 h (`purpose: 'gm'`); el worker mira
  `is_gm` en cada petición. No tiene nada que ver con el modo GM del juego (`?gm`), que es abierto a propósito
- No hay entorno local: CORS solo admite oestiquest.com
- Orden de publicación: SQL en Supabase → `npm run deploy` en `auth/` → push de la web

## Convenciones

- Sin framework, sin TypeScript, sin bundler — JS vanilla en todos los archivos del juego
- `update.js` y `check-links.js` son scripts Node.js (no se cargan en el browser)
- Enlaces internos, canónicas y sitemap sin `.html` (`ranking`, `profile`…): GitHub Pages sirve `ranking.html`
  igual, y `header.js` quita el `.html` de la barra si se entra por un enlace antiguo
- Los diálogos de confirmación usan `customConfirm()`, nunca `confirm()` nativo
- `GLOSARIO.md` en la raíz define la terminología oficial de UI — consultarlo antes de nombrar elementos
