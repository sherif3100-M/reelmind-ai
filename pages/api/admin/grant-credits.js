import { getUserFromRequest, getServiceSupabase, getProfile } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const profile = await getProfile(user.id);
  if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only' });

  const { targetUserId, credits, plan } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  const supabase = getServiceSupabase();
  const update = {};
  if (credits !== undefined) update.video_credits = credits;
  if (plan) { update.plan = plan; update.subscription_status = 'active'; }

  const { error } = await supabase.from('profiles').update(update).eq('id', targetUserId);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true });
}
