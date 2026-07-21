// Oesti Quest — Soundtracks page list

function updatePlayBanner() {
  const banner = document.getElementById('st-play-banner');
  if (!banner) return;
  const played = loadPlayedDays();
  banner.style.display = played[getGameDay()] ? 'none' : '';
}

function renderSoundtracks() {
  document.title = t('soundtracks_page_title');

  const container = document.getElementById('soundtracks-list');
  if (!container) return;
  container.innerHTML = '';

  const sorted = [...GAME_DB].sort((a, b) =>
    localizeGame(a).game.localeCompare(localizeGame(b).game)
  );

  sorted.forEach(game => {
    const lg = localizeGame(game);
    const tracksHtml = game.tracks.map(tr => `
      <li class="st-track">
        <span class="st-track__title">${tr.title || '—'}</span>
        ${tr.artist ? `<span class="st-track__artist">${tr.artist}</span>` : ''}
      </li>`).join('');

    const entry = document.createElement('div');
    entry.className = 'st-entry';
    entry.innerHTML = `
      <h2 class="st-game">${lg.game}${game.year ? `<span class="st-year">${game.year}</span>` : ''}</h2>
      <ul class="st-tracks">${tracksHtml}</ul>`;
    container.appendChild(entry);
  });
}

document.addEventListener('langchange', () => {
  if (window.SOUNDTRACKS_PAGE) renderSoundtracks();
});

document.addEventListener('DOMContentLoaded', () => {
  if (window.SOUNDTRACKS_PAGE) { renderSoundtracks(); updatePlayBanner(); }
});
