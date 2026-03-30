import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { createOrder } from "../../../lib/razorpay-service";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: "Sign in required" });
  try {
    const order = await createOrder({ planKey: req.body.planKey, userId: user.id, userEmail: user.email });
    return res.json(order);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
