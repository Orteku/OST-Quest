import { AUTH_BASE, findOrCreateOauthUser, issueToken, oauthSuccess, oauthError } from './oauth.js';

const TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const REDIRECT_URI = `${AUTH_BASE}/auth/google/callback`;

// GET /auth/google — redirige a la pantalla de consentimiento de Google
export function handleGoogleStart(request, env) {
  const params = new URLSearchParams({
    client_id:     env.GOOGLE_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'openid email',
    state:         crypto.randomUUID(),
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

// GET /auth/google/callback — intercambia code, crea/encuentra usuario, emite JWT
export async function handleGoogleCallback(request, env, db) {
  const url  = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return oauthError('no_code');

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return oauthError('token_exchange_failed');

    const userRes   = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const gUser = await userRes.json();
    if (!gUser.id) return oauthError('user_fetch_failed');

    const user  = await findOrCreateOauthUser(db, 'google', gUser.id, gUser.email);
    const token = await issueToken(user, env);
    return oauthSuccess(token);
  } catch (e) {
    console.error('Google OAuth error:', e);
    return oauthError('server_error');
  }
}
