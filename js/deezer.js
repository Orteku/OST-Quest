// OST Quest - Asset loader (YouTube-only)
// All games now use YouTube for both audio (via iframe) and cover (hqdefault thumbnail)

async function getGameAssets(gameEntry) {
  return {
    cover:       `https://img.youtube.com/vi/${gameEntry.youtubeId}/hqdefault.jpg`,
    youtubeId:   gameEntry.youtubeId,
    startSeconds: gameEntry.startSeconds || 0,
    preview:     null,   // audio handled by YouTube player
    album:       gameEntry.game,
    deezerUrl:   '',
  };
}
