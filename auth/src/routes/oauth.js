import { signJwt, verifyJwt } from '../lib/jwt.js';

export const AUTH_BASE     = 'https://auth.oestiquest.com';
export const FRONTEND_BASE = 'https://oestiquest.com';

// Redirige al frontend con el JWT en el hash (lo recibe oauth-callback.html)
export function oauthSuccess(token, linked = false) {
  const extra = linked ? '&linked=1' : '';
  return Response.redirect(`${FRONTEND_BASE}/oauth-callback.html#token=${token}${extra}`, 302);
}

export function oauthError(error) {
  return Response.redirect(`${FRONTEND_BASE}/oauth-callback.html#error=${error}`, 302);
}

// Emite un JWT para el usuario dado
export async function issueToken(user, env) {
  return signJwt({ sub: user.id, role: 'authenticated' }, env.JWT_SECRET);
}

// Codifica el state OAuth. Si hay linkJwt, lo incluye para el flujo de vinculación.
export function buildOAuthState(linkJwt) {
  const data = { r: crypto.randomUUID() };
  if (linkJwt) data.l = linkJwt;
  return btoa(JSON.stringify(data));
}

// Extrae el userId a vincular del state. Devuelve null si no es un flujo de vinculación.
export async function getLinkUserId(stateParam, env) {
  if (!stateParam) return null;
  try {
    const data = JSON.parse(atob(stateParam));
    if (!data.l) return null;
    const payload = await verifyJwt(data.l, env.JWT_SECRET);
    return payload?.sub ?? null;
  } catch { return null; }
}

// Busca un usuario existente por proveedor OAuth. NO crea usuarios nuevos.
// Si hay cuenta con el mismo email, vincula el proveedor y la devuelve.
// Devuelve null si no existe ninguna cuenta — el llamador debe emitir un token pendiente.
export async function findExistingOauthUser(db, provider, providerId, email) {
  let user = await db.getUserByProvider(provider, providerId);
  if (user) return user;

  if (email) {
    user = await db.getUserByEmail(email.toLowerCase());
    if (user) {
      await db.linkProvider(user.id, provider, providerId);
      return user;
    }
  }

  return null;
}

// JWT pendiente para nuevos usuarios OAuth (antes de que guarden su username).
// El usuario NO existe aún en la BD.
export async function issuePendingToken({ provider, provider_id, email }, env) {
  return signJwt({ pending: true, provider, provider_id: String(provider_id), email: email || null }, env.JWT_SECRET);
}
