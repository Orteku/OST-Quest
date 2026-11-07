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

"Sobrescribir" borra la tabla entera y la vuelve a insertar (antes descarga una copia de `database.js`);
para cambios normales es más seguro "Añadir nuevas" / "Modificar", que solo suben lo que ha cambiado.

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
