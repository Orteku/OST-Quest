// ─── Config ───────────────────────────────────────────────────────────────────

const AUTH_URL  = 'https://auth.oestiquest.com';
const _JWT_KEY  = 'ostquest_jwt';
const _USER_KEY = 'ostquest_user';

// ─── State ────────────────────────────────────────────────────────────────────

let _token   = null;   // JWT string
let _profile = null;   // { id, username, email, provider }

// ─── API helper ───────────────────────────────────────────────────────────────

async function _apiFetch(path, method = 'GET', body = null, overrideToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  const tok = overrideToken ?? _token;
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  try {
    const res = await fetch(AUTH_URL + path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  } catch { return {}; }
}

// ─── Persistencia de sesión ───────────────────────────────────────────────────

function _saveSession(token, user) {
  _token   = token;
  _profile = user;
  localStorage.setItem(_JWT_KEY,  token);
  localStorage.setItem(_USER_KEY, JSON.stringify(user));
}

function _clearSession() {
  _token   = null;
  _profile = null;
  localStorage.removeItem(_JWT_KEY);
  localStorage.removeItem(_USER_KEY);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function authInit() {
  document.getElementById('btn-auth')?.addEventListener('click', e => {
    e.stopPropagation();
    _token && _profile?.username ? _openDrop() : openAuthModal();
  });
  document.getElementById('auth-modal')?.addEventListener('click', e => {
    if (e.target.id === 'auth-modal') closeAuthModal();
  });

  // Escuchar el callback del popup OAuth
  window.addEventListener('message', _handleOAuthMessage);

  // Token pendiente si el popup fue bloqueado (fallback redirect)
  const pending = sessionStorage.getItem('oauth_pending_token');
  if (pending) {
    sessionStorage.removeItem('oauth_pending_token');
    await _handleNewToken(pending);
    return;
  }

  // Restaurar sesión desde localStorage
  _token = localStorage.getItem(_JWT_KEY);
  try { _profile = JSON.parse(localStorage.getItem(_USER_KEY)); } catch { _profile = null; }

  if (_token) {
    // Verificar que el token sigue siendo válido
    const data = await _apiFetch('/auth/me');
    if (data?.id) {
      _profile = data;
      localStorage.setItem(_USER_KEY, JSON.stringify(data));
      if (!data.username) { openUsernameModal(); return; }
      _migrateIfNeeded();
    } else {
      _clearSession();
    }
  }

  _renderAuthBtn();
}

// Procesa un token nuevo (tras login, registro o OAuth)
async function _handleNewToken(token) {
  const data = await _apiFetch('/auth/me', 'GET', null, token);
  if (!data?.id) { _showErr(t('auth_error_generic')); return; }
  _saveSession(token, data);
  if (!data.username) { openUsernameModal(); return; }
  _renderAuthBtn();
  closeAuthModal();
  _migrateIfNeeded();
}

// Recibe el JWT desde el popup OAuth vía postMessage
async function _handleOAuthMessage(event) {
  if (event.origin !== location.origin && event.origin !== 'https://oestiquest.com') return;
  if (event.data?.type !== 'oauth-callback') return;
  const { token, error } = event.data;
  if (error) { _showErr(t('auth_error_generic')); return; }
  if (token) await _handleNewToken(token);
}

// ─── Auth button ──────────────────────────────────────────────────────────────

function _renderAuthBtn() {
  const btn = document.getElementById('btn-auth');
  if (!btn) return;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>`;
  btn.classList.toggle('auth-btn--in', !!(  _token && _profile?.username));
}

// ─── Dropdown (usuario logado) ────────────────────────────────────────────────

function _openDrop() {
  const existing = document.getElementById('auth-drop');
  if (existing) { existing.remove(); return; }

  const btn  = document.getElementById('btn-auth');
  const drop = document.createElement('div');
  drop.id        = 'auth-drop';
  drop.className = 'auth-drop';
  drop.innerHTML = `
    <div class="auth-drop__name">${_esc(_profile.username)}</div>
    <button class="auth-drop__item auth-drop__item--out" id="auth-drop-out">${t('auth_sign_out')}</button>
  `;
  document.body.appendChild(drop);

  const rect = btn.getBoundingClientRect();
  drop.style.top   = (rect.bottom + window.scrollY + 6) + 'px';
  drop.style.right = (document.documentElement.clientWidth - rect.right) + 'px';

  document.getElementById('auth-drop-out').addEventListener('click', () => { drop.remove(); _signOut(); });

  setTimeout(() => {
    document.addEventListener('click', function _cl(e) {
      if (!drop.contains(e.target) && e.target !== btn) {
        drop.remove();
        document.removeEventListener('click', _cl);
      }
    });
  }, 0);
}

// ─── Auth modal ───────────────────────────────────────────────────────────────

let _authMode = 'signin';

function openAuthModal(mode) {
  _authMode = mode || 'signin';
  _renderAuthModal();
  document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
}

function _renderAuthModal() {
  const reg = _authMode === 'register';
  document.getElementById('auth-modal-inner').innerHTML = `
    <button class="modal__close-x" id="auth-close">&times;</button>
    <h2 class="auth-title">${t(reg ? 'auth_register' : 'auth_sign_in')}</h2>
    <div class="auth-form">
      <input class="auth-input" type="email" id="auth-email" placeholder="${t('auth_email')}" autocomplete="email">
      <input class="auth-input" type="password" id="auth-pwd" placeholder="${t('auth_password')}" autocomplete="${reg ? 'new-password' : 'current-password'}">
      <p class="auth-err" id="auth-err" style="display:none"></p>
      <button class="btn auth-submit-btn" id="auth-submit">${t(reg ? 'auth_register_btn' : 'auth_sign_in_btn')}</button>
    </div>
    <div class="auth-sep"><span>${t('auth_or')}</span></div>
    <div class="auth-social">
      <button class="auth-social__btn auth-social__btn--google" data-provider="google" title="Google">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      </button>
      <button class="auth-social__btn auth-social__btn--discord" data-provider="discord" title="Discord">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#5865F2" aria-hidden="true">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      </button>
      <button class="auth-social__btn auth-social__btn--twitch" data-provider="twitch" title="Twitch">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#9146FF" aria-hidden="true">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
        </svg>
      </button>
      <button class="auth-social__btn auth-social__btn--steam" data-provider="steam" title="Steam">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#c7d5e0" aria-hidden="true">
          <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.497 1.41-2.455 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
        </svg>
      </button>
    </div>
    <p class="auth-switch"><button class="auth-switch__btn" id="auth-sw">${t(reg ? 'auth_have_account' : 'auth_no_account')}</button></p>
  `;

  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.getElementById('auth-sw').addEventListener('click', () => {
    _authMode = _authMode === 'signin' ? 'register' : 'signin';
    _renderAuthModal();
  });
  document.getElementById('auth-submit').addEventListener('click', _submitEmail);
  document.getElementById('auth-pwd').addEventListener('keydown', e => { if (e.key === 'Enter') _submitEmail(); });
  document.querySelectorAll('.auth-social__btn').forEach(btn => {
    btn.addEventListener('click', () => _signInOAuth(btn.dataset.provider));
  });
}

// Abre un popup hacia el Worker para iniciar OAuth
function _signInOAuth(provider) {
  const w = 520, h = 620;
  const left = Math.max(0, (screen.width  - w) / 2);
  const top  = Math.max(0, (screen.height - h) / 2);
  const popup = window.open(
    `${AUTH_URL}/auth/${provider}`,
    'oauth-popup',
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
  );
  // Si el popup fue bloqueado, redirigir directamente
  if (!popup || popup.closed) window.location.href = `${AUTH_URL}/auth/${provider}`;
}

async function _submitEmail() {
  const email = document.getElementById('auth-email')?.value.trim();
  const pwd   = document.getElementById('auth-pwd')?.value;
  if (!email || !pwd) return;
  _hideErr();

  const path = _authMode === 'register' ? '/auth/register' : '/auth/login';
  const data = await _apiFetch(path, 'POST', { email, password: pwd });

  if (data?.error) {
    const msg = data.error === 'invalid_credentials'     ? t('auth_error_invalid_credentials')
              : data.error === 'email_already_registered' ? t('auth_error_email_taken')
              : t('auth_error_generic');
    _showErr(msg);
    return;
  }

  if (data?.token) await _handleNewToken(data.token);
}

function _showErr(msg) {
  const el = document.getElementById('auth-err');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function _hideErr() {
  const el = document.getElementById('auth-err');
  if (el) el.style.display = 'none';
}

// ─── Username modal ───────────────────────────────────────────────────────────

function openUsernameModal() {
  document.getElementById('auth-modal-inner').innerHTML = `
    <h2 class="auth-title">${t('auth_choose_username')}</h2>
    <p class="auth-username-ranking-note">${t('auth_username_ranking')}</p>
    <div class="auth-form">
      <input class="auth-input" type="text" id="uname-input" placeholder="${t('auth_username')}" maxlength="20" autofocus>
      <p class="auth-hint">${t('auth_username_hint')}</p>
      <p class="auth-err" id="uname-err" style="display:none"></p>
      <button class="btn auth-submit-btn" id="uname-save">${t('auth_save_username')}</button>
    </div>
  `;
  document.getElementById('auth-modal').style.display = 'flex';
  document.getElementById('uname-save').addEventListener('click', _saveUsername);
  document.getElementById('uname-input').addEventListener('keydown', e => { if (e.key === 'Enter') _saveUsername(); });
}

async function _saveUsername() {
  const uname = document.getElementById('uname-input')?.value.trim();
  const errEl = document.getElementById('uname-err');
  const setErr = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };

  if (!_validUname(uname)) { setErr(t('auth_username_invalid')); return; }

  const data = await _apiFetch('/auth/set-username', 'POST', { username: uname });
  if (data?.error === 'username_taken') { setErr(t('auth_username_taken')); return; }
  if (data?.error) { setErr(t('auth_error_generic')); return; }

  _profile = { ..._profile, username: uname };
  localStorage.setItem(_USER_KEY, JSON.stringify(_profile));
  _renderAuthBtn();
  closeAuthModal();
  _migrateIfNeeded();
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

function _signOut() {
  _clearSession();
  localStorage.removeItem(_SYNC_KEY);
  _renderAuthBtn();
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

let _rankTab = 'weekly';

async function loadRankingInto(containerId, tab) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<p class="rank-empty">${t('ranking_loading')}</p>`;

  const view = tab === 'weekly' ? 'ranking_weekly' : 'ranking_global';
  const { data, error } = await _supabase
    .from(view).select('username, streak, pts').order('pts', { ascending: false }).limit(25);

  if (error || !data?.length) {
    el.innerHTML = `<p class="rank-empty">${t('ranking_empty')}</p>`;
    return;
  }

  const me = _profile?.username;
  el.innerHTML = `<table class="rank-table">
    <thead><tr>
      <th class="rank-th--pos"></th>
      <th class="rank-th--name">${t('ranking_player')}</th>
      <th class="rank-th--pts">${t('ranking_pts')}</th>
      <th class="rank-th--streak">${t('ranking_streak')}</th>
    </tr></thead>
    <tbody>${data.map((r, i) => {
      const medal = i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : '';
      const isMe  = r.username === me;
      return `<tr class="${[medal, isMe ? 'rank-row--me' : ''].filter(Boolean).join(' ')}">
        <td class="rank-pos">${i + 1}</td>
        <td class="rank-name">${_esc(r.username)}${isMe ? ' ★' : ''}</td>
        <td class="rank-pts">${r.pts}</td>
        <td class="rank-streak">${r.streak || 0}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function openRankingModal() {
  _rankTab = 'weekly';
  document.getElementById('auth-modal-inner').innerHTML = `
    <button class="modal__close-x" id="auth-close">&times;</button>
    <h2 class="auth-title">${t('ranking_title')}</h2>
    <div class="rank-tabs">
      <button class="rank-tab rank-tab--active" id="rtab-weekly">${t('ranking_weekly')}</button>
      <button class="rank-tab" id="rtab-global">${t('ranking_global')}</button>
    </div>
    <div id="rank-content" class="rank-content"><p class="rank-empty">${t('ranking_loading')}</p></div>
  `;
  document.getElementById('auth-modal').style.display = 'flex';
  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.getElementById('rtab-weekly').addEventListener('click', () => {
    _rankTab = 'weekly';
    document.getElementById('rtab-weekly').classList.add('rank-tab--active');
    document.getElementById('rtab-global').classList.remove('rank-tab--active');
    loadRankingInto('rank-content', 'weekly');
  });
  document.getElementById('rtab-global').addEventListener('click', () => {
    _rankTab = 'global';
    document.getElementById('rtab-global').classList.add('rank-tab--active');
    document.getElementById('rtab-weekly').classList.remove('rank-tab--active');
    loadRankingInto('rank-content', 'global');
  });
  await loadRankingInto('rank-content', 'weekly');
}

// ─── Score sync ───────────────────────────────────────────────────────────────

async function submitScoreToSupabase(dateStr, score, stats) {
  if (!_token) return;
  await _apiFetch('/scores', 'POST', { gameDate: dateStr, score, stats });
}

// ─── Migración de localStorage ────────────────────────────────────────────────

// Clave por usuario para que cada cuenta tenga su propio estado de migración
const _SYNC_KEY = 'ostquest_synced'; // legacy, se mantiene para _signOut

function _syncKey() {
  return _profile?.id ? `ostquest_synced_${_profile.id}` : _SYNC_KEY;
}

async function _migrateIfNeeded() {
  if (!_token || !_profile?.id) return;
  if (localStorage.getItem(_syncKey())) return;

  const played = loadPlayedDays();
  const dates  = Object.keys(played);
  if (!dates.length) { localStorage.setItem(_syncKey(), '1'); return; }

  const data = await _apiFetch('/scores/migrate', 'POST', { played });
  if ((data?.migrated ?? 0) > 0 && typeof showToast === 'function') {
    showToast(t('auth_migration_done'));
  }
  localStorage.setItem(_syncKey(), '1');
}

async function getUserWeeklyPosition() {
  if (!_profile?.username) return null;
  const { data } = await _supabase
    .from('ranking_weekly').select('username, pts').order('pts', { ascending: false });
  if (!data) return null;
  const idx = data.findIndex(r => r.username === _profile.username);
  return idx !== -1 ? { rank: idx + 1, pts: data[idx].pts } : null;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _validUname(s) { return s && /^[a-zA-Z0-9_]{3,20}$/.test(s); }
function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function authGetSession() { return _token; }
function authGetProfile() { return _profile; }
