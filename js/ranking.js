// Oesti Quest — Ranking page

let _rankingTab = 'weekly';

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  document.title = t('ranking_page_title') || 'Ranking — Oesti Quest';

  await authInit();

  // Lang dropdown
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

  // Theme toggle
  document.getElementById('btn-theme')?.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('theme--light');
    localStorage.setItem('ostquest_theme', isLight ? 'light' : 'dark');
    _updateThemeBtn();
  });
  _updateThemeBtn();

  // Tabs
  document.getElementById('rtab-weekly').addEventListener('click', () => {
    document.getElementById('rtab-weekly').classList.add('rank-tab--active');
    document.getElementById('rtab-global').classList.remove('rank-tab--active');
    _rankingTab = 'weekly';
    loadRankingInto('ranking-list', 'weekly');
  });
  document.getElementById('rtab-global').addEventListener('click', () => {
    document.getElementById('rtab-global').classList.add('rank-tab--active');
    document.getElementById('rtab-weekly').classList.remove('rank-tab--active');
    _rankingTab = 'global';
    loadRankingInto('ranking-list', 'global');
  });

  // Initial load
  loadRankingInto('ranking-list', 'weekly');
});

document.addEventListener('langchange', () => {
  if (!window.RANKING_PAGE) return;
  document.title = t('ranking_page_title') || 'Ranking — Oesti Quest';
  loadRankingInto('ranking-list', _rankingTab);
});

function _updateThemeBtn() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const isLight = document.body.classList.contains('theme--light');
  btn.setAttribute('aria-label', isLight ? 'Modo oscuro' : 'Modo claro');
}
