# Oesti Quest

Juego diario de bandas sonoras de videojuegos. Escucha un fragmento y elige el juego correcto entre 4 portadas,
en tres columnas. La misma quest para todo el mundo; se renueva a las 03:00 UTC (04:00 en España, 05:00 en verano).

Web estática (HTML/CSS/JS puro, sin framework ni bundler) publicada en GitHub Pages, con un Cloudflare Worker
para cuentas, puntuaciones y logros, y Supabase como base de datos.

## Estructura del proyecto

```
ostquest/
├── index.html              # Juego (<body data-page="game">)
├── profile.html            # Perfil: tarjeta, ajustes de cuenta y trofeos
├── ranking.html            # Ranking semanal y global
├── soundtracks.html        # Lista de canciones (HTML estático generado por update.js)
├── about.html, privacy.html, terms.html
├── oauth-callback.html     # Recibe el token del login social y lo pasa a la ventana principal
├── games.json              # Quests pregeneradas (generado por update.js)
├── sitemap.xml, robots.txt, CNAME
├── update.js               # Regenera games.json, soundtracks.html y la lista de imágenes de logros (Node.js)
├── check-links.js          # Comprueba que las URLs de audio siguen activas (Node.js)
├── css/style.css           # Todos los estilos
├── js/
│   ├── database.js         # GAME_DB: ~800 juegos con portada, pistas, tags, pop y año
│   ├── i18n.js             # Idiomas (es / en) y traducción de nombres de juegos
│   ├── specials.js         # Eventos especiales (también lo usa update.js)
│   ├── achievements.js     # Definición de los logros
│   ├── daily.js            # Fechas, carga de games.json, persistencia en localStorage
│   ├── algorithm.js        # Selección de señuelos y generación de quests (update.js y modo GM)
│   ├── assets.js           # Portada y audio de cada entrada
│   ├── player.js           # Reproductor de audio HTML5 (precarga, fragmento de 30 s, fundido)
│   ├── supabase.js         # Lectura de las vistas del ranking (fetch a la API de Supabase)
│   ├── auth.js             # Sesión, perfil, ranking, logros y avisos de logro
│   ├── header.js           # Header, footer, controles, Quest Log, estadísticas, tema y arranque
│   ├── game.js             # Juego, modales de partida y modo GM (solo en index.html)
│   ├── ranking.js          # Página de ranking
│   └── soundtracks.js      # Página de canciones
├── locales/
│   ├── es.json, en.json    # Textos de la interfaz
│   └── games-es.json       # Nombres de juegos traducidos al español
├── img/                    # banner, logo, achievements/ (logros + manifest.json), specials/ (banner y favicon de eventos)
├── fx/                     # Sonidos e imágenes de efectos (wasted, línea, logro)
├── auth/                   # Cloudflare Worker (ver más abajo)
└── knowledge/              # Bestiario (bestiary.html): editor interno de la base de juegos, solo rol GM
```

**Orden de carga de scripts** (página del juego):
`database.js` → `i18n.js` → `specials.js` → `achievements.js` → `daily.js` → `algorithm.js`
→ `assets.js` → `player.js` → `supabase.js` → `auth.js` → `header.js` → `game.js`

Las demás páginas cargan lo común (`i18n`, `specials`, `achievements`, `daily`, `supabase`, `auth`, `header`) más su
script propio. El header no está en el HTML: cada página tiene `<div id="site-header">`, `<div id="site-controls">` y
`<footer id="site-footer">`, que rellena `header.js`. El título de la pestaña sale de `<body data-title-key="…">`.

## Desarrollo y despliegue

No hay entorno local: el Worker solo acepta peticiones de oestiquest.com (`auth/src/lib/cors.js`).

### Orden al publicar cambios que tocan varias partes
1. **SQL** en Supabase (si hay cambios de tablas o vistas)
2. **Worker**: `cd auth && npm run deploy`
3. **Web**: push a GitHub Pages

### Worker (`auth/`)
```
auth/src/
├── index.js              # Router
├── lib/
│   ├── achievements.js   # Niveles de logros por tag/compañía y logros que concede el servidor
│   ├── cors.js           # Orígenes y métodos permitidos
│   ├── db.js             # Acceso a Supabase (service key)
│   ├── jwt.js            # JWT HMAC; sesión de 30 días renovada al entrar
│   ├── mailer.js         # Correos (Resend)
│   └── password.js       # PBKDF2
└── routes/
    ├── email.js          # Registro, login, cambio y recuperación de contraseña
    ├── oauth.js          # Utilidades comunes del login social
    ├── google.js, discord.js, twitch.js, steam.js
    ├── user.js           # Perfil, nombre, vincular/desvincular, borrar cuenta, logros, tarjeta pública
    └── gm.js             # Editor de la base de juegos (solo cuentas con rol GM)
    └── scores.js         # Puntuaciones, historial, estadísticas, migración
```
Secretos (`npx wrangler secret put …`): `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, credenciales de
Google, Discord y Twitch, y `RESEND_API_KEY`. Ver `auth/.dev.vars.example`.

## Cómo funciona

### Juego diario
`games.json` guarda para cada día solo IDs (`answerId`, `coverIds[]`, `trackIndex`); el navegador reconstruye la quest
desde `GAME_DB`. El día de juego cambia a las 03:00 UTC (`getGameDay()` en el cliente, `_isOnTime` / `gameDay()` en el worker); si la
página está abierta en ese momento, se recarga sola con la quest nueva. El resultado se guarda en cuanto se responde la
tercera columna. El navegador no genera quests: si `games.json` no carga, avisa del error.

### Eventos especiales (`js/specials.js`)
Fechas fijas (`YYYY-MM-DD`) o anuales (`MM-DD`), con rango opcional (`dateTo`). Un especial con pool (`gameIds`,
`tag` o `search`) genera la quest solo con esos juegos, no cuenta en la numeración de quests y da un logro
`special_{fecha}`. Sin pool es solo visual (color, banner y favicon de `img/specials/`).

### Audio
HTML5 `<audio>`. Las URLs apuntan sobre todo a Archive.org y KHInsider (vgmtreasurechest). Las tres pistas de la
quest se precargan; si falla la precarga, se reintenta hasta 3 veces (3 s / 8 s / 15 s). Cada pista suena 30 s
desde `startSeconds`, con fundido en los últimos 3 s.

### Selección de señuelos (`js/algorithm.js`)
- **Filtro duro**: `|pop_señuelo - pop_respuesta| ≤ 1`
- **Puntuación**: proximidad de año + Jaccard de effective tags + aleatoriedad
- **Modo normal** `{ year: 0.30, tags: 0.15, random: 0.55 }` y **modo estricto** `{ year: 0.55, tags: 0.35, random: 0.10 }`;
  cada quest pone uno de sus tres grupos en modo estricto

**Popularidad (1-6):** 6 iconos fuera del gaming (Mario, GTA) · 5 grandes éxitos (Elden Ring) · 4 muy conocidos en el
hobby (Hollow Knight) · 3 conocidos por aficionados (Transistor) · 2 nicho o muy retro · 1 muy desconocidos.

### Cuentas, puntos y ranking
Login con email/contraseña, Google, Discord, Twitch o Steam. Con contraseña se puede entrar con el email o con el
nombre de usuario (útil en cuentas de Steam, que no tienen email). Los nombres no distinguen mayúsculas.
La sesión dura 30 días desde la última visita. El login social usa un `state` firmado más una cookie del worker, y
para vincular una red se pide antes un ticket de 5 minutos (`/auth/link-ticket`) en vez de poner la sesión en la URL.
Las partidas jugadas sin sesión en su día se suben al iniciarla; las del Quest Log no suman puntos.

Puntos por quest: 100 (3/3) · 66 (2/3) · 33 (1/3), +10 si se lleva una racha de 2 o más días seguidos.
Ranking semanal (lunes a domingo) y global, leídos de las vistas `ranking_weekly` y `ranking_global`.

### Logros (`js/achievements.js`)
Un logro sin imagen en `img/achievements/` es provisional: no se muestra ni se concede. La web sabe qué imágenes hay
por `img/achievements/manifest.json`, que genera `update.js`: **después de añadir imágenes de logros hay que correrlo**.
- **Servidor**: registro, racha de 7, 30 quests, aniversario, quests perfectas y podio semanal.
- **Navegador**: aciertos por tag de juego (`tag_*`), por tag de pista (`track_*`) y por compañía (`dev_*`). El worker
  solo acepta los ids de `auth/src/lib/achievements.js`: al añadir o cambiar niveles hay que tocar los dos archivos.
  Las compañías se buscan por palabra completa en `developer` (`DEV_ACHIEVEMENT_TERMS`); los tags de pista pueden
  tener un año máximo (`TRACK_ACHIEVEMENT_MAX_YEAR`, p. ej. retro hasta 1999).
- **Secretos** (`easter_*`), compartir y especiales: los pide el navegador.

## Actualizar la base de juegos

Tras cambiar `database.js`, el algoritmo o los especiales:
```bash
node update.js
```
Conserva los días pasados y hoy (salvo que hoy sea un especial cuya quest aún no sea del especial) y regenera los
365 siguientes. También rehace la lista estática de `soundtracks.html` y `img/achievements/manifest.json`.
`games.json` se escribe con un día por línea (la mitad de tamaño y diffs legibles).

## Estructura de una entrada en GAME_DB

```js
{
  id: 116,
  game: "Nombre del juego",
  cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/CODIGO.webp",
  developer: "Estudio, Distribuidora",   // opcional; lo usan los logros de compañía
  pop: 4,                                // popularidad 1-6
  year: 2020,
  tags: ['rpg', 'adventure'],
  tracks: [
    {
      title: "Nombre de la canción",
      artist: "Compositor",              // opcional
      mp3Url: "https://archive.org/download/...",
      startSeconds: 30,                  // opcional
      tags: ['lyrics'],                  // opcional
    }
  ]
}
```

Tags de juego: `action`, `adventure`, `arcade`, `fighting`, `horror`, `indie`, `japanese`, `mmo`, `platformer`,
`puzzle`, `rhythm`, `rpg`, `sandbox`, `shooter`, `sport`, `strategy`, `war`.
Tags de pista: `lyrics`, `rock`, `electronic`, `retro`, `asian`.

**Portadas de IGDB:** busca el juego en [igdb.com](https://www.igdb.com), copia el código de la portada (ej. `co4jni`) y
usa `https://images.igdb.com/igdb/image/upload/t_cover_big/CODIGO.webp`.
