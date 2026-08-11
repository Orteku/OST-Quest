// Steam usa OpenID 2.0 (no OAuth 2.0) — el flujo es diferente
import { AUTH_BASE, findOrCreateOauthUser, issueToken, oauthSuccess, oauthError } from './oauth.js';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const REDIRECT_URI = `${AUTH_BASE}/auth/steam/callback`;

// GET /auth/steam — redirige a Steam
export function handleSteamStart() {
  const params = new URLSearchParams({
    'openid.ns':         'http://specs.openid.net/auth/2.0',
    'openid.mode':       'checkid_setup',
    'openid.return_to':  REDIRECT_URI,
    'openid.realm':      AUTH_BASE,
    'openid.identity':   'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return Response.redirect(`${STEAM_OPENID}?${params}`, 302);
}

// GET /auth/steam/callback
export async function handleSteamCallback(request, env, db) {
  const url    = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  if (params['openid.mode'] !== 'id_res') return oauthError('steam_cancelled');

  try {
    // Verificar con Steam que la respuesta es legítima
    const verifyParams = new URLSearchParams({ ...params, 'openid.mode': 'check_authentication' });
    const verifyRes    = await fetch(STEAM_OPENID, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    verifyParams,
    });
    const verifyText = await verifyRes.text();
    if (!verifyText.includes('is_valid:true')) return oauthError('steam_verification_failed');

    // Extraer SteamID64 del claimed_id (format: .../openid/id/STEAMID)
    const steamId = (params['openid.claimed_id'] || '').match(/\/(\d+)$/)?.[1];
    if (!steamId) return oauthError('no_steam_id');

    // Obtener datos del perfil de Steam (opcional, para mostrar avatar en el futuro)
    // Steam no provee email → siempre creamos usuario sin email
    const user  = await findOrCreateOauthUser(db, 'steam', steamId, null);
    const token = await issueToken(user, env);
    return oauthSuccess(token);
  } catch (e) {
    console.error('Steam OpenID error:', e);
    return oauthError('server_error');
  }
}
