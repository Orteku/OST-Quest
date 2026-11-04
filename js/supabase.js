// Lectura de las vistas públicas del ranking (API REST de Supabase) con la clave publicable.
// Son consultas de solo lectura: basta un fetch, sin cargar la librería de Supabase en cada página.
// Todo lo que escribe va por el worker (auth.js).
const _SUPABASE_URL = 'https://yegroscvdpzkqfthnqqt.supabase.co';
const _SUPABASE_KEY = 'sb_publishable_yQhqur9pjlFGiYD64HGtFw_e79fcdnA';

// query: parámetros de PostgREST, p. ej. { select: 'username,pts', order: 'pts.desc', limit: 25 }.
// Devuelve el array de filas o null si falla
async function supabaseSelect(view, query) {
  try {
    const res = await fetch(`${_SUPABASE_URL}/rest/v1/${view}?${new URLSearchParams(query)}`, {
      headers: { apikey: _SUPABASE_KEY },
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
