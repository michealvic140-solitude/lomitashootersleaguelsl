
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('viewer','shooter','gang_leader','registered','moderator','admin');
CREATE TYPE public.gang_type AS ENUM ('G','F');
CREATE TYPE public.match_status AS ENUM ('scheduled','live','ended','cancelled');
CREATE TYPE public.bet_status AS ENUM ('open','won','lost','cashed_out','void');
CREATE TYPE public.chat_room AS ENUM ('general','gang','moderator');
CREATE TYPE public.ticket_status AS ENUM ('open','pending','resolved','closed');
CREATE TYPE public.token_request_status AS ENUM ('pending','approved','denied');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  discord_username TEXT,
  country TEXT,
  server TEXT DEFAULT 'LOMITA AFR',
  gang_name TEXT,
  gang_type public.gang_type,
  avatar_url TEXT,
  token_balance BIGINT NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  mute_reason TEXT,
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  restrict_reason TEXT,
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_mod_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('moderator','admin'))
$$;

CREATE OR REPLACE FUNCTION public.can_use_gang_chat(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('gang_leader','moderator','admin'))
$$;

-- =========================================================
-- AUTO-CREATE PROFILE + VIEWER ROLE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, discord_username, country, server, gang_name, gang_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'discord_username',
    NEW.raw_user_meta_data->>'country',
    COALESCE(NEW.raw_user_meta_data->>'server','LOMITA AFR'),
    NEW.raw_user_meta_data->>'gang_name',
    NULLIF(NEW.raw_user_meta_data->>'gang_type','')::public.gang_type
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- PROFILE / ROLE POLICIES
-- =========================================================
CREATE POLICY "profiles readable by all authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admins update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "roles readable by all authed" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- CATEGORIES / TEAMS / PLAYERS / MATCHES
-- =========================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  gang_type public.gang_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "admins manage teams" ON public.teams FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_substitute BOOLEAN NOT NULL DEFAULT false,
  position TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players public read" ON public.players FOR SELECT USING (true);
CREATE POLICY "admins manage players" ON public.players FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  home_team_id UUID NOT NULL REFERENCES public.teams(id),
  away_team_id UUID NOT NULL REFERENCES public.teams(id),
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  status public.match_status NOT NULL DEFAULT 'scheduled',
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  winner_team_id UUID REFERENCES public.teams(id),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches public read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "admins manage matches" ON public.matches FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "markets public read" ON public.markets FOR SELECT USING (true);
CREATE POLICY "admins manage markets" ON public.markets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value NUMERIC(8,2) NOT NULL,
  is_winner BOOLEAN,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "odds public read" ON public.odds FOR SELECT USING (true);
CREATE POLICY "admins manage odds" ON public.odds FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- BETS
-- =========================================================
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL UNIQUE DEFAULT ('LSL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  booking_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  stake BIGINT NOT NULL CHECK (stake > 0),
  total_odds NUMERIC(10,2) NOT NULL,
  potential_payout BIGINT NOT NULL CHECK (potential_payout <= 60000000),
  status public.bet_status NOT NULL DEFAULT 'open',
  cashout_amount BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own bets" ON public.bets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "users insert own bets" ON public.bets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own open bets" ON public.bets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'open');
CREATE POLICY "admins manage bets" ON public.bets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.bet_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id),
  market_id UUID NOT NULL REFERENCES public.markets(id),
  odd_id UUID NOT NULL REFERENCES public.odds(id),
  locked_odds NUMERIC(8,2) NOT NULL,
  selection_label TEXT NOT NULL,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bet_id, match_id)
);
ALTER TABLE public.bet_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "selections via bet ownership" ON public.bet_selections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bets b WHERE b.id = bet_id AND (b.user_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "users insert selections" ON public.bet_selections FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bets b WHERE b.id = bet_id AND b.user_id = auth.uid()));
CREATE POLICY "admins manage selections" ON public.bet_selections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- CHAT
-- =========================================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room public.chat_room NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "general chat readable by all authed" ON public.chat_messages FOR SELECT TO authenticated
  USING (
    room = 'general'
    OR (room = 'gang' AND public.can_use_gang_chat(auth.uid()))
    OR (room = 'moderator' AND public.is_mod_or_admin(auth.uid()))
  );
CREATE POLICY "users post if not muted" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_muted OR p.is_banned))
    AND (
      room = 'general'
      OR (room = 'gang' AND public.can_use_gang_chat(auth.uid()))
      OR (room = 'moderator' AND public.is_mod_or_admin(auth.uid()))
    )
  );
CREATE POLICY "mods delete chat" ON public.chat_messages FOR DELETE TO authenticated
  USING (public.is_mod_or_admin(auth.uid()));

-- =========================================================
-- ANNOUNCEMENTS / HIGHLIGHTS / ADS
-- =========================================================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, body TEXT, image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements public read" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, media_url TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT 'image',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "highlights public read" ON public.highlights FOR SELECT USING (true);
CREATE POLICY "admins manage highlights" ON public.highlights FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, image_url TEXT, link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads public read" ON public.advertisements FOR SELECT USING (true);
CREATE POLICY "admins manage ads" ON public.advertisements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT, link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- PROMO CODES
-- =========================================================
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  amount BIGINT NOT NULL,
  usage_limit INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promos read by authed" ON public.promo_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage promos" ON public.promo_codes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promo_id, user_id)
);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own redemptions" ON public.promo_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "users insert own redemptions" ON public.promo_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- SUPPORT TICKETS
-- =========================================================
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "users create tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mods update tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_mod_or_admin(auth.uid()) OR auth.uid() = user_id);

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT,
  image_url TEXT,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket msgs via ownership" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (t.user_id = auth.uid() OR public.is_mod_or_admin(auth.uid()))));
CREATE POLICY "ticket msgs insert" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (t.user_id = auth.uid() OR public.is_mod_or_admin(auth.uid()))));

-- =========================================================
-- TOKEN REQUESTS
-- =========================================================
CREATE TABLE public.token_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  proof_image_url TEXT,
  note TEXT,
  status public.token_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE public.token_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own requests" ON public.token_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "users create requests" ON public.token_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update requests" ON public.token_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "authed insert logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================
-- APP SETTINGS (singleton row)
-- =========================================================
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT DEFAULT 'We are currently performing maintenance. Please check back soon.',
  terms_content TEXT DEFAULT '',
  contact_email TEXT DEFAULT 'lomitashootersleague@gmail.com',
  contact_phone TEXT,
  contact_whatsapp TEXT,
  about_us TEXT,
  why_trust_us TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "admins update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "admins insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.app_settings (id) VALUES (1);

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars','avatars',true),
  ('chat-images','chat-images',true),
  ('team-logos','team-logos',true),
  ('player-avatars','player-avatars',true),
  ('announcements','announcements',true),
  ('highlights','highlights',true),
  ('ads','ads',true),
  ('ticket-uploads','ticket-uploads',true),
  ('token-proofs','token-proofs',true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read all buckets" ON storage.objects FOR SELECT USING (true);
CREATE POLICY "authed upload buckets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars','chat-images','team-logos','player-avatars','announcements','highlights','ads','ticket-uploads','token-proofs'));
CREATE POLICY "users update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()));

-- =========================================================
-- REALTIME
-- =========================================================
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.odds REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.bets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.odds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
