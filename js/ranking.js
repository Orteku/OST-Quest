// Oesti Quest — Ranking page

let _rankingTab = 'weekly';

document.addEventListener('DOMContentLoaded', async () => {
  await siteI18nReady;
  await siteAuthReady;

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
  loadRankingInto('ranking-list', _rankingTab);
});
