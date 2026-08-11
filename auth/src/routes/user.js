import { verifyJwt } from '../lib/jwt.js';
import { json } from '../lib/cors.js';

// Extrae y verifica el JWT del header Authorization
// Devuelve [payload, null] si válido, o [null, errorResponse] si no
export async function requireAuth(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return [null, json({ error: 'unauthorized' }, 401, request)];

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload)  return [null, json({ error: 'invalid_token' }, 401, request)];

  return [payload, null];
}

// GET /auth/me — devuelve perfil del usuario autenticado
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
