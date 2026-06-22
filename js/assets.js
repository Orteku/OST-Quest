// OST Quest - Asset loader

async function getGameAssets(gameEntry, trackIndex) {
  const track = gameEntry.tracks[trackIndex !== undefined ? trackIndex : 0];
  return {
    cover:        gameEntry.cover || null,
    audioUrl:     track.mp3Url || track.url || null,
    title:        track.title        || null,
    startSeconds: track.startSeconds || 0,
  };
}
