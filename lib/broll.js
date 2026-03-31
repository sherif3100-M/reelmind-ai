export async function fetchBRollVideos(keywords = [], count = 5) {
  const urls = [];

  for (const keyword of keywords.slice(0, count)) {
    const url = await tryPexels(keyword) || await tryPixabay(keyword);
    if (url) urls.push({ keyword, url });
  }

  // Ensure we always have at least 3 clips
  while (urls.length < 3 && urls.length > 0) {
    urls.push(urls[0]);
  }

  return urls;
}

async function tryPexels(query) {
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=medium`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.videos?.length) return null;

    // Pick a random video from top 3 results for variety
    const video = data.videos[Math.floor(Math.random() * Math.min(3, data.videos.length))];
    const file = video.video_files?.find(f => f.quality === 'hd' && f.width >= 720)
      || video.video_files?.find(f => f.width >= 480)
      || video.video_files?.[0];

    return file?.link || null;
  } catch { return null; }
}

async function tryPixabay(query) {
  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&video_type=film&per_page=5&orientation=vertical`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.hits?.[0];
    return hit?.videos?.medium?.url || hit?.videos?.small?.url || null;
  } catch { return null; }
}
