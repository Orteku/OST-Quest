import { createClient } from '@supabase/supabase-js';

// Crea un cliente Supabase con la service role key (bypassa RLS)
export function createDb(env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function check(res) {
    if (res.error) {
      console.error('DB error:', res.error.code, res.error.message, res.error.details);
      throw Object.assign(new Error(res.error.message), { details: res.error });
    }
    return res.data;
  }

  return {
    // ── Usuarios ─────────────────────────────────────────────────────────────
    async getUserByEmail(email) {
      return check(await supabase.from('player_accounts').select('*').eq('email', email).maybeSingle());
    },
    async getUserById(id) {
      return check(await supabase.from('player_accounts').select('*').eq('id', id).maybeSingle());
    },
    async getUserByProvider(provider, providerId) {
      return check(await supabase.from('player_accounts').select('*').eq('provider', provider).eq('provider_id', String(providerId)).maybeSingle());
    },
    async getUserByUsername(username) {
      return check(await supabase.from('player_accounts').select('*').eq('username', username).maybeSingle());
    },
    async createUser(data) {
      return check(await supabase.from('player_accounts').insert(data).select().single());
    },
    async updateUser(id, data) {
      return check(await supabase.from('player_accounts').update(data).eq('id', id));
    },

    // ── Scores ───────────────────────────────────────────────────────────────
    async upsertScore(data) {
      return check(await supabase.from('scores').upsert(data, { onConflict: 'user_id,game_date' }));
    },
    async upsertScores(rows) {
      return check(await supabase.from('scores').upsert(rows, { onConflict: 'user_id,game_date' }));
    },
    async getUserScores(userId) {
      return check(await supabase.from('scores').select('game_date').eq('user_id', userId));
    },

    // ── Tokens de reset de contraseña ────────────────────────────────────────
    async createResetToken(userId, token, expiresAt) {
      return check(await supabase.from('password_reset_tokens').insert({ user_id: userId, token, expires_at: expiresAt }));
    },
    async getResetToken(token) {
      return check(await supabase.from('password_reset_tokens').select('*').eq('token', token).maybeSingle());
    },
    async deleteResetToken(token) {
      return check(await supabase.from('password_reset_tokens').delete().eq('token', token));
    },
  };
}
