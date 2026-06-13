// OST Quest - YouTube IFrame API Player

let ytPlayer     = null;
let ytApiReady   = false;
let ytPending    = null;
let ytOnEnd      = null;
let ytEndTimer   = null;
let ytVolume     = 80; // 0-100, persiste entre reproducciones

window.onYouTubeIframeAPIReady = function () {
  ytApiReady = true;
  ytPlayer = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: { autoplay:0, controls:0, disablekb:1, fs:0, rel:0, playsinline:1 },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange },
  });
};

function onPlayerReady() {
  ytPlayer.setVolume(ytVolume);
  if (ytPending) {
    const p = ytPending; ytPending = null;
    _doPlay(p.videoId, p.startSeconds, p.onEnd);
  }
}

function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.ENDED) { _cleanup(); if (ytOnEnd) ytOnEnd(); }
}

function _doPlay(videoId, startSeconds, onEnd) {
  ytOnEnd = onEnd;
  ytPlayer.loadVideoById({ videoId, startSeconds: startSeconds || 0 });
  ytPlayer.setVolume(ytVolume);
  ytPlayer.playVideo();
  clearTimeout(ytEndTimer);
  ytEndTimer = setTimeout(() => { _cleanup(); if (ytOnEnd) ytOnEnd(); }, 30000);
}

function _cleanup() {
  clearTimeout(ytEndTimer); ytEndTimer = null; ytOnEnd = null;
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
  _cleanup(); ytPending = null;
  if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
    try { ytPlayer.stopVideo(); } catch (_) {}
  }
}

function setYouTubeVolume(vol) {
  ytVolume = Math.max(0, Math.min(100, vol));
  if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
    ytPlayer.setVolume(ytVolume);
  }
  if (_audioEl) _audioEl.volume = ytVolume / 100;
  if (_scWidget) { try { _scWidget.setVolume(ytVolume); } catch (_) {} }
  localStorage.setItem('ostquest_vol', ytVolume);
}

function loadSavedVolume() {
  const saved = parseInt(localStorage.getItem('ostquest_vol'));
  if (!isNaN(saved)) ytVolume = saved;
}

function youtubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// ─── HTML5 audio (para URLs directas tipo archive.org / Khinsider) ───────────

let _audioEl            = null;
let _audioOnEnd         = null;
let _audioEndTimer      = null;
const _audioPreloadCache = new Map(); // url → Audio (precacheado)

function _makeAudioEl() {
  const el = new Audio();
  el.addEventListener('ended', () => {
    _cleanupDirectAudio();
    if (_audioOnEnd) _audioOnEnd();
  });
  return el;
}

function _getAudioEl() {
  if (!_audioEl) _audioEl = _makeAudioEl();
  return _audioEl;
}

function _cleanupDirectAudio() {
  clearTimeout(_audioEndTimer);
  _audioEndTimer = null;
  _audioOnEnd    = null;
}

function prewarmDirectAudio(url) {
  if (_audioPreloadCache.has(url)) return;
  const el = _makeAudioEl();
  el.preload = 'auto';
  el.src = url;
  _audioPreloadCache.set(url, el);
}

function _playDirectAudio(url, startSeconds, onEnd, onWaiting, onPlaying) {
  _cleanupDirectAudio();
  if (_audioEl) _audioEl.pause();

  // Usar elemento precacheado si existe, si no crear uno nuevo
  const cached = _audioPreloadCache.get(url);
  if (cached) {
    if (_audioEl && _audioEl !== cached) _audioEl.src = '';
    _audioEl = cached;
    _audioPreloadCache.delete(url);
  } else {
    _audioEl = _getAudioEl();
    _audioEl.src = url;
  }

  _audioOnEnd      = onEnd;
  _audioEl.volume  = ytVolume / 100;

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

  if (onWaiting) {
    _audioEl.addEventListener('waiting', function h() {
      _audioEl.removeEventListener('waiting', h);
      onWaiting();
    });
  }
  if (onPlaying) {
    _audioEl.addEventListener('playing', function h() {
      _audioEl.removeEventListener('playing', h);
      onPlaying();
    });
  }

  _audioEl.play().catch(() => {});
  clearTimeout(_audioEndTimer);
  _audioEndTimer = setTimeout(() => { _cleanupDirectAudio(); if (onEnd) onEnd(); }, 32000);
}

function _stopDirectAudio() {
  _cleanupDirectAudio();
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; }
}

// ─── SoundCloud Widget ────────────────────────────────────────────────────────

let _scWidget      = null;
let _scIframe      = null;
let _scOnEnd       = null;
let _scEndTimer    = null;
let _scApiLoaded   = false;
let _scApiQueue    = [];
let _scPendingSeek = 0; // ms; applied on first PLAY event after load

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

function _cleanupSoundCloud() {
  clearTimeout(_scEndTimer);
  _scEndTimer = null;
  _scOnEnd    = null;
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
        _cleanupSoundCloud();
        if (_scOnEnd) _scOnEnd();
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
      _scWidget.setVolume(ytVolume);
      // No llamamos play() aquí — auto_play:true lo inicia el propio iframe
      // evitando el bloqueo de autoplay de Chrome en callbacks asíncronos
      clearTimeout(_scEndTimer);
      _scEndTimer = setTimeout(() => { _cleanupSoundCloud(); if (_scOnEnd) _scOnEnd(); }, 32000);
    });
  });
}

function stopSoundCloud() {
  _scPendingSeek = 0;
  _cleanupSoundCloud();
  if (_scWidget) {
    try { _scWidget.pause(); } catch (_) {}
  }
}

// Precarga la API y el iframe de SC antes de que el usuario pulse play
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
      _cleanupSoundCloud();
      if (_scOnEnd) _scOnEnd();
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

function stopTrack() {
  stopYouTube();
  _stopDirectAudio();
  stopSoundCloud();
}

loadSavedVolume();
