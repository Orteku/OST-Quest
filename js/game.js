// OST Quest - Main Game Controller

let currentGroups  = [];
let colStates      = [];
let currentDateStr = '';
let isArchiveMode  = false;
let playingCol     = -1;
let loadingCol     = -1;
let gameFinished   = false;

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

  // Pre-calentar SoundCloud si hay algún track del día que lo use
  for (const g of currentGroups) {
    const scAsset = g.assets?.find(a => a.sourceType === 'soundcloud');
    if (scAsset?.audioUrl) { prewarmSoundCloud(scAsset.audioUrl); break; }
  }

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

// ─── Progreso guardado ────────────────────────────────────────────────────────




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
      : st.locked ? t('col_locked') : t('col_play_hint');

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
  stopTrack();
  playingCol = -1;
  loadingCol = -1;
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

  if (!asset?.youtubeId && !asset?.audioUrl) {
    showToast(t('audio_unavailable'));
    return;
  }

  playingCol = gi;
  rerenderColumn(gi);

  playTrack(
    asset,
    () => { stopAudio(); rerenderColumn(gi); },
    () => { loadingCol = gi; rerenderColumn(gi); },
    () => { loadingCol = -1; rerenderColumn(gi); }
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

function _initModalAudioPlayer() {
  const wrap = document.querySelector('.modal-player');
  if (!wrap) return;
  const audio = wrap.querySelector('.modal-player__audio');
  const btn   = wrap.querySelector('.modal-player__btn');
  const fill  = wrap.querySelector('.modal-player__fill');
  const time  = wrap.querySelector('.modal-player__time');

  audio.volume = gameVolume / 100;

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function updateBtn() { btn.innerHTML = audio.paused ? _PLAY_SM : _PAUSE_SM; }

  function startModalPreview() {
    _stopModalPreview();
    const fadeSecs  = 3;
    const fadeSteps = 20;
    const remaining = (MODAL_PREVIEW_SECS - audio.currentTime) * 1000;

    _modalStopTimer = setTimeout(() => {
      const baseVol = audio.volume;
      let step = 0;
      _modalFadeInterval = setInterval(() => {
        step++;
        audio.volume = baseVol * (1 - step / fadeSteps);
        if (step >= fadeSteps) {
          clearInterval(_modalFadeInterval); _modalFadeInterval = null;
          audio.pause();
          audio.currentTime = 0;
          audio.volume = gameVolume / 100;
          fill.style.width = '0%';
          time.textContent = `${fmt(0)} / ${fmt(MODAL_PREVIEW_SECS)}`;
          updateBtn();
        }
      }, (fadeSecs * 1000) / fadeSteps);
    }, Math.max(0, remaining - fadeSecs * 1000));
  }

  btn.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else { audio.pause(); _stopModalPreview(); }
  });
  audio.addEventListener('play',  () => { updateBtn(); startModalPreview(); });
  audio.addEventListener('pause', updateBtn);
  audio.addEventListener('ended', () => { updateBtn(); _stopModalPreview(); });
  audio.addEventListener('timeupdate', () => {
    const elapsed = Math.min(audio.currentTime, MODAL_PREVIEW_SECS);
    fill.style.width  = `${(elapsed / MODAL_PREVIEW_SECS) * 100}%`;
    time.textContent  = `${fmt(elapsed)} / ${fmt(MODAL_PREVIEW_SECS)}`;
  });

  time.textContent = `${fmt(0)} / ${fmt(MODAL_PREVIEW_SECS)}`;
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
    </div>`;

  document.getElementById('tutorial-close').addEventListener('click', () => {
    localStorage.setItem('ostquest_tutorial', '1');
    closeModal();
  });
  openModal();
}

// ─── Media widget helpers ─────────────────────────────────────────────────────

const _YT_ICON  = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>`;
const _PLAY_SM  = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5,3 19,12 5,21"/></svg>`;
const _PAUSE_SM = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const _SC_ICON  = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M1.175 12.225c-.105 0-.19.08-.19.18l-.233 2.154.233 2.105c0 .1.085.18.19.18.1 0 .18-.08.183-.18l.267-2.105-.267-2.154c-.003-.1-.083-.18-.183-.18zm1.558-.89c-.12 0-.217.1-.217.22l-.2 3.044.2 2.899c0 .12.097.22.217.22.12 0 .217-.1.217-.22l.226-2.899-.226-3.044c0-.12-.097-.22-.217-.22zm1.567-.35c-.14 0-.25.11-.25.25l-.167 3.394.167 2.803c0 .14.11.25.25.25s.25-.11.25-.25l.189-2.803-.189-3.394c0-.14-.11-.25-.25-.25zm1.567.09c-.155 0-.28.125-.28.28l-.133 3.304.133 2.717c0 .155.125.28.28.28.155 0 .28-.125.28-.28l.15-2.717-.15-3.304c0-.155-.125-.28-.28-.28zm1.568.5c-.17 0-.31.14-.31.31l-.1 2.804.1 2.63c0 .17.14.31.31.31.17 0 .31-.14.31-.31l.114-2.63-.114-2.804c0-.17-.14-.31-.31-.31zm1.567-.27c-.185 0-.337.152-.337.337l-.067 3.074.067 2.544c0 .185.152.337.337.337.185 0 .337-.152.337-.337l.075-2.544-.075-3.074c0-.185-.152-.337-.337-.337zm1.568.07c-.2 0-.363.163-.363.363l-.033 3.004.033 2.477c0 .2.163.363.363.363.2 0 .363-.163.363-.363l.038-2.477-.038-3.004c0-.2-.163-.363-.363-.363zm1.567-.59c-.217 0-.393.176-.393.393l0 3.597 0 2.41c0 .217.176.393.393.393.217 0 .393-.176.393-.393l0-2.41 0-3.597c0-.217-.176-.393-.393-.393zm1.568.14c-.233 0-.42.187-.42.42l0 3.457 0 2.343c0 .233.187.42.42.42.233 0 .42-.187.42-.42l0-2.343 0-3.457c0-.233-.187-.42-.42-.42zm1.567 4.52v-3.03c.237-.563.79-.957 1.437-.957 1.033 0 1.87.837 1.87 1.87 0 .037-.003.073-.007.11.36.165.61.53.61.953 0 .577-.467 1.043-1.043 1.043h-2.867z"/></svg>`;
const _SP_ICON  = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 0 1-.277-1.215c3.809-.87 7.077-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 0 1-.43-1.497c3.633-1.102 8.147-.568 11.235 1.334a.78.78 0 0 1 .232 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 1 1-.543-1.794c3.543-1.073 9.431-.866 13.158 1.235a.937.937 0 0 1-.998 1.716z"/></svg>`;

function _buildMediaWidget(asset, compact) {
  const titleHtml = asset.title
    ? `<p class="modal__track-title">${asset.title}</p>`
    : '';

  function _sourceLink(href, icon, prefix, platformName, type) {
    const label = `${icon}${t(prefix)} <span class="source-name source-name--${type}">${platformName}</span>`;
    return compact
      ? `<a class="source-link" href="${href}" target="_blank" rel="noopener">${label}</a>`
      : `<a class="btn btn--source-link" href="${href}" target="_blank" rel="noopener">${label}</a>`;
  }

  if (asset.sourceType === 'youtube' && asset.sourceUrl) {
    return titleHtml + _sourceLink(asset.sourceUrl, _YT_ICON, 'watch_on_yt', 'YouTube', 'yt');
  }

  if (asset.sourceType === 'soundcloud' && asset.sourceUrl) {
    return titleHtml + _sourceLink(asset.sourceUrl, _SC_ICON, 'watch_on', 'SoundCloud', 'sc');
  }

  if (asset.audioUrl) {
    const spLink = (asset.sourceType === 'spotify' && asset.sourceUrl)
      ? _sourceLink(asset.sourceUrl, _SP_ICON, 'watch_on', 'Spotify', 'sp')
      : '';
    if (compact) return `${titleHtml}${spLink}`;
    const player = `
      <div class="modal-player">
        <audio class="modal-player__audio" src="${asset.audioUrl}" preload="metadata"></audio>
        <button class="modal-player__btn" aria-label="Reproducir">${_PLAY_SM}</button>
        <div class="modal-player__track">
          <div class="modal-player__bar"><div class="modal-player__fill"></div></div>
          <span class="modal-player__time">0:00</span>
        </div>
      </div>`;
    return `${titleHtml}${player}${spLink}`;
  }

  return '';
}

// Info modal para portadas de columnas ya resueltas
function openInfoModal(cv, asset) {
  const fallback = `https://placehold.co/400x400/1a1d25/b8e030?text=${encodeURIComponent(cv.game)}`;

  document.getElementById('modal-inner').innerHTML = `
    <button class="modal__close-x" id="info-close">&times;</button>
    <div class="modal__cover-wrap">
      <img src="${asset.cover || fallback}" alt="${cv.game}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div class="modal__body">
      <h2 class="modal__game-name">${cv.game}${cv.year ? `<span class="modal__game-year">${cv.year}</span>` : ''}</h2>
      ${_buildMediaWidget(asset, false)}
    </div>`;

  document.getElementById('info-close').addEventListener('click', closeModal);
  _initModalAudioPlayer();
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

  document.getElementById('modal-inner').innerHTML = `
    <button class="modal__close-x" id="result-close">&times;</button>
    <div class="modal__cover-wrap">
      <img src="${ansAsset.cover || fallback}" alt="${g.answer.game}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div class="modal__body">
      <h2 class="modal__game-name">${g.answer.game}${g.answer.year ? `<span class="modal__game-year">${g.answer.year}</span>` : ''}</h2>
      <button class="btn ${btnClass}" disabled>${btnText}</button>
      <div class="modal__result-info">
        <p class="modal__result-text">${msg}</p>
        ${_buildMediaWidget(ansAsset, true)}
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
  const pct   = stats.played > 0 ? Math.round(((stats.totalHits || 0) / (stats.played * 3)) * 100) : 0;
  // FIX 2: modal final es bloqueante, solo cierra con el botón

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
  const days = [];
  for (let i = 1; i <= 14; i++) {
    days.push(getPastGameDay(i));
  }

  const rows = days.map(ds => {
    // Check both played registry and saved progress for this day
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
    const [y,m,d] = ds.split('-');
    const isActive = ds === currentDateStr && isArchiveMode;
    return `<li class="archive__item ${isActive ? 'archive__item--active' : ''}" data-date="${ds}">
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
  if (asset?.sourceType === 'direct' && asset?.audioUrl) {
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

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('toast--show');
  setTimeout(() => t.classList.remove('toast--show'), 3500);
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
