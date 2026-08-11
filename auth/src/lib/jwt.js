// JWT firmado con HMAC-SHA256 usando Web Crypto API (disponible en Workers)
const JWT_ALG = { name: 'HMAC', hash: 'SHA-256' };

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToBytes(str) {
  return new TextEncoder().encode(str);
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw', strToBytes(secret), JWT_ALG, false, ['sign', 'verify']
  );
}

export async function signJwt(payload, secret, expiresInSeconds = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + expiresInSeconds };

  const headerB64  = b64url(strToBytes(JSON.stringify(header)));
  const payloadB64 = b64url(strToBytes(JSON.stringify(claims)));
  const message    = `${headerB64}.${payloadB64}`;

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(JWT_ALG, key, strToBytes(message));

  return `${message}.${b64url(sig)}`;
}

export async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    const sigBin = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'));
    const sig = new Uint8Array([...sigBin].map(c => c.charCodeAt(0)));

    const key = await getKey(secret);
    const valid = await crypto.subtle.verify(JWT_ALG, key, sig, strToBytes(message));
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
