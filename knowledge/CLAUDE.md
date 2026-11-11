# Bestiario (editor de la base de juegos) — Contexto

Herramienta interna para gestionar `GAME_DB` (los juegos de Oesti Quest).
Es una única página HTML (`bestiary.html`, antes `database_editor/database_editor.html`) sin dependencias.
Se usa desde https://oestiquest.com/knowledge/bestiary.html (el worker solo acepta ese origen); las cuentas
GM tienen un botón de libro junto a su nombre en el menú de usuario y en el perfil. Lleva `noindex`.
Hace falta entrar con una cuenta de Oesti Quest con **rol GM** (`is_gm` en `player_accounts`).

## Qué hace

- Carga la base de datos desde Supabase (tabla `OSTQuest`), a través del worker
- Permite añadir, editar y eliminar entradas de juegos y sus pistas
- Guarda los cambios en Supabase y también exporta `js/database.js`
  (el archivo que usa el juego) mediante Google Apps Script

## Integraciones externas

### Supabase (a través del worker)
Base de datos remota donde se almacena la copia "fuente de verdad" de GAME_DB.
El editor no habla con Supabase: llama a las rutas `/gm/*` del worker (`auth/src/routes/gm.js`)
con una sesión de GM de 12 horas (`POST /gm/login`, guardada en localStorage `ostquest_gm_token`).
El worker comprueba `is_gm` en cada petición, así que quitar el rol corta el acceso al momento.
Para dar o quitar acceso: `UPDATE public.player_accounts SET is_gm = true/false WHERE username = '…'`.
Las cuentas sin contraseña (solo login social) deben ponerse una en su perfil para entrar.
Tabla principal: `OSTQuest`. Columnas: id, game, cover, developer, pop, year, tags, tracks.
- `tags`: tipo `text[]` (array de texto)
- `tracks`: tipo `jsonb`

Tablas para colaborar en traducciones y especiales:
- `editor_translations` (`game_id`, `lang`, …): nombres de juegos traducidos → `locales/games-es.json`
- `editor_specials`: eventos especiales → `js/specials.js`

Las tres pestañas (Juegos, Traducciones, Especiales) tienen el mismo menú: cargar, guardar, descargar y
subir archivo. "Guardar" compara con lo que había en Supabase al cargar y solo sube lo nuevo y lo modificado
y borra lo quitado (pidiendo confirmación si hay borrados); bajo el botón se ve el resumen de lo pendiente.
Se compara con lo cargado, no con lo que hay al guardar, para no borrar lo que otra persona haya añadido
mientras tanto. En Juegos, cada guardado descarga antes una copia de `database.js`.

"Comprobar enlaces" (pestaña Juegos) prueba todas las pistas de la base cargada. El navegador no puede hacer
HEAD a archive.org ni a KHInsider (CORS), así que carga cada audio con `preload = 'metadata'` (6 a la vez,
máximo 12 s cada uno). Marca bajo cada pista si está rota o si su formato conviene cambiarlo, y filtra la lista.
El audio no da el código HTTP, así que para las rotas se pregunta al worker (`POST /gm/link-status`, 8 URLs por
petición, HEAD y si no GET de 1 byte) y se muestra el código con su explicación (404, 403, 503, timeout…).
Los avisos de formato son los mismos que los de `check-links.js` (raíz; herramienta de terminal sobre
`js/database.js`): si se cambia uno, cambiar los dos. La API de metadatos de archive.org sí admite CORS.

### Google Apps Script (`apps_script.gs`)
Script desplegado como aplicación web en Google Sheets. Recibe los datos del editor
en trozos (chunked) vía GET requests, los ensambla y los escribe en la hoja
`DATABASE`. Desde ahí se puede exportar `js/database.js` al repositorio.

### `abrir.bat` (obsoleto)
Abría el editor con un servidor local en `localhost:8000`. Ya no sirve: el worker solo acepta
peticiones desde oestiquest.com.

## Estructura de una entrada

Ver `CLAUDE.md` en la raíz del proyecto para la estructura completa de `GAME_DB`.
Los campos relevantes para el editor son los mismos que en `js/database.js`.

## Convención importante

Los diálogos de confirmación usan `customConfirm()`, nunca `confirm()` nativo.
