import { AUTH_BASE, buildOAuthState, getLinkUserId, findOrCreateOauthUser, issueToken, oauthSuccess, oauthError } from './oauth.js';

const TOKEN_URL    = 'https://discord.com/api/oauth2/token';
const USERINFO_URL = 'https://discord.com/api/users/@me';
const REDIRECT_URI = `${AUTH_BASE}/auth/discord/callback`;

// GET /auth/discord
export function handleDiscordStart(request, env) {
  const linkJwt = new URL(request.url).searchParams.get('link');
  const params = new URLSearchParams({
    client_id:     env.DISCORD_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'identify email',
    state:         buildOAuthState(linkJwt),
  });
  return Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
}

// GET /auth/discord/callback
export async function handleDiscordCallback(request, env, db) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return oauthError('no_code');

  try {
    const linkUserId = await getLinkUserId(state, env);

    const tokenRes = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return oauthError('token_exchange_failed');

    const userRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const dUser = await userRes.json();
    if (!dUser.id) return oauthError('user_fetch_failed');

    if (linkUserId) {
      const existing = await db.getUserByProvider('discord', dUser.id);
      if (existing && existing.id !== linkUserId) return oauthError('provider_already_linked');
      await db.linkProvider(linkUserId, 'discord', dUser.id);
      const user  = await db.getUserById(linkUserId);
      const token = await issueToken(user, env);
      return oauthSuccess(token, true);
    }

    const user  = await findOrCreateOauthUser(db, 'discord', dUser.id, dUser.email);
    const token = await issueToken(user, env);
    return oauthSuccess(token);
  } catch (e) {
    console.error('Discord OAuth error:', e);
    return oauthError('server_error');
  }
}
