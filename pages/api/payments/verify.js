import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { verifyPayment } from "../../../lib/razorpay-service";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).end();
  try {
    const result = await verifyPayment(req.body);
    return res.json({ success: true, ...result });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
