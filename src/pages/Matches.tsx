import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/Countdown";
import { Crosshair, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BetSlipPanel } from "@/components/BetSlipPanel";

interface MatchRow {
  id: string; name: string; start_time: string; status: string;
  home_score: number; away_score: number; location: string | null;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
}

const Matches = () => {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [filter, setFilter] = useState<"all" | "live" | "scheduled" | "ended">("all");

  useEffect(() => {
    const sel = "id,name,start_time,status,home_score,away_score,location,home_team:teams!matches_home_team_id_fkey(name,logo_url),away_team:teams!matches_away_team_id_fkey(name,logo_url)";
    supabase.from("matches").select(sel).order("start_time", { ascending: false }).limit(100)
      .then(({ data }) => setMatches((data ?? []) as unknown as MatchRow[]));
    const ch = supabase.channel("matches-list").on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
      supabase.from("matches").select(sel).order("start_time", { ascending: false }).limit(100)
        .then(({ data }) => setMatches((data ?? []) as unknown as MatchRow[]));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = matches.filter((m) => filter === "all" || m.status === filter);

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-bold gradient-gold-text">Arena Matches</h1>
          <div className="flex gap-2">
            {(["all", "live", "scheduled", "ended"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)} className={filter === f ? "btn-luxury" : "glass"}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-3">
            {filtered.length === 0 && (
              <Card className="glass p-12 text-center text-muted-foreground">No matches found.</Card>
            )}
            {filtered.map((m) => (
              <Link key={m.id} to={`/matches/${m.id}`}>
                <Card className="glass p-5 hover:border-primary/60 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Crosshair className="h-4 w-4 text-primary" />
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">{m.name}</span>
                    </div>
                    {m.status === "live" && <Badge variant="destructive" className="animate-pulse"><Flame className="h-3 w-3 mr-1" />LIVE</Badge>}
                    {m.status === "scheduled" && <Badge variant="outline" className="text-gold border-gold/40">UPCOMING</Badge>}
                    {m.status === "ended" && <Badge variant="secondary">ENDED</Badge>}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-center flex-1">
                      <div className="h-14 w-14 mx-auto rounded-full glass flex items-center justify-center mb-2">
                        {m.home_team?.logo_url ? <img src={m.home_team.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <Crosshair className="h-6 w-6 text-primary" />}
                      </div>
                      <div className="text-sm font-bold">{m.home_team?.name}</div>
                    </div>
                    <div className="text-center">
                      {m.status === "scheduled" ? (
                        <Countdown target={m.start_time} />
                      ) : (
                        <div className="text-3xl font-black gradient-gold-text">{m.home_score} - {m.away_score}</div>
                      )}
                      {m.location && <div className="text-xs text-muted-foreground mt-1">{m.location}</div>}
                    </div>
                    <div className="text-center flex-1">
                      <div className="h-14 w-14 mx-auto rounded-full glass flex items-center justify-center mb-2">
                        {m.away_team?.logo_url ? <img src={m.away_team.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <Crosshair className="h-6 w-6 text-primary" />}
                      </div>
                      <div className="text-sm font-bold">{m.away_team?.name}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <div className="hidden lg:block">
            <BetSlipPanel />
          </div>
        </div>
      </div>
    </Layout>
  );
};
export default Matches;
