import { hashPassword, verifyPassword } from '../lib/password.js';
import { signJwt } from '../lib/jwt.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';
import { json } from '../lib/cors.js';

function generateHexToken(len = 32) {
  return [...crypto.getRandomValues(new Uint8Array(len))]
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /auth/register  { email, password }
export async function handleRegister(request, env, db) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { email, password } = body;
  if (!email || !password)   return json({ error: 'email_and_password_required' }, 400, request);
  if (password.length < 6)   return json({ error: 'password_too_short' }, 400, request);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                              return json({ error: 'invalid_email' }, 400, request);

  const existing = await db.getUserByEmail(email.toLowerCase());
  if (existing) return json({ error: 'email_already_registered' }, 409, request);

  const password_hash = await hashPassword(password);
  const user = await db.createUser({
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    password_hash,
    provider: 'email',
  });

  const token = await signJwt({ sub: user.id, role: 'authenticated' }, env.JWT_SECRET);
  return json({ token, user: { id: user.id, username: user.username } }, 201, request);
}

// POST /auth/login  { email, password }
export async function handleLogin(request, env, db) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { email, password } = body;
  if (!email || !password) return json({ error: 'email_and_password_required' }, 400, request);

  const user = await db.getUserByEmail(email.toLowerCase());
  if (!user || !user.password_hash) return json({ error: 'invalid_credentials' }, 401, request);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return json({ error: 'invalid_credentials' }, 401, request);

  const token = await signJwt({ sub: user.id, role: 'authenticated' }, env.JWT_SECRET);
  return json({ token, user: { id: user.id, username: user.username } }, 200, request);
}

// POST /auth/forgot-password  { email }
export async function handleForgotPassword(request, env, db) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { email } = body;
  if (!email) return json({ error: 'email_required' }, 400, request);

  const user = await db.getUserByEmail(email.toLowerCase());
  // Devolvemos OK igualmente para no revelar si el email existe
  if (!user || user.provider !== 'email') return json({ ok: true }, 200, request);

  const token     = generateHexToken();
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString(); // 1 hora

  await db.createResetToken(user.id, token, expiresAt);

  const resetLink = `https://oestiquest.com/reset-password.html?token=${token}`;
  await sendPasswordResetEmail(env, user.email, resetLink);

  return json({ ok: true }, 200, request);
}

// POST /auth/reset-password  { token, password }
export async function handleResetPassword(request, env, db) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, request); }

  const { token, password } = body;
  if (!token || !password)  return json({ error: 'token_and_password_required' }, 400, request);
  if (password.length < 6)  return json({ error: 'password_too_short' }, 400, request);

  const record = await db.getResetToken(token);
  if (!record || new Date(record.expires_at) < new Date()) {
    if (record) await db.deleteResetToken(token);
    return json({ error: 'invalid_or_expired_token' }, 400, request);
  }

  const password_hash = await hashPassword(password);
  await db.updateUser(record.user_id, { password_hash });
  await db.deleteResetToken(token);

  return json({ ok: true }, 200, request);
}
