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
    const labelFs  = nameLen > 36 ? '9px' : nameLen > 24 ? '11px' : '13px';
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
        Es esta
      </button>
    </div>`;

  document.getElementById('confirm-btn').addEventListener('click', () => {
    closeModal();
    resolveGuess(gi, cv, ci);
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
  const btnText  = isCorrect ? '¡Acertaste!' : '¡Fallaste!';
  const msg      = isCorrect
    ? SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]
    : FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];

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
          <a class="yt-link" href="https://www.youtube.com/watch?v=${ansAsset.youtubeId}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>Ver en YouTube</a>` : ''}
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
      <div class="modal__end-score">
        <span class="modal__end-num modal__end-num--${score}">${score}</span>
        <span class="modal__end-denom">/ 3</span>
      </div>
      <p class="modal__end-label">${
        score === 3 ? '¡Eres la CABRA!'         :
        score === 2 ? 'No está mal'              :
        score === 1 ? 'Se hizo lo que se pudo'   :
                      'Tienes un poco de skill issue'
      }</p>
      ${isArchiveMode ? `<p class="modal__archive-note">Quests pasadas no suben las estadísticas</p>` : ''}
      ${!isArchiveMode ? `
        <div class="modal__stats">
          <div class="stat-box"><span class="stat-box__val">${stats.played}</span><span class="stat-box__lbl">Quests completadas</span></div>
          <div class="stat-box"><span class="stat-box__val">${pct}%</span><span class="stat-box__lbl">Puntería</span></div>
          <div class="stat-box"><span class="stat-box__val">${stats.streak}</span><span class="stat-box__lbl">Racha</span></div>
          <div class="stat-box"><span class="stat-box__val">${stats.maxStreak}</span><span class="stat-box__lbl">Mejor racha</span></div>
        </div>
        <div class="modal__countdown">Siguiente Quest en &nbsp; <strong id="end-countdown">--:--:--</strong></div>
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
  const pct   = stats.played > 0 ? Math.round(((stats.totalHits || 0) / (stats.played * 3)) * 100) : 0;

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal__end">
      <h2 class="modal__end-label" style="font-size:1.3rem;margin-bottom:1.2rem">Estadísticas</h2>
      <div class="modal__stats">
        <div class="stat-box"><span class="stat-box__val">${stats.played}</span><span class="stat-box__lbl">Quests completadas</span></div>
        <div class="stat-box"><span class="stat-box__val">${pct}%</span><span class="stat-box__lbl">Puntería</span></div>
        <div class="stat-box"><span class="stat-box__val">${stats.streak}</span><span class="stat-box__lbl">Racha actual</span></div>
        <div class="stat-box"><span class="stat-box__val">${stats.maxStreak}</span><span class="stat-box__lbl">Mejor racha</span></div>
      </div>
      <div class="modal__countdown">Siguiente Quest en &nbsp; <strong id="stats-countdown">--:--:--</strong></div>
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
        ? `<span class="archive__badge archive__badge--ongoing">En curso...</span>`
        : `<span class="archive__badge archive__badge--new">Jugar</span>`;
    const [y,m,d] = ds.split('-');
    const isActive = ds === currentDateStr && isArchiveMode;
    return `<li class="archive__item ${isActive ? 'archive__item--active' : ''}" data-date="${ds}">
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
      const banner = document.getElementById('archive-banner');
      if (banner) { banner.textContent = `Quest ${ad}-${am}-${ay}`; banner.style.display = 'block'; }
      initGame(ds, true);
    });
  });
  openModal();
}

// ─── Game Logic ───────────────────────────────────────────────────────────────

function resolveGuess(gi, pickedCv, pickedPos) {
  const correct = pickedCv.id === currentGroups[gi].answer.id;
  colStates[gi].solved    = true;
  colStates[gi].pickedId  = pickedCv.id;
  colStates[gi].pickedPos = pickedPos ?? null;
  colStates[gi].correct   = correct;
  if (gi + 1 < 3) colStates[gi + 1].locked = false;

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

document.addEventListener('DOMContentLoaded', () => {
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
  document.getElementById('btn-today').addEventListener('click', () => {
    stopAudio();
    const banner = document.getElementById('archive-banner');
    if (banner) banner.style.display = 'none';
    initGame(today, false);
  });

  initGame(today, false);

  // ─── Aviso de anuncios si no hay bloqueador ──────────────────────────────
  if (!localStorage.getItem('ostquest_adwarn_ok')) {
    fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store'
    }).then(() => {
      const banner = document.createElement('div');
      banner.className = 'ad-warning';
      banner.innerHTML =
        '<strong>Aviso:</strong> La música se reproduce vía YouTube. ' +
        'Sin bloqueador de anuncios, es posible que escuches publicidad antes de que empiece la canción.' +
        '<button class="ad-warning__close" aria-label="Cerrar">✕</button>';
      document.body.appendChild(banner);
      banner.querySelector('.ad-warning__close').addEventListener('click', () => {
        localStorage.setItem('ostquest_adwarn_ok', '1');
        banner.remove();
      });
    }).catch(() => {});
  }

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
    setYouTubeVolume(v);
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
        setYouTubeVolume(prevVol);
        updateVolIcon(prevVol);
      } else {
        // Mute
        prevVol = current;
        volSlider.value = 0;
        setYouTubeVolume(0);
        updateVolIcon(0);
      }
    });
  }
});
