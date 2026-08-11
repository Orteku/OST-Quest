import { corsHeaders, handleOptions, json } from './lib/cors.js';
import { createDb } from './lib/db.js';
import { handleRegister, handleLogin, handleForgotPassword, handleResetPassword, handleChangePassword } from './routes/email.js';
import { handleGoogleStart, handleGoogleCallback } from './routes/google.js';
import { handleDiscordStart, handleDiscordCallback } from './routes/discord.js';
import { handleTwitchStart, handleTwitchCallback } from './routes/twitch.js';
import { handleSteamStart, handleSteamCallback } from './routes/steam.js';
import { handleGetMe, handleSetUsername, handleUnlink, handleDeleteAccount } from './routes/user.js';
import { handleSubmitScore, handleMigrateScores } from './routes/scores.js';

export default {
  async fetch(request, env, ctx) {
    // Preflight CORS
    if (request.method === 'OPTIONS') return handleOptions(request);

    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;
    const db     = createDb(env);

    try {
      // ── Email / contraseña ──────────────────────────────────────────────
      if (path === '/auth/register'         && method === 'POST') return handleRegister(request, env, db);
      if (path === '/auth/login'            && method === 'POST') return handleLogin(request, env, db);
      if (path === '/auth/forgot-password'  && method === 'POST') return handleForgotPassword(request, env, db);
      if (path === '/auth/reset-password'   && method === 'POST') return handleResetPassword(request, env, db);
      if (path === '/auth/change-password'  && method === 'POST') return handleChangePassword(request, env, db);

      // ── Google OAuth ────────────────────────────────────────────────────
      if (path === '/auth/google'           && method === 'GET') return handleGoogleStart(request, env);
      if (path === '/auth/google/callback'  && method === 'GET') return handleGoogleCallback(request, env, db);

      // ── Discord OAuth ───────────────────────────────────────────────────
      if (path === '/auth/discord'          && method === 'GET') return handleDiscordStart(request, env);
      if (path === '/auth/discord/callback' && method === 'GET') return handleDiscordCallback(request, env, db);

      // ── Twitch OAuth ────────────────────────────────────────────────────
      if (path === '/auth/twitch'           && method === 'GET') return handleTwitchStart(request, env);
      if (path === '/auth/twitch/callback'  && method === 'GET') return handleTwitchCallback(request, env, db);

      // ── Steam OpenID ────────────────────────────────────────────────────
      if (path === '/auth/steam'            && method === 'GET') return handleSteamStart(request);
      if (path === '/auth/steam/callback'   && method === 'GET') return handleSteamCallback(request, env, db);

      // ── Perfil de usuario ───────────────────────────────────────────────
      if (path === '/auth/me'              && method === 'GET')    return handleGetMe(request, env, db);
      if (path === '/auth/set-username'    && method === 'POST')   return handleSetUsername(request, env, db);
      if (path === '/auth/unlink'          && method === 'POST')   return handleUnlink(request, env, db);
      if (path === '/auth/account'         && method === 'DELETE') return handleDeleteAccount(request, env, db);

      // ── Scores ──────────────────────────────────────────────────────────
      if (path === '/scores'         && method === 'POST') return handleSubmitScore(request, env, db);
      if (path === '/scores/migrate' && method === 'POST') return handleMigrateScores(request, env, db);

      return json({ error: 'not_found' }, 404, request);
    } catch (e) {
      console.error('Worker error:', e);
      return json({ error: 'server_error', message: e.message }, 500, request);
    }
  },
};
