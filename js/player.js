// OST Quest - Audio Player

let gameVolume = 80; // 0-100

function setGameVolume(vol) {
  gameVolume = Math.max(0, Math.min(100, vol));
  if (_audioEl) _audioEl.volume = gameVolume / 100;
  localStorage.setItem('ostquest_vol', gameVolume);
}

function loadSavedVolume() {
  const saved = parseInt(localStorage.getItem('ostquest_vol'));
  if (!isNaN(saved)) gameVolume = saved;
}

// ─── Preview: 30 s con fade out en los últimos 3 s ───────────────────────────

const PREVIEW_MS = 30000;
const FADE_MS    = 3000;
const FADE_STEPS = 20;

let _previewStopTimer    = null;
let _previewFadeInterval = null;

function _applyFadeRatio(ratio) {
  if (_audioEl) _audioEl.volume = (gameVolume * ratio) / 100;
}

function _startPreview(onEnd) {
  _cleanupPreview();
  _previewStopTimer = setTimeout(() => {
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
  _previewStopTimer    = null;
  _previewFadeInterval = null;
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
    const cb = _audioOnEnd; _audioOnEnd = null;
    _cleanupPreview();
    if (cb) cb();
  });
  return el;
}

function _getAudioEl() {
  if (!_audioEl) _audioEl = _makeAudioEl();
  return _audioEl;
}

function prewarmDirectAudio(url) {
  if (_audioPreloadCache.has(url)) return;
  const el = _makeAudioEl();
  el.preload = 'auto';
  el.src = url;
  _audioPreloadCache.set(url, el);
}

function _playDirectAudio(url, startSeconds, onEnd, onWaiting, onPlaying, onError) {
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
