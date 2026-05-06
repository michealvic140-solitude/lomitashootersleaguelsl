
-- 1. token_transactions ledger
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount bigint NOT NULL,
  balance_after bigint NOT NULL,
  kind text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON public.token_transactions(user_id, created_at DESC);
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own tx" ON public.token_transactions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "admins insert tx" ON public.token_transactions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);

-- 2. Trigger: log every balance change automatically
CREATE OR REPLACE FUNCTION public.log_token_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE diff bigint;
BEGIN
  diff := COALESCE(NEW.token_balance,0) - COALESCE(OLD.token_balance,0);
  IF diff <> 0 THEN
    INSERT INTO public.token_transactions(user_id, amount, balance_after, kind, description)
    VALUES (NEW.id, diff, NEW.token_balance, 'balance_change',
      CASE WHEN diff > 0 THEN 'Credit' ELSE 'Debit' END);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_log_token ON public.profiles;
CREATE TRIGGER profiles_log_token AFTER UPDATE OF token_balance ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_token_change();

-- 3. Detach selections when a match is deleted (preserve bet history)
ALTER TABLE public.bet_selections DROP CONSTRAINT IF EXISTS bet_selections_match_id_fkey;
ALTER TABLE public.bet_selections ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE public.bet_selections
  ADD CONSTRAINT bet_selections_match_id_fkey FOREIGN KEY (match_id)
  REFERENCES public.matches(id) ON DELETE SET NULL;

-- 4. Emergency wipe-all-tokens (admin only)
CREATE OR REPLACE FUNCTION public.wipe_all_tokens()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can wipe all tokens';
  END IF;
  UPDATE public.profiles SET token_balance = 0 WHERE token_balance > 0;
  INSERT INTO public.audit_logs(actor_id, action, target_type, metadata)
  VALUES (auth.uid(), 'emergency_wipe_all_tokens', 'system', '{}'::jsonb);
END $$;

-- 5. Realtime publication
DO $$ BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname='supabase_realtime';
  IF FOUND THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bets; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.matches; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.odds; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.markets; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.token_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.token_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.bets REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.odds REPLICA IDENTITY FULL;
ALTER TABLE public.markets REPLICA IDENTITY FULL;
