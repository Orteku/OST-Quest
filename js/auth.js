// ─── Config ───────────────────────────────────────────────────────────────────

const AUTH_URL  = 'https://auth.oestiquest.com';
const _JWT_KEY  = 'ostquest_jwt';
const _USER_KEY = 'ostquest_user';

// ─── State ────────────────────────────────────────────────────────────────────

let _token              = null;   // JWT string
let _profile            = null;   // { id, username, email, provider }
let _cachedAchievements = [];     // último fetch de logros del usuario
let _serverStats        = null;   // estadísticas de /scores/stats para la tarjeta del perfil
let _achGridRender      = null;   // repinta la sección de trofeos del perfil (cuando está en pantalla)
document.addEventListener('langchange', () => _achGridRender?.());

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
    const data = await res.json();
    data.__status = res.status;
    return data;
  } catch { return { __networkError: true }; }
}

// El perfil se pide en cuanto carga el script, en paralelo con las traducciones; authInit reutiliza la respuesta
const _savedJwt   = localStorage.getItem(_JWT_KEY);
const _mePrefetch = _savedJwt ? _apiFetch('/auth/me', 'GET', null, _savedJwt) : null;

// ─── Persistencia de sesión ───────────────────────────────────────────────────

function _saveSession(token, user) {
  _token   = token;
  _profile = user;
  _historyPromise = null;  // el historial guardado era de la sesión anterior
  localStorage.setItem(_JWT_KEY,  token);
  localStorage.setItem(_USER_KEY, JSON.stringify(user));
}

function _clearSession() {
  _token   = null;
  _profile = null;
  _historyPromise = null;
  localStorage.removeItem(_JWT_KEY);
  localStorage.removeItem(_USER_KEY);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function authInit() {
  document.getElementById('btn-auth')?.addEventListener('click', e => {
    e.stopPropagation();
    if (_token && _profile?.username) _openDrop();
    else if (_token && !_profile) openUsernameModal();  // token pendiente
    else openAuthModal();
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
    const data = (_mePrefetch && _token === _savedJwt) ? await _mePrefetch : await _apiFetch('/auth/me');
    if (data?.pending) {
      // Token pendiente restaurado — usuario OAuth sin username
      _renderAuthBtn();
      openUsernameModal();
      return;
    } else if (data?.id) {
      // Sesión renovada por el worker: 30 días más desde esta visita
      if (data.token) {
        _token = data.token;
        localStorage.setItem(_JWT_KEY, data.token);
        delete data.token;
      }
      _profile = data;
      localStorage.setItem(_USER_KEY, JSON.stringify(data));
      if (!data.username) { openUsernameModal(); return; }
      // En segundo plano: el juego no la espera para arrancar (ver authWhenRestored)
      _restorePromise = _restoreFromServer().catch(() => false);
      _syncAfterLogin();
    } else if (!data.__networkError) {
      // Solo cerrar sesión si el servidor rechazó el token (401/403), no por error de red
      _clearSession();
    }
  }

  _renderAuthBtn();
  document.addEventListener('langchange', _renderAuthBtn);
  if (window.PROFILE_PAGE) initProfilePage();
}

// Recupera del servidor lo ya jugado. Sin esto, un navegador nuevo (otro móvil, navegador integrado
// de una app, almacenamiento borrado…) mostraría el historial vacío y dejaría repetir la quest del día.
// Devuelve true si ha reconstruido la quest de hoy.
// Historial del servidor, pedido una sola vez por carga de página (lo usan la recuperación y la subida)
let _historyPromise = null;
function _getServerHistory() {
  return _historyPromise ??= _apiFetch('/scores/history').then(h => Array.isArray(h) ? h : null);
}

async function _restoreFromServer() {
  if (!_token || typeof loadPlayedDays !== 'function') return false;
  const history = await _getServerHistory();
  if (!Array.isArray(history) || !history.length) return false;

  const played = loadPlayedDays();
  let changed = false;
  for (const row of history) {
    if (played[row.game_date]) continue;
    played[row.game_date] = { score: row.score, total: 3, ts: row.played_at ? Date.parse(row.played_at) : null };
    changed = true;
  }
  if (changed) localStorage.setItem(PLAYED_KEY, JSON.stringify(played));

  // Reconstruir la quest de hoy necesita la base de juegos (solo está en las páginas que la cargan)
  if (typeof GAME_DB === 'undefined') return false;
  const today    = getGameDay();
  const todayRow = history.find(r => r.game_date === today);
  if (!todayRow?.results || loadDayProgress(today)) return false;

  const games  = await loadGamesJson();
  const groups = games?.[today] ? reconstructFromIds(games[today]) : [];
  if (groups.length !== 3) return false;
  // Solo se sabe qué columnas se acertaron, no qué portada se eligió en las falladas
  saveDayProgress(today, groups.map((g, i) => {
    const correct = todayRow.results[i] === '1';
    return {
      locked: false, solved: true, correct,
      pickedId:  correct ? g.answer.id : null,
      pickedPos: correct ? g.covers.findIndex(c => c.id === g.answer.id) : null,
    };
  }));
  return true;
}

let _restorePromise = Promise.resolve(false);

// Se resuelve a true si la recuperación del servidor ha reconstruido la quest de hoy
function authWhenRestored() {
  return _restorePromise;
}

// Procesa un token nuevo (tras login, registro o OAuth)
async function _handleNewToken(token) {
  const data = await _apiFetch('/auth/me', 'GET', null, token);
  if (data?.pending) {
    // Nuevo usuario OAuth — guardar token pendiente y pedir username
    _token = token;
    localStorage.setItem(_JWT_KEY, token);
    _renderAuthBtn();
    openUsernameModal();
    return;
  }
  if (!data?.id) { _showErr(t('auth_error_generic')); return; }
  _saveSession(token, data);
  if (!data.username) { openUsernameModal(); return; }
  _renderAuthBtn();
  closeAuthModal();
  // Si la quest de hoy ya se jugó en otro sitio, mostrarla terminada en vez de dejar repetirla
  if (await _restoreFromServer() && typeof initGame === 'function'
      && currentDateStr === getGameDay() && !isArchiveMode) {
    initGame(currentDateStr, false);
  }
  _syncAfterLogin();
  if (window.PROFILE_PAGE) initProfilePage();
}

// Recibe el JWT desde el popup OAuth vía postMessage
async function _handleOAuthMessage(event) {
  if (event.origin !== location.origin && event.origin !== 'https://oestiquest.com') return;
  if (event.data?.type !== 'oauth-callback') return;
  const { token, error, linked } = event.data;
  if (error) {
    const msg = error === 'provider_already_linked' ? t('auth_error_provider_taken') : t('auth_error_generic');
    if (typeof showToast === 'function') showToast(msg, 'error');
    else _showErr(msg);
    return;
  }
  if (!token) return;
  if (linked) {
    // Vínculo de proveedor completado — actualizar sesión y refrescar perfil
    _token = token;
    localStorage.setItem(_JWT_KEY, token);
    if (window.PROFILE_PAGE) {
      const data = await _apiFetch('/auth/me');
      if (data?.id) { _profile = data; localStorage.setItem(_USER_KEY, JSON.stringify(data)); }
      const settingsEl = document.getElementById('profile-settings');
      if (settingsEl) { settingsEl.innerHTML = _renderProfileHTML(true); _bindProfilePageEvents(); }
    } else {
      await openProfileModal();
    }
    if (typeof showToast === 'function') showToast(t('auth_linked_ok'));
    return;
  }
  await _handleNewToken(token);
}

// ─── Auth button ──────────────────────────────────────────────────────────────

function _renderAuthBtn() {
  const btn = document.getElementById('btn-auth');
  if (!btn) return;
  const loggedIn = !!(_token && _profile?.username);
  btn.classList.toggle('auth-btn--in', loggedIn);
  btn.classList.add('auth-btn--text');
  if (loggedIn && _profile.selected_avatar) {
    btn.title = _profile.username;
    btn.innerHTML = `<img class="auth-btn__avatar-img" src="img/achievements/${_esc(_profile.selected_avatar)}" alt=""><span class="auth-btn__username">${_esc(_profile.username)}</span>`;
  } else if (loggedIn) {
    btn.title = _profile.username;
    const initial = _profile.username.charAt(0).toUpperCase();
    btn.innerHTML = `<span class="auth-btn__avatar">${initial}</span><span class="auth-btn__username">${_esc(_profile.username)}</span>`;
  } else {
    btn.title = t('auth_sign_in');
    btn.innerHTML = `<span class="auth-btn__signin-label">${t('auth_sign_in')}</span>`;
  }
}

// ─── Dropdown (usuario logado) ────────────────────────────────────────────────

function _loadLocalStats() {
  try { return JSON.parse(localStorage.getItem('ostquest_stats')) || {}; } catch { return {}; }
}

// Estadísticas del servidor: las últimas guardadas en este navegador (al instante) y la actualización.
// Las locales solo conocen lo jugado en este dispositivo (p. ej. la racha se reinicia al cambiar de móvil a ordenador).
function _cachedServerStats() {
  try { return JSON.parse(localStorage.getItem(`ostquest_server_stats_${_profile?.id}`)) || null; } catch { return null; }
}
async function _refreshServerStats() {
  const stats = await _apiFetch('/scores/stats');
  if (!stats || stats.error || stats.__networkError) return null;
  _serverStats = stats;
  try { localStorage.setItem(`ostquest_server_stats_${_profile?.id}`, JSON.stringify(stats)); } catch {}
  return stats;
}

function _openDrop() {
  const existing = document.getElementById('auth-drop');
  if (existing) { existing.remove(); return; }

  const btn   = document.getElementById('btn-auth');
  const drop  = document.createElement('div');
  drop.id        = 'auth-drop';
  drop.className = 'auth-drop auth-drop--card';

  const stats   = _cachedServerStats() || _loadLocalStats();
  const initial = (_profile.username || '?')[0].toUpperCase();

  drop.innerHTML = `
    <div class="auth-drop__top">
      <div class="auth-drop__avatar">${_profile.selected_avatar ? `<img class="auth-drop__avatar-img" src="img/achievements/${_esc(_profile.selected_avatar)}" alt="">` : initial}</div>
      <div class="auth-drop__body">
        <div class="auth-drop__body-top">
          <div class="auth-drop__name">${_esc(_profile.username)}</div>
          <div class="auth-drop__controls">
            <a class="auth-drop__config-link" href="profile.html">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              ${t('auth_profile')}
            </a>
            <button class="auth-drop__signout-btn" id="auth-drop-out" title="${t('auth_sign_out')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
        <div class="auth-drop__drop-stats">
          <span class="auth-drop__drop-stat">⚡ ${t('stat_streak_short')} <strong id="auth-drop-streak">${stats.streak || 0}</strong></span>
          <span class="auth-drop__drop-stat">🎮 ${t('stat_played')} <strong id="auth-drop-played">${stats.played || 0}</strong></span>
        </div>
      </div>
    </div>
    <div class="auth-drop__trofeos">
      <div class="auth-drop__trofeos-head">
        <span class="auth-drop__trofeos-title">${t('drop_recent_trophies')}</span>
        <a class="auth-drop__trofeos-link" href="profile.html">${t('drop_see_all')}</a>
      </div>
      <div class="auth-drop__trofeos-icons" id="auth-drop-achievements"></div>
    </div>
  `;
  document.body.appendChild(drop);

  // Racha y partidas del servidor (iguales en todos los dispositivos)
  _refreshServerStats().then(s => {
    if (!s) return;
    const streakEl = document.getElementById('auth-drop-streak');
    const playedEl = document.getElementById('auth-drop-played');
    if (streakEl) streakEl.textContent = s.streak || 0;
    if (playedEl) playedEl.textContent = s.played || 0;
  });

  // Cargar logros recientes en segundo plano
  if (_token && typeof ACHIEVEMENTS_DB !== 'undefined') {
    authGetAchievements().then(async unlocked => {
      const el = document.getElementById('auth-drop-achievements');
      if (!el) return;
      const lang    = document.documentElement.lang || 'es';
      const visible = (await Promise.all(unlocked.map(u => achievementHasImage(getAchievement(u.achievement_id)))))
        .reduce((acc, ok, i) => ok ? [...acc, unlocked[i]] : acc, []);
      const recent  = visible.slice(-5).reverse();
      if (!recent.length) { el.textContent = '—'; return; }
      el.innerHTML = recent.map(u => {
        const a = getAchievement(u.achievement_id);
        if (!a) return '';
        const label = getAchievementLabel(a, lang);
        return `<img class="auth-drop__ach-icon" src="img/achievements/${_esc(a.image)}" alt="" title="${_esc(label.name)}">`;
      }).join('');
    });
  }

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
  document.getElementById('auth-modal-inner')?.classList.remove('auth-modal--profile');
}

function _renderAuthModal() {
  const reg = _authMode === 'register';
  const lastProvider = localStorage.getItem('ostquest_last_provider');
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
        ${lastProvider === 'google' ? `<span class="auth-social__last">${t('auth_last_used')}</span>` : ''}
      </button>
      <button class="auth-social__btn auth-social__btn--discord" data-provider="discord" title="Discord">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#5865F2" aria-hidden="true">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        ${lastProvider === 'discord' ? `<span class="auth-social__last">${t('auth_last_used')}</span>` : ''}
      </button>
      <button class="auth-social__btn auth-social__btn--twitch" data-provider="twitch" title="Twitch">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#9146FF" aria-hidden="true">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
        </svg>
        ${lastProvider === 'twitch' ? `<span class="auth-social__last">${t('auth_last_used')}</span>` : ''}
      </button>
      <button class="auth-social__btn auth-social__btn--steam" data-provider="steam" title="Steam">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#c7d5e0" aria-hidden="true">
          <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.497 1.41-2.455 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
        </svg>
        ${lastProvider === 'steam' ? `<span class="auth-social__last">${t('auth_last_used')}</span>` : ''}
      </button>
    </div>
    ${reg ? `<p class="auth-legal-note" id="auth-legal-note"></p>` : ''}
    <p class="auth-switch"><button class="auth-switch__btn" id="auth-sw">${t(reg ? 'auth_have_account' : 'auth_no_account')}</button></p>
  `;

  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  const legalEl = document.getElementById('auth-legal-note');
  if (legalEl) legalEl.innerHTML = t('auth_legal_note');
  document.getElementById('auth-sw').addEventListener('click', () => {
    _authMode = _authMode === 'signin' ? 'register' : 'signin';
    _renderAuthModal();
  });
  document.getElementById('auth-submit').addEventListener('click', _submitEmail);
  document.getElementById('auth-pwd').addEventListener('keydown', e => { if (e.key === 'Enter') _submitEmail(); });
  document.querySelectorAll('.auth-social__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem('ostquest_last_provider', btn.dataset.provider);
      _signInOAuth(btn.dataset.provider);
    });
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

  if (data?.token) {
    localStorage.setItem('ostquest_last_provider', 'email');
    await _handleNewToken(data.token);
  }
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

  // Caso pendiente: el servidor devuelve un token real tras crear el usuario
  if (data?.token) {
    await _handleNewToken(data.token);
    return;
  }

  _profile = { ..._profile, username: uname };
  localStorage.setItem(_USER_KEY, JSON.stringify(_profile));
  _renderAuthBtn();
  closeAuthModal();
  _syncAfterLogin();
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

function _signOut() {
  _clearSession();
  if (window.PROFILE_PAGE) { window.location.href = '/'; return; }
  _renderAuthBtn();
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

let _rankTab = 'weekly';

async function loadRankingInto(containerId, tab) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<p class="rank-empty">${t('ranking_loading')}</p>`;

  document.getElementById('player-card')?.remove();
  const view = tab === 'weekly' ? 'ranking_weekly' : 'ranking_global';
  const { data, error } = await _supabase
    .from(view).select('username, streak, pts, selected_avatar').order('pts', { ascending: false }).limit(25);

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
      const avatarHtml = r.selected_avatar
        ? `<img class="rank-avatar rank-avatar--img" src="img/achievements/${_esc(r.selected_avatar)}" alt="">`
        : `<span class="rank-avatar">${_esc(r.username.charAt(0).toUpperCase())}</span>`;
      return `<tr class="${[medal, isMe ? 'rank-row--me' : ''].filter(Boolean).join(' ')}">
        <td class="rank-pos">${i + 1}</td>
        <td class="rank-name"><button type="button" class="rank-name__btn">${avatarHtml}${_esc(r.username)}${isMe ? ' ★' : ''}</button></td>
        <td class="rank-pts">${r.pts}</td>
        <td class="rank-streak">${r.streak || '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
  el.querySelectorAll('.rank-name__btn').forEach((btn, i) => {
    btn.addEventListener('click', () => _openPlayerCard(btn, data[i]));
  });
}

// Tarjeta de jugador: como el menú de usuario, pero con datos públicos y sin ajustes ni enlaces.
// Puntos y racha son los de la fila; quests y trofeos se piden al abrirla.
function _openPlayerCard(btn, row) {
  const wasOpenFor = document.getElementById('player-card')?.dataset.user;
  document.getElementById('player-card')?.remove();
  if (wasOpenFor === row.username) return;

  const card = document.createElement('div');
  card.id = 'player-card';
  card.className = 'auth-drop auth-drop--card player-card';
  card.dataset.user = row.username;
  const initial = _esc(row.username.charAt(0).toUpperCase());
  card.innerHTML = `
    <div class="auth-drop__top">
      <div class="auth-drop__avatar">${row.selected_avatar ? `<img class="auth-drop__avatar-img" src="img/achievements/${_esc(row.selected_avatar)}" alt="">` : initial}</div>
      <div class="auth-drop__body">
        <div class="auth-drop__name">${_esc(row.username)}</div>
        <div class="auth-drop__drop-stats">
          <span class="auth-drop__drop-stat">🏆 ${t('ranking_pts')} <strong>${row.pts}</strong></span>
          <span class="auth-drop__drop-stat">⚡ ${t('stat_streak_short')} <strong>${row.streak || 0}</strong></span>
          <span class="auth-drop__drop-stat">🎮 ${t('stat_played')} <strong data-played>…</strong></span>
        </div>
      </div>
    </div>
    <div class="auth-drop__trofeos">
      <div class="auth-drop__trofeos-head">
        <span class="auth-drop__trofeos-title">${t('drop_recent_trophies')}</span>
      </div>
      <div class="auth-drop__trofeos-icons" data-trophies></div>
    </div>`;
  document.body.appendChild(card);

  // En móvil el CSS la centra en pantalla; aquí se coloca junto al nombre sin salirse por la derecha
  if (window.innerWidth > 600) {
    const rect = btn.getBoundingClientRect();
    const left = Math.min(rect.left, document.documentElement.clientWidth - card.offsetWidth - 8);
    card.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
    card.style.left = (left + window.scrollX) + 'px';
  }

  const close = () => {
    card.remove();
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onKey);
  };
  // Pulsar otro nombre ya cierra esta tarjeta y abre la suya
  const onOutside = e => { if (!card.contains(e.target) && !e.target.closest('.rank-name__btn')) close(); };
  const onKey     = e => { if (e.key === 'Escape') close(); };
  setTimeout(() => {
    if (!card.isConnected) return;
    document.addEventListener('click', onOutside);
    document.addEventListener('keydown', onKey);
  }, 0);

  _apiFetch('/public/player/' + encodeURIComponent(row.username)).then(async res => {
    const failed   = res.__networkError || res.error;
    const unlocked = failed ? [] : (res.recent || []).map(getAchievement).filter(Boolean);
    const oks      = await Promise.all(unlocked.map(achievementHasImage));
    if (!card.isConnected) return;
    card.querySelector('[data-played]').textContent = failed ? '—' : res.played;
    const lang   = document.documentElement.lang || 'es';
    const recent = unlocked.filter((a, i) => oks[i]).slice(-3).reverse();
    const icons  = card.querySelector('[data-trophies]');
    if (!recent.length) { icons.textContent = '—'; return; }
    icons.innerHTML = recent.map(a =>
      `<img class="auth-drop__ach-icon" src="img/achievements/${_esc(a.image)}" alt="" title="${_esc(getAchievementLabel(a, lang).name)}">`
    ).join('');
  });
}

// ─── customConfirm ────────────────────────────────────────────────────────────

function customConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:#18191e;border:1px solid #2c2c34;border-radius:14px;padding:28px 24px;max-width:320px;width:100%;text-align:center">
        <p style="font-family:Barlow,sans-serif;font-size:14px;color:#ddd9cf;line-height:1.5;margin-bottom:20px">${message}</p>
        <div style="display:flex;gap:8px;justify-content:center">
          <button id="cc-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid #2a2a34;background:#20202a;color:#ddd9cf;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">${t('btn_close')}</button>
          <button id="cc-ok" style="flex:1;padding:10px;border-radius:8px;border:none;background:#7a1010;color:#ffc0c0;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">${t('auth_delete_account')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('#cc-ok').addEventListener('click', () => cleanup(true));
    overlay.querySelector('#cc-cancel').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
  });
}

// ─── Stats desde servidor ─────────────────────────────────────────────────────

let _pendingScoreSubmit = null;

async function authWaitForScore() {
  if (_pendingScoreSubmit) await _pendingScoreSubmit;
}

async function authUpdateStatsDisplay() {
  if (!_token) return;
  await authWaitForScore();
  const stats = await _apiFetch('/scores/stats');
  if (!stats || stats.error) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-val-played',   stats.played);
  set('stat-val-accuracy', stats.accuracy + '%');
  set('stat-val-streak',   stats.streak);
  set('stat-val-perfect',  stats.perfectQuests);
}

// ─── Score sync ───────────────────────────────────────────────────────────────

async function submitScoreToSupabase(dateStr, score, stats, results) {
  if (!_token) return;
  _pendingScoreSubmit = _apiFetch('/scores', 'POST', { gameDate: dateStr, score, stats, results });
  const res = await _pendingScoreSubmit;
  _pendingScoreSubmit = null;

  if (res?.newAchievements?.length) {
    for (const id of res.newAchievements) _showAchievementToast(id);
  }
  checkTagAchievements();
}

// Logros de tag: cuenta los aciertos por tag de las quests jugadas en su día
// (columnas acertadas guardadas en el servidor + composición de cada quest en games.json)
async function checkTagAchievements() {
  if (!_token || typeof ACHIEVEMENTS_DB === 'undefined'
      || typeof loadGamesJson !== 'function' || typeof GAME_DB === 'undefined') return;

  const history = await _apiFetch('/scores/results');
  const games   = Array.isArray(history) ? await loadGamesJson() : null;
  if (!games) return;

  // Partidas anteriores a que se guardaran las columnas: completar con el progreso de este navegador
  const toFill = {};
  for (const row of history) {
    if (row.results) continue;
    const prog = typeof loadDayProgress === 'function' ? loadDayProgress(row.game_date) : null;
    if (!Array.isArray(prog) || prog.length !== 3) continue;
    row.results = prog.map(s => s?.correct ? '1' : '0').join('');
    toFill[row.game_date] = row.results;
  }
  if (Object.keys(toFill).length) _apiFetch('/scores/results', 'POST', { results: toFill });

  // Palabras completas: "square" no debe coincidir con "SadSquare Studio"
  const devTerms = typeof DEV_ACHIEVEMENT_TERMS === 'undefined' ? [] : Object.entries(DEV_ACHIEVEMENT_TERMS)
    .map(([key, terms]) => [key, terms.map(t => new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'))]);
  const counts = { tag: {}, track: {}, dev: {} };
  const add = (kind, key) => { counts[kind][key] = (counts[kind][key] || 0) + 1; };
  for (const { game_date, results } of history) {
    if (!results || !games[game_date]) continue;
    const groups = reconstructFromIds(games[game_date]);
    groups.forEach((g, i) => {
      if (results[i] !== '1') return;
      for (const tag of g.answer.tags || []) add('tag', tag);
      for (const tag of g.answer.tracks[g.trackIndex]?.tags || []) add('track', tag);
      const dev = (g.answer.developer || '').toLowerCase();
      for (const [key, res] of devTerms) if (res.some(re => re.test(dev))) add('dev', key);
    });
  }

  // Se guarda para mostrar el progreso en el perfil, que no carga la base de juegos
  try { localStorage.setItem(`ostquest_ach_progress_${_profile?.id}`, JSON.stringify(counts)); } catch {}

  // Tipo, clave y nivel salen del propio id: tag_rpg_10, track_lyrics_30, dev_nintendo_20
  const have = new Set((await authGetAchievements()).map(a => a.achievement_id));
  for (const { id } of ACHIEVEMENTS_DB) {
    const m = id.match(/^(tag|track|dev)_(.+)_(\d+)$/);
    if (!m) continue;
    const count = counts[m[1]][m[2]] || 0;
    if (count >= Number(m[3]) && !have.has(id)) await authUnlockAchievement(id);
  }
}

// ─── Migración de localStorage ────────────────────────────────────────────────

// Primero sube lo jugado sin cuenta y después comprueba logros: si van a la vez, la comprobación
// llega antes que las partidas migradas y no las ve (p. ej. un pleno hecho antes de iniciar sesión)
function _syncAfterLogin() {
  _migrateIfNeeded().catch(() => {}).then(_backfillAchievements);
}

// Sube al servidor las partidas jugadas en su día que aún no tenga (p. ej. jugadas sin sesión iniciada).
// Se comprueba en cada carga con sesión: antes era una sola vez por dispositivo y las posteriores se perdían.
// Las del Quest Log no se suben: no deben sumar puntos.
async function _migrateIfNeeded() {
  if (!_token || !_profile?.id || typeof loadPlayedDays !== 'function') return;
  const history = await _getServerHistory();
  if (!history) return;
  const onServer = new Set(history.map(r => r.game_date));

  const missing = Object.fromEntries(Object.entries(loadPlayedDays()).filter(([date, r]) =>
    !onServer.has(date) && r?.ts && getGameDay(new Date(r.ts)) === date));
  if (!Object.keys(missing).length) return;

  const data = await _apiFetch('/scores/migrate', 'POST', { played: missing });
  if ((data?.migrated ?? 0) > 0 && typeof showToast === 'function') {
    showToast(t('auth_migration_done'));
  }
}

async function getUserWeeklyPosition() {
  if (!_profile?.username) return null;
  const { data } = await _supabase
    .from('ranking_weekly').select('username, pts').order('pts', { ascending: false });
  if (!data) return null;
  const idx = data.findIndex(r => r.username === _profile.username);
  return idx !== -1 ? { rank: idx + 1, pts: data[idx].pts } : null;
}

// ─── Modal de perfil ──────────────────────────────────────────────────────────

async function openProfileModal() {
  // Refresca el perfil para tener providers actualizados
  const data = await _apiFetch('/auth/me');
  if (data?.id) { _profile = data; localStorage.setItem(_USER_KEY, JSON.stringify(data)); }

  const inner = document.getElementById('auth-modal-inner');
  inner.innerHTML = _renderProfileHTML();
  inner.classList.add('auth-modal--profile');
  document.getElementById('auth-modal').style.display = 'flex';
  _bindProfileEvents();
}

function _renderProfileHTML(forPage = false) {
  const p = _profile || {};
  const providers = p.providers || {};

  const providerList = [
    { key: 'google',  label: 'Google',  icon: `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>` },
    { key: 'discord', label: 'Discord', icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>` },
    { key: 'twitch',  label: 'Twitch',  icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#9146FF"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>` },
    { key: 'steam',   label: 'Steam',   icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0z"/></svg>` },
  ];

  const providerRows = providerList.map(({ key, label, icon }) => {
    const linked = !!providers[key];
    return `<div class="profile-provider">
      <span class="profile-provider__icon">${icon}</span>
      <span class="profile-provider__label">${label}</span>
      ${linked
        ? `<button class="profile-provider__btn profile-provider__btn--unlink" data-action="unlink" data-provider="${key}">${t('auth_disconnect')}</button>`
        : `<button class="profile-provider__btn profile-provider__btn--link"   data-action="link"   data-provider="${key}">${t('auth_connect')}</button>`
      }
    </div>`;
  }).join('');

  const emailRow = `<div class="profile-provider">
    <span class="profile-provider__icon">✉️</span>
    <span class="profile-provider__label">Email</span>
    <span class="profile-provider__status">${providers.email ? (p.email || '') : t('auth_not_configured')}</span>
  </div>`;

  const _sections = `
    <section class="profile-section">
      <h3 class="profile-section__title">${t('auth_username')}</h3>
      <div class="profile-uname-row">
        <input class="auth-input" type="text" id="profile-uname" value="${_esc(p.username || '')}" maxlength="20">
        <button class="btn profile-save-btn" id="profile-uname-save">${t('auth_save_username')}</button>
      </div>
      <p class="auth-err" id="profile-uname-err" style="display:none"></p>
    </section>

    <section class="profile-section">
      <h3 class="profile-section__title">${t('auth_password')}</h3>
      ${providers.email
        ? `<input class="auth-input" type="password" id="profile-pwd-cur"  placeholder="${t('auth_current_password')}" autocomplete="current-password">
           <input class="auth-input" type="password" id="profile-pwd-new"  placeholder="${t('auth_new_password')}"     autocomplete="new-password">
           <input class="auth-input" type="password" id="profile-pwd-new2" placeholder="${t('auth_confirm_password')}" autocomplete="new-password">`
        : `<input class="auth-input" type="password" id="profile-pwd-new"  placeholder="${t('auth_new_password')}"     autocomplete="new-password">
           <input class="auth-input" type="password" id="profile-pwd-new2" placeholder="${t('auth_confirm_password')}" autocomplete="new-password">`
      }
      <p class="auth-err" id="profile-pwd-err" style="display:none"></p>
      <button class="btn profile-save-btn" id="profile-pwd-save">${t('auth_change_password')}</button>
    </section>

    <section class="profile-section">
      <h3 class="profile-section__title">${t('auth_connected_accounts')}</h3>
      ${emailRow}
      ${providerRows}
      <p class="auth-err" id="profile-link-err" style="display:none"></p>
    </section>

    <section class="profile-section profile-section--danger">
      <h3 class="profile-section__title">${t('auth_danger_zone')}</h3>
      <button class="btn profile-delete-btn" id="profile-delete">${t('auth_delete_account')}</button>
    </section>
  `;
  if (forPage) return _sections;
  return `
    <button class="modal__close-x" id="auth-close">&times;</button>
    <h2 class="auth-title">${t('auth_profile')}</h2>
    ${_sections}
  `;
}

function _renderProfileCardHTML(unlocked = []) {
  const p       = _profile || {};
  const initial = (p.username || '?')[0].toUpperCase();
  // Del servidor si está disponible: las del navegador solo conocen lo jugado en este dispositivo
  const s        = _serverStats;
  const local    = _loadLocalStats();
  const played   = s ? s.played        : (local.played || 0);
  const accuracy = s ? s.accuracy      : (played > 0 ? Math.round(((local.totalHits || 0) / (played * 3)) * 100) : 0);
  const streak   = s ? s.streak        : (local.streak || 0);
  const perfect  = s ? s.perfectQuests : (local.perfectQuests || 0);

  // Últimos 3 logros desbloqueados (sin los provisionales)
  let recentHtml = '';
  if (unlocked.length && typeof ACHIEVEMENTS_DB !== 'undefined') {
    const lang   = document.documentElement.lang || 'es';
    const recent = unlocked.filter(u => !achievementImageMissing(getAchievement(u.achievement_id))).slice(-3).reverse();
    recentHtml = `<div class="pcard__recent-achievements">${
      recent.map(u => {
        const a = getAchievement(u.achievement_id);
        if (!a) return '';
        const label = getAchievementLabel(a, lang);
        return `<img class="pcard__achievement-icon" src="img/achievements/${_esc(a.image)}" alt="${_esc(label.name)}" title="${_esc(label.name)}">`;
      }).join('')
    }</div>`;
  }

  return `
    <div class="pcard">
      <div class="pcard__avatar">${p.selected_avatar
        ? `<img class="pcard__avatar-img" src="img/achievements/${_esc(p.selected_avatar)}" alt="">`
        : initial}</div>
      <div class="pcard__body">
        <div class="pcard__username">${_esc(p.username || '')}</div>
        <div class="pcard__stats">
          <div class="pcard__stat"><span class="pcard__stat-value">${played}</span><span class="pcard__stat-label">${t('stat_played')}</span></div>
          <div class="pcard__stat"><span class="pcard__stat-value">${accuracy}%</span><span class="pcard__stat-label">${t('stat_accuracy')}</span></div>
          <div class="pcard__stat"><span class="pcard__stat-value">${streak}</span><span class="pcard__stat-label">${t('stat_streak_current')}</span></div>
          <div class="pcard__stat"><span class="pcard__stat-value">${perfect}</span><span class="pcard__stat-label">${t('stat_max_streak')}</span></div>
        </div>
        ${recentHtml}
      </div>
    </div>
  `;
}

async function initProfilePage() {
  const cardEl     = document.getElementById('profile-card');
  const settingsEl = document.getElementById('profile-settings');
  const drawerEl   = document.getElementById('pcard-drawer');

  if (!_token || !_profile) {
    if (cardEl) cardEl.innerHTML = `
      <div class="pcard pcard--guest">
        <p class="pcard__guest-msg">${t('profile_not_logged_in')}</p>
        <button class="btn" onclick="openAuthModal('signin')">${t('auth_sign_in_btn')}</button>
      </div>`;
    if (drawerEl) drawerEl.hidden = true;
    return;
  }

  // Todo se pinta al momento con lo que ya se sabe y se actualiza cuando llegan los datos del servidor.
  // (El perfil ya lo acaba de pedir authInit / _handleNewToken.)
  const hasAch    = typeof ACHIEVEMENTS_DB !== 'undefined';
  const renderCard = () => { if (cardEl) cardEl.innerHTML = _renderProfileCardHTML(_cachedAchievements); };
  const availableP = hasAch ? getAvailableAchievements() : null;  // en paralelo con los logros del usuario

  // Últimas estadísticas del servidor guardadas en este navegador (si no hay, la tarjeta usa las locales)
  _serverStats = _cachedServerStats();
  renderCard();

  _refreshServerStats().then(stats => {
    if (!stats) return;
    renderCard();
    _achGridRender?.();
  });

  if (settingsEl) {
    settingsEl.innerHTML = _renderProfileHTML(true);
    _bindProfilePageEvents();
  }

  // Toggle de ajustes
  const toggle = document.getElementById('profile-settings-toggle');
  const panel  = document.getElementById('profile-settings-panel');
  if (toggle && panel && drawerEl) {
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      drawerEl.classList.toggle('pcard-drawer--open', open);
    });
  }

  if (!hasAch) return;
  const unlocked = await authGetAchievements();
  _cachedAchievements = unlocked;
  renderCard();
  // Si algún logro conseguido resulta provisional (sin imagen), se repinta la tarjeta sin él
  Promise.all(unlocked.map(u => achievementHasImage(getAchievement(u.achievement_id)))).then(oks => {
    if (oks.includes(false)) renderCard();
  });

  const achievementsEl = document.getElementById('achievements-grid');
  if (achievementsEl) {
    const available = await availableP;
    const renderGrid = () => {
      achievementsEl.innerHTML = _renderAchievementsHTML(_cachedAchievements, available);
      _bindAchievementEvents();
    };
    renderGrid();

    const filterEl = document.getElementById('ach-only-unlocked');
    if (filterEl && !filterEl.dataset.bound) {
      filterEl.dataset.bound = '1';
      filterEl.checked = _achOnlyUnlocked();
      filterEl.addEventListener('change', () => {
        try { localStorage.setItem(_ACH_FILTER_KEY, filterEl.checked ? '1' : '0'); } catch {}
        renderGrid();
      });
    }

    // Vista compacta (iconos) o detallada (nombre, descripción y progreso)
    const viewEl = document.getElementById('ach-view');
    if (viewEl && !viewEl.dataset.bound) {
      viewEl.dataset.bound = '1';
      const markView = () => viewEl.querySelectorAll('.seg__btn').forEach(b => {
        const on = b.dataset.view === _achView();
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
      });
      markView();
      viewEl.addEventListener('click', e => {
        const btn = e.target.closest('.seg__btn');
        if (!btn || btn.dataset.view === _achView()) return;
        try { localStorage.setItem(_ACH_VIEW_KEY, btn.dataset.view); } catch {}
        markView();
        renderGrid();
      });
    }

    // Recuerda las categorías cerradas. "toggle" no se propaga: hay que escucharlo en la fase de captura
    if (!achievementsEl.dataset.boundToggle) {
      achievementsEl.dataset.boundToggle = '1';
      achievementsEl.addEventListener('toggle', e => {
        const cat = e.target.dataset?.cat;
        if (!cat) return;
        const closed = _achClosedCats();
        if (e.target.open) closed.delete(cat); else closed.add(cat);
        try { localStorage.setItem(_ACH_CLOSED_KEY, JSON.stringify([...closed])); } catch {}
      }, true);
    }

    // Las estadísticas del servidor llegan aparte y dan el progreso de partidas y racha
    _achGridRender = renderGrid;

    // Progreso de tags y compañías calculado aquí mismo, para que sea igual en cualquier dispositivo.
    // Necesita la base de juegos (~100 KB), que el perfil no carga de inicio: solo se pide en segundo plano
    // si hay algún logro de ese tipo visible y sin conseguir.
    const have = new Set(_cachedAchievements.map(u => u.achievement_id));
    if (available.some(a => /^(tag|track|dev)_/.test(a.id) && !have.has(a.id))) {
      _loadGameDb()
        .then(() => checkTagAchievements())
        .then(async () => { _cachedAchievements = await authGetAchievements(); renderGrid(); })
        .catch(() => {});
    }
  }
}

function _bindProfilePageEvents() {
  // Cambiar username
  document.getElementById('profile-uname-save')?.addEventListener('click', async () => {
    const uname  = document.getElementById('profile-uname')?.value.trim();
    const errEl  = document.getElementById('profile-uname-err');
    const setErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
    errEl.style.display = 'none';
    if (!_validUname(uname)) { setErr(t('auth_username_invalid')); return; }
    const data = await _apiFetch('/auth/set-username', 'POST', { username: uname });
    if (data?.error === 'username_taken') { setErr(t('auth_username_taken')); return; }
    if (data?.error) { setErr(t('auth_error_generic')); return; }
    _profile = { ..._profile, username: uname };
    localStorage.setItem(_USER_KEY, JSON.stringify(_profile));
    _renderAuthBtn();
    const cardEl = document.getElementById('profile-card');
    if (cardEl) cardEl.innerHTML = _renderProfileCardHTML();
    if (typeof showToast === 'function') showToast(t('auth_saved'));
  });

  // Cambiar contraseña
  document.getElementById('profile-pwd-save')?.addEventListener('click', async () => {
    const curEl  = document.getElementById('profile-pwd-cur');
    const newPwd = document.getElementById('profile-pwd-new')?.value;
    const repPwd = document.getElementById('profile-pwd-new2')?.value;
    const errEl  = document.getElementById('profile-pwd-err');
    const setErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
    errEl.style.display = 'none';
    if (!newPwd || newPwd.length < 6) { setErr(t('auth_password_too_short')); return; }
    if (newPwd !== repPwd)            { setErr(t('auth_passwords_dont_match')); return; }
    const body = { newPassword: newPwd };
    if (curEl) body.currentPassword = curEl.value;
    const data = await _apiFetch('/auth/change-password', 'POST', body);
    if (data?.error === 'invalid_current_password') { setErr(t('auth_error_invalid_credentials')); return; }
    if (data?.error) { setErr(t('auth_error_generic')); return; }
    _profile = { ..._profile, providers: { ..._profile?.providers, email: true } };
    localStorage.setItem(_USER_KEY, JSON.stringify(_profile));
    if (typeof showToast === 'function') showToast(t('auth_saved'));
    if (curEl) curEl.value = '';
    document.getElementById('profile-pwd-new').value  = '';
    document.getElementById('profile-pwd-new2').value = '';
  });

  // Vincular / desvincular proveedores
  document.querySelectorAll('[data-action="link"]').forEach(btn => {
    btn.addEventListener('click', () => _linkProvider(btn.dataset.provider));
  });
  document.querySelectorAll('[data-action="unlink"]').forEach(btn => {
    btn.addEventListener('click', () => _unlinkProvider(btn.dataset.provider));
  });

  // Borrar cuenta
  document.getElementById('profile-delete')?.addEventListener('click', async () => {
    const ok = await customConfirm(t('auth_delete_confirm'));
    if (!ok) return;
    await _apiFetch('/auth/account', 'DELETE');
    _signOut();
    window.location.href = '/';
  });
}

function _bindProfileEvents() {
  document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);

  // Cambiar username
  document.getElementById('profile-uname-save')?.addEventListener('click', async () => {
    const uname  = document.getElementById('profile-uname')?.value.trim();
    const errEl  = document.getElementById('profile-uname-err');
    const setErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
    errEl.style.display = 'none';

    if (!_validUname(uname)) { setErr(t('auth_username_invalid')); return; }
    const data = await _apiFetch('/auth/set-username', 'POST', { username: uname });
    if (data?.error === 'username_taken') { setErr(t('auth_username_taken')); return; }
    if (data?.error) { setErr(t('auth_error_generic')); return; }
    _profile = { ..._profile, username: uname };
    localStorage.setItem(_USER_KEY, JSON.stringify(_profile));
    _renderAuthBtn();
    if (typeof showToast === 'function') showToast(t('auth_saved'));
  });

  // Cambiar contraseña
  document.getElementById('profile-pwd-save')?.addEventListener('click', async () => {
    const curEl  = document.getElementById('profile-pwd-cur');
    const newPwd = document.getElementById('profile-pwd-new')?.value;
    const repPwd = document.getElementById('profile-pwd-new2')?.value;
    const errEl  = document.getElementById('profile-pwd-err');
    const setErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
    errEl.style.display = 'none';

    if (!newPwd || newPwd.length < 6) { setErr(t('auth_password_too_short')); return; }
    if (newPwd !== repPwd)            { setErr(t('auth_passwords_dont_match')); return; }

    const body = { newPassword: newPwd };
    if (curEl) body.currentPassword = curEl.value;

    const data = await _apiFetch('/auth/change-password', 'POST', body);
    if (data?.error === 'invalid_current_password') { setErr(t('auth_error_invalid_credentials')); return; }
    if (data?.error) { setErr(t('auth_error_generic')); return; }

    // Actualizar perfil para reflejar que ahora tiene email/password
    _profile = { ..._profile, providers: { ..._profile?.providers, email: true } };
    localStorage.setItem(_USER_KEY, JSON.stringify(_profile));
    if (typeof showToast === 'function') showToast(t('auth_saved'));
    if (curEl) curEl.value = '';
    document.getElementById('profile-pwd-new').value  = '';
    document.getElementById('profile-pwd-new2').value = '';
  });

  // Vincular / desvincular proveedores
  document.querySelectorAll('[data-action="link"]').forEach(btn => {
    btn.addEventListener('click', () => _linkProvider(btn.dataset.provider));
  });
  document.querySelectorAll('[data-action="unlink"]').forEach(btn => {
    btn.addEventListener('click', () => _unlinkProvider(btn.dataset.provider));
  });

  // Borrar cuenta
  document.getElementById('profile-delete')?.addEventListener('click', async () => {
    const ok = await customConfirm(t('auth_delete_confirm'));
    if (!ok) return;
    await _apiFetch('/auth/account', 'DELETE');
    _signOut();
    closeAuthModal();
  });
}

// Abre popup para vincular un proveedor OAuth a la cuenta actual
function _linkProvider(provider) {
  const w = 520, h = 620;
  const left = Math.max(0, (screen.width  - w) / 2);
  const top  = Math.max(0, (screen.height - h) / 2);
  window.open(
    `${AUTH_URL}/auth/${provider}?link=${encodeURIComponent(_token)}`,
    'link-popup',
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
  );
  // El resultado llega por postMessage (mismo listener _handleOAuthMessage)
  // Al recibir linked=1, refrescamos el modal de perfil
}

// Desvincula un proveedor OAuth de la cuenta actual
async function _unlinkProvider(provider) {
  const errEl = document.getElementById('profile-link-err');
  errEl.style.display = 'none';
  const data = await _apiFetch('/auth/unlink', 'POST', { provider });
  if (data?.error === 'cannot_unlink_last_provider') {
    errEl.textContent = t('auth_cannot_unlink_last');
    errEl.style.display = 'block';
    return;
  }
  if (data?.error) {
    errEl.textContent = t('auth_error_generic');
    errEl.style.display = 'block';
    return;
  }
  // Recargar perfil para reflejar el cambio
  if (window.PROFILE_PAGE) {
    const d = await _apiFetch('/auth/me');
    if (d?.id) { _profile = d; localStorage.setItem(_USER_KEY, JSON.stringify(d)); }
    const settingsEl = document.getElementById('profile-settings');
    if (settingsEl) { settingsEl.innerHTML = _renderProfileHTML(true); _bindProfilePageEvents(); }
  } else {
    openProfileModal();
  }
}

// ─── Logros ───────────────────────────────────────────────────────────────────

async function _backfillAchievements() {
  if (!_token || sessionStorage.getItem('ach_backfilled_v2')) return;
  sessionStorage.setItem('ach_backfilled_v2', '1');

  const data = await _apiFetch('/auth/achievements/backfill', 'POST');
  const granted = data?.granted || [];

  // Especiales retroactivos: verificar localStorage (incluye Quest Log/archivo)
  if (typeof SPECIAL_EVENTS !== 'undefined' && typeof loadPlayedDays === 'function') {
    const playedDays = loadPlayedDays();
    const existing   = granted.length ? await authGetAchievements() : (data?.granted ? [] : await authGetAchievements());
    const haveIds    = new Set(existing.map(a => a.achievement_id));
    for (const sp of SPECIAL_EVENTS.filter(hasGameData)) {
      const achId = 'special_' + sp.date;
      if (haveIds.has(achId)) continue;
      if (typeof getAchievement === 'function' && !await achievementHasImage(getAchievement(achId))) continue;
      const played = Object.keys(playedDays).some(d => d === sp.date || d.endsWith('-' + sp.date));
      if (!played) continue;
      const res = await _apiFetch('/auth/achievements/unlock', 'POST', { achievementId: achId });
      if (res?.ok && res?.isNew) granted.push(achId);
    }
  }

  await checkTagAchievements();

  if (granted.length) {
    for (const id of granted) _showAchievementToast(id);
    const achievementsEl = document.getElementById('achievements-grid');
    if (achievementsEl && typeof ACHIEVEMENTS_DB !== 'undefined') {
      const unlocked = await authGetAchievements();
      _cachedAchievements = unlocked;
      achievementsEl.innerHTML = _renderAchievementsHTML(unlocked, await getAvailableAchievements());
      _bindAchievementEvents();
    }
  }
}

async function authUnlockAchievement(id) {
  if (!_token) return false;
  if (typeof getAchievement === 'function' && !await achievementHasImage(getAchievement(id))) return false;
  const data = await _apiFetch('/auth/achievements/unlock', 'POST', { achievementId: id });
  if (data?.ok && data?.isNew) _showAchievementToast(id);
  return data?.ok === true;
}

// Avisos de logro apilados en vertical (estilo Steam): máximo 3 a la vez, el resto espera en cola
const _ACH_TOAST_MAX     = 3;
const _ACH_TOAST_STAGGER = 350;   // ms entre avisos que llegan juntos
const _achToastQueue     = [];
let _achToastsVisible    = 0;
let _achToastLastShown   = 0;
let _achToastLastSound   = 0;

let _achToastChain = Promise.resolve();

// Encadenado para que los avisos salgan en el orden en que se piden, aunque las comprobaciones de imagen tarden distinto
function _showAchievementToast(achievementId) {
  _achToastChain = _achToastChain.then(async () => {
    const a = typeof getAchievement === 'function' ? getAchievement(achievementId) : null;
    if (a && !await achievementHasImage(a)) return;  // provisional: se concede en silencio
    _achToastQueue.push({ id: achievementId, a });
    _pumpAchievementToasts();
  }).catch(() => {});
}

function _pumpAchievementToasts() {
  while (_achToastsVisible < _ACH_TOAST_MAX && _achToastQueue.length) {
    const item  = _achToastQueue.shift();
    const delay = Math.max(0, _achToastLastShown + _ACH_TOAST_STAGGER - Date.now());
    _achToastLastShown = Date.now() + delay;
    _achToastsVisible++;
    setTimeout(() => _renderAchievementToast(item), delay);
  }
}

function _renderAchievementToast({ id, a }) {
  let stack = document.getElementById('achievement-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'achievement-toast-stack';
    stack.className = 'achievement-toast-stack';
    document.body.appendChild(stack);
  }

  const lang = document.documentElement.lang || 'es';
  const name = a ? _esc(getAchievementLabel(a, lang).name) : _esc(id);
  const img  = a ? `<img class="achievement-toast__img" src="img/achievements/${_esc(a.image)}" alt="">` : `<div class="achievement-toast__img-ph">🏆</div>`;

  const el = document.createElement('div');
  el.className = 'achievement-toast';
  el.innerHTML = `${img}<div class="achievement-toast__body"><div class="achievement-toast__label">${t('achievement_unlocked')}</div><div class="achievement-toast__name">${name}</div></div>`;
  stack.appendChild(el);

  // Un solo sonido por tanda
  if (Date.now() - _achToastLastSound > 1500) {
    _achToastLastSound = Date.now();
    const sfx = new Audio('fx/achievement.mp3');
    sfx.volume = Math.min(1, (typeof gameVolume !== 'undefined' ? gameVolume : 80) / 100 * 0.6);
    sfx.play().catch(() => {});
  }

  // Temporizador en vez de animationend: ese evento no llega si las animaciones están desactivadas,
  // y el aviso se quedaría para siempre bloqueando la cola
  setTimeout(() => {
    el.classList.add('achievement-toast--out');
    setTimeout(() => {
      el.remove();
      _achToastsVisible--;
      _pumpAchievementToasts();
    }, 350);
  }, 4500);
}

async function authGetAchievements() {
  if (!_token) return [];
  const data = await _apiFetch('/auth/achievements');
  return Array.isArray(data) ? data : [];
}

async function authSetAvatar(filename) {
  if (!_token) return false;
  const data = await _apiFetch('/auth/avatar', 'POST', { avatar: filename });
  if (data?.ok) {
    _profile = { ..._profile, selected_avatar: filename };
    localStorage.setItem(_USER_KEY, JSON.stringify(_profile));
    _renderAuthBtn();
  }
  return data?.ok === true;
}

// ─── Código Konami (logro oculto) ─────────────────────────────────────────────
// Se introduce en el mando que abre su "???" en el perfil, pulsando sus botones o con el teclado.
const _KONAMI = 'up,up,down,down,left,right,left,right,b,a';
let _konamiBuffer = [];

function _konamiInput(key) {
  _konamiBuffer = [..._konamiBuffer, key].slice(-10);
  if (_konamiBuffer.join(',') !== _KONAMI) return false;
  _konamiBuffer = [];
  _unlockKonami();
  return true;
}

async function _unlockKonami() {
  _closeKonamiPad();
  if (!_token) return;
  await authUnlockAchievement('easter_konami');
  if (_achGridRender) { _cachedAchievements = await authGetAchievements(); _achGridRender(); }
}

// El teclado solo cuenta con el mando abierto (igual que en móvil) y hunde el botón correspondiente
document.addEventListener('keydown', e => {
  const overlay = document.getElementById('konami-overlay');
  if (!overlay?.classList.contains('is-open')) return;
  if (e.key === 'Escape') { _closeKonamiPad(); return; }
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', b: 'b', B: 'b', a: 'a', A: 'a' };
  const key = map[e.key];
  if (key) {
    e.preventDefault();  // que las flechas no muevan la página
    _pressPadButton(overlay.querySelector(`[data-k="${key}"]`));
  }
  _konamiInput(key || e.key);
});

function _pressPadButton(btn) {
  if (!btn) return;
  btn.classList.remove('is-pressed');
  void btn.offsetWidth;  // reinicia la animación aunque se repita la misma tecla
  btn.classList.add('is-pressed');
}

const _PAD_ARROW = `<svg viewBox="0 0 10 10" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="5,1.5 9,8 1,8"/></svg>`;

function _openKonamiPad() {
  let overlay = document.getElementById('konami-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'konami-overlay';
    overlay.className = 'konami-overlay';
    // Inspirado en el mando de NES: cuerpo gris claro, panel oscuro, cruceta negra, SELECT/START y B/A rojos
    overlay.innerHTML = `
      <div class="konami-pad" role="dialog" aria-modal="true">
        <button type="button" class="konami-pad__close" aria-label="${t('btn_close')}">&times;</button>
        <div class="konami-pad__face">
          <div class="konami-pad__dpad">
            <button type="button" class="konami-pad__dir konami-pad__dir--up"    data-k="up"    aria-label="↑">${_PAD_ARROW}</button>
            <button type="button" class="konami-pad__dir konami-pad__dir--left"  data-k="left"  aria-label="←">${_PAD_ARROW}</button>
            <span class="konami-pad__center"><span></span></span>
            <button type="button" class="konami-pad__dir konami-pad__dir--right" data-k="right" aria-label="→">${_PAD_ARROW}</button>
            <button type="button" class="konami-pad__dir konami-pad__dir--down"  data-k="down"  aria-label="↓">${_PAD_ARROW}</button>
          </div>
          <div class="konami-pad__mid">
            <span class="konami-pad__stripe"></span>
            <span class="konami-pad__stripe"></span>
            <div class="konami-pad__labels"><span>SELECT</span><span>START</span></div>
            <div class="konami-pad__ss">
              <button type="button" class="konami-pad__pill" data-k="select" aria-label="Select"></button>
              <button type="button" class="konami-pad__pill" data-k="start"  aria-label="Start"></button>
            </div>
            <span class="konami-pad__stripe"></span>
          </div>
          <div class="konami-pad__right">
            <span class="konami-pad__brand" aria-hidden="true">KONAMI</span>
            <div class="konami-pad__ab">
              <div class="konami-pad__key"><span class="konami-pad__tile"><button type="button" class="konami-pad__btn" data-k="b" aria-label="B"></button></span><span class="konami-pad__letter">B</span></div>
              <div class="konami-pad__key"><span class="konami-pad__tile"><button type="button" class="konami-pad__btn" data-k="a" aria-label="A"></button></span><span class="konami-pad__letter">A</span></div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('.konami-pad__close')) { _closeKonamiPad(); return; }
      const btn = e.target.closest('[data-k]');
      if (!btn) return;
      _pressPadButton(btn);
      _konamiInput(btn.dataset.k);
    });
  }
  _konamiBuffer = [];
  overlay.classList.add('is-open');
}

function _closeKonamiPad() {
  document.getElementById('konami-overlay')?.classList.remove('is-open');
}

// Carga js/database.js bajo demanda (páginas que no lo incluyen, como el perfil)
let _gameDbPromise = null;
function _loadGameDb() {
  if (typeof GAME_DB !== 'undefined') return Promise.resolve();
  return _gameDbPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/database.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Categorías de la sección de trofeos, en orden. Los especiales van al final, tras la línea de puntos.
const _ACH_CATEGORIES = ['general', 'perfect', 'ranking', 'genre', 'music', 'company', 'secret', 'special'];
function _achCategory(a) {
  if (a.hidden) return 'secret';
  return { perfect: 'perfect', week: 'ranking', tag: 'genre', track: 'music', dev: 'company', special: 'special' }[a.id.split('_')[0]] || 'general';
}

// Progreso de un logro por niveles: { cur, goal } o null si no se sabe.
// Tags y compañías: lo guarda el juego al contar aciertos. Partidas y racha: estadísticas del servidor.
function _achProgress(id) {
  const m = id.match(/^(tag|track|dev)_(.+)_(\d+)$/);
  if (m) {
    let counts = null;
    try { counts = JSON.parse(localStorage.getItem(`ostquest_ach_progress_${_profile?.id}`)); } catch {}
    if (!counts?.[m[1]]) return null;
    return { cur: counts[m[1]][m[2]] || 0, goal: Number(m[3]) };
  }
  if (!_serverStats) return null;
  if (id === 'played_30') return { cur: _serverStats.played || 0, goal: 30 };
  if (id === 'streak_7')  return { cur: _serverStats.streak || 0, goal: 7 };
  // Plenos y podio: el servidor los cuenta desde la fecha de inicio de estos logros
  const sp = _serverStats.achievementProgress;
  const perfect = id.match(/^perfect_(\d+)$/);
  if (perfect && sp) return { cur: sp.perfect || 0, goal: Number(perfect[1]) };
  if (id === 'week_top3_x3' && sp) return { cur: sp.top3Weeks || 0, goal: 3 };
  return null;
}

function _renderAchievementsHTML(unlocked, available) {
  if (typeof ACHIEVEMENTS_DB === 'undefined') return '';
  const unlockedIds = new Set(unlocked.map(a => a.achievement_id));
  const lang     = document.documentElement.lang || 'es';
  const detailed = _achView() === 'detailed';

  function _item(a) {
    const isUnlocked = unlockedIds.has(a.id);
    const label      = getAchievementLabel(a, lang);
    const isHidden   = a.hidden && !isUnlocked;
    const name = isHidden ? '???' : _esc(label.name);
    const desc = isHidden ? '???' : _esc(label.desc || '');
    const prog = !isUnlocked ? _achProgress(a.id) : null;
    const progText = prog ? `${Math.min(prog.cur, prog.goal)}/${prog.goal}` : '';
    const cls = ['achievement-card', isUnlocked ? 'achievement-card--unlocked' : 'achievement-card--locked',
      _profile?.selected_avatar === a.image ? 'achievement-card--selected' : '', detailed ? 'achievement-row' : ''].filter(Boolean).join(' ');
    const icon = isHidden
      ? `<div class="achievement-card__mystery">?</div>`
      : `<img class="achievement-card__img" src="img/achievements/${_esc(a.image)}" alt="${name}" loading="lazy">`;
    // El "???" del código Konami abre un mando para introducirlo (la pista de que hay que hacer algo)
    const konami = a.id === 'easter_konami' && !isUnlocked ? ' data-konami="1"' : '';
    const attrs = `class="${cls}" data-id="${_esc(a.id)}" data-img="${isHidden ? '' : _esc(a.image)}" data-name="${name}" data-desc="${desc}" data-progress="${progText}"${konami}`;

    if (!detailed) return `<div ${attrs}>${icon}</div>`;
    const bar = prog
      ? `<div class="ach-progress"><div class="ach-progress__bar"><span style="width:${Math.min(100, Math.round(prog.cur / prog.goal * 100))}%"></span></div><span class="ach-progress__num">${progText}</span></div>`
      : '';
    return `<div ${attrs}>
      <div class="achievement-row__icon">${icon}</div>
      <div class="achievement-row__text">
        <div class="achievement-row__name">${name}</div>
        <div class="achievement-row__desc">${desc}</div>
        ${bar}
      </div>
    </div>`;
  }

  // Interruptor "Solo conseguidos" del perfil
  const list = _achOnlyUnlocked() ? available.filter(a => unlockedIds.has(a.id)) : available;
  if (!list.length) return `<p class="achievements-grid__empty">${t('ach_none_unlocked')}</p>`;

  // Compacta: una sola rejilla seguida, con un hueco entre categorías y la línea de puntos antes de los especiales
  if (!detailed) {
    const parts = _ACH_CATEGORIES
      .map(cat => ({ cat, items: list.filter(a => _achCategory(a) === cat) }))
      .filter(p => p.items.length)
      .map((p, i) => {
        const sep = i === 0 ? '' : p.cat === 'special'
          ? `<div class="ach-compact-sep" aria-hidden="true"></div>`
          : `<div class="ach-compact-gap" aria-hidden="true"></div>`;
        return sep + p.items.map(_item).join('');
      });
    return `<div class="ach-cat__items ach-cat__items--compact">${parts.join('')}</div>`;
  }

  const closed = _achClosedCats();
  return _ACH_CATEGORIES.map(cat => {
    const items = list.filter(a => _achCategory(a) === cat);
    if (!items.length) return '';
    const all  = available.filter(a => _achCategory(a) === cat);
    const done = all.filter(a => unlockedIds.has(a.id)).length;
    return `<details class="ach-cat${cat === 'special' ? ' ach-cat--special' : ''}" data-cat="${cat}"${closed.has(cat) ? '' : ' open'}>
      <summary class="ach-cat__head">
        <span class="ach-cat__title">${t('ach_cat_' + cat)}</span>
        <span class="ach-cat__count">${done}/${all.length}</span>
      </summary>
      <div class="ach-cat__items ach-cat__items--detailed">${items.map(_item).join('')}</div>
    </details>`;
  }).join('');
}

// Categorías que el jugador ha cerrado en la vista detallada
const _ACH_CLOSED_KEY = 'ostquest_ach_closed';
function _achClosedCats() {
  try { return new Set(JSON.parse(localStorage.getItem(_ACH_CLOSED_KEY)) || []); } catch { return new Set(); }
}

const _ACH_FILTER_KEY = 'ostquest_ach_only_unlocked';
function _achOnlyUnlocked() {
  try { return localStorage.getItem(_ACH_FILTER_KEY) === '1'; } catch { return false; }
}

const _ACH_VIEW_KEY = 'ostquest_ach_view';
function _achView() {
  try { return localStorage.getItem(_ACH_VIEW_KEY) === 'detailed' ? 'detailed' : 'compact'; } catch { return 'compact'; }
}

function _bindAchievementEvents() {
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  if (isTouch) {
    _bindAchievementSheet();
  } else {
    _bindAchievementTooltip();
  }
}

function _bindAchievementTooltip() {
  let tip = document.getElementById('ach-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'ach-tooltip';
    tip.className = 'ach-tooltip';
    document.body.appendChild(tip);
  }

  // En la vista detallada el nombre y la descripción ya se ven: sin tooltip
  document.querySelectorAll('.achievement-card:not(.achievement-row)').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const prog = card.dataset.progress
        ? `<div class="ach-tooltip__progress">${t('ach_progress')}: ${_esc(card.dataset.progress)}</div>` : '';
      tip.innerHTML = `<div class="ach-tooltip__name">${_esc(card.dataset.name)}</div><div class="ach-tooltip__desc">${_esc(card.dataset.desc)}</div>${prog}`;
      tip.style.display = 'block';
      const r  = card.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let left = r.left + window.scrollX + r.width / 2 - tw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
      const topAbove = r.top + window.scrollY - th - 8;
      tip.style.left = left + 'px';
      tip.style.top  = (topAbove > 0 ? topAbove : r.bottom + window.scrollY + 8) + 'px';
    });
    card.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });

  document.querySelectorAll('.achievement-card[data-konami]').forEach(card => {
    card.addEventListener('click', _openKonamiPad);
  });

  document.querySelectorAll('.achievement-card--unlocked').forEach(card => {
    card.addEventListener('click', async () => {
      const img = card.dataset.img;
      if (!img) return;
      const ok = await authSetAvatar(img);
      if (ok) {
        document.querySelectorAll('.achievement-card--selected').forEach(c => c.classList.remove('achievement-card--selected'));
        card.classList.add('achievement-card--selected');
        const cardEl = document.getElementById('profile-card');
        if (cardEl) cardEl.innerHTML = _renderProfileCardHTML(_cachedAchievements);
        if (typeof showToast === 'function') showToast(t('auth_saved'));
      }
    });
  });
}

function _bindAchievementSheet() {
  let overlay = document.getElementById('ach-sheet-overlay');
  let sheet   = document.getElementById('ach-sheet');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ach-sheet-overlay';
    overlay.className = 'ach-sheet-overlay';
    document.body.appendChild(overlay);
  }
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'ach-sheet';
    sheet.className = 'ach-sheet';
    sheet.innerHTML = `
      <div class="ach-sheet__handle"></div>
      <div id="ach-sheet-media"></div>
      <p class="ach-sheet__name" id="ach-sheet-name"></p>
      <p class="ach-sheet__desc" id="ach-sheet-desc"></p>
      <p class="ach-sheet__progress" id="ach-sheet-progress"></p>
      <button class="ach-sheet__avatar-btn" id="ach-sheet-btn"></button>
    `;
    document.body.appendChild(sheet);
  }

  const closeSheet = () => {
    overlay.classList.remove('is-open');
    sheet.classList.remove('is-open');
  };

  overlay.onclick = closeSheet;

  document.getElementById('ach-sheet-btn').onclick = async () => {
    const btn = document.getElementById('ach-sheet-btn');
    const img = btn.dataset.img;
    if (!img) return;
    const ok = await authSetAvatar(img);
    if (ok) {
      document.querySelectorAll('.achievement-card--selected').forEach(c => c.classList.remove('achievement-card--selected'));
      document.querySelectorAll('.achievement-card--unlocked').forEach(c => {
        if (c.dataset.img === img) c.classList.add('achievement-card--selected');
      });
      const cardEl = document.getElementById('profile-card');
      if (cardEl) cardEl.innerHTML = _renderProfileCardHTML(_cachedAchievements);
      closeSheet();
      if (typeof showToast === 'function') showToast(t('auth_saved'));
    }
  };

  document.querySelectorAll('.achievement-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.konami) { _openKonamiPad(); return; }
      const img      = card.dataset.img || '';
      const unlocked = card.classList.contains('achievement-card--unlocked');

      document.getElementById('ach-sheet-media').innerHTML = img
        ? `<img class="ach-sheet__img" src="img/achievements/${_esc(img)}" alt="">`
        : `<div class="ach-sheet__img-placeholder">?</div>`;

      document.getElementById('ach-sheet-name').textContent = card.dataset.name || '?';
      document.getElementById('ach-sheet-desc').textContent = card.dataset.desc || '';
      const progEl = document.getElementById('ach-sheet-progress');
      if (progEl) {
        progEl.textContent  = card.dataset.progress ? `${t('ach_progress')}: ${card.dataset.progress}` : '';
        progEl.style.display = card.dataset.progress ? '' : 'none';
      }

      const btn = document.getElementById('ach-sheet-btn');
      btn.textContent  = t('ach_set_avatar');
      btn.dataset.img  = img;
      btn.style.display = (unlocked && img) ? '' : 'none';

      overlay.classList.add('is-open');
      sheet.classList.add('is-open');
    });
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _validUname(s) { return s && /^[a-zA-Z0-9_]{3,20}$/.test(s); }
function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function authGetSession() { return _token; }
function authGetProfile() { return _profile; }
