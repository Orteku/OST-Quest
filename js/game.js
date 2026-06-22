// OST Quest - Main Game Controller

const ARCHIVE_START = '2026-06-08'; // Primera quest disponible

let currentGroups  = [];
let colStates      = [];
let currentDateStr = '';
let isArchiveMode  = false;
let playingCol     = -1;
let loadingCol     = -1;
let gameFinished   = false;
let _loadingToastTimer = null;
let _toastTimer        = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function initGame(dateStr, archiveMode) {
  currentDateStr = dateStr;
  isArchiveMode  = archiveMode;
  gameFinished   = false;
  stopAudio();

  showLoadingScreen(true);
  currentGroups = await generateDailyGame(dateStr);

  // Restaurar progreso guardado (solo día actual, no archivo)
  const saved = loadDayProgress(dateStr);
  if (saved) {
    colStates = saved;
  } else {
    colStates = [
      { locked: false, solved: false, pickedId: null, pickedPos: null, correct: false },
      { locked: true,  solved: false, pickedId: null, pickedPos: null, correct: false },
      { locked: true,  solved: false, pickedId: null, pickedPos: null, correct: false },
    ];
  }

  await Promise.all(currentGroups.map(async (g) => {
    g.assets = await Promise.all(g.covers.map(cv =>
      getGameAssets(cv, cv.id === g.answer.id ? (g.trackIndex || 0) : 0)
    ));
  }));

  showLoadingScreen(false);
  renderAll();
  startCountdownTicker();

  // Precachear el audio directo de las 3 columnas
  _prewarmAnswerAudio(0);
  _prewarmAnswerAudio(1);
  _prewarmAnswerAudio(2);

  // Si ya estaba terminado al recargar, mostrar end modal directamente
  if (saved && colStates.every(s => s.solved)) {
    gameFinished = true;
    setTimeout(() => openEndModal(colStates.filter(s => s.correct).length), 300);
  }
}

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
  const isLoading = loadingCol === gi;
  const playIcon = isLoading
    ? `<svg class="col__loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a10 10 0 1 0 10 10"/></svg>`
    : playingCol === gi
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
  const hintText = isLoading
    ? t('audio_loading')
    : st.solved
      ? `<strong>${g.answer.game}</strong>`
      : st.locked
        ? t('col_locked')
        : playingCol === gi
          ? `<span class="col__hint-guessing">${t('col_guessing')}</span>`
          : t('col_play_hint');

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
      if (isPicked && isAnswer) {
        // Correct pick: highlight green, rest dimmed
        item.classList.add('cover-item--correct-pick');
      } else if (isPicked) {
        // Wrong pick: slightly dimmed + red outline
        item.classList.add('cover-item--wrong-pick');
      } else if (isAnswer) {
        // Correct answer (when user picked wrong): highlight green
        item.classList.add('cover-item--answer');
      } else {
        // Neither picked nor answer: fully dimmed
        item.classList.add('cover-item--dimmed');
      }
    }

    const fallback = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(cv.game)}`;
    const nameLen  = cv.game.length;
    const labelFs  = nameLen > 24 ? '11px' : '13px';
    item.innerHTML = `
      <img src="${asset.cover || fallback}" alt="${cv.game}" loading="lazy"
           onerror="this.onerror=null;this.src='${fallback}'">
      <span class="cover-item__label" style="font-size:${labelFs}">${cv.game}</span>`;

    if (!st.locked) {
      if (!st.solved) {
        item.addEventListener('click', () => openGuessModal(gi, cv, ci));
      } else {
        // Columna resuelta: mostrar info del juego
        item.addEventListener('click', () => openInfoModal(cv, asset, gi));
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
  clearTimeout(_loadingToastTimer);
  _loadingToastTimer = null;
  hideToast();
  stopTrack();
  playingCol = -1;
  loadingCol = -1;
}

function togglePlay(gi) {
  if (playingCol === gi) {
    stopAudio();
    rerenderColumn(gi);
    return;
  }

  const prevPlaying = playingCol;
  stopAudio();
  if (prevPlaying >= 0) rerenderColumn(prevPlaying);

  const g      = currentGroups[gi];
  const ansIdx = g.covers.indexOf(g.answer);
  const asset  = g.assets[ansIdx];

  if (!asset?.audioUrl) {
    showToast(t('audio_unavailable'));
    return;
  }

  playingCol = gi;
  rerenderColumn(gi);

  playTrack(
    asset,
    () => {
      const wasLoading = loadingCol === gi;
      stopAudio();
      rerenderColumn(gi);
      if (wasLoading) showToast(t('audio_error'), 'error', true);
    },
    () => {
      loadingCol = gi;
      rerenderColumn(gi);
      if (asset.audioUrl.includes('archive.org')) {
        _loadingToastTimer = setTimeout(() => {
          _loadingToastTimer = null;
          if (loadingCol === gi) showToast(t('audio_slow_archive'), 'warn', true);
        }, 4000);
      }
    },
    () => {
      clearTimeout(_loadingToastTimer);
      _loadingToastTimer = null;
      hideToast();
      if (loadingCol === gi) { loadingCol = -1; rerenderColumn(gi); }
    },
    () => {
      clearTimeout(_loadingToastTimer);
      _loadingToastTimer = null;
      hideToast();
      loadingCol = -1;
      playingCol = -1;
      rerenderColumn(gi);
      showToast(t('audio_error'), 'error', true);
    }
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function openModal() {
  document.getElementById('modal').classList.add('modal--open');
}

const MODAL_PREVIEW_SECS = 30;
let _modalStopTimer    = null;
let _modalFadeInterval = null;

function _stopModalPreview() {
  clearTimeout(_modalStopTimer);
  clearInterval(_modalFadeInterval);
  _modalStopTimer    = null;
  _modalFadeInterval = null;
}

function _cleanupModalPlayer() {
  _stopModalPreview();
  const audio = document.querySelector('.modal-player__audio');
  if (audio) { audio.pause(); audio.currentTime = 0; }
}

function closeModal() {
  _cleanupModalPlayer();
  document.getElementById('modal').classList.remove('modal--open');
}

function _initModalAudioPlayer(startSeconds = 0) {
  const wrap = document.querySelector('.modal-player');
  if (!wrap) return;
  const audio = wrap.querySelector('.modal-player__audio');
  const btn   = wrap.querySelector('.modal-player__btn');
  const fill  = wrap.querySelector('.modal-player__fill');
  const time  = wrap.querySelector('.modal-player__time');

  audio.volume = gameVolume / 100;

  let _modalWaiting = false;
  let _hadError     = false;
  let _modalPlayed  = false;
  function updateBtn() {
    btn.innerHTML = _modalWaiting ? _LOADING_SM : audio.paused ? _PLAY_SM : _PAUSE_SM;
  }

  function seekToStart() {
    if (audio.readyState >= 1) {
      audio.currentTime = startSeconds;
    } else {
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = startSeconds; }, { once: true });
    }
  }
  seekToStart();

  function startModalPreview() {
    _stopModalPreview();
    const fadeSecs  = 3;
    const fadeSteps = 20;
    const elapsed   = Math.max(0, audio.currentTime - startSeconds);
    const remaining = (MODAL_PREVIEW_SECS - elapsed) * 1000;

    _modalStopTimer = setTimeout(() => {
      const baseVol = audio.volume;
      let step = 0;
      _modalFadeInterval = setInterval(() => {
        step++;
        audio.volume = baseVol * (1 - step / fadeSteps);
        if (step >= fadeSteps) {
          clearInterval(_modalFadeInterval); _modalFadeInterval = null;
          const played = _modalPlayed;
          audio.pause();
          audio.currentTime = startSeconds;
          audio.volume = gameVolume / 100;
          fill.style.width = '0%';
          time.textContent = `${_fmtTime(0)} / ${_fmtTime(MODAL_PREVIEW_SECS)}`;
          if (!played) {
            _clearSlowToast();
            hideToast();
            _hadError = true;
            showToast(t('audio_error'), 'error', true);
          }
          updateBtn();
        }
      }, (fadeSecs * 1000) / fadeSteps);
    }, Math.max(0, remaining - fadeSecs * 1000));
  }

  btn.addEventListener('click', () => {
    if (audio.paused) {
      const prev = playingCol;
      stopAudio();
      if (prev >= 0) rerenderColumn(prev);
      if (_hadError) { audio.load(); _hadError = false; seekToStart(); }
      audio.play().catch(() => {});
    } else {
      audio.pause();
      _stopModalPreview();
    }
  });
  function _startSlowToast() {
    if (audio.src.includes('archive.org') && !_loadingToastTimer) {
      _loadingToastTimer = setTimeout(() => {
        _loadingToastTimer = null;
        if (_modalWaiting) showToast(t('audio_slow_archive'), 'warn', true);
      }, 4000);
    }
  }
  function _clearSlowToast() { clearTimeout(_loadingToastTimer); _loadingToastTimer = null; }

  audio.addEventListener('play',    () => {
    _modalWaiting = false; updateBtn(); startModalPreview();
    if (audio.readyState < 3) _startSlowToast();
  });
  audio.addEventListener('playing', () => { _modalWaiting = false; _modalPlayed = true; _clearSlowToast(); hideToast(); updateBtn(); });
  audio.addEventListener('waiting', () => { _modalWaiting = true;  updateBtn(); _startSlowToast(); });
  audio.addEventListener('pause',   () => { _modalWaiting = false; _clearSlowToast(); hideToast(); updateBtn(); });
  audio.addEventListener('ended',   () => { _modalWaiting = false; updateBtn(); _stopModalPreview(); });
  audio.addEventListener('error',   () => {
    _hadError     = true;
    _modalWaiting = false;
    _clearSlowToast();
    hideToast();
    btn.innerHTML = _PLAY_SM;
    btn.setAttribute('aria-label', 'Reproducir');
    showToast(t('audio_error'), 'error', true);
  });
  audio.addEventListener('timeupdate', () => {
    const elapsed = Math.min(Math.max(0, audio.currentTime - startSeconds), MODAL_PREVIEW_SECS);
    fill.style.width  = `${(elapsed / MODAL_PREVIEW_SECS) * 100}%`;
    time.textContent  = `${_fmtTime(elapsed)} / ${_fmtTime(MODAL_PREVIEW_SECS)}`;
  });

  time.textContent = `${_fmtTime(0)} / ${_fmtTime(MODAL_PREVIEW_SECS)}`;
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
      <h2 class="modal__game-name">${cv.game}${cv.year ? `<span class="modal__game-year">${cv.year}</span>` : ''}</h2>
      <button class="btn btn--guess" id="confirm-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        ${t('guess_confirm')}
      </button>
    </div>`;

  document.getElementById('confirm-btn').addEventListener('click', () => {
    closeModal();
    resolveGuess(gi, cv, ci);
  });
  openModal();
}

// ─── Tutorial ────────────────────────────────────────────────────────────────

function openTutorialModal() {
  document.getElementById('modal-inner').innerHTML = `
    <button class="modal__close-x" id="tutorial-close">&times;</button>
    <div class="modal__body">
      <h2 class="modal__tutorial-title">${t('tutorial_title')}</h2>
      <ul class="tutorial-steps">
        <li>
          <span class="tutorial-step__icon">▶</span>
          <div><strong>${t('tutorial_listen_h')}</strong><p>${t('tutorial_listen_b')}</p></div>
        </li>
        <li>
          <span class="tutorial-step__icon">?</span>
          <div><strong>${t('tutorial_guess_h')}</strong><p>${t('tutorial_guess_b')}</p></div>
        </li>
        <li>
          <span class="tutorial-step__icon">★</span>
          <div><strong>${t('tutorial_daily_h')}</strong><p>${t('tutorial_daily_b')}</p></div>
        </li>
      </ul>
      <hr class="tutorial-divider">
      <div class="tutorial-btns">
        <div class="tutorial-btn-item">
          <span class="tutorial-step__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18">
              <path d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6z"/>
              <path d="M14 2v6h6"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
          </span>
          <div><strong>${t('tutorial_archive_h')}</strong><p>${t('tutorial_archive_b')}</p></div>
        </div>
        <div class="tutorial-btn-item">
          <span class="tutorial-step__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <div><strong>${t('tutorial_stats_h')}</strong><p>${t('tutorial_stats_b')}</p></div>
        </div>
      </div>
    </div>`;

  document.getElementById('tutorial-close').addEventListener('click', () => {
    localStorage.setItem('ostquest_tutorial', '1');
    closeModal();
  });
  openModal();
}

// ─── Media widget helpers ─────────────────────────────────────────────────────

const _PLAY_SM    = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5,3 19,12 5,21"/></svg>`;
const _PAUSE_SM   = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const _LOADING_SM = `<svg class="col__loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M12 2a10 10 0 1 0 10 10"/></svg>`;

function _fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Conecta el reproductor sincronizado (rAF) al audioEl existente.
// Gestiona play/pause desde el botón y limpia el rAF cuando el elemento se desconecta.
function _attachSyncedPlayer(fillId, timeId, btnId, audioEl, startSecs) {
  const fillEl  = document.getElementById(fillId);
  const timeEl  = document.getElementById(timeId);
  const playBtn = document.getElementById(btnId);
  let rafId;

  function tick() {
    if (!fillEl || !fillEl.isConnected) { cancelAnimationFrame(rafId); return; }
    const elapsed = Math.min(MODAL_PREVIEW_SECS, Math.max(0, audioEl.currentTime - startSecs));
    fillEl.style.width = `${(elapsed / MODAL_PREVIEW_SECS) * 100}%`;
    timeEl.textContent = `${_fmtTime(elapsed)} / ${_fmtTime(MODAL_PREVIEW_SECS)}`;
    rafId = requestAnimationFrame(tick);
  }
  tick();

  playBtn.addEventListener('click', () => {
    if (audioEl.paused) {
      cancelAnimationFrame(rafId);
      audioEl.play().catch(() => {});
      playBtn.innerHTML = _PAUSE_SM;
      playBtn.setAttribute('aria-label', 'Pausar');
      tick();
    } else {
      cancelAnimationFrame(rafId);
      audioEl.pause();
      playBtn.innerHTML = _PLAY_SM;
      playBtn.setAttribute('aria-label', 'Reproducir');
    }
  });

  function onAudioPause() {
    if (!playBtn.isConnected) { audioEl.removeEventListener('pause', onAudioPause); return; }
    cancelAnimationFrame(rafId);
    playBtn.innerHTML = _PLAY_SM;
    playBtn.setAttribute('aria-label', 'Reproducir');
  }
  audioEl.addEventListener('pause', onAudioPause);
}

function _buildMediaWidget(asset) {
  const titleHtml = asset.title ? `<p class="modal__track-title">${asset.title}</p>` : '';
  if (!asset.audioUrl) return titleHtml;
  return `${titleHtml}
    <div class="modal-player">
      <audio class="modal-player__audio" src="${asset.audioUrl}" preload="metadata"></audio>
      <button class="modal-player__btn" aria-label="Reproducir">${_PLAY_SM}</button>
      <div class="modal-player__track">
        <div class="modal-player__bar"><div class="modal-player__fill"></div></div>
        <span class="modal-player__time">0:00</span>
      </div>
    </div>`;
}

// Info modal para portadas de columnas ya resueltas
function openInfoModal(cv, asset, gi) {
  const fallback  = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(cv.game)}`;
  const audioEl   = getDirectAudioEl();
  const startSecs = asset.startSeconds || 0;
  const isSynced  = playingCol === gi
    && audioEl
    && !audioEl.paused
    && !!asset.audioUrl
    && audioEl.src === new URL(asset.audioUrl, location.href).href;

  const playerHtml = isSynced ? `
    ${asset.title ? `<p class="modal__track-title">${asset.title}</p>` : ''}
    <div class="modal-player">
      <button class="modal-player__btn" id="info-player-btn" aria-label="Pausar">${_PAUSE_SM}</button>
      <div class="modal-player__track">
        <div class="modal-player__bar"><div class="modal-player__fill" id="info-player-fill"></div></div>
        <span class="modal-player__time" id="info-player-time">${_fmtTime(0)} / ${_fmtTime(MODAL_PREVIEW_SECS)}</span>
      </div>
    </div>` : _buildMediaWidget(asset);

  document.getElementById('modal-inner').innerHTML = `
    <button class="modal__close-x" id="info-close">&times;</button>
    <div class="modal__cover-wrap">
      <img src="${asset.cover || fallback}" alt="${cv.game}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div class="modal__body">
      <h2 class="modal__game-name">${cv.game}${cv.year ? `<span class="modal__game-year">${cv.year}</span>` : ''}</h2>
      ${playerHtml}
    </div>`;

  document.getElementById('info-close').addEventListener('click', closeModal);

  if (isSynced) {
    _attachSyncedPlayer('info-player-fill', 'info-player-time', 'info-player-btn', audioEl, startSecs);
  } else {
    _initModalAudioPlayer(startSecs);
  }

  openModal();
}

function openResultModal(gi, pickedCv, isCorrect) {
  const g        = currentGroups[gi];
  const ansIdx   = g.covers.indexOf(g.answer);
  const ansAsset = g.assets[ansIdx];
  const fallback = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(g.answer.game)}`;

  const btnClass = isCorrect ? 'btn--result-ok' : 'btn--result-fail';
  const btnText  = isCorrect ? t('result_correct') : t('result_wrong');
  const msg      = tRandom(isCorrect ? 'msg_success' : 'msg_fail');

  const audioEl   = getDirectAudioEl();
  const startSecs = ansAsset.startSeconds || 0;
  const isPlaying = audioEl && !audioEl.paused;

  const titleHtml = ansAsset.title
    ? `<p class="modal__track-title">${ansAsset.title}</p>` : '';

  const syncedPlayer = isPlaying ? `
    ${titleHtml}
    <div class="modal-player">
      <button class="modal-player__btn" id="result-player-btn" aria-label="Pausar">${_PAUSE_SM}</button>
      <div class="modal-player__track">
        <div class="modal-player__bar"><div class="modal-player__fill" id="result-player-fill"></div></div>
        <span class="modal-player__time" id="result-player-time">${_fmtTime(0)} / ${_fmtTime(MODAL_PREVIEW_SECS)}</span>
      </div>
    </div>` : _buildMediaWidget(ansAsset);

  document.getElementById('modal-inner').innerHTML = `
    <button class="modal__close-x" id="result-close">&times;</button>
    <div class="modal__cover-wrap">
      <img src="${ansAsset.cover || fallback}" alt="${g.answer.game}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div class="modal__body">
      <h2 class="modal__game-name">${g.answer.game}${g.answer.year ? `<span class="modal__game-year">${g.answer.year}</span>` : ''}</h2>
      <button class="btn ${btnClass}" disabled>${btnText}</button>
      <p class="modal__result-text">${msg}</p>
      <div class="modal__result-info">
        ${syncedPlayer}
      </div>
    </div>`;

  if (isPlaying) {
    _attachSyncedPlayer('result-player-fill', 'result-player-time', 'result-player-btn', audioEl, startSecs);
  } else {
    _initModalAudioPlayer(startSecs);
  }

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
  const pct   = stats.played > 0 ? Math.round(((stats.totalHits || 0) / (stats.played * 3)) * 100) : 0;

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      ${score === 0
        ? `<img src="fx/wasted.png" alt="WASTED" class="modal__wasted-img">`
        : `<div class="modal__end-score">
             <span class="modal__end-num modal__end-num--${score}">${score}</span>
             <span class="modal__end-denom">/ 3</span>
           </div>`
      }
      <p class="modal__end-label">${
        score === 3 ? t('end_3') :
        score === 2 ? t('end_2') :
        score === 1 ? t('end_1') :
                      t('end_0')
      }</p>
      ${isArchiveMode ? `<p class="modal__archive-note">${t('archive_note')}</p>` : ''}
      ${!isArchiveMode ? `
        <div class="modal__stats">
          <div class="stat-box"><span class="stat-box__val">${stats.played}</span><span class="stat-box__lbl">${t('stat_played')}</span></div>
          <div class="stat-box"><span class="stat-box__val">${pct}%</span><span class="stat-box__lbl">${t('stat_accuracy')}</span></div>
          <div class="stat-box"><span class="stat-box__val">${stats.streak}</span><span class="stat-box__lbl">${t('stat_streak')}</span></div>
          <div class="stat-box"><span class="stat-box__val">${stats.maxStreak}</span><span class="stat-box__lbl">${t('stat_max_streak')}</span></div>
        </div>
        <div class="modal__countdown">${t('next_quest_in')} &nbsp; <strong id="end-countdown">--:--:--</strong></div>
      ` : ''}
      <button class="btn btn--new" id="close-end-btn">${t('btn_close')}</button>
    </div>`;

  document.getElementById('close-end-btn').addEventListener('click', () => {
      closeModal();
  });
  if (!isArchiveMode) tickEndCountdown();
  openModal();

  if (score === 0) {
    const sfx     = new Audio('fx/wasted.mp3');
    const sfxVol  = (gameVolume / 100) * 0.35;
    sfx.volume    = sfxVol;
    sfx.play().catch(() => {});
    const FADE_STEPS = 20, FADE_MS = 800;
    setTimeout(() => {
      let step = 0;
      const iv = setInterval(() => {
        step++;
        try { sfx.volume = Math.max(0, sfxVol * (1 - step / FADE_STEPS)); } catch (_) {}
        if (step >= FADE_STEPS) { clearInterval(iv); sfx.pause(); }
      }, FADE_MS / FADE_STEPS);
    }, 3000 - FADE_MS);
  }
}

function tickEndCountdown() {
  const el = document.getElementById('end-countdown');
  if (!el) return;
  el.textContent = formatCountdown(timeUntilNextGame());
  setTimeout(tickEndCountdown, 1000);
}

function openStatsModal() {
  const stats = loadStats();
  const pct   = stats.played > 0 ? Math.round(((stats.totalHits || 0) / (stats.played * 3)) * 100) : 0;

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      <h2 class="modal__end-label" style="font-size:1.3rem;margin-bottom:1.2rem">${t('stats_title')}</h2>
      <div class="modal__stats">
        <div class="stat-box"><span class="stat-box__val">${stats.played}</span><span class="stat-box__lbl">${t('stat_played')}</span></div>
        <div class="stat-box"><span class="stat-box__val">${pct}%</span><span class="stat-box__lbl">${t('stat_accuracy')}</span></div>
        <div class="stat-box"><span class="stat-box__val">${stats.streak}</span><span class="stat-box__lbl">${t('stat_streak_current')}</span></div>
        <div class="stat-box"><span class="stat-box__val">${stats.maxStreak}</span><span class="stat-box__lbl">${t('stat_max_streak')}</span></div>
      </div>
      <div class="modal__countdown">${t('next_quest_in')} &nbsp; <strong id="stats-countdown">--:--:--</strong></div>
      <button class="btn btn--new" id="close-stats-btn">${t('btn_close')}</button>
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
  const today  = getGameDay();

  // Generar todos los días desde el inicio hasta ayer
  const days = [];
  const cur  = new Date(ARCHIVE_START + 'T12:00:00Z');
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
      ? `<span class="archive__badge archive__badge--${result.score === 3 ? 'ok' : result.score > 0 ? 'partial' : 'fail'}">
           ${result.score === 3 ? '✓' : result.score + '/3'}
         </span>`
      : inProgress
        ? `<span class="archive__badge archive__badge--ongoing">${t('archive_in_progress')}</span>`
        : `<span class="archive__badge archive__badge--new">${t('archive_play')}</span>`;
    const isActive = ds === currentDateStr && isArchiveMode;
    return monthHeader + `<li class="archive__item ${isActive ? 'archive__item--active' : ''}" data-date="${ds}">
      <span class="archive__date">${d}-${m}-${y}</span>${badge}
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
      closeModal();
      stopAudio();
      const [ay,am,ad] = ds.split('-');
      const banner = document.getElementById('archive-banner');
      if (banner) { banner.textContent = `Quest ${ad}-${am}-${ay}`; banner.style.display = 'block'; }
      document.body.classList.add('is-archive');
      initGame(ds, true);
    });
  });
  openModal();
}

// ─── Game Logic ───────────────────────────────────────────────────────────────

function _prewarmAnswerAudio(gi) {
  const g = currentGroups[gi];
  if (!g) return;
  const ansIdx = g.covers.indexOf(g.answer);
  const asset  = g.assets?.[ansIdx];
  if (asset?.audioUrl) {
    prewarmDirectAudio(asset.audioUrl);
  }
}

function resolveGuess(gi, pickedCv, pickedPos) {
  const correct = pickedCv.id === currentGroups[gi].answer.id;
  colStates[gi].solved    = true;
  colStates[gi].pickedId  = pickedCv.id;
  colStates[gi].pickedPos = pickedPos ?? null;
  colStates[gi].correct   = correct;
  if (gi + 1 < 3) { colStates[gi + 1].locked = false; _prewarmAnswerAudio(gi + 1); }

  saveDayProgress(currentDateStr, colStates);
  updateScoreDisplay();
  showScorePopup(correct);
  setTimeout(() => openResultModal(gi, pickedCv, correct), 60);
}

// Store last click position for popup
let _lastClickX = window.innerWidth / 2;
let _lastClickY = window.innerHeight / 2;
document.addEventListener('click', e => { _lastClickX = e.clientX; _lastClickY = e.clientY; }, true);

function showScorePopup(correct) {
  const popup = document.createElement('div');
  popup.className = `score-popup score-popup--${correct ? 'hit' : 'miss'}`;
  popup.textContent = correct ? 'HIT' : 'MISS';
  popup.style.left      = `${_lastClickX}px`;
  popup.style.top       = `${_lastClickY - 10}px`;
  popup.style.transform = 'translateX(-50%)';
  document.body.appendChild(popup);
  popup.addEventListener('animationend', () => popup.remove());
}

function checkFinished() {
  if (!colStates.every(s => s.solved)) return;
  if (gameFinished) return;
  gameFinished = true;
  const score = colStates.filter(s => s.correct).length;

  let isLine = false;
  if (score === 3) {
    const p = colStates[0].pickedPos;
    if (p !== null && colStates[1].pickedPos === p && colStates[2].pickedPos === p) {
      isLine = true;
      setTimeout(() => triggerLineEffect(p), 80);
    }
  }

  setTimeout(() => {
    recordDailyResult(currentDateStr, score, 3);
    openEndModal(score);
  }, isLine ? 1800 : 400);
}

function triggerLineEffect(pos) {
  const sfx = new Audio('fx/cash.mp3');
  sfx.currentTime = 0.5;
  sfx.play().catch(() => {});

  const topItem = document.getElementById('col-0')?.querySelectorAll('.cover-item')?.[pos];
  const botItem = document.getElementById('col-2')?.querySelectorAll('.cover-item')?.[pos];
  if (topItem && botItem) {
    const topRect = topItem.getBoundingClientRect();
    const botRect = botItem.getBoundingClientRect();
    const strip = document.createElement('div');
    strip.className = 'line-strip';
    strip.style.cssText = `left:${topRect.left}px;top:${topRect.top}px;width:${topRect.width}px;height:${botRect.bottom - topRect.top}px;`;
    document.body.appendChild(strip);
    strip.addEventListener('animationend', () => strip.remove());
  }

  if (topItem) {
    const rect = topItem.getBoundingClientRect();
    const gif = document.createElement('div');
    gif.className = 'line-gif';
    gif.innerHTML = `<img src="fx/coin.gif" alt="">`;
    gif.style.left = `${rect.left + rect.width / 2}px`;
    gif.style.top  = `${rect.top}px`;
    document.body.appendChild(gif);
    gif.addEventListener('animationend', () => gif.remove());
  }
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

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();

  const langDropdown = document.getElementById('lang-dropdown');
  document.getElementById('lang-dropdown-btn').addEventListener('click', e => {
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
  document.addEventListener('click', () => langDropdown.classList.remove('lang-dropdown--open'));

  const today = getGameDay();

  // Clic fuera del modal cierra siempre (incluyendo el modal final)
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id !== 'modal') return;
    closeModal();
    renderAll();
    checkFinished();
  });

  document.getElementById('btn-stats').addEventListener('click', openStatsModal);
  document.getElementById('btn-archive').addEventListener('click', openArchive);
  document.getElementById('btn-help').addEventListener('click', openTutorialModal);
  document.getElementById('btn-today').addEventListener('click', () => {
    stopAudio();
    const banner = document.getElementById('archive-banner');
    if (banner) banner.style.display = 'none';
    document.body.classList.remove('is-archive');
    initGame(today, false);
  });

  if (!localStorage.getItem('ostquest_tutorial')) openTutorialModal();

  initGame(today, false);

  // Volume control
  const volSlider  = document.getElementById('vol-slider');
  const volBtn     = document.getElementById('btn-vol');
  const volControl = document.getElementById('vol-control');
  let prevVol = 80;

  const savedVol = parseInt(localStorage.getItem('ostquest_vol'));
  if (!isNaN(savedVol)) { volSlider.value = savedVol; prevVol = savedVol || 80; }

  function updateVolIcon(v) {
    const waves = document.getElementById('vol-waves');
    const muted = v === 0;
    if (volBtn) volBtn.classList.toggle('muted', muted);
    if (waves)  waves.style.display = muted ? 'none' : '';
  }
  updateVolIcon(parseInt(volSlider.value));

  volSlider.addEventListener('input', () => {
    const v = parseInt(volSlider.value);
    if (v > 0) prevVol = v;
    setGameVolume(v);
    updateVolIcon(v);
  });

  // Click button: toggle mute/unmute
  if (volBtn) {
    volBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = parseInt(volSlider.value);
      if (current === 0) {
        // Unmute
        volSlider.value = prevVol;
        setGameVolume(prevVol);
        updateVolIcon(prevVol);
      } else {
        // Mute
        prevVol = current;
        volSlider.value = 0;
        setGameVolume(0);
        updateVolIcon(0);
      }
    });
  }
});
