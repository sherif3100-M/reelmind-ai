import Razorpay from "razorpay";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const PLANS = {
  starter_monthly:  { amount: 190000,  credits: 30,    plan: "starter",  label: "Starter Monthly" },
  creator_monthly:  { amount: 490000,  credits: 150,   plan: "creator",  label: "Creator Pro Monthly" },
  agency_monthly:   { amount: 1290000, credits: 99999, plan: "agency",   label: "Agency Monthly" },
  starter_weekly:   { amount: 59900,   credits: 8,     plan: "starter",  label: "Starter Weekly" },
  creator_weekly:   { amount: 149900,  credits: 38,    plan: "creator",  label: "Creator Pro Weekly" },
  credits_5:        { amount: 39900,   credits: 5,     plan: null,       label: "5 Video Credits" },
  credits_20:       { amount: 149900,  credits: 20,    plan: null,       label: "20 Video Credits" },
  credits_50:       { amount: 299900,  credits: 50,    plan: null,       label: "50 Video Credits" },
};

export async function createOrder({ planKey, userId, userEmail }) {
  const cfg = PLANS[planKey];
  if (!cfg) throw new Error(`Invalid plan: ${planKey}`);

  const order = await razorpay.orders.create({
    amount: cfg.amount,
    currency: "INR",
    receipt: `rm_${userId}_${Date.now()}`,
    notes: { user_id: userId, plan_key: planKey, email: userEmail || "" },
  });

  await supabase.from("payment_orders").insert({
    razorpay_order_id: order.id, user_id: userId,
    plan_key: planKey, amount: cfg.amount, currency: "INR", status: "created",
  });

  return { orderId: order.id, amount: cfg.amount, currency: "INR", planLabel: cfg.label, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID };
}

export async function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if (expected !== razorpay_signature) throw new Error("Invalid payment signature");

  const { data: order } = await supabase.from("payment_orders").select("*").eq("razorpay_order_id", razorpay_order_id).single();
  if (!order) throw new Error("Order not found");
  if (order.status === "paid") return { alreadyProcessed: true };

  const cfg = PLANS[order.plan_key];
  if (cfg.plan) {
    await supabase.from("profiles").update({ plan: cfg.plan, video_credits: cfg.credits, subscription_status: "active" }).eq("id", order.user_id);
  } else {
    const { data: p } = await supabase.from("profiles").select("video_credits").eq("id", order.user_id).single();
    await supabase.from("profiles").update({ video_credits: (p?.video_credits || 0) + cfg.credits }).eq("id", order.user_id);
  }

  await supabase.from("credit_transactions").insert({ user_id: order.user_id, amount: cfg.credits, type: "credit_purchase", description: cfg.label, razorpay_payment_id, razorpay_order_id });
  await supabase.from("payment_orders").update({ status: "paid", razorpay_payment_id, paid_at: new Date().toISOString() }).eq("razorpay_order_id", razorpay_order_id);

  return { success: true, credits: cfg.credits, plan: cfg.plan };
}
