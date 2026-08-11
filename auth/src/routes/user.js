import { verifyJwt } from '../lib/jwt.js';
import { json } from '../lib/cors.js';

// Extrae y verifica el JWT del header Authorization
export async function requireAuth(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return [null, json({ error: 'unauthorized' }, 401, request)];

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload)  return [null, json({ error: 'invalid_token' }, 401, request)];

  return [payload, null];
}

// GET /auth/me — devuelve perfil y proveedores vinculados
export async function handleGetMe(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  const user = await db.getUserById(payload.sub);
  if (!user) return json({ error: 'user_not_found' }, 404, request);

  return json({
    id:       user.id,
    email:    user.email,
    username: user.username,
    provider: user.provider,
    providers: {
      email:   !!user.password_hash,
      google:  !!user.google_id,
      discord: !!user.discord_id,
      twitch:  !!user.twitch_id,
      steam:   !!user.steam_id,
    },
  }, 200, request);
}

// POST /auth/set-username  { username }
export async function handleSetUsername(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { username } = body;
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return json({ error: 'invalid_username' }, 400, request);
  }

  const existing = await db.getUserByUsername(username);
  if (existing && existing.id !== payload.sub) {
    return json({ error: 'username_taken' }, 409, request);
  }

  await db.updateUser(payload.sub, { username });
  return json({ ok: true, username }, 200, request);
}

// POST /auth/unlink  { provider }
// Desvincula un proveedor OAuth de la cuenta. Requiere al menos 1 método de login restante.
export async function handleUnlink(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { provider } = body;
  if (!['google', 'discord', 'twitch', 'steam'].includes(provider)) {
    return json({ error: 'invalid_provider' }, 400, request);
  }

  const user = await db.getUserById(payload.sub);
  if (!user) return json({ error: 'user_not_found' }, 404, request);

  // Contar métodos de login disponibles
  const loginMethods = [
    !!user.password_hash,
    !!user.google_id,
    !!user.discord_id,
    !!user.twitch_id,
    !!user.steam_id,
  ].filter(Boolean).length;

  if (loginMethods <= 1) {
    return json({ error: 'cannot_unlink_last_provider' }, 409, request);
  }

  await db.unlinkProvider(payload.sub, provider);
  return json({ ok: true }, 200, request);
}

// DELETE /auth/account — borra la cuenta y todos sus datos
export async function handleDeleteAccount(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;

  await db.deleteUser(payload.sub);
  return json({ ok: true }, 200, request);
}
