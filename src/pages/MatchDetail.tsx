import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/Countdown";
import { Crosshair, Flame, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { BetSlipPanel } from "@/components/BetSlipPanel";

const MatchDetail = () => {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const { add, selections } = useBetSlip();

  const load = async () => {
    if (!id) return;
    const { data: m } = await supabase.from("matches").select(
      "*,home_team:teams!matches_home_team_id_fkey(*),away_team:teams!matches_away_team_id_fkey(*)"
    ).eq("id", id).maybeSingle();
    setMatch(m);
    const { data: mk } = await supabase.from("markets").select("*,odds(*)").eq("match_id", id);
    setMarkets(mk ?? []);
    if (m) {
      const { data: pl } = await supabase.from("players").select("*").in("team_id", [m.home_team_id, m.away_team_id]);
      setPlayers(pl ?? []);
    }
  };

  useEffect(() => {
    load();
    if (!id) return;
    const ch = supabase.channel(`match-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "odds" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!match) return <Layout><div className="container py-12 text-center text-muted-foreground">Loading match...</div></Layout>;

  const homePlayers = players.filter((p) => p.team_id === match.home_team_id);
  const awayPlayers = players.filter((p) => p.team_id === match.away_team_id);

  return (
    <Layout>
      <div className="container py-8 grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <Card className="glass p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{match.name}</span>
              {match.status === "live" && <Badge variant="destructive" className="animate-pulse"><Flame className="h-3 w-3 mr-1" />LIVE</Badge>}
              {match.status === "scheduled" && <Badge variant="outline" className="text-gold border-gold/40">UPCOMING</Badge>}
              {match.status === "ended" && <Badge variant="secondary">FINAL</Badge>}
            </div>
            <div className="flex items-center justify-between gap-6">
              <div className="text-center flex-1">
                <div className="h-20 w-20 mx-auto rounded-full glass flex items-center justify-center mb-2">
                  {match.home_team?.logo_url ? <img src={match.home_team.logo_url} className="h-16 w-16 rounded-full object-cover" alt="" /> : <Crosshair className="h-8 w-8 text-primary" />}
                </div>
                <div className="font-bold">{match.home_team?.name}</div>
              </div>
              <div className="text-center">
                {match.status === "scheduled" ? (
                  <Countdown target={match.start_time} />
                ) : (
                  <div className="text-5xl font-black gradient-gold-text">{match.home_score} - {match.away_score}</div>
                )}
                {match.location && <div className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1"><MapPin className="h-3 w-3" />{match.location}</div>}
              </div>
              <div className="text-center flex-1">
                <div className="h-20 w-20 mx-auto rounded-full glass flex items-center justify-center mb-2">
                  {match.away_team?.logo_url ? <img src={match.away_team.logo_url} className="h-16 w-16 rounded-full object-cover" alt="" /> : <Crosshair className="h-8 w-8 text-primary" />}
                </div>
                <div className="font-bold">{match.away_team?.name}</div>
              </div>
            </div>
          </Card>

          {markets.map((mk) => (
            <Card key={mk.id} className="glass p-5">
              <h3 className="font-bold mb-3">{mk.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {mk.odds?.map((o: any) => {
                  const selected = selections.some((s) => s.odd_id === o.id);
                  return (
                    <Button key={o.id} variant={selected ? "default" : "outline"}
                      className={selected ? "btn-luxury" : "glass justify-between"}
                      disabled={!mk.is_open || match.status === "ended"}
                      onClick={() => add({
                        match_id: match.id, match_name: `${match.home_team?.name} vs ${match.away_team?.name}`,
                        market_id: mk.id, market_name: mk.name,
                        odd_id: o.id, selection_label: o.label, odds: Number(o.value),
                      })}>
                      <span className="text-xs">{o.label}</span>
                      <span className="text-gold font-bold ml-2">{Number(o.value).toFixed(2)}</span>
                    </Button>
                  );
                })}
              </div>
            </Card>
          ))}

          <div className="grid md:grid-cols-2 gap-4">
            {[{ team: match.home_team, players: homePlayers }, { team: match.away_team, players: awayPlayers }].map(({ team, players }) => (
              <Card key={team?.id} className="glass p-5">
                <h4 className="font-bold mb-3">{team?.name} Squad</h4>
                <div className="space-y-1 text-sm">
                  <div className="text-xs uppercase tracking-widest text-gold mt-2">Main</div>
                  {players.filter((p) => !p.is_substitute).map((p) => (
                    <div key={p.id}>{p.name} {p.position && <span className="text-muted-foreground">· {p.position}</span>}</div>
                  ))}
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mt-2">Substitutes</div>
                  {players.filter((p) => p.is_substitute).map((p) => (
                    <div key={p.id} className="text-muted-foreground">{p.name}</div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
        <div><BetSlipPanel /></div>
      </div>
    </Layout>
  );
};
export default MatchDetail;
