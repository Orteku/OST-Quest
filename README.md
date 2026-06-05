# OST Quest 🎮🎵

Juego diario de bandas sonoras de videojuegos. Escucha un fragmento de 30 segundos y elige el juego correcto entre 4 portadas. Mismo juego para todo el mundo, se renueva a las 03:00 UTC.

## Estructura del proyecto

```
ostquest/
├── index.html        # Página principal
├── css/
│   └── style.css     # Estilos
├── js/
│   ├── database.js   # Base de datos de juegos (100 entradas)
│   ├── daily.js      # Juego diario: semilla, estadísticas, progreso
│   ├── assets.js     # Carga de portadas (IGDB / thumbnail YouTube)
│   ├── youtube.js    # Reproductor de audio (YouTube IFrame API)
│   └── game.js       # Controlador principal del juego
└── README.md
```

## Despliegue

Proyecto de HTML/CSS/JS puro, sin backend ni build step. Funciona en cualquier hosting estático.

### Netlify (recomendado, gratis)
Arrastra la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop). Listo en 30 segundos.

### GitHub Pages (gratis)
1. Sube la carpeta a un repositorio de GitHub
2. Settings → Pages → Source: `main branch / root`
3. URL: `https://tuusuario.github.io/ostquest`

### Servidor local (para desarrollo)
```bash
cd ostquest
python -m http.server 8000
# Abrir http://localhost:8000
```
> El audio de YouTube puede no funcionar en local por restricciones del navegador. En hosting funciona sin problemas.

## Cómo funciona

### Juego diario determinista
La fecha actual (UTC, día cambia a las 03:00 UTC) se convierte en una semilla numérica mediante un hash. Esa semilla alimenta un RNG (mulberry32) que selecciona y baraja los grupos de forma idéntica para todos los usuarios sin necesidad de servidor.

### Audio
Usa la **YouTube IFrame API** oficial. Al pulsar play se carga el vídeo de YouTube correspondiente en un reproductor invisible y se reproduce durante 30 segundos. No requiere API key.

### Portadas
Cada juego en `database.js` puede tener:
- `cover`: URL directa a una imagen portrait (recomendado). Se usan URLs de IGDB (`images.igdb.com`).
- Si no hay `cover`, usa el thumbnail de YouTube (`hqdefault.jpg`) como fallback.

### Grupos equilibrados
Cada grupo de 4 portadas tiene juegos con popularidad similar (campo `pop`, rango ±2). Así se evita mezclar un juego muy oscuro con tres AAA superconocidos, lo que haría trivial adivinar.

### Progreso y estadísticas
- El progreso de cada partida se guarda en `localStorage` (`ostquest_prog_YYYY-MM-DD`)
- Las estadísticas globales (jugadas, racha, % aciertos) se guardan en `ostquest_stats`
- El Quest Log muestra los últimos 14 días con su resultado
- Las partidas del Quest Log no afectan a las estadísticas ni a la racha

## Ampliar la base de datos

Edita `js/database.js` y añade entradas al array `GAME_DB`:

```js
{
  id: 101,                    // ID único (no repetir)
  game: "Nombre del juego",   // Nombre visible al jugador
  cover: "https://...",       // URL portrait opcional (recomendado ~400x600px)
  youtubeId: "ID_DEL_VIDEO",  // ID del vídeo de YouTube (parte de la URL tras ?v=)
  startSeconds: 60,           // Segundo donde empieza el fragmento de audio
  pop: 8,                     // Popularidad 1-10 (equilibra los grupos)
  year: 2020                  // Año de lanzamiento (informativo)
}
```

**Cómo encontrar portadas en IGDB:**
1. Busca el juego en [igdb.com](https://www.igdb.com)
2. En la URL de la portada, copia el código (ej. `co4jni`)
3. URL: `https://images.igdb.com/igdb/image/upload/t_cover_big/CODIGO.jpg`

**Nota sobre vídeos de Nintendo:** Nintendo retira periódicamente vídeos de YouTube por copyright. Si una portada o audio falla, busca un nuevo vídeo de la BSO en YouTube, copia el ID de la URL y actualiza `youtubeId` en `database.js`.
