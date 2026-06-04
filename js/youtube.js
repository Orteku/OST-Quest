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

// FIX 4: control de volumen
function setYouTubeVolume(vol) {
  ytVolume = Math.max(0, Math.min(100, vol));
  if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
    ytPlayer.setVolume(ytVolume);
  }
  localStorage.setItem('ostquest_vol', ytVolume);
}

function loadSavedVolume() {
  const saved = parseInt(localStorage.getItem('ostquest_vol'));
  if (!isNaN(saved)) ytVolume = saved;
}

function youtubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

loadSavedVolume();
