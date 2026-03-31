import { getUserFromRequest, getServiceSupabase } from '../../../../lib/supabase';

const PROGRESS = {
  pending: 5, scripting: 20, voicing: 45, fetching_broll: 65,
  rendering: 82, uploading: 92, scheduled: 100, published: 100, failed: 0,
};

const MESSAGES = {
  pending:        '⏳ Queued — starting soon...',
  scripting:      '🧠 Gemini AI writing your script...',
  voicing:        '🎙 ElevenLabs generating voiceover...',
  fetching_broll: '🎬 Fetching HD footage from Pexels...',
  rendering:      '⚙️ Assembling video assets...',
  uploading:      '📤 Saving to cloud storage...',
  scheduled:      '✅ Video ready! Assets assembled.',
  published:      '✅ Published to YouTube!',
  failed:         '❌ Generation failed.',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.query;
  const supabase = getServiceSupabase();

  const { data: video, error } = await supabase
    .from('videos')
    .select('id, status, error_message, seo_title, seo_description, viral_score, viral_score, voiceover_url, broll_urls, youtube_url, youtube_video_id, niche, duration, style, voice_id, created_at, asset_manifest_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !video) return res.status(404).json({ error: 'Video not found' });

  return res.json({
    ...video,
    progress: PROGRESS[video.status] ?? 0,
    message: MESSAGES[video.status] || '',
    isComplete: ['scheduled', 'published', 'failed'].includes(video.status),
    isReady: ['scheduled', 'published'].includes(video.status),
  });
}
