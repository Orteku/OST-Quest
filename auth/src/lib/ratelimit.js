// Límite de intentos para el login y la recuperación de contraseña, para que no se puedan probar
// contraseñas sin parar: 20 por minuto desde una misma IP y 5 por minuto contra una misma cuenta
// (bindings de wrangler.jsonc). Sin los bindings (p. ej. en `wrangler dev`) no limita.
export async function attemptAllowed(request, env, account = null) {
  const checks = [];
  if (env.LOGIN_IP_LIMITER) {
    checks.push(env.LOGIN_IP_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' }));
  }
  if (env.LOGIN_ACCOUNT_LIMITER && account) {
    checks.push(env.LOGIN_ACCOUNT_LIMITER.limit({ key: String(account).trim().toLowerCase() }));
  }
  const results = await Promise.all(checks);
  return results.every(r => r.success);
}
