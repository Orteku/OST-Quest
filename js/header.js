// Oesti Quest — Header, footer y controles comunes a todas las páginas
//
// Cada página tiene <div class="site-header-wrap" id="site-header">, <div id="site-controls"> y <footer id="site-footer">;
// este archivo los rellena, conecta sus botones y arranca idioma y sesión.
// La página del juego lleva <body data-page="game">: muestra el contador y el texto de especial,
// y game.js define openArchiveDay() / goToToday() / onModalBackdropClose() para enlazarse.
//
// Orden de carga: i18n.js → specials.js → achievements.js → daily.js → supabase.js → auth.js → header.js → (script de la página)

const IS_GAME_PAGE = document.body.dataset.page === 'game';

// ─── Iconos ───────────────────────────────────────────────────────────────────

const _ICON_ARCHIVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`;
const _ICON_STATS   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
const _ICON_SUN     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const _ICON_MOON    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const _FLAG_ES_SVG  = `<svg class="lang-flag-svg" viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#c60b1e"/><rect y="3.5" width="20" height="7" fill="#ffc400"/></svg>`;
const _FLAG_EN_SVG  = `<svg class="lang-flag-svg" viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#012169"/><path d="M0,0 L20,14 M20,0 L0,14" stroke="white" stroke-width="4"/><path d="M0,0 L20,14 M20,0 L0,14" stroke="#c8102e" stroke-width="2"/><rect x="8.5" y="0" width="3" height="14" fill="white"/><rect x="0" y="5.5" width="20" height="3" fill="white"/><rect x="9.25" y="0" width="1.5" height="14" fill="#c8102e"/><rect x="0" y="6.25" width="20" height="1.5" fill="#c8102e"/></svg>`;

// ─── Marcado ──────────────────────────────────────────────────────────────────

function _siteHeaderHTML() {
  return `
  <header class="site-header">
    <div class="site-header__left">
      <a href="/"><img src="img/banner.png" alt="Oesti Quest" class="site-banner"></a>
      <div class="site-header__brand">
        <span id="special-event-label" hidden></span>
        <span class="site-tagline" data-i18n="tagline">Adivina la OST</span>
      </div>
    </div>
    <div class="site-header__right">
      <div class="archive-banner" id="archive-banner"></div>
      ${IS_GAME_PAGE ? `<div class="header-countdown">
        <span data-i18n="next_quest">Siguiente quest:</span><span id="header-countdown">--:--:--</span>
      </div>` : ''}
      <button class="today-btn" id="btn-today" data-i18n="btn_today">Hoy</button>
      <button class="icon-btn" id="btn-archive" data-i18n-aria="btn_archive_label" aria-label="Quest Log">${_ICON_ARCHIVE}</button>
      <button class="icon-btn" id="btn-stats" data-i18n-aria="btn_stats_label" aria-label="Estadísticas">${_ICON_STATS}</button>
      <button class="icon-btn" id="btn-auth" aria-label="Cuenta"></button>
    </div>
  </header>`;
}

function _siteControlsHTML() {
  return `
  <button class="theme-btn" id="btn-theme" aria-label="Modo claro">${_ICON_SUN}</button>
  <div class="settings-panel">
    ${IS_GAME_PAGE ? `<div class="vol-control" id="vol-control">
      <button class="vol-btn" id="btn-vol" aria-label="Volumen">
        <svg id="vol-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path id="vol-waves" d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      </button>
      <div class="vol-slider-wrap">
        <input type="range" class="vol-slider" id="vol-slider" min="0" max="100" value="80">
      </div>
    </div>` : ''}
    <div class="lang-dropdown" id="lang-dropdown">
      <button class="lang-dropdown__btn" id="lang-dropdown-btn" aria-haspopup="true" aria-expanded="false">
        <span id="lang-dropdown-flag">${_FLAG_ES_SVG}</span>
        <span id="lang-dropdown-label">Español</span>
        <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="lang-dropdown__chevron"><path d="M1 1l4 4 4-4"/></svg>
      </button>
      <div class="lang-dropdown__menu" id="lang-dropdown-menu">
        <button class="lang-dropdown__option" data-lang="es">${_FLAG_ES_SVG} Español</button>
        <button class="lang-dropdown__option" data-lang="en">${_FLAG_EN_SVG} English</button>
      </div>
    </div>
  </div>`;
}

function _siteFooterHTML() {
  return `
    <div class="footer-social">
      <a href="https://x.com/OestiQuest" target="_blank" rel="noopener" class="footer-social__btn footer-social__btn--x">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        @OestiQuest
      </a>
      <a href="https://ko-fi.com/C0C426TPFE" target="_blank" rel="noopener" class="footer-social__btn footer-social__btn--kofi">
        <svg class="kofi-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.5 3H6a5 5 0 0 0 0 10h.5c.8 2.3 2.8 4 5.2 4.4V19H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2.7v-1.6C15 16.9 17.5 14.2 18 11h.5a3.5 3.5 0 0 0 0-7zM6 11a3 3 0 0 1 0-6h1v6H6zm12.5 0H19V5h-.5a1.5 1.5 0 0 0 0 3H19v3h-.5z"/></svg>
        Support me on Ko-fi
      </a>
    </div>
    <p data-i18n-html="footer_credit_legal">Música provista por <a href="https://archive.org" target="_blank" rel="noopener">Archive.org</a> y <a href="https://downloads.khinsider.com" target="_blank" rel="noopener">KHInsider</a> · Desarrollado por Orteku en colaboración con Vyrka · <a href="privacy.html">Privacidad</a> · <a href="terms.html">Términos</a></p>
    <p data-i18n-html="footer_soundtracks_line">¿Tienes alguna sugerencia? Consulta la <a href="soundtracks.html">lista de canciones</a> · <a href="about.html">Sobre el proyecto</a> · <a href="ranking.html">Ranking</a> · Contacto: <a href="mailto:oestiquest@gmail.com">oestiquest@gmail.com</a></p>`;
}

// Se ejecuta al cargar el script (va al final del <body>, el DOM ya existe) y antes de aplicar
// las traducciones, para que i18n traduzca también el header.
(function _mountSiteChrome() {
  const wrap = document.getElementById('site-header');
  // Los hijos del contenedor (en el juego: panel del tutorial y pestaña de ayuda) se conservan debajo del header
  if (wrap) wrap.insertAdjacentHTML('afterbegin', _siteHeaderHTML());

  const controls = document.getElementById('site-controls');
  if (controls) controls.outerHTML = _siteControlsHTML();

  // La etiqueta <footer> se queda en cada página (con sus márgenes propios); aquí solo se rellena
  const footer = document.getElementById('site-footer');
  if (footer) footer.innerHTML = _siteFooterHTML();

  if (!document.getElementById('modal')) {
    document.body.insertAdjacentHTML('beforeend', `<div id="modal" role="dialog" aria-modal="true"><div id="modal-inner"></div></div>`);
  }
  if (!document.getElementById('auth-modal')) {
    document.body.insertAdjacentHTML('beforeend', `<div id="auth-modal" role="dialog" aria-modal="true"><div id="auth-modal-inner"></div></div>`);
  }
  if (!document.getElementById('toast')) {
    document.body.insertAdjacentHTML('beforeend', `<div id="toast" role="status" aria-live="polite"></div>`);
  }
})();

// ─── Modales y avisos ─────────────────────────────────────────────────────────

function openModal() {
  document.getElementById('modal').classList.add('modal--open');
}

function closeModal() {
  if (typeof _cleanupModalPlayer === 'function') _cleanupModalPlayer();
  document.getElementById('modal').classList.remove('modal--open');
}

let _toastTimer = null;

function showToast(msg, type, persistent) {
  clearTimeout(_toastTimer);
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('toast--warn',  type === 'warn');
  el.classList.toggle('toast--error', type === 'error');
  el.classList.add('toast--show');
  if (!persistent) {
    _toastTimer = setTimeout(hideToast, 3500);
  }
}

function hideToast() {
  clearTimeout(_toastTimer);
  _toastTimer = null;
  const el = document.getElementById('toast');
  el.classList.remove('toast--show', 'toast--warn', 'toast--error');
}

function _showAchievementAnnouncement() {
  const KEY = 'ostquest_seen_ach_v1';
  if (localStorage.getItem(KEY)) return;
  setTimeout(() => {
    const el = document.createElement('div');
    el.className = 'news-banner';
    el.innerHTML = `
      <div class="news-banner__icon">🏆</div>
      <div class="news-banner__body">
        <div class="news-banner__title">${t('news_ach_title')}</div>
        <div class="news-banner__text">${t('news_ach_body')}</div>
      </div>
      <button class="news-banner__close" id="news-banner-close">&times;</button>`;
    document.body.appendChild(el);
    document.getElementById('news-banner-close').addEventListener('click', () => {
      el.classList.add('news-banner--out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      localStorage.setItem(KEY, '1');
    });
  }, 1800);
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────

function openStatsModal() {
  const stats = loadStats();
  const pct   = stats.played > 0 ? Math.round(((stats.totalHits || 0) / (stats.played * 3)) * 100) : 0;

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      <h2 class="modal__end-label" style="font-size:1.3rem;margin-bottom:1.2rem">${t('stats_title')}</h2>
      <div class="modal__stats">
        <div class="stat-box"><span class="stat-box__val" id="stat-val-played">${stats.played}</span><span class="stat-box__lbl">${t('stat_played')}</span></div>
        <div class="stat-box"><span class="stat-box__val" id="stat-val-accuracy">${pct}%</span><span class="stat-box__lbl">${t('stat_accuracy')}</span></div>
        <div class="stat-box"><span class="stat-box__val" id="stat-val-streak">${stats.streak}</span><span class="stat-box__lbl">${t('stat_streak_current')}</span></div>
        <div class="stat-box"><span class="stat-box__val" id="stat-val-perfect">${stats.perfectQuests || 0}</span><span class="stat-box__lbl">${t('stat_max_streak')}</span></div>
      </div>
      <div class="stats-rank-section">
        <div id="stats-rank-info" class="stats-rank-info">
          <p class="rank-empty">${t('ranking_loading')}</p>
        </div>
        <a href="ranking.html" class="stats-rank-link">${t('ranking_view_full')} →</a>
      </div>
      <button class="btn btn--new" id="close-stats-btn">${t('btn_close')}</button>
    </div>`;

  document.getElementById('close-stats-btn').addEventListener('click', closeModal);
  _loadStatsRankInfo();
  authUpdateStatsDisplay?.();
  openModal();
}

async function _loadStatsRankInfo() {
  const el = document.getElementById('stats-rank-info');
  if (!el) return;

  if (!authGetSession() || !authGetProfile()) {
    el.innerHTML = `<p class="modal__register-cta">${t('register_cta_text')} <button class="modal__register-link" id="stats-register-btn">${t('register_cta_link')}</button></p>`;
    document.getElementById('stats-register-btn')?.addEventListener('click', () => {
      closeModal();
      openAuthModal('register');
    });
    return;
  }

  const pos = await getUserWeeklyPosition();
  if (!pos) {
    el.innerHTML = `<p class="rank-empty">${t('ranking_no_score')}</p>`;
  } else {
    el.innerHTML = `<p class="stats-rank-pos">#${pos.rank} <span class="stats-rank-pts">${pos.pts} ${t('ranking_pts')}</span></p>`;
  }
}

// ─── Quest Log ────────────────────────────────────────────────────────────────

function openArchive() {
  const played = loadPlayedDays();
  const today  = getGameDay();
  const activeDate = typeof getActiveArchiveDate === 'function' ? getActiveArchiveDate() : null;

  // Generar todos los días desde el inicio hasta ayer
  const days = [];
  const cur  = new Date(QUEST_START + 'T12:00:00Z');
  while (true) {
    const ds = cur.toISOString().slice(0, 10);
    if (ds >= today) break;
    days.push(ds);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  days.reverse(); // más reciente primero

  let prevMonth = null;
  const rows = days.map(ds => {
    const [y, m, d] = ds.split('-');

    // Separador de mes cuando cambia
    let monthHeader = '';
    const monthKey = `${y}-${m}`;
    if (monthKey !== prevMonth) {
      prevMonth = monthKey;
      const label = new Date(`${y}-${m}-01T12:00:00Z`)
        .toLocaleString(document.documentElement.lang, { month: 'long', year: 'numeric' });
      monthHeader = `<li class="archive__month-sep">${label.charAt(0).toUpperCase() + label.slice(1)}</li>`;
    }

    let result = played[ds];
    let inProgress = false;
    if (!result) {
      const prog = loadDayProgress(ds);
      if (prog && prog.every(s => s.solved)) {
        const score = prog.filter(s => s.correct).length;
        result = { score, total: 3 };
        savePlayedDay(ds, { score, total: 3, ts: Date.now() });
      } else if (prog && prog.some(s => s.solved)) {
        inProgress = true;
      }
    }
    const badge = result
      ? `<span class="archive__badge archive__badge--${result.score === 3 ? 'ok' : result.score > 0 ? 'partial' : 'fail'}">${result.score === 3 ? '✓' : result.score + '/3'}</span>`
      : inProgress
        ? `<span class="archive__badge archive__badge--ongoing">${t('archive_in_progress')}</span>`
        : '';
    const isActive  = ds === activeDate;
    const questNum  = getQuestNumber(ds);
    const special   = questNum === null ? getSpecialForDate(ds) : null;
    const questLabel = special
      ? `<span class="archive__special-label">⭐ ${special.label}</span>`
      : `Quest #${questNum}`;
    const itemClass = ['archive__item', isActive ? 'archive__item--active' : '', special ? 'archive__item--special' : ''].filter(Boolean).join(' ');
    return monthHeader + `<li class="${itemClass}" data-date="${ds}">
      <span class="archive__left">${questLabel}${badge}</span>
      <span class="archive__date">${d}-${m}-${y}</span>
    </li>`;
  }).join('');

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      <h2 class="modal__end-label" style="font-size:1.3rem;margin-bottom:1rem">${t('archive_title')}</h2>
      <ul class="archive__list">${rows}</ul>
      <button class="btn btn--new" id="close-archive-btn">${t('btn_close')}</button>
    </div>`;

  document.getElementById('close-archive-btn').addEventListener('click', closeModal);
  document.querySelectorAll('.archive__item').forEach(li => {
    li.addEventListener('click', () => {
      const ds = li.dataset.date;
      if (typeof openArchiveDay !== 'function') { location.href = '/?date=' + ds; return; }
      closeModal();
      openArchiveDay(ds);
    });
  });
  openModal();
}

// ─── Tema de especiales ───────────────────────────────────────────────────────

// Imágenes opcionales de img/specials/: banner_ → header, logo_ → favicon. Con null restaura las normales.
let _specialAssetsToken = 0;
function applySpecialAssets(sp) {
  const token = ++_specialAssetsToken;
  const targets = [
    { el: document.querySelector('.site-banner'),   attr: 'src',  prefix: 'banner_' },
    { el: document.querySelector('link[rel="icon"]'), attr: 'href', prefix: 'logo_' },
  ].filter(x => x.el);

  for (const { el, attr } of targets) {
    if (!el.dataset.defaultAsset) el.dataset.defaultAsset = el.getAttribute(attr);
    el.setAttribute(attr, el.dataset.defaultAsset);
  }
  if (!sp) return;

  const d = sp.date.replace(/-/g, '');
  for (const { el, attr, prefix } of targets) {
    const url = `img/specials/${prefix}${d}.png`;
    const probe = new Image();
    probe.onload = () => { if (token === _specialAssetsToken) el.setAttribute(attr, url); };
    probe.src = url;
  }
}

// Aplica (o revierte con null) todo el tema de un especial. Lo usan el día real y el modo GM.
let _themeSpecial = null;
function applySpecialTheme(sp) {
  if (sp !== _themeSpecial) applySpecialAssets(sp);
  _themeSpecial = sp;

  document.body.classList.toggle('is-special', !!sp);
  if (sp) document.documentElement.style.setProperty('--special-color', sp.color);
  else document.documentElement.style.removeProperty('--special-color');

  // Texto "Especial", tagline y recuadro derecho solo en especiales con pool
  const withPool = !!sp && hasGameData(sp);
  document.body.classList.toggle('has-special-label', withPool);
  const prefix = t('special_prefix');

  const lbl = document.getElementById('special-event-label');
  if (lbl) {
    lbl.innerHTML = !withPool ? '' : t('special_order') === 'suffix'
      ? `<span class="special-label__name">${sp.label}</span><span class="special-label__prefix">${prefix}</span>`
      : `<span class="special-label__prefix">${prefix}</span><span class="special-label__name">${sp.label}</span>`;
    lbl.hidden = !withPool;
  }

  const tgl = document.querySelector('.site-tagline');
  if (tgl) {
    if (withPool) tgl.innerHTML = t('tagline').trim().split(/\s+/).join('<br>');
    else tgl.textContent = t('tagline');
  }

  // El recuadro se comparte con el Quest Log: en modo archivo no se toca
  const banner = document.getElementById('archive-banner');
  if (banner && !document.body.classList.contains('is-archive')) {
    if (withPool) {
      banner.innerHTML = `<span class="archive-banner__special-prefix">${prefix}</span><span class="archive-banner__special-name">${sp.label}</span>`;
      banner.style.setProperty('--archive-banner-color', sp.color);
      banner.classList.add('archive-banner--special');
      banner.classList.remove('archive-banner--gm');
      banner.style.display = 'block';
    } else {
      banner.innerHTML = '';
      banner.style.display = 'none';
      banner.classList.remove('archive-banner--special');
      banner.style.removeProperty('--archive-banner-color');
    }
  }
}

// ─── Contador ─────────────────────────────────────────────────────────────────

// Si mañana es un especial con pool, el texto y el color del contador lo anuncian
function _updateCountdownLabel() {
  const el = document.getElementById('header-countdown');
  if (!el) return;
  const tomorrow = new Date(getGameDay() + 'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const next = getSpecialForDate(tomorrow.toISOString().slice(0, 10));
  if (!next || !hasGameData(next)) return;
  const lbl = el.parentElement.querySelector('[data-i18n]');
  if (lbl) {
    const prefix = t('special_prefix');
    lbl.textContent = t('special_order') === 'suffix' ? `${next.name} ${prefix}` : `${prefix} ${next.name}`;
  }
  el.style.color = next.color;
}

function _startCountdownTicker() {
  const el = document.getElementById('header-countdown');
  if (!el) return;
  _updateCountdownLabel();
  (function tick() {
    el.textContent = formatCountdown(timeUntilNextGame());
    setTimeout(tick, 1000);
  })();
}

// ─── Tema claro/oscuro ────────────────────────────────────────────────────────

function _applySiteTheme(light) {
  document.body.classList.toggle('theme--light', light);
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  btn.innerHTML = light ? _ICON_MOON : _ICON_SUN;
  btn.setAttribute('aria-label', light ? 'Modo oscuro' : 'Modo claro');
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

// Los scripts de cada página esperan a estas promesas en vez de llamar a initI18n()/authInit()
const siteI18nReady = initI18n();
const siteAuthReady = siteI18nReady.then(() => authInit());

siteI18nReady.then(() => {
  // Idioma
  const langDropdown = document.getElementById('lang-dropdown');
  document.getElementById('lang-dropdown-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    const open = langDropdown.classList.toggle('lang-dropdown--open');
    e.currentTarget.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('.lang-dropdown__option').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      langDropdown.classList.remove('lang-dropdown--open');
    });
  });
  document.addEventListener('click', () => langDropdown?.classList.remove('lang-dropdown--open'));

  // Tema
  _applySiteTheme(localStorage.getItem('ostquest_theme') === 'light');
  document.getElementById('btn-theme')?.addEventListener('click', () => {
    const light = !document.body.classList.contains('theme--light');
    localStorage.setItem('ostquest_theme', light ? 'light' : 'dark');
    _applySiteTheme(light);
  });

  // Botones del header
  document.getElementById('btn-stats')?.addEventListener('click', openStatsModal);
  document.getElementById('btn-archive')?.addEventListener('click', openArchive);
  document.getElementById('btn-today')?.addEventListener('click', () => {
    if (typeof goToToday === 'function') goToToday();
    else location.href = '/';
  });

  // Clic fuera del modal lo cierra
  document.getElementById('modal')?.addEventListener('click', e => {
    if (e.target.id !== 'modal') return;
    closeModal();
    if (typeof onModalBackdropClose === 'function') onModalBackdropClose();
  });

  // Especial de hoy y contador
  const todaySpecial = getSpecialForDate(getGameDay());
  if (todaySpecial) applySpecialTheme(todaySpecial);
  _startCountdownTicker();

  document.addEventListener('langchange', () => {
    if (_themeSpecial) applySpecialTheme(_themeSpecial);
    _updateCountdownLabel();
  });

  _showAchievementAnnouncement();
});
