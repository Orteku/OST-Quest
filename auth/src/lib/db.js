import { createClient } from '@supabase/supabase-js';

// Mapa provider → columna en player_accounts
const PROVIDER_COL = { google: 'google_id', discord: 'discord_id', twitch: 'twitch_id', steam: 'steam_id' };

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
      const col = PROVIDER_COL[provider];
      if (col) {
        return check(await supabase.from('player_accounts').select('*').eq(col, String(providerId)).maybeSingle());
      }
      // fallback legacy
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
    async linkProvider(userId, provider, providerId) {
      const col = PROVIDER_COL[provider];
      if (!col) throw new Error(`Unknown provider: ${provider}`);
      return check(await supabase.from('player_accounts').update({ [col]: String(providerId) }).eq('id', userId));
    },
    async unlinkProvider(userId, provider) {
      const col = PROVIDER_COL[provider];
      if (!col) throw new Error(`Unknown provider: ${provider}`);
      return check(await supabase.from('player_accounts').update({ [col]: null }).eq('id', userId));
    },
    async deleteUser(userId) {
      await check(await supabase.from('scores').delete().eq('user_id', userId));
      await check(await supabase.from('password_reset_tokens').delete().eq('user_id', userId));
      return check(await supabase.from('player_accounts').delete().eq('id', userId));
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
    // Devuelve true si la quest se jugó "a tiempo": mismo día o día siguiente al game_date
    // played_at null = dato antiguo sin timestamp → no cuenta para la racha
    _isOnTime(gameDate, playedAt) {
      if (!playedAt) return false;
      const questStart = new Date(gameDate + 'T00:00:00Z').getTime();
      const diff       = new Date(playedAt).getTime() - questStart;
      return diff >= 0 && diff < 48 * 3_600_000;
    },

    // Calcula todas las estadísticas desde la tabla scores (sin depender de localStorage)
    async calcStats(userId) {
      const rows = await check(
        await supabase.from('scores').select('game_date, score, played_at').eq('user_id', userId).order('game_date', { ascending: true })
      );
      if (!rows?.length) return { played: 0, accuracy: 0, streak: 0, perfectQuests: 0 };

      const played        = rows.length;
      const totalScore    = rows.reduce((s, r) => s + (r.score || 0), 0);
      const accuracy      = Math.round(totalScore / (played * 3) * 100);
      const perfectQuests = rows.filter(r => r.score === 3).length;

      // Solo cuentan para racha las quests jugadas a tiempo (con played_at en ventana de 48h)
      const db = this;
      const onTime = rows.filter(r => db._isOnTime(r.game_date, r.played_at));

      let streak = 0, expected = null;
      for (let i = onTime.length - 1; i >= 0; i--) {
        const d = new Date(onTime[i].game_date + 'T12:00:00Z');
        if (!expected) {
          const today     = new Date(); today.setUTCHours(12, 0, 0, 0);
          const yesterday = new Date(today); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          if (d < yesterday) break;
          expected = d;
        }
        if (d.getTime() !== expected.getTime()) break;
        streak++;
        expected = new Date(expected);
        expected.setUTCDate(expected.getUTCDate() - 1);
      }

      return { played, accuracy, streak, perfectQuests };
    },

    // Calcula la racha actual (usado tras submitScore — filtra por played_at)
    async calcStreakFromScores(userId) {
      const rows = await check(
        await supabase.from('scores').select('game_date, played_at').eq('user_id', userId).order('game_date', { ascending: false })
      );
      if (!rows?.length) return 0;

      const db = this;
      const onTime = rows.filter(r => db._isOnTime(r.game_date, r.played_at));
      if (!onTime.length) return 0;

      const today     = new Date(); today.setUTCHours(12, 0, 0, 0);
      const yesterday = new Date(today); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const mostRecent = new Date(onTime[0].game_date + 'T12:00:00Z');
      if (mostRecent < yesterday) return 0;

      let streak = 0, expected = mostRecent;
      for (const { game_date } of onTime) {
        const d = new Date(game_date + 'T12:00:00Z');
        if (d.getTime() === expected.getTime()) {
          streak++;
          expected = new Date(expected); expected.setUTCDate(expected.getUTCDate() - 1);
        } else break;
      }
      return streak;
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
