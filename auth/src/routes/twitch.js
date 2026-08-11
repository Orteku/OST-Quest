import { AUTH_BASE, findOrCreateOauthUser, issueToken, oauthSuccess, oauthError } from './oauth.js';

const TOKEN_URL    = 'https://id.twitch.tv/oauth2/token';
const USERINFO_URL = 'https://api.twitch.tv/helix/users';
const REDIRECT_URI = `${AUTH_BASE}/auth/twitch/callback`;

// GET /auth/twitch
export function handleTwitchStart(request, env) {
  const params = new URLSearchParams({
    client_id:     env.TWITCH_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'user:read:email',
  });
  return Response.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`, 302);
}

// GET /auth/twitch/callback
export async function handleTwitchCallback(request, env, db) {
  const url  = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return oauthError('no_code');

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return oauthError('token_exchange_failed');

    const userRes  = await fetch(USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id':   env.TWITCH_CLIENT_ID,
      },
    });
    const tData = await userRes.json();
    const tUser = tData.data?.[0];
    if (!tUser) return oauthError('user_fetch_failed');

    const user  = await findOrCreateOauthUser(db, 'twitch', tUser.id, tUser.email);
    const token = await issueToken(user, env);
    return oauthSuccess(token);
  } catch (e) {
    console.error('Twitch OAuth error:', e);
    return oauthError('server_error');
  }
}
