// OST Quest - Asset loader
// Portada: usa el campo `cover` de la BD si existe, si no usa thumbnail de YouTube
// Formato de portada: 3:4 portrait (estándar carátulas de videojuegos)

async function getGameAssets(gameEntry, trackIndex) {
  const track = gameEntry.tracks[trackIndex !== undefined ? trackIndex : 0];

  let rawUrl, sourceType, sourceUrl;

  if (track.youtubeId) {
    rawUrl     = null;
    sourceType = 'youtube';
    sourceUrl  = `https://www.youtube.com/watch?v=${track.youtubeId}`;
  } else if (track.soundcloudUrl) {
    rawUrl     = track.soundcloudUrl;
    sourceType = 'soundcloud';
    sourceUrl  = track.soundcloudUrl;
  } else if (track.spotifyUrl) {
    rawUrl     = track.previewUrl || null;
    sourceType = 'spotify';
    sourceUrl  = track.spotifyUrl;
  } else {
    rawUrl     = track.mp3Url || track.url || null;
    sourceType = 'direct';
    sourceUrl  = null;
  }

  const cover = gameEntry.cover
    || (track.youtubeId ? `https://img.youtube.com/vi/${track.youtubeId}/hqdefault.jpg` : null);

  return {
    cover,
    youtubeId:    track.youtubeId  || null,
    audioUrl:     rawUrl,
    sourceType,
    sourceUrl,
    title:        track.title      || null,
    startSeconds: track.startSeconds || 0,
  };
}
