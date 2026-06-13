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

// ─── HTML5 audio (para URLs directas tipo Khinsider) ─────────────────────────

let _audioEl       = null;
let _audioOnEnd    = null;
let _audioEndTimer = null;

function _getAudioEl() {
  if (!_audioEl) {
    _audioEl = new Audio();
    _audioEl.addEventListener('ended', () => {
      _cleanupDirectAudio();
      if (_audioOnEnd) _audioOnEnd();
    });
  }
  return _audioEl;
}

function _cleanupDirectAudio() {
  clearTimeout(_audioEndTimer);
  _audioEndTimer = null;
  _audioOnEnd    = null;
}

function _playDirectAudio(url, startSeconds, onEnd) {
  const el = _getAudioEl();
  _audioOnEnd  = onEnd;
  el.volume    = ytVolume / 100;
  el.src       = url;
  if (startSeconds) {
    el.addEventListener('loadedmetadata', function h() {
      el.removeEventListener('loadedmetadata', h);
      el.currentTime = startSeconds;
    });
  }
  el.play().catch(() => {});
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
      _scIframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false`;
      document.body.appendChild(_scIframe);
      _scWidget = SC.Widget(_scIframe);
      _scWidget.bind(SC.Widget.Events.FINISH, () => {
        _cleanupSoundCloud();
        if (_scOnEnd) _scOnEnd();
      });
      // Seek happens here (after play has started) instead of before play()
      _scWidget.bind(SC.Widget.Events.PLAY, () => {
        if (_scPendingSeek > 0) {
          _scWidget.seekTo(_scPendingSeek);
          _scPendingSeek = 0;
        }
      });
    } else {
      _scWidget.unbind(SC.Widget.Events.READY);
      _scWidget.load(url, { auto_play: false });
    }
    _scWidget.bind(SC.Widget.Events.READY, function onScReady() {
      _scWidget.unbind(SC.Widget.Events.READY);
      _scWidget.setVolume(ytVolume);
      _scWidget.play();
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

// ─── API unificada ────────────────────────────────────────────────────────────

function playTrack(asset, onEnd) {
  if (asset.audioUrl) {
    if (asset.sourceType === 'soundcloud') {
      playSoundCloud(asset.audioUrl, asset.startSeconds || 0, onEnd);
    } else {
      _playDirectAudio(asset.audioUrl, asset.startSeconds || 0, onEnd);
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
