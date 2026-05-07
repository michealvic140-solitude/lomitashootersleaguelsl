
-- Upcoming events table for bold homepage countdown banners
CREATE TABLE IF NOT EXISTS public.upcoming_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  starts_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.upcoming_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events public read" ON public.upcoming_events;
CREATE POLICY "events public read" ON public.upcoming_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage events" ON public.upcoming_events;
CREATE POLICY "admins manage events" ON public.upcoming_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.upcoming_events;

-- Notify all users helper
CREATE OR REPLACE FUNCTION public.notify_all_users(_title text, _body text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT id, _title, _body, _link FROM public.profiles;
END $$;

-- Auto-notify on match status change & creation
CREATE OR REPLACE FUNCTION public.notify_match_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hn text; an text;
BEGIN
  SELECT name INTO hn FROM public.teams WHERE id = NEW.home_team_id;
  SELECT name INTO an FROM public.teams WHERE id = NEW.away_team_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_all_users('New match created', COALESCE(hn,'?')||' vs '||COALESCE(an,'?'), '/matches/'||NEW.id::text);
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'live' THEN
      PERFORM public.notify_all_users('Match is LIVE 🔴', COALESCE(hn,'?')||' vs '||COALESCE(an,'?'), '/matches/'||NEW.id::text);
    ELSIF NEW.status = 'ended' THEN
      PERFORM public.notify_all_users('Match ended', COALESCE(hn,'?')||' '||NEW.home_score||'-'||NEW.away_score||' '||COALESCE(an,'?'), '/matches/'||NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_match_event ON public.matches;
CREATE TRIGGER trg_notify_match_event AFTER INSERT OR UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.notify_match_event();

-- Auto-notify on new announcement
CREATE OR REPLACE FUNCTION public.notify_announcement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active THEN
    PERFORM public.notify_all_users('📣 '||NEW.title, COALESCE(NEW.body,''), '/');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_announcement ON public.announcements;
CREATE TRIGGER trg_notify_announcement AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();

-- Auto-notify on new event
CREATE OR REPLACE FUNCTION public.notify_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active THEN
    PERFORM public.notify_all_users('🎯 New event: '||NEW.title, COALESCE(NEW.description,''), '/');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_event ON public.upcoming_events;
CREATE TRIGGER trg_notify_event AFTER INSERT ON public.upcoming_events
FOR EACH ROW EXECUTE FUNCTION public.notify_event();

-- Auto-notify on new highlight
CREATE OR REPLACE FUNCTION public.notify_highlight() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active THEN
    PERFORM public.notify_all_users('✨ New highlight: '||NEW.title, '', '/');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_highlight ON public.highlights;
CREATE TRIGGER trg_notify_highlight AFTER INSERT ON public.highlights
FOR EACH ROW EXECUTE FUNCTION public.notify_highlight();

-- Realtime for notifications already not added? Add for safety
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;
