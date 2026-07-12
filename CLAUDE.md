# Oesti Quest — Contexto del proyecto

Juego diario de adivinar bandas sonoras de videojuegos. El jugador escucha
un fragmento de audio y selecciona a qué juego pertenece entre cuatro portadas.
Hay tres columnas (rondas) por día. Publicado en GitHub Pages como sitio estático
(HTML/CSS/JS puro, sin framework, sin bundler).

## Arquitectura general

- **`index.html`** — estructura de la página
- **`css/style.css`** — todos los estilos
- **`js/database.js`** — `GAME_DB`: array con los 500+ juegos
- **`js/algorithm.js`** — algoritmo de selección de grupos (compartido por browser y update.js)
- **`js/daily.js`** — carga `games.json`, utilidades de fecha, persistencia localStorage
- **`js/game.js`** — lógica del juego, modales, modo GM
- **`js/player.js`** — reproductor de audio HTML5
- **`js/assets.js`** — extrae portada y URL de audio de cada entrada
- **`js/i18n.js`** — internacionalización (es/en)
- **`games.json`** — quests pregeneradas para 365 días (generado por `update.js`)
- **`update.js`** — script Node.js que regenera `games.json` (correr tras cambios en la DB o el algoritmo)
- **`backfill.js`** — rellena los últimos 30 días en `games.json` sin sobreescribir existentes
- **`check-links.js`** — verifica que las URLs de audio de `database.js` siguen activas
- **`GLOSARIO.md`** — terminología del proyecto (leer antes de nombrar elementos de la UI)

Orden de carga de scripts en el browser:
`database.js` → `i18n.js` → `daily.js` → `algorithm.js` → `assets.js` → `player.js` → `game.js`

## Estructura de GAME_DB

Cada entrada en `js/database.js`:

```js
{
  id: 1,
  game: "Nombre del juego",
  cover: "URL de la portada",
  pop: 5,          // popularidad 1-6, usada como filtro en la selección de grupos
  year: 2025,      // año de lanzamiento
  tags: ['rpg', 'action'],  // tags de género del juego
  tracks: [
    {
      title: "Nombre de la canción",
      mp3Url: "URL del audio",
      startSeconds: 30,         // opcional
      tags: ['lyrics'],         // opcional, solo en pistas vocales
    }
  ]
}
```

Tags de juego disponibles: `rpg`, `action`, `fps`, `platformer`, `strategy`,
`racing`, `fighting`, `puzzle`, `horror`, `adventure`, `simulation`, `rhythm`,
`roguelike`, `metroidvania`, `sandbox`, `mmo`, `stealth`, `indie`, `visual-novel`.

Tag de pista: solo existe `lyrics` (pistas con letra vocal).

## Flujo de generación de quests

1. `update.js` genera grupos para los próximos 365 días usando `generateGameForDate()`
2. Cada grupo = 1 respuesta + 3 señuelos, seleccionados por el algoritmo ponderado
3. `games.json` guarda solo IDs: `{ answerId, coverIds[], trackIndex }`
4. En el browser, `daily.js` carga `games.json` y `reconstructFromIds()` reconstruye
   los objetos completos desde `GAME_DB`
5. Tras cualquier cambio en el algoritmo o la base de datos, correr `node update.js`

## Algoritmo de selección de grupos (`js/algorithm.js`)

- **Filtro duro**: señuelos con `|pop_señuelo - pop_respuesta| ≤ 1`
- **Scoring ponderado** (`weightedPickN`): año cercano + Jaccard de effective tags + aleatoriedad
- **Effective tags**: `game.tags` + `'lyrics'` si la pista seleccionada (respuesta)
  o cualquier pista (señuelos) tiene ese tag
- **Modo normal** `{ year:0.30, tags:0.15, random:0.55 }` — predomina la aleatoriedad
- **Modo estricto** `{ year:0.55, tags:0.35, random:0.10 }` — prima año y tags
- Cada quest asigna aleatoriamente el modo estricto a uno de sus tres grupos
- `update.js` carga `algorithm.js` vía archivo temporal (mismo patrón que `database.js`)

## Convenciones

- Sin framework, sin TypeScript, sin bundler — JS vanilla en todos los archivos del juego
- `update.js`, `backfill.js`, `check-links.js` son scripts Node.js (no se cargan en el browser)
- Los diálogos de confirmación usan `customConfirm()`, nunca `confirm()` nativo
- `GLOSARIO.md` en la raíz define la terminología oficial de UI — consultarlo antes de nombrar elementos
