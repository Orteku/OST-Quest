import { verifyJwt } from '../lib/jwt.js';
import { json } from '../lib/cors.js';
import { issueToken } from './oauth.js';

const CLIENT_UNLOCKABLE = ['easter_line', 'easter_wasted', 'easter_both'];

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

  // JWT pendiente: usuario OAuth nuevo, aún no existe en la BD
  if (payload.pending) return json({ pending: true }, 200, request);

  const user = await db.getUserById(payload.sub);
  if (!user) return json({ error: 'user_not_found' }, 404, request);

  return json({
    id:              user.id,
    email:           user.email,
    username:        user.username,
    provider:        user.provider,
    selected_avatar: user.selected_avatar || null,
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

  // JWT pendiente: crear el usuario ahora que tenemos el username
  if (payload.pending) {
    if (existing) return json({ error: 'username_taken' }, 409, request);
    const providerCol = { google: 'google_id', discord: 'discord_id', twitch: 'twitch_id', steam: 'steam_id' };
    const newUser = await db.createUser({
      id:                        crypto.randomUUID(),
      email:                     payload.email || null,
      provider:                  payload.provider,
      provider_id:               payload.provider_id,
      [providerCol[payload.provider]]: payload.provider_id,
    });
    await db.updateUser(newUser.id, { username });
    await db.unlockAchievement(newUser.id, 'register');
    const token = await issueToken(newUser, env);
    return json({ ok: true, username, token }, 200, request);
  }

  if (existing && existing.id !== payload.sub) {
    return json({ error: 'username_taken' }, 409, request);
  }

  // Primera vez que se pone username (registro por email)
  const currentUser = await db.getUserById(payload.sub);
  const isFirst = !currentUser?.username;
  await db.updateUser(payload.sub, { username });
  if (isFirst) await db.unlockAchievement(payload.sub, 'register');
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

// GET /auth/achievements — logros desbloqueados del usuario
export async function handleGetAchievements(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;
  if (payload.pending) return json([], 200, request);

  const achievements = await db.getUserAchievements(payload.sub);
  return json(achievements || [], 200, request);
}

// POST /auth/achievements/unlock  { achievementId }
// Solo para logros client-side: easter_line, easter_wasted, easter_both
export async function handleUnlockAchievement(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;
  if (payload.pending) return json({ error: 'pending_user' }, 403, request);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { achievementId } = body;

  // Logros de especiales: verificar que el usuario jugó ese día
  if (achievementId.startsWith('special_')) {
    const datePart = achievementId.slice('special_'.length);
    let played;
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      played = await db.hasScoreForDate(payload.sub, datePart);
    } else if (/^\d{2}-\d{2}$/.test(datePart)) {
      played = await db.hasScoreForMonthDay(payload.sub, datePart);
    } else {
      return json({ error: 'invalid_achievement' }, 400, request);
    }
    if (!played) return json({ ok: false, isNew: false }, 200, request);
    const isNew = await db.unlockAchievement(payload.sub, achievementId);
    return json({ ok: true, isNew }, 200, request);
  }

  if (!CLIENT_UNLOCKABLE.includes(achievementId)) {
    return json({ error: 'not_allowed' }, 403, request);
  }

  if (achievementId === 'easter_both') {
    const [hasLine, hasWasted] = await Promise.all([
      db.hasAchievement(payload.sub, 'easter_line'),
      db.hasAchievement(payload.sub, 'easter_wasted'),
    ]);
    if (!hasLine || !hasWasted) return json({ error: 'prerequisites_not_met' }, 403, request);
  }

  const isNew = await db.unlockAchievement(payload.sub, achievementId);
  return json({ ok: true, isNew }, 200, request);
}

// POST /auth/achievements/backfill — concede retroactivamente los logros ya ganados
export async function handleBackfillAchievements(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;
  if (payload.pending) return json({ granted: [] }, 200, request);

  const userId = payload.sub;
  const [user, existing, playedCount] = await Promise.all([
    db.getUserById(userId),
    db.getUserAchievements(userId),
    db.getPlayedCount(userId),
  ]);
  if (!user) return json({ error: 'user_not_found' }, 404, request);

  const have   = new Set(existing.map(a => a.achievement_id));
  const granted = [];

  async function tryGrant(id) {
    if (have.has(id)) return;
    const isNew = await db.unlockAchievement(userId, id);
    if (isNew) granted.push(id);
  }

  // register — cualquier cuenta existente ya lo cumple
  await tryGrant('register');

  // streak_7 — racha actual >= 7
  if ((user.streak || 0) >= 7) await tryGrant('streak_7');

  // played_30 — quests totales >= 30
  if (playedCount >= 30) await tryGrant('played_30');

  // anniversary — cuenta creada hace >= 1 año
  if (user.created_at) {
    const created    = new Date(user.created_at);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (created <= oneYearAgo) await tryGrant('anniversary');
  }

  return json({ granted }, 200, request);
}

// POST /auth/avatar  { avatar: 'filename.png' }
export async function handleSetAvatar(request, env, db) {
  const [payload, err] = await requireAuth(request, env);
  if (err) return err;
  if (payload.pending) return json({ error: 'pending_user' }, 403, request);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { avatar } = body;
  if (!avatar || typeof avatar !== 'string' || avatar.includes('/') || avatar.includes('..') || !/^[\w-]+\.(png|webp)$/i.test(avatar)) {
    return json({ error: 'invalid_avatar' }, 400, request);
  }

  await db.setAvatar(payload.sub, avatar);
  return json({ ok: true }, 200, request);
}
