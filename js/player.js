// OST Quest - Audio Player

let gameVolume = 80; // 0-100

function setGameVolume(vol) {
  gameVolume = Math.max(0, Math.min(100, vol));
  if (_audioEl) _audioEl.volume = gameVolume / 100;
  // El reproductor del modal es un <audio> aparte
  const modalAudio = document.querySelector('.modal-player__audio');
  if (modalAudio) modalAudio.volume = gameVolume / 100;
  localStorage.setItem('ostquest_vol', gameVolume);
}

function loadSavedVolume() {
  const saved = parseInt(localStorage.getItem('ostquest_vol'));
  if (!isNaN(saved)) gameVolume = saved;
}

// ─── Preview: 30 s con fade out en los últimos 3 s ───────────────────────────

const PREVIEW_MS   = 30000;
const FADE_MS      = 3000;
const FADE_STEPS   = 20;
const LOOP_DELAY_MS = 2000;

let _previewStopTimer    = null;
let _previewFadeInterval = null;
let _previewActive       = false;
let _loopTimer           = null;
let _audioStartSeconds   = 0;

function _applyFadeRatio(ratio) {
  if (_audioEl) _audioEl.volume = (gameVolume * ratio) / 100;
}

function _startPreview(onEnd) {
  _cleanupPreview();
  _previewActive    = true;
  _previewStopTimer = setTimeout(() => {
    _previewActive = false;
    clearTimeout(_loopTimer);
    _loopTimer = null;
    let step = 0;
    _previewFadeInterval = setInterval(() => {
      step++;
      _applyFadeRatio(1 - step / FADE_STEPS);
      if (step >= FADE_STEPS) {
        clearInterval(_previewFadeInterval);
        _previewFadeInterval = null;
        if (_audioEl) _audioEl.pause();
        _applyFadeRatio(1);
        if (onEnd) onEnd();
      }
    }, FADE_MS / FADE_STEPS);
  }, PREVIEW_MS - FADE_MS);
}

function _cleanupPreview() {
  clearTimeout(_previewStopTimer);
  clearInterval(_previewFadeInterval);
  clearTimeout(_loopTimer);
  _previewStopTimer    = null;
  _previewFadeInterval = null;
  _previewActive       = false;
  _loopTimer           = null;
  _applyFadeRatio(1);
}

// ─── HTML5 audio ─────────────────────────────────────────────────────────────

let _audioEl             = null;
let _audioOnEnd          = null;
const _audioPreloadCache = new Map();

let _audioListenersEl = null;
let _audioWaitingCb   = null;
let _audioPlayingCb   = null;
let _audioErrorCb     = null;

function _cleanupAudioListeners() {
  if (_audioListenersEl) {
    if (_audioWaitingCb) _audioListenersEl.removeEventListener('waiting', _audioWaitingCb);
    if (_audioPlayingCb) _audioListenersEl.removeEventListener('playing', _audioPlayingCb);
    if (_audioErrorCb)   _audioListenersEl.removeEventListener('error',   _audioErrorCb);
  }
  _audioListenersEl = _audioWaitingCb = _audioPlayingCb = _audioErrorCb = null;
}

function _makeAudioEl() {
  const el = new Audio();
  el.addEventListener('ended', () => {
    if (_previewActive) {
      // Pista corta: loop con delay de 2 s
      _loopTimer = setTimeout(() => {
        _loopTimer = null;
        if (_audioEl && _previewActive) {
          _audioEl.currentTime = _audioStartSeconds;
          _audioEl.volume = gameVolume / 100;
          _audioEl.play().catch(() => {});
        }
      }, LOOP_DELAY_MS);
    } else {
      const cb = _audioOnEnd; _audioOnEnd = null;
      _cleanupPreview();
      if (cb) cb();
    }
  });
  return el;
}

function _getAudioEl() {
  if (!_audioEl) _audioEl = _makeAudioEl();
  return _audioEl;
}

function prewarmDirectAudio(url, _attempt = 0) {
  if (_audioPreloadCache.has(url)) return;
  const el = _makeAudioEl();
  el.preload = 'auto';
  el.src = url;
  _audioPreloadCache.set(url, el);

  if (_attempt < 3) {
    el.addEventListener('error', () => {
      if (el.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return;
      _audioPreloadCache.delete(url);
      setTimeout(() => prewarmDirectAudio(url, _attempt + 1), [3000, 8000, 15000][_attempt]);
    }, { once: true });
  }
}

function _playDirectAudio(url, startSeconds, onEnd, onWaiting, onPlaying, onError) {
  _audioStartSeconds = startSeconds || 0;
  _audioOnEnd = null;
  if (_audioEl) _audioEl.pause();

  const cached = _audioPreloadCache.get(url);
  if (cached) {
    if (_audioEl && _audioEl !== cached) _audioEl.src = '';
    _audioEl = cached;
    _audioPreloadCache.delete(url);
  } else {
    _audioEl = _getAudioEl();
    _audioEl.src = url;
  }

  _audioOnEnd     = onEnd;
  _audioEl.volume = gameVolume / 100;

  if (startSeconds) {
    if (_audioEl.readyState >= 1) {
      _audioEl.currentTime = startSeconds;
    } else {
      _audioEl.addEventListener('loadedmetadata', function h() {
        _audioEl.removeEventListener('loadedmetadata', h);
        _audioEl.currentTime = startSeconds;
      });
    }
  }

  _cleanupAudioListeners();
  _audioListenersEl = _audioEl;
  if (onWaiting) {
    _audioWaitingCb = () => onWaiting();
    _audioEl.addEventListener('waiting', _audioWaitingCb);
  }
  if (onPlaying) {
    _audioPlayingCb = () => onPlaying();
    _audioEl.addEventListener('playing', _audioPlayingCb);
  }

  if (onError) {
    _audioErrorCb = () => {
      _cleanupPreview();
      _cleanupAudioListeners();
      _audioOnEnd = null;
      onError();
    };
    _audioEl.addEventListener('error', _audioErrorCb);
  }

  _audioEl.play().catch(() => {});
  // Si el buffer no está listo para reproducir, señalizar carga inmediatamente
  // sin esperar al evento 'waiting' (que puede tardar o no dispararse al inicio)
  if (onWaiting && _audioEl.readyState < 3) onWaiting();
  _startPreview(onEnd);
}

function _stopDirectAudio() {
  _cleanupAudioListeners();
  _audioOnEnd = null;
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; }
}

// ─── API ─────────────────────────────────────────────────────────────────────

function playTrack(asset, onEnd, onWaiting, onPlaying, onError) {
  if (asset.audioUrl) {
    _playDirectAudio(asset.audioUrl, asset.startSeconds || 0, onEnd, onWaiting, onPlaying, onError);
  }
}

function getDirectAudioEl() { return _audioEl; }

function stopTrack() {
  _cleanupPreview();
  _stopDirectAudio();
}

loadSavedVolume();
