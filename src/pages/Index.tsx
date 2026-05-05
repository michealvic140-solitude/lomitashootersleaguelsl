import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Skull, Trophy, Flame, Megaphone, ChevronRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/Countdown";
import { supabase } from "@/integrations/supabase/client";

interface MatchRow {
  id: string; name: string; start_time: string; status: string;
  home_score: number; away_score: number;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
}
interface Announcement { id: string; title: string; body: string | null; image_url: string | null; }

const Index = () => {
  const [upcoming, setUpcoming] = useState<MatchRow[]>([]);
  const [live, setLive] = useState<MatchRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annIdx, setAnnIdx] = useState(0);

  useEffect(() => {
    const load = async () => {
      const sel = "id,name,start_time,status,home_score,away_score,home_team:teams!matches_home_team_id_fkey(name,logo_url),away_team:teams!matches_away_team_id_fkey(name,logo_url)";
      const [u, l, a] = await Promise.all([
        supabase.from("matches").select(sel).eq("status", "scheduled").order("start_time").limit(6),
        supabase.from("matches").select(sel).eq("status", "live").limit(6),
        supabase.from("announcements").select("id,title,body,image_url").eq("is_active", true).order("created_at", { ascending: false }).limit(5),
      ]);
      setUpcoming((u.data ?? []) as unknown as MatchRow[]);
      setLive((l.data ?? []) as unknown as MatchRow[]);
      setAnnouncements((a.data ?? []) as Announcement[]);
    };
    load();
  }, []);

  useEffect(() => {
    if (announcements.length < 2) return;
    const id = setInterval(() => setAnnIdx((i) => (i + 1) % announcements.length), 5000);
    return () => clearInterval(id);
  }, [announcements.length]);

  return (
    <Layout>
      {/* HERO */}
      <section className="container py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 glass px-4 py-1.5 rounded-full mb-6">
          <Skull className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs tracking-widest text-muted-foreground">VIRTUAL TOKEN ARENA</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight">
          <span className="gradient-gold-text">LOMITA</span><br />
          <span className="text-foreground">SHOOTERS LEAGUE</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-muted-foreground text-lg">
          Bet your tokens. Crown your gang. Become a legend in the most luxurious shooting arena on the web.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register"><Button size="lg" className="btn-luxury font-bold tracking-wider">JOIN THE LEAGUE</Button></Link>
          <Link to="/matches"><Button size="lg" variant="outline" className="glass">Browse Matches</Button></Link>
        </div>
      </section>

      {/* ANNOUNCEMENTS */}
      {announcements.length > 0 && (
        <section className="container mb-12">
          <Card className="glass-gold p-6 flex items-center gap-4 overflow-hidden">
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

      {/* LIVE STRIP */}
      {live.length > 0 && (
        <section className="container mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Flame className="h-5 w-5 text-accent" />Live Now</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {live.map((m) => (
              <Card key={m.id} className="glass min-w-[280px] p-4">
                <Badge variant="destructive" className="mb-2 animate-pulse">LIVE</Badge>
                <div className="font-bold">{m.home_team?.name} vs {m.away_team?.name}</div>
                <div className="text-2xl font-black gradient-gold-text mt-1">{m.home_score} - {m.away_score}</div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* UPCOMING */}
      <section className="container mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Crosshair className="h-5 w-5 text-primary" />Upcoming Events</h2>
          <Link to="/matches"><Button variant="ghost" size="sm">View all <ChevronRight className="h-4 w-4" /></Button></Link>
        </div>
        {upcoming.length === 0 ? (
          <Card className="glass p-12 text-center text-muted-foreground">
            No upcoming matches yet. The arena awaits.
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((m) => (
              <Card key={m.id} className="glass p-5 hover:border-primary/50 transition-all">
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{m.name}</div>
                <div className="flex items-center justify-between gap-2 my-3">
                  <div className="text-center flex-1">
                    <div className="h-12 w-12 mx-auto rounded-full glass flex items-center justify-center mb-1">
                      {m.home_team?.logo_url ? <img src={m.home_team.logo_url} alt="" className="h-10 w-10 rounded-full" /> : <Crosshair className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="text-xs font-bold">{m.home_team?.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">VS</div>
                  <div className="text-center flex-1">
                    <div className="h-12 w-12 mx-auto rounded-full glass flex items-center justify-center mb-1">
                      {m.away_team?.logo_url ? <img src={m.away_team.logo_url} alt="" className="h-10 w-10 rounded-full" /> : <Crosshair className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="text-xs font-bold">{m.away_team?.name}</div>
                  </div>
                </div>
                <div className="text-center text-xs">
                  <Countdown target={m.start_time} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* LEADERBOARDS */}
      <section className="container mb-16 grid md:grid-cols-2 gap-6">
        <Card className="glass p-6">
          <h3 className="font-bold flex items-center gap-2 mb-4"><Trophy className="h-5 w-5 text-gold" />Top Factions / Gangs</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="text-center py-8">Leaderboard data coming as matches settle.</li>
          </ol>
        </Card>
        <Card className="glass p-6">
          <h3 className="font-bold flex items-center gap-2 mb-4"><Trophy className="h-5 w-5 text-gold" />Best Shooters</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="text-center py-8">Be the first legend on this board.</li>
          </ol>
        </Card>
      </section>
    </Layout>
  );
};

export default Index;
