// OST Quest - Asset loader
// Portada: usa el campo `cover` de la BD si existe, si no usa thumbnail de YouTube
// Formato de portada: 3:4 portrait (estándar carátulas de videojuegos)

async function getGameAssets(gameEntry) {
  const cover = gameEntry.cover
    || `https://img.youtube.com/vi/${gameEntry.youtubeId}/hqdefault.jpg`;
  return {
    cover,
    youtubeId:    gameEntry.youtubeId,
    startSeconds: gameEntry.startSeconds || 0,
  };
}
