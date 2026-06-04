// OST Quest - Main Game Controller

let currentGroups  = [];
let colStates      = [];
let currentDateStr = '';
let isArchiveMode  = false;
let playingCol     = -1;
let gameFinished   = false;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function initGame(dateStr, archiveMode) {
  currentDateStr = dateStr;
  isArchiveMode  = archiveMode;
  gameFinished   = false;
  stopAudio();

  showLoadingScreen(true);
  currentGroups = generateDailyGame(dateStr);

  // Restaurar progreso guardado (solo día actual, no archivo)
  const saved = loadDayProgress(dateStr);
  if (saved) {
    colStates = saved;
  } else {
    colStates = [
      { locked: false, solved: false, pickedId: null, correct: false },
      { locked: true,  solved: false, pickedId: null, correct: false },
      { locked: true,  solved: false, pickedId: null, correct: false },
    ];
  }

  await Promise.all(currentGroups.map(async (g) => {
    g.assets = await Promise.all(g.covers.map(cv => getGameAssets(cv)));
  }));

  showLoadingScreen(false);
  renderAll();
  startCountdownTicker();

  // Si ya estaba terminado al recargar, mostrar end modal directamente
  if (saved && colStates.every(s => s.solved)) {
    gameFinished = true;
    setTimeout(() => openEndModal(colStates.filter(s => s.correct).length), 300);
  }
}

// ─── Progreso guardado ────────────────────────────────────────────────────────

// saveDayProgress and loadDayProgress now live in daily.js



// ─── Rendering ────────────────────────────────────────────────────────────────

function renderAll() {
  const wrapper = document.getElementById('columns-wrapper');
  wrapper.innerHTML = '';
  currentGroups.forEach((_, gi) => renderColumn(gi, wrapper));
  updateScoreDisplay();
}

function renderColumn(gi, wrapper) {
  const g  = currentGroups[gi];
  const st = colStates[gi];

  const col = document.createElement('div');
  col.className = [
    'col',
    st.locked               ? 'col--locked'  : '',
    st.solved && st.correct  ? 'col--correct' : '',
    st.solved && !st.correct ? 'col--wrong'   : '',
    !st.locked && !st.solved ? 'col--active'  : '',
  ].filter(Boolean).join(' ');
  col.id = `col-${gi}`;

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'col__header' + (playingCol === gi ? ' col__header--playing' : '');
  const playIcon = playingCol === gi
    ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
  const hintText = st.solved
    ? `<strong>${g.answer.game}</strong>`
    : st.locked ? 'Bloqueado' : 'Pulsa ▶ para escuchar';

  hdr.innerHTML = `
    <button class="play-btn" aria-label="Reproducir / pausar" ${st.locked ? 'disabled' : ''}>
      ${playIcon}
    </button>
    <span class="col__track-hint">${hintText}</span>`;

  if (!st.locked) {
    hdr.querySelector('.play-btn').addEventListener('click', () => togglePlay(gi));
  }
  col.appendChild(hdr);

  // Covers
  const grid = document.createElement('div');
  grid.className = 'covers-grid';

  g.covers.forEach((cv, ci) => {
    const asset = g.assets[ci];
    const item  = document.createElement('div');
    item.className = 'cover-item';

    if (st.solved) {
      const isAnswer = cv.id === g.answer.id;
      const isPicked = cv.id === st.pickedId;
      if (isPicked && isAnswer)  item.classList.add('cover-item--correct-pick');
      else if (isPicked)         item.classList.add('cover-item--wrong-pick');
      else if (isAnswer)         item.classList.add('cover-item--answer');
    }

    const fallback = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(cv.game)}`;
    item.innerHTML = `
      <img src="${asset.cover || fallback}" alt="${cv.game}" loading="lazy"
           onerror="this.onerror=null;this.src='${fallback}'">
      <span class="cover-item__label">${cv.game}</span>`;

    if (!st.locked) {
      if (!st.solved) {
        item.addEventListener('click', () => openGuessModal(gi, cv, ci));
      } else {
        // Columna resuelta: mostrar info + link YouTube
        item.addEventListener('click', () => openInfoModal(cv, asset));
      }
    }
    grid.appendChild(item);
  });
  col.appendChild(grid);

  // Lock overlay
  if (st.locked) {
    const lock = document.createElement('div');
    lock.className = 'lock-overlay';
    lock.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`;
    col.appendChild(lock);
  }

  wrapper.appendChild(col);
}

function rerenderColumn(gi) {
  const wrapper = document.getElementById('columns-wrapper');
  const old = document.getElementById(`col-${gi}`);
  if (!old) return;
  const tmp = document.createElement('div');
  renderColumn(gi, tmp);
  wrapper.replaceChild(tmp.firstChild, old);
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function stopAudio() {
  stopYouTube();
  playingCol = -1;
}

function togglePlay(gi) {
  if (playingCol === gi) {
    const prev = gi;
    stopAudio();
    rerenderColumn(prev);
    return;
  }

  const prevPlaying = playingCol;
  stopAudio();
  if (prevPlaying >= 0) rerenderColumn(prevPlaying);

  const g      = currentGroups[gi];
  const ansIdx = g.covers.indexOf(g.answer);
  const asset  = g.assets[ansIdx];

  if (!asset?.youtubeId) {
    showToast('Audio no disponible para este grupo.');
    return;
  }

  playingCol = gi;
  playYouTube(asset.youtubeId, asset.startSeconds || 0, () => {
    stopAudio();
    rerenderColumn(gi);
  });
  rerenderColumn(gi);
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function openModal() {
  document.getElementById('modal').classList.add('modal--open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('modal--open');
}

function openGuessModal(gi, cv, ci) {
  const asset    = currentGroups[gi].assets[ci];
  const fallback = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(cv.game)}`;

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__cover-wrap">
      <img src="${asset.cover || fallback}" alt="${cv.game}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div class="modal__body">
      <h2 class="modal__game-name">${cv.game}</h2>
      <button class="btn btn--guess" id="confirm-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        ¡Mi opción!
      </button>
    </div>`;

  document.getElementById('confirm-btn').addEventListener('click', () => {
    closeModal();
    resolveGuess(gi, cv);
  });
  openModal();
}

// Info modal para portadas de columnas ya resueltas (FIX 3)
function openInfoModal(cv, asset) {
  const fallback = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(cv.game)}`;

  document.getElementById('modal-inner').innerHTML = `
    <button class="modal__close-x" id="info-close">&times;</button>
    <div class="modal__cover-wrap">
      <img src="${asset.cover || fallback}" alt="${cv.game}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div class="modal__body">
      <h2 class="modal__game-name">${cv.game}</h2>
      ${asset.youtubeId ? `
        <a class="btn btn--yt-link" href="https://www.youtube.com/watch?v=${asset.youtubeId}"
           target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
          </svg>
          Ver en YouTube
        </a>` : ''}
    </div>`;

  document.getElementById('info-close').addEventListener('click', closeModal);
  openModal();
}

function openResultModal(gi, pickedCv, isCorrect) {
  const g        = currentGroups[gi];
  const ansIdx   = g.covers.indexOf(g.answer);
  const ansAsset = g.assets[ansIdx];
  const fallback = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(g.answer.game)}`;

  const btnClass = isCorrect ? 'btn--result-ok' : 'btn--result-fail';
  const btnText  = isCorrect ? '¡Correcto!' : '¡Errado!';
  const msg      = isCorrect ? '¡Lo hiciste bien!' : `Era <strong>${g.answer.game}</strong>`;

  document.getElementById('modal-inner').innerHTML = `
    <button class="modal__close-x" id="result-close">&times;</button>
    <div class="modal__cover-wrap">
      <img src="${ansAsset.cover || fallback}" alt="${g.answer.game}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div class="modal__body">
      <h2 class="modal__game-name">${g.answer.game}</h2>
      <button class="btn ${btnClass}" disabled>${btnText}</button>
      <div class="modal__result-info">
        <p class="modal__result-text">${msg}</p>
        ${ansAsset.youtubeId ? `
          <a class="deezer-link" href="https://www.youtube.com/watch?v=${ansAsset.youtubeId}"
             target="_blank" rel="noopener">Ver en YouTube</a>` : ''}
      </div>
    </div>`;

  document.getElementById('result-close').addEventListener('click', () => {
    closeModal();
    renderAll();
    checkFinished();
  });
  openModal();
}

function openEndModal(score) {
  closeModal();
  const stats = loadStats();
  const pct   = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
  // FIX 2: modal final es bloqueante, solo cierra con el botón

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      <div class="modal__end-score">
        <span class="modal__end-num">${score}</span>
        <span class="modal__end-denom">/ 3</span>
      </div>
      <p class="modal__end-label">${
        score === 3 ? '¡Perfecto!'        :
        score === 2 ? '¡Casi!'            :
        score === 1 ? 'Sigue intentándolo':
                      'Mañana será mejor'
      }</p>
      ${isArchiveMode ? `<p class="modal__archive-note">Modo Quest Log — sin estadísticas</p>` : ''}
      ${!isArchiveMode ? `
        <div class="modal__stats">
          <div class="stat-box"><span class="stat-box__val">${stats.played}</span><span class="stat-box__lbl">Jugadas</span></div>
          <div class="stat-box"><span class="stat-box__val">${pct}%</span><span class="stat-box__lbl">Hits %</span></div>
          <div class="stat-box"><span class="stat-box__val">${stats.streak}</span><span class="stat-box__lbl">Racha</span></div>
          <div class="stat-box"><span class="stat-box__val">${stats.maxStreak}</span><span class="stat-box__lbl">Mejor racha</span></div>
        </div>
        <div class="modal__countdown">Próximo juego en <strong id="end-countdown">--:--:--</strong></div>
      ` : ''}
      <button class="btn btn--new" id="close-end-btn">Cerrar</button>
    </div>`;

  document.getElementById('close-end-btn').addEventListener('click', () => {
      closeModal();
  });
  if (!isArchiveMode) tickEndCountdown();
  openModal();
}

function tickEndCountdown() {
  const el = document.getElementById('end-countdown');
  if (!el) return;
  el.textContent = formatCountdown(timeUntilNextGame());
  setTimeout(tickEndCountdown, 1000);
}

function openStatsModal() {
  const stats = loadStats();
  const pct   = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      <h2 class="modal__end-label" style="font-size:1.3rem;margin-bottom:1.2rem">Estadísticas</h2>
      <div class="modal__stats">
        <div class="stat-box"><span class="stat-box__val">${stats.played}</span><span class="stat-box__lbl">Jugadas</span></div>
        <div class="stat-box"><span class="stat-box__val">${pct}%</span><span class="stat-box__lbl">Hits %</span></div>
        <div class="stat-box"><span class="stat-box__val">${stats.streak}</span><span class="stat-box__lbl">Racha actual</span></div>
        <div class="stat-box"><span class="stat-box__val">${stats.maxStreak}</span><span class="stat-box__lbl">Mejor racha</span></div>
      </div>
      <div class="modal__countdown">Próximo juego en <strong id="stats-countdown">--:--:--</strong></div>
      <button class="btn btn--new" id="close-stats-btn">Cerrar</button>
    </div>`;

  document.getElementById('close-stats-btn').addEventListener('click', closeModal);
  openModal();
  (function tickStats() {
    const el = document.getElementById('stats-countdown');
    if (!el) return;
    el.textContent = formatCountdown(timeUntilNextGame());
    setTimeout(tickStats, 1000);
  })();
}

function openArchive() {
  const played = loadPlayedDays();
  const days = [];
  for (let i = 1; i <= 14; i++) {
    days.push(getPastGameDay(i));
  }

  const rows = days.map(ds => {
    // Check both played registry and saved progress for this day
    let result = played[ds];
    if (!result) {
      // Check if there's saved progress that's complete
      const prog = loadDayProgress(ds);
      if (prog && prog.every(s => s.solved)) {
        const score = prog.filter(s => s.correct).length;
        result = { score, total: 3 };
        // Also persist it so it shows next time
        savePlayedDay(ds, { score, total: 3, ts: Date.now() });
      }
    }
    const badge = result
      ? `<span class="archive__badge archive__badge--${result.score === 3 ? 'ok' : result.score > 0 ? 'partial' : 'fail'}">
           ${result.score === 3 ? '✓' : result.score + '/3'}
         </span>`
      : `<span class="archive__badge archive__badge--new">Jugar</span>`;
    const [y,m,d] = ds.split('-');
    return `<li class="archive__item" data-date="${ds}">
      <span class="archive__date">${d}-${m}-${y}</span>${badge}
    </li>`;
  }).join('');

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      <h2 class="modal__end-label" style="font-size:1.3rem;margin-bottom:1rem">Quest Log</h2>
      <ul class="archive__list">${rows}</ul>
      <button class="btn btn--new" id="close-archive-btn">Cerrar</button>
    </div>`;

  document.getElementById('close-archive-btn').addEventListener('click', closeModal);
  document.querySelectorAll('.archive__item').forEach(li => {
    li.addEventListener('click', () => {
      const ds = li.dataset.date;
      closeModal();
      stopAudio();
      const [ay,am,ad] = ds.split('-');
      document.getElementById('archive-banner').textContent = `Quest ${ad}-${am}-${ay}`;
      document.getElementById('archive-banner').style.display = 'block';
      initGame(ds, true);
    });
  });
  openModal();
}

// ─── Game Logic ───────────────────────────────────────────────────────────────

function resolveGuess(gi, pickedCv) {
  const correct = pickedCv.id === currentGroups[gi].answer.id;
  colStates[gi].solved   = true;
  colStates[gi].pickedId = pickedCv.id;
  colStates[gi].correct  = correct;
  if (gi + 1 < 3) colStates[gi + 1].locked = false;

  saveDayProgress(currentDateStr, colStates);
  updateScoreDisplay();
  setTimeout(() => openResultModal(gi, pickedCv, correct), 60);
}

function checkFinished() {
  if (!colStates.every(s => s.solved)) return;
  if (gameFinished) return;
  gameFinished = true;
  const score = colStates.filter(s => s.correct).length;
  setTimeout(() => {
    recordDailyResult(currentDateStr, score, 3);
    openEndModal(score);
  }, 400);
}

// ─── Score / Countdown ────────────────────────────────────────────────────────

function updateScoreDisplay() {
  document.getElementById('score-hits').textContent = colStates.filter(s => s.solved && s.correct).length;
  document.getElementById('score-miss').textContent = colStates.filter(s => s.solved && !s.correct).length;
}

function startCountdownTicker() {
  const el = document.getElementById('header-countdown');
  if (!el) return;
  (function tick() {
    el.textContent = formatCountdown(timeUntilNextGame());
    setTimeout(tick, 1000);
  })();
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function showLoadingScreen(show) {
  document.getElementById('loading-screen').style.display = show ? 'flex' : 'none';
  document.getElementById('game-area').style.display      = show ? 'none'  : 'block';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('toast--show');
  setTimeout(() => t.classList.remove('toast--show'), 3500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const today = getGameDay();

  // Clic fuera del modal cierra siempre (incluyendo el modal final)
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id !== 'modal') return;
    closeModal();
    renderAll();
  });

  document.getElementById('btn-stats').addEventListener('click', openStatsModal);
  document.getElementById('btn-archive').addEventListener('click', openArchive);
  document.getElementById('btn-today').addEventListener('click', () => {
    stopAudio();
    document.getElementById('archive-banner').style.display = 'none';
    initGame(today, false);
  });

  initGame(today, false);

  // Volume control — inline slider, always visible
  const volSlider = document.getElementById('vol-slider');
  const savedVol  = parseInt(localStorage.getItem('ostquest_vol'));
  if (!isNaN(savedVol)) volSlider.value = savedVol;

  volSlider.addEventListener('input', () => {
    const v = parseInt(volSlider.value);
    setYouTubeVolume(v);
    const waves = document.getElementById('vol-waves');
    if (waves) waves.style.opacity = v === 0 ? '0' : '0.5';
  });
});
