import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const NICHE_MAP = {
  finance: "personal finance, investing, saving money, wealth building",
  motivation: "mindset, productivity, success habits, morning routines",
  tech: "artificial intelligence, tech news, gadgets, software tools",
  facts: "amazing world facts, history mysteries, science discoveries",
  fitness: "workout tips, nutrition advice, weight loss, health",
  books: "book summaries, key lessons, author insights",
  gaming: "gaming tips, game reviews, esports highlights",
  cooking: "quick recipes, cooking hacks, meal prep",
  history: "historical events, ancient civilizations, forgotten stories",
  mystery: "unsolved mysteries, conspiracy theories, paranormal",
};

export async function generateScript({ niche, duration = 30, customPrompt, style = "cinematic" }) {
  const wordCount = duration <= 15 ? 40 : duration <= 30 ? 80 : duration <= 60 ? 150 : 220;
  const nicheContext = NICHE_MAP[niche] || niche;

  const prompt = `You are a viral YouTube Shorts script writer for faceless videos.
Write a ${duration}-second video script for the ${niche} niche (${nicheContext}).
${customPrompt ? `Topic: ${customPrompt}` : ""}
Style: ${style}.
Return ONLY valid JSON, no markdown, no explanation:
{
  "hook": "Opening line max 12 words",
  "body": "Main content ~${Math.round(wordCount * 0.75)} words",
  "cta": "Call to action max 8 words",
  "full_script": "Complete narration ~${wordCount} words",
  "seo_title": "Viral YouTube title max 65 chars",
  "seo_description": "YouTube description 150 chars",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "search_keywords": ["keyword1","keyword2","keyword3"],
  "viral_score": 85,
  "viral_reason": "One sentence why this will perform well"
}`;

  const result = await gemini.generateContent(prompt);
  const text = result.response.text();
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Gemini returned invalid JSON");
  }
}

const VOICE_IDS = {
  deep_male: "pNInz6obpgDQGcFmaJgB",
  calm_female: "EXAVITQu4vr4xnSDxMaL",
  energetic: "VR6AewLTigWG4xSOukaG",
  british: "onwK4e9ZLuTAKqWW03F9",
  asmr: "jBpfuIE2acCO8z3wKNLl",
};

export async function generateVoiceover({ text, voiceKey = "deep_male", videoId }) {
  const voiceId = VOICE_IDS[voiceKey] || process.env.ELEVENLABS_VOICE_ID;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!response.ok) throw new Error(`ElevenLabs error: ${await response.text()}`);

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const fileName = `voiceovers/${videoId}.mp3`;

  const { error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .upload(fileName, audioBuffer, { contentType: "audio/mpeg", upsert: true });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return publicUrl;
}

export async function fetchBRoll({ keywords = [], count = 5 }) {
  const videoUrls = [];
  for (const keyword of keywords.slice(0, count)) {
    try {
      const res = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=3&orientation=portrait`,
        { headers: { Authorization: process.env.PEXELS_API_KEY } }
      );
      const data = await res.json();
      if (data.videos?.length) {
        const video = data.videos[0];
        const file = video.video_files?.find(f => f.quality === "hd") || video.video_files?.[0];
        if (file?.link) { videoUrls.push(file.link); continue; }
      }
      const res2 = await fetch(
        `https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&per_page=3&orientation=vertical`
      );
      const data2 = await res2.json();
      if (data2.hits?.[0]?.videos?.medium?.url) videoUrls.push(data2.hits[0].videos.medium.url);
    } catch (e) { console.warn("B-roll fetch failed:", e.message); }
  }
  return videoUrls;
}

export async function generateFullVideo({ videoId, userId, config }) {
  const update = async (status, extra = {}) =>
    supabase.from("videos").update({ status, ...extra }).eq("id", videoId);

  try {
    await update("scripting");
    const script = await generateScript(config);
    await supabase.from("videos").update({
      script_hook: script.hook, script_body: script.body, script_cta: script.cta,
      script_full: script.full_script, keywords: script.search_keywords,
      seo_title: script.seo_title, seo_description: script.seo_description,
      seo_tags: script.tags, viral_score: script.viral_score,
    }).eq("id", videoId);

    await update("voicing");
    const voiceoverUrl = await generateVoiceover({ text: script.full_script, voiceKey: config.voiceId, videoId });
    await supabase.from("videos").update({ voiceover_url: voiceoverUrl }).eq("id", videoId);

    await update("fetching_broll");
    const brollUrls = await fetchBRoll({ keywords: script.search_keywords || [config.niche], count: 4 });
    await supabase.from("videos").update({ broll_urls: brollUrls }).eq("id", videoId);

    await update("rendering");
    const assetPayload = { videoId, script: script.full_script, voiceoverUrl, brollUrls, style: config.style, duration: config.duration };
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET)
      .upload(`renders/${videoId}/assets.json`, JSON.stringify(assetPayload), { contentType: "application/json", upsert: true });
    if (error) throw new Error(`Asset save failed: ${error.message}`);

    await supabase.rpc("decrement_video_credits", { p_user_id: userId });
    await supabase.from("credit_transactions").insert({
      user_id: userId, amount: -1, type: "video_used", video_id: videoId,
      description: `Generated: ${script.seo_title}`,
    });
    await update("scheduled");
    return { success: true, script };
  } catch (error) {
    await supabase.from("videos").update({ status: "failed", error_message: error.message }).eq("id", videoId);
    throw error;
  }
}

export async function detectTrends(niche) {
  const prompt = `What are the top 5 trending topics RIGHT NOW in ${niche} for viral YouTube Shorts?
Return ONLY a JSON array:
[{"title":"...","hook":"...","viral_potential":90,"reason":"..."}]`;
  const result = await gemini.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, "").trim();
  try { const m = text.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : []; }
  catch { return []; }
}
