
-- Withdrawal requests
CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','declined');

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  in_game_name text NOT NULL,
  gang_name text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  ticket_tracking_id text,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users create own withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users see own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "admins update withdrawals" ON public.withdrawal_requests
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;

-- Add minimum stake + pop-out ad content to settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS min_stake bigint NOT NULL DEFAULT 2000000,
  ADD COLUMN IF NOT EXISTS popup_ad_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_ad_title text,
  ADD COLUMN IF NOT EXISTS popup_ad_body text,
  ADD COLUMN IF NOT EXISTS popup_ad_image_url text,
  ADD COLUMN IF NOT EXISTS popup_ad_link text;

-- Make latest account admin
INSERT INTO public.user_roles(user_id, role)
SELECT '81801f81-d53f-45f4-8f2d-74daa62e1379'::uuid, 'admin'::public.app_role
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id='81801f81-d53f-45f4-8f2d-74daa62e1379' AND role='admin');
