import { signJwt, signSession, verifyJwt } from '../lib/jwt.js';

export const AUTH_BASE     = 'https://auth.oestiquest.com';
export const FRONTEND_BASE = 'https://oestiquest.com';

// El state del login social va firmado y con un nonce que también se guarda en una cookie del worker.
// Al volver del proveedor se exige que coincidan: así nadie puede colar en el navegador de otro un login
// o una vinculación que empezó él (CSRF). El usuario a vincular viaja dentro del state firmado.
const STATE_COOKIE  = 'oq_oauth_state';
const STATE_SECONDS = 600;

function stateCookie(value, maxAge) {
  return `${STATE_COOKIE}=${value}; Path=/auth; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function redirect(location, cookie) {
  return new Response(null, { status: 302, headers: { Location: location, 'Set-Cookie': cookie } });
}

// Redirige al frontend con el JWT en el hash (lo recibe oauth-callback.html) y borra la cookie del state
export function oauthSuccess(token, linked = false) {
  const extra = linked ? '&linked=1' : '';
  return redirect(`${FRONTEND_BASE}/oauth-callback.html#token=${token}${extra}`, stateCookie('', 0));
}

export function oauthError(error) {
  return redirect(`${FRONTEND_BASE}/oauth-callback.html#error=${error}`, stateCookie('', 0));
}

// Emite un JWT para el usuario dado
export async function issueToken(user, env) {
  return signSession(user.id, env.JWT_SECRET);
}

// Inicio del flujo: ?link=<ticket de /auth/link-ticket> si es para vincular a la cuenta actual.
// buildUrl(state) devuelve la URL del proveedor.
export async function startOAuth(request, env, buildUrl) {
  const link = new URL(request.url).searchParams.get('link');
  const linkPayload = link ? await verifyJwt(link, env.JWT_SECRET) : null;
  // También se acepta el token de sesión, que es lo que mandaba la web antes del ticket
  const linkUserId = linkPayload?.sub && !linkPayload.pending ? linkPayload.sub : null;

  const nonce = crypto.randomUUID();
  const state = await signJwt({ n: nonce, ...(linkUserId && { l: linkUserId }) }, env.JWT_SECRET, STATE_SECONDS);
  return redirect(buildUrl(state), stateCookie(nonce, STATE_SECONDS));
}

// Al volver: { linkUserId } si el state es válido y coincide con la cookie; null si no
export async function checkOAuthState(request, state, env) {
  const payload = state ? await verifyJwt(state, env.JWT_SECRET) : null;
  const cookie  = (request.headers.get('Cookie') || '')
    .split(';').map(c => c.trim().split('=')).find(([k]) => k === STATE_COOKIE)?.[1];
  if (!payload?.n || payload.n !== cookie) return null;
  return { linkUserId: payload.l || null };
}

// Busca un usuario existente por proveedor OAuth. NO crea usuarios nuevos.
// Si hay cuenta con el mismo email, vincula el proveedor y la devuelve.
// `email` debe venir verificado por el proveedor (ver verifiedEmail): con uno sin verificar,
// cualquiera podría entrar en la cuenta de otro poniendo su email en Discord.
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

// Email del proveedor solo si este lo ha verificado; si no, null
export function verifiedEmail(email, verified) {
  return email && verified === true ? email : null;
}

// JWT pendiente para nuevos usuarios OAuth (antes de que guarden su username).
// El usuario NO existe aún en la BD.
export async function issuePendingToken({ provider, provider_id, email }, env) {
  return signJwt({ pending: true, provider, provider_id: String(provider_id), email: email || null }, env.JWT_SECRET);
}
