import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Server-side admin client (uses service role key - never expose to browser)
export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// Get current user from request (for API routes)
export async function getUserFromRequest(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await getServiceSupabase().auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Get profile with admin check
export async function getProfile(userId) {
  const { data } = await getServiceSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}
