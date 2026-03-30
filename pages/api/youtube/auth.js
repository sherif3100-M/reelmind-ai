import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAuthUrl } from "../../../lib/youtube-service";

export default async function handler(req, res) {
 const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.redirect("/login?error=signin_required");
  res.redirect(getAuthUrl(user.id));
}
