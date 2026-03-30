import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

export function getAuthUrl(userId) {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state: userId,
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
  });
}

export async function exchangeCodeForTokens(code, userId) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const channelRes = await youtube.channels.list({ part: ["snippet", "statistics"], mine: true });
  const channel = channelRes.data.items?.[0];
  if (!channel) throw new Error("No YouTube channel found");

  const { data, error } = await supabase.from("channels").upsert({
    user_id: userId,
    youtube_channel_id: channel.id,
    channel_name: channel.snippet.title,
    channel_thumbnail: channel.snippet.thumbnails?.default?.url,
    subscriber_count: parseInt(channel.statistics?.subscriberCount || 0),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(tokens.expiry_date).toISOString(),
    is_active: true,
  }, { onConflict: "user_id,youtube_channel_id" }).select().single();

  if (error) throw new Error(`DB save failed: ${error.message}`);
  return data;
}

async function refreshToken(channel) {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: channel.refresh_token });
  const { credentials } = await oauth2.refreshAccessToken();
  await supabase.from("channels").update({
    access_token: credentials.access_token,
    token_expires_at: new Date(credentials.expiry_date).toISOString(),
  }).eq("id", channel.id);
  return credentials.access_token;
}

async function getYouTubeClient(channelId) {
  const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single();
  if (!channel) throw new Error("Channel not found");
  let accessToken = channel.access_token;
  if (new Date(channel.token_expires_at) < new Date()) accessToken = await refreshToken(channel);
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ access_token: accessToken, refresh_token: channel.refresh_token });
  return { youtube: google.youtube({ version: "v3", auth: oauth2 }), channel };
}

export async function uploadToYouTube({ videoId, channelId, publishAt }) {
  const { data: video } = await supabase.from("videos").select("*").eq("id", videoId).single();
  if (!video?.voiceover_url) throw new Error("Video assets not ready");

  const { youtube } = await getYouTubeClient(channelId);

  const uploadRes = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: video.seo_title || "Viral Short",
        description: `${video.seo_description || ""}\n\n#Shorts #Viral #${video.niche}`,
        tags: [...(video.seo_tags || []), "Shorts", "Viral"],
        categoryId: "22",
      },
      status: {
        privacyStatus: publishAt ? "private" : "public",
        publishAt: publishAt ? new Date(publishAt).toISOString() : undefined,
        selfDeclaredMadeForKids: false,
      },
    },
    media: { mimeType: "video/mp4", body: Buffer.from("placeholder") },
  });

  const ytId = uploadRes.data.id;
  await supabase.from("videos").update({
    youtube_video_id: ytId,
    youtube_url: `https://www.youtube.com/shorts/${ytId}`,
    status: publishAt ? "scheduled" : "published",
    published_at: publishAt ? null : new Date().toISOString(),
  }).eq("id", videoId);

  return { ytId, ytUrl: `https://www.youtube.com/shorts/${ytId}` };
}

export async function runPublishScheduler() {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 20 * 60 * 1000);
  const { data: queue } = await supabase.from("publish_queue")
    .select("*, channels(*), videos(*)")
    .eq("status", "queued")
    .lte("scheduled_at", cutoff.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (!queue?.length) return { processed: 0 };

  let processed = 0;
  for (const item of queue) {
    try {
      await supabase.from("publish_queue").update({ status: "processing" }).eq("id", item.id);
      await uploadToYouTube({ videoId: item.video_id, channelId: item.channel_id, publishAt: item.scheduled_at });
      await supabase.from("publish_queue").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", item.id);
      processed++;
    } catch (err) {
      await supabase.from("publish_queue").update({ status: "queued", last_error: err.message, attempts: (item.attempts || 0) + 1 }).eq("id", item.id);
    }
  }
  return { processed };
}
