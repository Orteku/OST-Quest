# Database Editor — Contexto

Herramienta interna para gestionar `GAME_DB` (los juegos de Oesti Quest).
Es una única página HTML (`database_editor.html`) sin dependencias locales salvo
la librería de Supabase cargada desde CDN.

## Qué hace

- Carga la base de datos desde Supabase (tabla `games`) al abrir
- Permite añadir, editar y eliminar entradas de juegos y sus pistas
- Guarda los cambios en Supabase y también exporta `js/database.js`
  (el archivo que usa el juego) mediante Google Apps Script

## Integraciones externas

### Supabase
Base de datos remota donde se almacena la copia "fuente de verdad" de GAME_DB.
La conexión usa las credenciales configuradas en el propio editor.
Tabla principal: `games` (columnas: id, game, cover, pop, year, tags, tracks).
- `tags`: tipo `text[]` (array de texto)
- `tracks`: tipo `jsonb`

### Google Apps Script (`apps_script.gs`)
Script desplegado como aplicación web en Google Sheets. Recibe los datos del editor
en trozos (chunked) vía GET requests, los ensambla y los escribe en la hoja
`DATABASE`. Desde ahí se puede exportar `js/database.js` al repositorio.

### `abrir.bat`
Script de Windows para abrir el editor directamente en el navegador.

## Estructura de una entrada

Ver `CLAUDE.md` en la raíz del proyecto para la estructura completa de `GAME_DB`.
Los campos relevantes para el editor son los mismos que en `js/database.js`.

## Convención importante

Los diálogos de confirmación usan `customConfirm()`, nunca `confirm()` nativo.
