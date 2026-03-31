import { getUserFromRequest, getServiceSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('videos')
    .select('id, niche, duration, style, voice_id, status, seo_title, viral_score, youtube_url, voiceover_url, created_at, error_message')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ videos: data || [] });
}
