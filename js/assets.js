// OST Quest - Asset loader
// Portada: usa el campo `cover` de la BD si existe, si no usa thumbnail de YouTube
// Formato de portada: 3:4 portrait (estándar carátulas de videojuegos)

async function getGameAssets(gameEntry, trackIndex) {
  const track = gameEntry.tracks[trackIndex !== undefined ? trackIndex : 0];
  const cover = gameEntry.cover
    || `https://img.youtube.com/vi/${track.youtubeId}/hqdefault.jpg`;
  return {
    cover,
    youtubeId:    track.youtubeId,
    startSeconds: track.startSeconds || 0,
  };
}
