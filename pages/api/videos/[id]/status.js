import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

const PROGRESS = { pending: 0, scripting: 15, voicing: 35, fetching_broll: 55, rendering: 70, uploading: 90, scheduled: 100, published: 100, failed: -1 };
const MESSAGES = { pending: "Queued...", scripting: "Gemini writing script...", voicing: "ElevenLabs generating voice...", fetching_broll: "Fetching footage from Pexels...", rendering: "Assembling video...", uploading: "Saving to storage...", scheduled: "Ready to publish!", published: "Published to YouTube!", failed: "Failed — please retry." };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).end();

  const { data: video } = await supabase.from("videos")
    .select("id,status,error_message,seo_title,viral_score,youtube_url,niche,duration,voiceover_url")
    .eq("id", req.query.id).eq("user_id", user.id).single();

  if (!video) return res.status(404).json({ error: "Video not found" });
  return res.json({ ...video, progress: PROGRESS[video.status] ?? 0, message: MESSAGES[video.status] || "" });
}
