import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { generateFullVideo } from "../../../lib/gemini-pipeline";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: "Please sign in first" });

  const { data: profile } = await supabase.from("profiles").select("video_credits").eq("id", user.id).single();
  if (!profile || profile.video_credits <= 0) return res.status(402).json({ error: "No credits remaining" });

  const { niche = "finance", duration = 30, style = "cinematic", voiceId = "deep_male", captionStyle = "bold_center", customPrompt = null, channelId = null } = req.body;

  const { data: video, error } = await supabase.from("videos").insert({
    user_id: user.id, channel_id: channelId || null, niche,
    duration: Number(duration), style, voice_id: voiceId,
    caption_style: captionStyle, custom_prompt: customPrompt, status: "pending",
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  generateFullVideo({ videoId: video.id, userId: user.id, config: { niche, duration: Number(duration), style, voiceId, captionStyle, customPrompt } })
    .catch(e => console.error("Generation failed:", e.message));

  return res.status(202).json({ videoId: video.id, pollUrl: `/api/videos/${video.id}/status`, estimatedTime: "90 seconds" });
}
