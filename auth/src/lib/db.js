// Wrapper sobre la REST API de Supabase
// Usa la service role key â†’ bypassa RLS, nunca exponer al cliente
export function createDb(env) {
  const base = env.SUPABASE_URL + '/rest/v1';
  const headers = {
    'apikey':        env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  async function q(path, method = 'GET', body = null, extra = {}) {
    const url = base + path;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: { ...headers, ...extra },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (fetchErr) {
      console.error(`DB fetch network error on ${method} ${url}:`, fetchErr.message);
      throw fetchErr;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`DB HTTP ${res.status} on ${method} ${path}:`, JSON.stringify(err));
      const e = new Error(err.message || 'DB error');
      e.status = res.status;
      e.details = err;
      throw e;
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    // â”€â”€ Usuarios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async getUserByEmail(email) {
      const rows = await q(`/player_accounts?email=eq.${encodeURIComponent(email)}&limit=1`);
      return rows?.[0] ?? null;
    },
    async getUserById(id) {
      const rows = await q(`/player_accounts?id=eq.${id}&limit=1`);
      return rows?.[0] ?? null;
    },
    async getUserByProvider(provider, providerId) {
      const rows = await q(
        `/player_accounts?provider=eq.${provider}&provider_id=eq.${encodeURIComponent(providerId)}&limit=1`
      );
      return rows?.[0] ?? null;
    },
    async getUserByUsername(username) {
      const rows = await q(`/player_accounts?username=eq.${encodeURIComponent(username)}&limit=1`);
      return rows?.[0] ?? null;
    },
    async createUser(data) {
      const rows = await q('/player_accounts', 'POST', data);
      return rows?.[0] ?? null;
    },
    async updateUser(id, data) {
      return q(`/player_accounts?id=eq.${id}`, 'PATCH', data, { Prefer: 'return=minimal' });
    },

    // â”€â”€ Scores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async upsertScore(data) {
      return q('/scores', 'POST', data, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    },
    async upsertScores(rows) {
      return q('/scores', 'POST', rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    },
    async getUserScores(userId) {
      return q(`/scores?user_id=eq.${userId}&select=game_date`);
    },

    // â”€â”€ Tokens de reset de contraseÃ±a â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async createResetToken(userId, token, expiresAt) {
      return q('/password_reset_tokens', 'POST', { user_id: userId, token, expires_at: expiresAt });
    },
    async getResetToken(token) {
      const rows = await q(`/password_reset_tokens?token=eq.${encodeURIComponent(token)}&limit=1`);
      return rows?.[0] ?? null;
    },
    async deleteResetToken(token) {
      return q(`/password_reset_tokens?token=eq.${encodeURIComponent(token)}`, 'DELETE', null, { Prefer: '' });
    },
  };
}


