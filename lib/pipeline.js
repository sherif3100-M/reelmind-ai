import { getServiceSupabase } from './supabase';
import { generateVideoScript } from './gemini';
import { generateVoice } from './elevenlabs';
import { fetchBRollVideos } from './broll';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'Faceless';

async function uploadToStorage(supabase, path, buffer, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

async function setStatus(supabase, videoId, status, extra = {}) {
  await supabase.from('videos').update({ status, updated_at: new Date().toISOString(), ...extra }).eq('id', videoId);
  console.log(`[${videoId}] Status → ${status}`);
}

export async function runVideoPipeline(videoId, userId, config) {
  const supabase = getServiceSupabase();

  try {
    // ── STEP 1: Script (Gemini) ──────────────────────────────
    await setStatus(supabase, videoId, 'scripting');
    console.log(`[${videoId}] Calling Gemini...`);

    const script = await generateVideoScript(config);

    await supabase.from('videos').update({
      script_hook: script.hook,
      script_body: script.body,
      script_cta: script.cta,
      script_full: script.full_script,
      keywords: script.search_keywords,
      seo_title: script.seo_title,
      seo_description: script.seo_description,
      seo_tags: script.tags,
      viral_score: script.viral_score,
    }).eq('id', videoId);

    // ── STEP 2: Voiceover (ElevenLabs) ─────────────────────
    await setStatus(supabase, videoId, 'voicing');
    console.log(`[${videoId}] Calling ElevenLabs...`);

    const audioBuffer = await generateVoice({
      text: script.full_script,
      voiceKey: config.voiceId || 'deep_male',
    });

    const voiceoverUrl = await uploadToStorage(
      supabase,
      `voiceovers/${videoId}.mp3`,
      audioBuffer,
      'audio/mpeg'
    );

    await supabase.from('videos').update({ voiceover_url: voiceoverUrl }).eq('id', videoId);

    // ── STEP 3: B-Roll footage (Pexels / Pixabay) ──────────
    await setStatus(supabase, videoId, 'fetching_broll');
    console.log(`[${videoId}] Fetching B-Roll...`);

    const brollClips = await fetchBRollVideos(
      script.search_keywords || [config.niche],
      Math.ceil(config.duration / 8)
    );
    const brollUrls = brollClips.map(c => c.url);

    await supabase.from('videos').update({ broll_urls: brollUrls }).eq('id', videoId);

    // ── STEP 4: Assemble asset manifest ────────────────────
    await setStatus(supabase, videoId, 'rendering');
    console.log(`[${videoId}] Assembling asset manifest...`);

    const manifest = {
      videoId,
      script: script.full_script,
      hook: script.hook,
      cta: script.cta,
      voiceoverUrl,
      brollUrls,
      seoTitle: script.seo_title,
      viralScore: script.viral_score,
      style: config.style,
      duration: config.duration,
      niche: config.niche,
      createdAt: new Date().toISOString(),
    };

    const manifestUrl = await uploadToStorage(
      supabase,
      `renders/${videoId}/manifest.json`,
      Buffer.from(JSON.stringify(manifest, null, 2)),
      'application/json'
    );

    // ── STEP 5: Deduct credit & mark ready ─────────────────
    const { data: profile } = await supabase.from('profiles').select('video_credits, total_videos_generated').eq('id', userId).single();
    const newCredits = Math.max(0, (profile?.video_credits || 0) - 1);
    const newTotal = (profile?.total_videos_generated || 0) + 1;

    await supabase.from('profiles').update({
      video_credits: newCredits,
      total_videos_generated: newTotal,
    }).eq('id', userId);

    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: -1,
      type: 'video_used',
      video_id: videoId,
      description: `Generated: ${script.seo_title}`,
    });

    await setStatus(supabase, videoId, 'scheduled', {
      asset_manifest_url: manifestUrl,
    });

    console.log(`[${videoId}] ✅ Pipeline complete!`);
    return { success: true, manifest };

  } catch (error) {
    console.error(`[${videoId}] ❌ Pipeline failed:`, error.message);
    await supabase.from('videos').update({
      status: 'failed',
      error_message: error.message,
      updated_at: new Date().toISOString(),
    }).eq('id', videoId);
    throw error;
  }
}
