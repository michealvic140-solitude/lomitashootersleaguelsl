import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Skull, Trophy, Flame, Megaphone, ChevronRight, CalendarClock, Sparkles, Mail, Phone, MessageCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/Countdown";
import { supabase } from "@/integrations/supabase/client";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { BetSlipPanel } from "@/components/BetSlipPanel";
import { MatchCardLive, type MatchRow } from "@/components/MatchCardLive";

interface Announcement { id: string; title: string; body: string | null; image_url: string | null; }
interface EventRow { id: string; title: string; description: string | null; image_url: string | null; starts_at: string; }
interface HighlightRow { id: string; title: string; media_url: string; media_type: string; }
interface Settings { about_us: string | null; why_trust_us: string | null; terms_content: string | null; contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; popup_ad_enabled?: boolean; popup_ad_title?: string | null; popup_ad_body?: string | null; popup_ad_image_url?: string | null; popup_ad_link?: string | null; }

const Index = () => {
  const [upcoming, setUpcoming] = useState<MatchRow[]>([]);
  const [live, setLive] = useState<MatchRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annIdx, setAnnIdx] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const { selections } = useBetSlip();

  useEffect(() => {
    const sel = "id,name,start_time,status,home_score,away_score,location,is_featured,home_team:teams!matches_home_team_id_fkey(name,logo_url),away_team:teams!matches_away_team_id_fkey(name,logo_url),markets(id,name,is_open,odds(id,label,value,is_winner))";
    const load = async () => {
      const [u, l, a, ev, hi, st] = await Promise.all([
        supabase.from("matches").select(sel).eq("status", "scheduled").order("start_time").limit(20),
        supabase.from("matches").select(sel).eq("status", "live").limit(10),
        supabase.from("announcements").select("id,title,body,image_url").eq("is_active", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("upcoming_events").select("*").eq("is_active", true).order("starts_at").limit(10),
        supabase.from("highlights").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(12),
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      setUpcoming((u.data ?? []) as unknown as MatchRow[]);
      setLive((l.data ?? []) as unknown as MatchRow[]);
      setAnnouncements((a.data ?? []) as Announcement[]);
      setEvents((ev.data ?? []) as EventRow[]);
      setHighlights((hi.data ?? []) as HighlightRow[]);
      setSettings((st.data ?? null) as Settings | null);
      if (st.data?.popup_ad_enabled && (st.data?.popup_ad_title || st.data?.popup_ad_body)) {
        const dismissed = sessionStorage.getItem("lsl_popup_dismissed");
        if (!dismissed) setShowPopup(true);
      }
    };
    load();
    const ch = supabase.channel("home")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "odds" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "markets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "upcoming_events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "highlights" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (announcements.length < 2) return;
    const id = setInterval(() => setAnnIdx((i) => (i + 1) % announcements.length), 5000);
    return () => clearInterval(id);
  }, [announcements.length]);

  const renderMatchRow = (m: MatchRow) => <MatchCardLive key={m.id} match={m} />;

  return (
    <Layout>
      <section className="container py-10 md:py-20 text-center">
        <div className="inline-flex items-center gap-2 glass px-4 py-1.5 rounded-full mb-6">
          <Skull className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs tracking-widest text-muted-foreground">VIRTUAL TOKEN ARENA</span>
        </div>
        <h1 className="text-4xl md:text-7xl font-black tracking-tight">
          <span className="gradient-gold-text">LOMITA</span><br />
          <span className="text-foreground">SHOOTERS LEAGUE</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-muted-foreground">
          Bet your tokens. Crown your gang. Become a legend in the most luxurious shooting arena on the web.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register"><Button size="lg" className="btn-luxury font-bold tracking-wider">JOIN THE LEAGUE</Button></Link>
          <Link to="/matches"><Button size="lg" variant="outline" className="glass">Browse Matches</Button></Link>
        </div>
      </section>

      {events.length > 0 && (
        <section className="container mb-6 space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="relative overflow-hidden rounded-2xl glass-gold border border-gold/40">
              {ev.image_url && <img src={ev.image_url} className="absolute inset-0 w-full h-full object-cover opacity-40" alt="" />}
              <div className="relative p-5 md:p-7 bg-gradient-to-r from-background/80 via-background/40 to-transparent">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold"><CalendarClock className="h-4 w-4" /> Upcoming Event</div>
                <h3 className="text-2xl md:text-4xl font-black gradient-gold-text mt-1">{ev.title}</h3>
                {ev.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{ev.description}</p>}
                <div className="mt-3 text-2xl md:text-4xl font-black"><Countdown target={ev.starts_at} /></div>
              </div>
            </div>
          ))}
        </section>
      )}

      {announcements.length > 0 && (
        <section className="container mb-8">
          <Card className="glass-gold p-4 flex items-center gap-4 overflow-hidden">
            <Megaphone className="h-6 w-6 text-primary shrink-0 animate-glow-pulse" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gold uppercase tracking-widest">Announcement</div>
              <div className="font-bold truncate">{announcements[annIdx].title}</div>
              {announcements[annIdx].body && (
                <div className="text-sm text-muted-foreground truncate">{announcements[annIdx].body}</div>
              )}
            </div>
          </Card>
        </section>
      )}

      <div className="container grid lg:grid-cols-[1fr_360px] gap-6 pb-12">
        <div className="space-y-8">
          {live.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Flame className="h-5 w-5 text-destructive animate-pulse" />Live Now</h2>
              <div className="space-y-2">{live.map(renderMatchRow)}</div>
            </section>
          )}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2"><Crosshair className="h-5 w-5 text-primary" />Upcoming · Today's Matches</h2>
              <Link to="/matches"><Button variant="ghost" size="sm">All<ChevronRight className="h-4 w-4" /></Button></Link>
            </div>
            {upcoming.length === 0 ? (
              <Card className="glass p-12 text-center text-muted-foreground">No upcoming matches yet. The arena awaits.</Card>
            ) : (
              <div className="space-y-2">{upcoming.map(renderMatchRow)}</div>
            )}
          </section>
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Trophy className="h-5 w-5 text-gold" />Hot Now</h2>
            <Link to="/leaderboard"><Card className="glass-gold p-6 text-center"><div className="font-bold gradient-gold-text">View live leaderboard →</div></Card></Link>
          </section>
          {highlights.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" />Highlights</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {highlights.map((h) => (
                  <Card key={h.id} className="glass overflow-hidden">
                    {h.media_type === "video"
                      ? <video src={h.media_url} controls className="w-full aspect-video object-cover" />
                      : <img src={h.media_url} className="w-full aspect-video object-cover" alt={h.title} />}
                    <div className="p-2 text-xs font-bold truncate">{h.title}</div>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {(settings?.about_us || settings?.why_trust_us) && (
            <section className="grid md:grid-cols-2 gap-3">
              {settings?.about_us && <Card className="glass p-5"><h3 className="font-bold gradient-gold-text mb-2">About Us</h3><p className="text-sm whitespace-pre-wrap text-muted-foreground">{settings.about_us}</p></Card>}
              {settings?.why_trust_us && <Card className="glass p-5"><h3 className="font-bold gradient-gold-text mb-2">Why Trust Us</h3><p className="text-sm whitespace-pre-wrap text-muted-foreground">{settings.why_trust_us}</p></Card>}
            </section>
          )}
          {settings && (
            <section>
              <Card className="glass p-5">
                <h3 className="font-bold gradient-gold-text mb-3">Contact</h3>
                <div className="flex flex-wrap gap-3 text-sm">
                  {settings.contact_email && <a className="flex items-center gap-1 text-gold hover:underline" href={`mailto:${settings.contact_email}`}><Mail className="h-4 w-4" />{settings.contact_email}</a>}
                  {settings.contact_phone && <a className="flex items-center gap-1 text-gold hover:underline" href={`tel:${settings.contact_phone}`}><Phone className="h-4 w-4" />{settings.contact_phone}</a>}
                  {settings.contact_whatsapp && <a className="flex items-center gap-1 text-gold hover:underline" href={`https://wa.me/${settings.contact_whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
                  {settings.terms_content && <button onClick={() => setShowTerms(true)} className="text-gold hover:underline">Terms & Conditions</button>}
                </div>
              </Card>
            </section>
          )}
        </div>
        <aside className="hidden lg:block"><BetSlipPanel /></aside>
      </div>

      {showTerms && settings?.terms_content && (
        <div onClick={() => setShowTerms(false)} className="fixed inset-0 z-[80] bg-black/70 backdrop-blur flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="glass-gold max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 rounded-2xl">
            <h3 className="text-xl font-bold gradient-gold-text mb-3">Terms & Conditions</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{settings.terms_content}</p>
            <Button onClick={() => setShowTerms(false)} className="btn-luxury mt-4 w-full">Close</Button>
          </div>
        </div>
      )}

      {showPopup && settings?.popup_ad_enabled && (
        <div onClick={() => { setShowPopup(false); sessionStorage.setItem("lsl_popup_dismissed", "1"); }} className="fixed inset-0 z-[90] bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="glass-gold max-w-3xl w-full rounded-3xl overflow-hidden border border-gold/40 relative">
            <button onClick={() => { setShowPopup(false); sessionStorage.setItem("lsl_popup_dismissed", "1"); }} className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/80 border border-gold/40 flex items-center justify-center text-gold">×</button>
            {settings.popup_ad_image_url && <img src={settings.popup_ad_image_url} className="w-full max-h-[50vh] object-cover" alt="" />}
            <div className="p-6 md:p-8">
              <h3 className="text-2xl md:text-4xl font-black gradient-gold-text">{settings.popup_ad_title}</h3>
              {settings.popup_ad_body && <p className="text-sm md:text-base text-muted-foreground mt-3 whitespace-pre-wrap">{settings.popup_ad_body}</p>}
              {settings.popup_ad_link && (
                <a href={settings.popup_ad_link} target="_blank" rel="noreferrer">
                  <Button className="btn-luxury mt-4">Learn more</Button>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {selections.length > 0 && (
        <div className="lg:hidden fixed bottom-20 left-2 right-2 z-30">
          <Link to="/checkout">
            <Card className="glass-gold p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Bet Slip</div>
                <div className="font-bold gradient-gold-text">{selections.length} selection{selections.length > 1 ? "s" : ""}</div>
              </div>
              <Button size="sm" className="btn-luxury">Checkout →</Button>
            </Card>
          </Link>
        </div>
      )}
    </Layout>
  );
};

export default Index;
