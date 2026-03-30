import { runPublishScheduler } from "../../../lib/youtube-service";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();
  try {
    const result = await runPublishScheduler();
    return res.json({ success: true, ...result, ts: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
