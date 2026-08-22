# Oesti Quest

Juego diario de bandas sonoras de videojuegos. Escucha un fragmento y elige el juego correcto entre 4 portadas. La misma quest para todo el mundo, se renueva a las 03:00 UTC.

## Estructura del proyecto

```
ostquest/
├── index.html              # Página principal
├── soundtracks.html        # Lista de canciones
├── ranking.html            # Ranking de jugadores
├── privacy.html            # Política de privacidad
├── terms.html              # Términos de servicio
├── games.json              # Quests pregeneradas (generado por update.js)
├── sitemap.xml
├── robots.txt
├── update.js               # Regenera games.json (Node.js)
├── backfill.js             # Rellena los últimos 30 días sin sobreescribir
├── check-links.js          # Verifica que las URLs de audio siguen activas
├── css/
│   └── style.css
├── js/
│   ├── database.js         # GAME_DB: 500+ juegos con portadas, audio, tags, pop, year
│   ├── i18n.js             # Internacionalización (es / en)
│   ├── daily.js            # Carga de games.json, lógica de fecha, persistencia, Quest Log
│   ├── algorithm.js        # Selección ponderada de grupos (compartido con update.js)
│   ├── assets.js           # Extrae portada y URL de audio de cada entrada
│   ├── player.js           # Reproductor de audio HTML5
│   ├── supabase.js         # Cliente Supabase (scores, stats, ranking)
│   ├── auth.js             # Autenticación (email, Google, Discord, Twitter, Twitch)
│   └── game.js             # Controlador principal: juego, modales, modo GM
├── locales/
│   ├── es.json             # Textos en español
│   └── en.json             # Textos en inglés
├── auth/                   # Cloudflare Worker (backend de autenticación)
│   └── src/
│       ├── index.js        # Router principal
│       ├── routes/         # email.js, oauth.js, profile.js, score.js, ranking.js
│       ├── lib/            # jwt.js, password.js, mailer.js, cors.js, db.js
│       └── wrangler.toml
└── database_editor/        # Herramienta interna para editar database.js
```

**Orden de carga de scripts en el browser:**
`database.js` → `i18n.js` → `daily.js` → `algorithm.js` → `assets.js` → `player.js` → `supabase.js` → `auth.js` → `game.js`

## Despliegue

Proyecto estático (HTML/CSS/JS puro, sin bundler). Publicado en GitHub Pages.

### Servidor local (desarrollo)
```bash
python -m http.server 8000
# Abrir http://localhost:8000
```

### Backend (Cloudflare Worker)
```bash
cd auth
npx wrangler deploy
```
El Worker gestiona autenticación, scores y ranking. Se conecta a Supabase como base de datos.

## Cómo funciona

### Juego diario
Las quests están pregeneradas en `games.json`. Al cargar la página se lee la entrada correspondiente a la fecha actual (UTC, el día cambia a las 03:00 UTC). `games.json` almacena solo IDs (`answerId`, `coverIds[]`, `trackIndex`); el browser reconstruye los objetos completos desde `GAME_DB` en `database.js`.

### Audio
Usa la API de audio HTML5. Las URLs apuntan principalmente a Archive.org y KHInsider. El reproductor aplica prewarm silencioso al cargar la quest; si falla, reintenta hasta 3 veces con backoff (3 s / 8 s / 15 s). Si el usuario pulsa play y el audio aún no está listo, se realiza un intento fresco.

### Grupos equilibrados
Cada grupo de 4 portadas (1 respuesta + 3 señuelos) se selecciona con el algoritmo de `algorithm.js`:
- **Filtro duro**: `|pop_señuelo - pop_respuesta| ≤ 1`
- **Scoring ponderado**: proximidad de año + Jaccard de effective tags + aleatoriedad
- **Modo normal** (`year: 0.30, tags: 0.15, random: 0.55`) — predomina la aleatoriedad
- **Modo estricto** (`year: 0.55, tags: 0.35, random: 0.10`) — prima año y tags
- Cada quest asigna aleatoriamente el modo estricto a uno de sus tres grupos

**Escala de popularidad (1-6):**
- **6** — Iconos absolutos, conocidos más allá del gaming. *Mario, Zelda, GTA*
- **5** — Grandes éxitos, cualquier gamer los conoce. *Elden Ring, The Witcher 3*
- **4** — Muy conocidos dentro del hobby. *Hollow Knight, Persona 5*
- **3** — Conocidos por aficionados. *Transistor, Ace Combat 04*
- **2** — Nicho o muy retro. *Lufia II...*
- **1** — Reservado para juegos muy desconocidos

### Progreso y estadísticas
- El progreso de cada partida se guarda en `localStorage` (`ostquest_prog_YYYY-MM-DD`)
- Las estadísticas globales se guardan en `ostquest_stats` (local) y en Supabase (si hay sesión)
- El Quest Log muestra todos los días desde el inicio del juego (`QUEST_START`)
- Las partidas del Quest Log no afectan a estadísticas ni racha

### Autenticación y ranking
El backend es un Cloudflare Worker (`auth/`) que se conecta a Supabase. Métodos de login: email/contraseña, Google, Discord, Twitter/X y Twitch. Al iniciar sesión, las estadísticas locales se migran a la cuenta. El ranking es semanal (lunes–domingo) y global.

La puntuación por quest es: 100 pts (3/3) · 66 pts (2/3) · 33 pts (1/3). La racha activa suma +10 pts por quest perfecta consecutiva.

## Actualizar la base de datos

Tras añadir o modificar juegos en `database.js`:

```bash
node update.js
```

El script preserva todos los días hasta hoy y regenera desde mañana en adelante con la base de datos actualizada (365 días futuros).

## Estructura de una entrada en GAME_DB

```js
{
  id: 116,
  game: "Nombre del juego",
  cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/CODIGO.jpg",
  pop: 4,         // Popularidad 1-6
  year: 2020,     // Año de lanzamiento
  tags: ['rpg', 'action'],
  tracks: [
    {
      title: "Nombre de la canción",
      mp3Url: "https://archive.org/download/...",
      startSeconds: 30,       // opcional
      tags: ['lyrics'],       // opcional, solo si la pista tiene letra vocal
    }
  ]
}
```

Tags de juego disponibles: `rpg`, `action`, `fps`, `platformer`, `strategy`, `racing`, `fighting`, `puzzle`, `horror`, `adventure`, `simulation`, `rhythm`, `roguelike`, `metroidvania`, `sandbox`, `mmo`, `stealth`, `indie`, `visual-novel`.

**Cómo encontrar portadas en IGDB:**
1. Busca el juego en [igdb.com](https://www.igdb.com)
2. Copia el código de la URL de la portada (ej. `co4jni`)
3. URL: `https://images.igdb.com/igdb/image/upload/t_cover_big/CODIGO.jpg`
