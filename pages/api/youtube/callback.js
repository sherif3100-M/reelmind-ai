import { exchangeCodeForTokens } from "../../../lib/youtube-service";

export default async function handler(req, res) {
  const { code, state: userId, error } = req.query;
  if (error || !code) return res.redirect("/dashboard?error=youtube_cancelled");
  try {
    const channel = await exchangeCodeForTokens(code, userId);
    res.redirect(`/dashboard?youtube_connected=1&channel=${encodeURIComponent(channel.channel_name)}`);
  } catch (e) {
    res.redirect(`/dashboard?error=${encodeURIComponent(e.message)}`);
  }
}
