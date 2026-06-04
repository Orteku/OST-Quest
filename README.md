# OST Quest 🎮🎵

Juego diario de adivinanza de bandas sonoras de videojuegos.  
Escucha un fragmento de 30 segundos y elige entre 4 portadas cuál es el juego correcto.

---

## Cómo funciona

- **Cada día a las 03:00 UTC** se genera un nuevo juego (el mismo para todo el mundo).
- **3 grupos** por partida, cada uno con 4 portadas y un fragmento de audio.
- Los grupos 2 y 3 se desbloquean al resolver el anterior.
- El audio viene de la **API de Deezer** (previews de 30 segundos, gratuita y sin clave).
- Los **últimos 14 días** son jugables en el archivo (sin afectar estadísticas).
- Las **estadísticas** (racha, % aciertos) se guardan en `localStorage`.

---

## Estructura del proyecto

```
ostquest/
├── index.html   ← HTML principal
├── style.css    ← Estilos
├── db.js        ← Base de datos de juegos (100+ títulos)
├── engine.js    ← Lógica: semilla diaria, Deezer, estadísticas
├── ui.js        ← Controlador UI: tablero, modal, archivo, stats
└── README.md
```

---

## Despliegue

El proyecto es HTML/CSS/JS puro, **sin backend ni build step**.  
Funciona en cualquier hosting estático.

### GitHub Pages (gratis)

1. Sube los 4 archivos (`index.html`, `style.css`, `db.js`, `engine.js`, `ui.js`) a un repo de GitHub.
2. Ve a **Settings → Pages → Source: main branch / root**.
3. En 1-2 minutos tendrás tu URL: `https://tuusuario.github.io/ostquest/`

### Netlify (gratis, más fácil)

1. Crea cuenta en [netlify.com](https://netlify.com).
2. Arrastra la carpeta `ostquest/` al panel de Netlify.
3. Listo. URL automática en segundos.

### Cloudflare Pages (gratis)

1. Conecta tu repo de GitHub en [pages.cloudflare.com](https://pages.cloudflare.com).
2. Sin configuración de build (es HTML estático).

---

## Ampliar la base de datos

Abre `db.js` y añade entradas al array `GAME_DB`:

```js
{ 
  id: 101,                          // ID único
  game: "Nombre del juego",
  year: 2024,
  platform: "PC",
  pop: 8,                           // 1-10 (popularidad, usada para equilibrar grupos)
  deezerQuery: "Nombre exacto OST"  // Búsqueda en Deezer para encontrar el álbum
},
```

**Sobre `pop`:**
- 10 → Legendario (Zelda, Mario, Skyrim…)
- 7-9 → AAA conocido
- 5-6 → Indie conocido / mid-tier
- 3-4 → Indie nicho
- 1-2 → Muy oscuro

Los grupos se forman con juegos de popularidad similar para que ninguna opción sea obvia.

---

## Notas técnicas

### Semilla diaria
El juego del día se genera con un hash determinista de la fecha UTC (ajustada a las 03:00).  
Esto garantiza que todos los jugadores vean exactamente el mismo juego sin necesidad de servidor.

### API de Deezer
- Búsqueda de álbumes: `https://api.deezer.com/search/album?q=...`
- Tracks del álbum: `https://api.deezer.com/album/{id}/tracks`
- Las previews son `.mp3` de 30 segundos, reproducibles directamente en `<audio>`.
- Se usa el proxy `https://proxy.corsfix.com/` para evitar problemas CORS desde el navegador.
- Sin API key requerida para búsquedas públicas.

### localStorage keys
- `ostquest_stats` → `{ totalPlayed, totalCorrect, currentStreak, maxStreak, lastDayKey }`
- `ostquest_played` → `{ "2025-06-01": 2, "2025-06-02": 3, … }` (aciertos por día)

---

## Próximas mejoras posibles

- [ ] Selección de dificultad (fácil / difícil)
- [ ] Filtros por género o plataforma
- [ ] Modo sin errores (como Musicle Royale)
- [ ] Compartir resultado (emoji grid)
- [ ] PWA / instalable como app
- [ ] Modo oscuro / claro
