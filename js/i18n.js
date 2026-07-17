// OST Quest — i18n module

const _I18N_KEY = 'ostquest_lang';
const _LANGS    = ['es', 'en'];

const _FLAG_ES = `<svg class="lang-flag-svg" viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#c60b1e"/><rect y="3.5" width="20" height="7" fill="#ffc400"/></svg>`;
const _FLAG_EN = `<svg class="lang-flag-svg" viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#012169"/><path d="M0,0 L20,14 M20,0 L0,14" stroke="white" stroke-width="4"/><path d="M0,0 L20,14 M20,0 L0,14" stroke="#c8102e" stroke-width="2"/><rect x="8.5" y="0" width="3" height="14" fill="white"/><rect x="0" y="5.5" width="20" height="3" fill="white"/><rect x="9.25" y="0" width="1.5" height="14" fill="#c8102e"/><rect x="0" y="6.25" width="20" height="1.5" fill="#c8102e"/></svg>`;

let _t    = {};
let _lang = 'es';

function t(key) {
  return typeof _t[key] === 'string' ? _t[key] : key;
}

function tRandom(key) {
  const arr = _t[key];
  if (!Array.isArray(arr) || !arr.length) return key;
  return arr[Math.floor(Math.random() * arr.length)];
}

function _applyDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = _t[el.dataset.i18n];
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const v = _t[el.dataset.i18nHtml];
    if (typeof v === 'string') el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const v = _t[el.dataset.i18nAria];
    if (typeof v === 'string') el.setAttribute('aria-label', v);
  });
  const flag  = document.getElementById('lang-dropdown-flag');
  const label = document.getElementById('lang-dropdown-label');
  if (flag)  flag.innerHTML    = _lang === 'es' ? _FLAG_ES : _FLAG_EN;
  if (label) label.textContent = _lang === 'es' ? 'Español' : 'English';
  document.querySelectorAll('.lang-dropdown__option').forEach(btn => {
    btn.classList.toggle('lang-dropdown__option--active', btn.dataset.lang === _lang);
  });
  document.documentElement.lang = _lang;
  if (_t.page_title) document.title = _t.page_title;
  document.dispatchEvent(new Event('langchange'));
}

async function setLang(lang) {
  if (!_LANGS.includes(lang)) return;
  try {
    const res = await fetch(`locales/${lang}.json`);
    if (!res.ok) throw new Error();
    _t    = await res.json();
    _lang = lang;
    localStorage.setItem(_I18N_KEY, lang);
    _applyDOM();
  } catch {
    if (lang !== 'es') await setLang('es');
  }
}

function localizeGame(game) {
  const override = _t.games?.[game.id];
  return override ? { ...game, ...override } : game;
}

async function initI18n() {
  const saved = localStorage.getItem(_I18N_KEY);
  const nav   = (navigator.language || '').toLowerCase();
  const lang  = (_LANGS.includes(saved) ? saved : null)
             ?? (nav.startsWith('es') ? 'es' : 'en');
  await setLang(lang);
}
