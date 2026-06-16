// OST Quest — i18n module

const _I18N_KEY = 'ostquest_lang';
const _LANGS    = ['es', 'en'];

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
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const v = _t[el.dataset.i18nAria];
    if (typeof v === 'string') el.setAttribute('aria-label', v);
  });
  const flag  = document.getElementById('lang-dropdown-flag');
  const label = document.getElementById('lang-dropdown-label');
  if (flag)  flag.textContent  = _lang === 'es' ? '🇪🇸' : '🇬🇧';
  if (label) label.textContent = _lang === 'es' ? 'Español' : 'English';
  document.querySelectorAll('.lang-dropdown__option').forEach(btn => {
    btn.classList.toggle('lang-dropdown__option--active', btn.dataset.lang === _lang);
  });
  document.documentElement.lang = _lang;
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

async function initI18n() {
  const saved = localStorage.getItem(_I18N_KEY);
  const nav   = (navigator.language || '').toLowerCase();
  const lang  = (_LANGS.includes(saved) ? saved : null)
             ?? (nav.startsWith('es') ? 'es' : 'en');
  await setLang(lang);
}
