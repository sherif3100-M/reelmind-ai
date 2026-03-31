import { getUserFromRequest, getServiceSupabase, getProfile } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const profile = await getProfile(user.id);
  if (!profile?.is_admin) return res.status(403).json({ error: 'Admin access required' });

  const supabase = getServiceSupabase();

  const [
    { count: totalUsers },
    { count: totalVideos },
    { count: publishedVideos },
    { data: recentUsers },
    { data: recentVideos },
    { data: failedVideos },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('profiles').select('id, email, plan, video_credits, is_admin, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('videos').select('id, niche, duration, status, seo_title, viral_score, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('videos').select('id, niche, error_message, created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(5),
  ]);

  return res.json({
    stats: { totalUsers, totalVideos, publishedVideos, failedVideos: failedVideos?.length || 0 },
    recentUsers: recentUsers || [],
    recentVideos: recentVideos || [],
    failedVideos: failedVideos || [],
  });
}
