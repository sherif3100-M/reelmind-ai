import { getUserFromRequest, getServiceSupabase, getProfile } from '../../../lib/supabase';
import { runVideoPipeline } from '../../../lib/pipeline';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated. Please sign in.' });

  // Credit check
  const profile = await getProfile(user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  if (!profile.is_admin && (profile.video_credits || 0) <= 0) {
    return res.status(402).json({
      error: 'No video credits remaining. Please upgrade your plan.',
      upgrade_url: '/#pricing',
    });
  }

  const {
    niche = 'finance',
    duration = 30,
    style = 'cinematic',
    voiceId = 'deep_male',
    captionStyle = 'bold_center',
    customPrompt = '',
    channelId = null,
  } = req.body;

  const supabase = getServiceSupabase();

  // Create video record
  const { data: video, error } = await supabase
    .from('videos')
    .insert({
      user_id: user.id,
      channel_id: channelId || null,
      niche,
      duration: Number(duration),
      style,
      voice_id: voiceId,
      caption_style: captionStyle,
      custom_prompt: customPrompt || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to create video: ' + error.message });

  // Run pipeline in background (fire and forget)
  runVideoPipeline(video.id, user.id, {
    niche,
    duration: Number(duration),
    style,
    voiceId,
    captionStyle,
    customPrompt,
  }).catch(e => console.error('Pipeline error:', e.message));

  return res.status(202).json({
    success: true,
    videoId: video.id,
    message: 'Generation started',
    estimatedSeconds: duration <= 30 ? 45 : 90,
  });
}
