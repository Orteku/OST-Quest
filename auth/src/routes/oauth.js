import { signJwt } from '../lib/jwt.js';

export const AUTH_BASE     = 'https://auth.oestiquest.com';
export const FRONTEND_BASE = 'https://oestiquest.com';

// Redirige al frontend con el JWT en el hash (lo recibe oauth-callback.html)
export function oauthSuccess(token) {
  return Response.redirect(`${FRONTEND_BASE}/oauth-callback.html#token=${token}`, 302);
}

export function oauthError(error) {
  return Response.redirect(`${FRONTEND_BASE}/oauth-callback.html#error=${error}`, 302);
}

// Emite un JWT para el usuario dado
export async function issueToken(user, env) {
  return signJwt({ sub: user.id, role: 'authenticated' }, env.JWT_SECRET);
}

// Busca o crea un usuario por proveedor OAuth.
// Si ya existe una cuenta con el mismo email, la vincula al proveedor.
export async function findOrCreateOauthUser(db, provider, providerId, email) {
  // Buscar por proveedor exacto
  let user = await db.getUserByProvider(provider, providerId);
  if (user) return user;

  // Buscar por email (puede tener cuenta con contraseña)
  if (email) {
    user = await db.getUserByEmail(email.toLowerCase());
    if (user) {
      // Vincular este proveedor a la cuenta existente
      await db.updateUser(user.id, { provider, provider_id: providerId });
      return user;
    }
  }

  // Crear usuario nuevo
  return db.createUser({
    id:          crypto.randomUUID(),
    email:       email ? email.toLowerCase() : null,
    provider,
    provider_id: String(providerId),
  });
}
