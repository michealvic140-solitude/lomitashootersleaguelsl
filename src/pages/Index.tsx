import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Skull, Trophy, Flame, Megaphone, ChevronRight, Lock, CalendarClock, Sparkles, Mail, Phone, MessageCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/Countdown";
import { supabase } from "@/integrations/supabase/client";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { BetSlipPanel } from "@/components/BetSlipPanel";

interface OddRow { id: string; label: string; value: number; is_winner: boolean | null }
interface MarketRow { id: string; name: string; is_open: boolean; odds: OddRow[] }
interface MatchRow {
  id: string; name: string; start_time: string; status: string;
  home_score: number; away_score: number; location: string | null;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
  markets: MarketRow[];
}
interface Announcement { id: string; title: string; body: string | null; image_url: string | null; }
interface EventRow { id: string; title: string; description: string | null; image_url: string | null; starts_at: string; }
interface HighlightRow { id: string; title: string; media_url: string; media_type: string; }
interface Settings { about_us: string | null; why_trust_us: string | null; terms_content: string | null; contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; }

const Index = () => {
  const [upcoming, setUpcoming] = useState<MatchRow[]>([]);
  const [live, setLive] = useState<MatchRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annIdx, setAnnIdx] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const { add, remove, selections } = useBetSlip();

  useEffect(() => {
    const sel = "id,name,start_time,status,home_score,away_score,location,home_team:teams!matches_home_team_id_fkey(name,logo_url),away_team:teams!matches_away_team_id_fkey(name,logo_url),markets(id,name,is_open,odds(id,label,value,is_winner))";
    const load = async () => {
      const [u, l, a, ev, hi, st] = await Promise.all([
        supabase.from("matches").select(sel).eq("status", "scheduled").order("start_time").limit(20),
        supabase.from("matches").select(sel).eq("status", "live").limit(10),
        supabase.from("announcements").select("id,title,body,image_url").eq("is_active", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("upcoming_events").select("*").eq("is_active", true).order("starts_at").limit(10),
        supabase.from("highlights").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(12),
        supabase.from("app_settings").select("about_us,why_trust_us,terms_content,contact_email,contact_phone,contact_whatsapp").eq("id", 1).maybeSingle(),
      ]);
      setUpcoming((u.data ?? []) as unknown as MatchRow[]);
      setLive((l.data ?? []) as unknown as MatchRow[]);
      setAnnouncements((a.data ?? []) as Announcement[]);
      setEvents((ev.data ?? []) as EventRow[]);
      setHighlights((hi.data ?? []) as HighlightRow[]);
      setSettings((st.data ?? null) as Settings | null);
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

  const renderMatchRow = (m: MatchRow) => {
    const winnerMarket = m.markets?.find((mk) => /winner|1x2|match/i.test(mk.name)) ?? m.markets?.[0];
    const odds = winnerMarket?.odds ?? [];
    const locked = m.status === "live" || m.status === "ended" || !winnerMarket?.is_open;
    return (
      <Card key={m.id} className="glass p-3 md:p-4 hover:border-primary/50 transition-all">
        <Link to={`/matches/${m.id}`} className="block">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{m.name}</div>
          <div className="flex items-center gap-2 mt-1">
            {m.home_team?.logo_url ? <img src={m.home_team.logo_url} className="h-7 w-7 rounded-full object-cover" alt="" /> : <Crosshair className="h-4 w-4 text-primary" />}
            <div className="font-bold text-sm truncate flex-1">{m.home_team?.name} <span className="text-muted-foreground">vs</span> {m.away_team?.name}</div>
            {m.away_team?.logo_url && <img src={m.away_team.logo_url} className="h-7 w-7 rounded-full object-cover" alt="" />}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {m.status === "scheduled" ? <Countdown target={m.start_time} /> :
             m.status === "live" ? <span className="text-destructive font-bold">LIVE {m.home_score}-{m.away_score}</span> :
             `Final ${m.home_score}-${m.away_score}`}
            {m.markets?.length ? ` · ${m.markets.length} markets` : ""}
          </div>
        </Link>
        {odds.length > 0 && (
          <div className="grid grid-cols-3 gap-1 mt-3">
            {odds.slice(0, 3).map((o) => {
              const selected = selections.some((s) => s.odd_id === o.id);
              return (
                <button
                  key={o.id}
                  disabled={locked}
                  onClick={(e) => {
                    e.preventDefault();
                    if (selected) remove(o.id);
                    else add({
                      match_id: m.id,
                      match_name: `${m.home_team?.name} vs ${m.away_team?.name}`,
                      market_id: winnerMarket!.id,
                      market_name: winnerMarket!.name,
                      odd_id: o.id,
                      selection_label: o.label,
                      odds: Number(o.value),
                    });
                  }}
                  className={`px-2 py-2 rounded text-xs font-bold transition-all ${
                    locked ? "bg-secondary/30 text-muted-foreground cursor-not-allowed" :
                    selected ? "bg-emerald-500/30 border border-emerald-400 text-emerald-200" :
                    "bg-emerald-600/80 hover:bg-emerald-500 text-white"
                  }`}
                >
                  <div className="text-[9px] opacity-80 truncate">{o.label}</div>
                  <div className="text-sm">{Number(o.value).toFixed(2)}</div>
                </button>
              );
            })}
          </div>
        )}
        {locked && <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2"><Lock className="h-3 w-3" />Bookings locked</div>}
      </Card>
    );
  };

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
        </div>
        <aside className="hidden lg:block"><BetSlipPanel /></aside>
      </div>

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
