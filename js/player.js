// OST Quest - Unified Audio Player (YouTube / HTML5 / SoundCloud)

let ytPlayer   = null;
let ytApiReady = false;
let ytPending  = null;
let ytOnEnd    = null;
let gameVolume   = 80; // 0-100

window.onYouTubeIframeAPIReady = function () {
  ytApiReady = true;
  ytPlayer = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: { autoplay:0, controls:0, disablekb:1, fs:0, rel:0, playsinline:1 },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange },
  });
};

function onPlayerReady() {
  ytPlayer.setVolume(gameVolume);
  if (ytPending) {
    const p = ytPending; ytPending = null;
    _doPlay(p.videoId, p.startSeconds, p.onEnd);
  }
}

function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.ENDED) {
    const cb = ytOnEnd; ytOnEnd = null;
    _cleanupPreview();
    if (cb) cb();
  }
}

function _doPlay(videoId, startSeconds, onEnd) {
  ytOnEnd = onEnd;
  ytPlayer.loadVideoById({ videoId, startSeconds: startSeconds || 0 });
  ytPlayer.setVolume(gameVolume);
  ytPlayer.playVideo();
  _startPreview(onEnd);
}

function playYouTube(videoId, startSeconds, onEnd) {
  if (!document.getElementById('yt-api-script')) {
    const tag = document.createElement('script');
    tag.id  = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
  if (ytApiReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
    _doPlay(videoId, startSeconds, onEnd);
  } else {
    ytPending = { videoId, startSeconds, onEnd };
  }
}

function stopYouTube() {
  ytOnEnd = null; ytPending = null;
  if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
    try { ytPlayer.stopVideo(); } catch (_) {}
  }
}

function setGameVolume(vol) {
  gameVolume = Math.max(0, Math.min(100, vol));
  if (ytPlayer && typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(gameVolume);
  if (_audioEl) _audioEl.volume = gameVolume / 100;
  if (_scWidget) { try { _scWidget.setVolume(gameVolume); } catch (_) {} }
  localStorage.setItem('ostquest_vol', gameVolume);
}

function loadSavedVolume() {
  const saved = parseInt(localStorage.getItem('ostquest_vol'));
  if (!isNaN(saved)) gameVolume = saved;
}

function youtubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// ─── Preview: 30 s con fade out en los últimos 3 s ───────────────────────────

const PREVIEW_MS   = 30000;
const FADE_MS      = 3000;
const FADE_STEPS   = 20;

let _previewStopTimer    = null;
let _previewFadeInterval = null;

function _applyFadeRatio(ratio) {
  const vol = gameVolume * ratio;
  if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
    try { ytPlayer.setVolume(vol); } catch (_) {}
  }
  if (_audioEl) _audioEl.volume = vol / 100;
  if (_scWidget) { try { _scWidget.setVolume(vol); } catch (_) {} }
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
        _stopAllPlayers();
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

function _stopAllPlayers() {
  if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
    try { ytPlayer.stopVideo(); } catch (_) {}
  }
  if (_audioEl) _audioEl.pause();
  if (_scWidget) { try { _scWidget.pause(); } catch (_) {} }
}

// ─── HTML5 audio (archive.org / Khinsider / Spotify previews) ────────────────

let _audioEl             = null;
let _audioOnEnd          = null;
const _audioPreloadCache = new Map();

let _audioListenersEl = null;
let _audioWaitingCb   = null;
let _audioPlayingCb   = null;

function _cleanupAudioListeners() {
  if (_audioListenersEl) {
    if (_audioWaitingCb) _audioListenersEl.removeEventListener('waiting',    _audioWaitingCb);
    if (_audioPlayingCb) _audioListenersEl.removeEventListener('timeupdate', _audioPlayingCb);
  }
  _audioListenersEl = _audioWaitingCb = _audioPlayingCb = null;
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

function _playDirectAudio(url, startSeconds, onEnd, onWaiting, onPlaying) {
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
    _audioPlayingCb = () => { if (!_audioEl.paused) onPlaying(); };
    _audioEl.addEventListener('timeupdate', _audioPlayingCb);
  }

  _audioEl.play().catch(() => {});
  _startPreview(onEnd);
}

function _stopDirectAudio() {
  _cleanupAudioListeners();
  _audioOnEnd = null;
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; }
}

// ─── SoundCloud Widget ────────────────────────────────────────────────────────

let _scWidget      = null;
let _scIframe      = null;
let _scOnEnd       = null;
let _scApiLoaded   = false;
let _scApiQueue    = [];
let _scPendingSeek = 0;

function _loadScApi(cb) {
  if (_scApiLoaded) { cb(); return; }
  _scApiQueue.push(cb);
  if (_scApiQueue.length > 1) return;
  const tag = document.createElement('script');
  tag.src = 'https://w.soundcloud.com/player/api.js';
  tag.onload = () => {
    _scApiLoaded = true;
    _scApiQueue.forEach(fn => fn());
    _scApiQueue = [];
  };
  document.head.appendChild(tag);
}

function playSoundCloud(url, startSeconds, onEnd) {
  _scOnEnd       = onEnd;
  _scPendingSeek = startSeconds ? startSeconds * 1000 : 0;
  _loadScApi(() => {
    if (!_scIframe) {
      _scIframe = document.createElement('iframe');
      _scIframe.allow = 'autoplay';
      _scIframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px';
      _scIframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true`;
      document.body.appendChild(_scIframe);
      _scWidget = SC.Widget(_scIframe);
      _scWidget.bind(SC.Widget.Events.FINISH, () => {
        const cb = _scOnEnd; _scOnEnd = null;
        _cleanupPreview();
        if (cb) cb();
      });
      _scWidget.bind(SC.Widget.Events.PLAY, () => {
        if (_scPendingSeek > 0) {
          _scWidget.seekTo(_scPendingSeek);
          _scPendingSeek = 0;
        }
      });
    } else {
      _scWidget.unbind(SC.Widget.Events.READY);
      _scWidget.load(url, { auto_play: true });
    }
    _scWidget.bind(SC.Widget.Events.READY, function onScReady() {
      _scWidget.unbind(SC.Widget.Events.READY);
      _scWidget.setVolume(gameVolume);
      _startPreview(_scOnEnd);
    });
  });
}

function stopSoundCloud() {
  _scPendingSeek = 0;
  _scOnEnd = null;
  if (_scWidget) { try { _scWidget.pause(); } catch (_) {} }
}

function prewarmSoundCloud(url) {
  _loadScApi(() => {
    if (_scIframe) return;
    _scIframe = document.createElement('iframe');
    _scIframe.allow = 'autoplay';
    _scIframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px';
    _scIframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false`;
    document.body.appendChild(_scIframe);
    _scWidget = SC.Widget(_scIframe);
    _scWidget.bind(SC.Widget.Events.FINISH, () => {
      const cb = _scOnEnd; _scOnEnd = null;
      _cleanupPreview();
      if (cb) cb();
    });
    _scWidget.bind(SC.Widget.Events.PLAY, () => {
      if (_scPendingSeek > 0) {
        _scWidget.seekTo(_scPendingSeek);
        _scPendingSeek = 0;
      }
    });
  });
}

// ─── API unificada ────────────────────────────────────────────────────────────

function playTrack(asset, onEnd, onWaiting, onPlaying) {
  if (asset.audioUrl) {
    if (asset.sourceType === 'soundcloud') {
      playSoundCloud(asset.audioUrl, asset.startSeconds || 0, onEnd);
    } else {
      _playDirectAudio(asset.audioUrl, asset.startSeconds || 0, onEnd, onWaiting, onPlaying);
    }
  } else if (asset.youtubeId) {
    playYouTube(asset.youtubeId, asset.startSeconds || 0, onEnd);
  }
}

function getDirectAudioEl() { return _audioEl; }

function stopTrack() {
  _cleanupPreview();
  stopYouTube();
  _stopDirectAudio();
  stopSoundCloud();
}

loadSavedVolume();
