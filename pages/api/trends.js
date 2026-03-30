import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { detectTrends } from "../../lib/gemini-pipeline";

export default async function handler(req, res) {
const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).end();
  const trends = await detectTrends(req.query.niche || "finance");
  return res.json({ trends, generatedAt: new Date().toISOString() });
}
