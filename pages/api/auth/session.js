import { getUserFromRequest, getProfile } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const profile = await getProfile(user.id);
  return res.json({ user: { id: user.id, email: user.email }, profile });
}
