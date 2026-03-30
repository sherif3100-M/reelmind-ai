CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT, full_name TEXT, avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','creator','agency')),
  video_credits INTEGER DEFAULT 3,
  total_videos_generated INTEGER DEFAULT 0,
  subscription_status TEXT DEFAULT 'inactive',
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.channels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  youtube_channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_thumbnail TEXT,
  subscriber_count INTEGER DEFAULT 0,
  access_token TEXT NOT NULL, refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ, is_active BOOLEAN DEFAULT TRUE,
  auto_publish BOOLEAN DEFAULT FALSE,
  publish_times TEXT[] DEFAULT ARRAY['09:00','18:00'],
  default_niche TEXT DEFAULT 'finance',
  default_voice_id TEXT DEFAULT 'deep_male',
  default_style TEXT DEFAULT 'cinematic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, youtube_channel_id)
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own channels" ON public.channels FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  niche TEXT NOT NULL DEFAULT 'finance',
  duration INTEGER NOT NULL DEFAULT 30,
  style TEXT DEFAULT 'cinematic',
  voice_id TEXT DEFAULT 'deep_male',
  caption_style TEXT DEFAULT 'bold_center',
  custom_prompt TEXT,
  script_hook TEXT, script_body TEXT, script_cta TEXT, script_full TEXT,
  keywords TEXT[], seo_title TEXT, seo_description TEXT, seo_tags TEXT[],
  viral_score INTEGER, voiceover_url TEXT, broll_urls TEXT[],
  final_video_url TEXT, asset_manifest_url TEXT,
  youtube_video_id TEXT, youtube_url TEXT,
  scheduled_publish_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','scripting','voicing','fetching_broll','rendering','uploading','scheduled','published','failed')),
  error_message TEXT, render_duration_ms INTEGER,
  view_count INTEGER DEFAULT 0, like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own videos" ON public.videos FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.publish_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed')),
  attempts INTEGER DEFAULT 0, last_error TEXT, processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.publish_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own queue" ON public.publish_queue FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  razorpay_order_id TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_key TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.payment_orders FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('subscription_purchase','credit_purchase','video_used','referral_bonus','admin_grant')),
  description TEXT, razorpay_payment_id TEXT, razorpay_order_id TEXT,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.decrement_video_credits(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET video_credits = GREATEST(0, video_credits - 1),
      total_videos_generated = total_videos_generated + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_videos_user ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON public.publish_queue(scheduled_at) WHERE status = 'queued';
