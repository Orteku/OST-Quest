// Cloudflare Turnstile: comprueba en el servidor el token que genera el widget del navegador.
// Exige éxito, la acción esperada (register, recover...) y que venga de nuestra web (TURNSTILE_HOSTNAMES).
// Si algo falla o Cloudflare no responde, rechaza (nunca deja pasar por defecto).
// Secreto: TURNSTILE_SECRET (wrangler secret). Dominios: TURNSTILE_HOSTNAMES en wrangler.jsonc.
import { json } from './cors.js';

export async function verifyTurnstile(request, env, token, expectedAction) {
  const hostnames = new Set(String(env.TURNSTILE_HOSTNAMES ?? '').split(',').map(h => h.trim()).filter(Boolean));
  if (typeof token !== 'string' || !token || token.length > 2048 || !env.TURNSTILE_SECRET || !hostnames.size) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    if (!r.ok) return false;
    const result = await r.json();
    return result.success === true && result.action === expectedAction && hostnames.has(result.hostname);
  } catch {
    return false;
  }
}

// Devuelve null si el token vale, o la respuesta 403 que hay que devolver
export async function requireTurnstile(request, env, body, expectedAction) {
  if (await verifyTurnstile(request, env, body?.turnstileToken, expectedAction)) return null;
  return json({ error: 'captcha_failed' }, 403, request);
}
