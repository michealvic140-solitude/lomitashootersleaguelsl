import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crosshair, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const TicketSlip = () => {
  const { id } = useParams();
  const { user, profile, refresh } = useAuth();
  const [bet, setBet] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!id) return;
    supabase.from("bets").select("*,bet_selections(*,odd:odds(is_winner),match:matches(name,home_score,away_score,status,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)))").eq("id", id).maybeSingle()
      .then(({ data }) => setBet(data));
  };
  useEffect(load, [id]);

  if (!bet) return <Layout><div className="container py-12 text-muted-foreground">Loading...</div></Layout>;

  const cashout = async () => {
    if (!user || !profile) return;
    if (bet.status !== "won") { toast.error("You can only cash out a winning ticket."); return; }
    setLoading(true);
    const amount = Math.min(60_000_000, Number(bet.potential_payout));
    await supabase.from("bets").update({ status: "cashed_out", cashout_amount: amount, settled_at: new Date().toISOString() }).eq("id", bet.id);
    await supabase.from("profiles").update({ token_balance: profile.token_balance + amount }).eq("id", user.id);
    await supabase.from("notifications").insert({ user_id: user.id, title: "Cashout successful", body: `+${amount} tokens` });
    await refresh(); load(); setLoading(false); toast.success(`Cashed out ${amount.toLocaleString()} tokens`);
  };

  const share = () => {
    navigator.clipboard.writeText(`${window.location.origin}/ticket/${bet.id} · Code ${bet.booking_code}`);
    toast.success("Booking link copied");
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <Card className="glass-gold p-8">
          <div className="text-center mb-6">
            <Crosshair className="h-10 w-10 text-primary mx-auto animate-glow-pulse" />
            <h1 className="gradient-gold-text text-2xl font-black mt-2">BET TICKET</h1>
            <p className="text-xs text-muted-foreground tracking-widest">LOMITA SHOOTERS LEAGUE</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Tracking ID</div><div className="font-mono text-gold">{bet.tracking_id}</div></div>
            <div><div className="text-xs text-muted-foreground">Booking Code</div><div className="font-mono text-gold text-lg font-bold">{bet.booking_code}</div></div>
            <div><div className="text-xs text-muted-foreground">Stake</div><div className="font-bold">{bet.stake.toLocaleString()} tokens</div></div>
            <div><div className="text-xs text-muted-foreground">Total Odds</div><div className="font-bold text-gold">{Number(bet.total_odds).toFixed(2)}</div></div>
            <div><div className="text-xs text-muted-foreground">Potential Payout</div><div className="font-bold text-gold">{Number(bet.potential_payout).toLocaleString()}</div></div>
            <div><div className="text-xs text-muted-foreground">Status</div><Badge variant={bet.status === "won" ? "default" : bet.status === "lost" ? "destructive" : "outline"}>{bet.status}</Badge></div>
          </div>
          <div className="border-t border-primary/30 my-4" />
          <h3 className="font-bold mb-2 text-sm">Selections</h3>
          <div className="space-y-2">
            {bet.bet_selections?.map((s: any) => (
              <div key={s.id} className="p-3 glass rounded text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold">{s.match?.home_team?.name ?? "?"} <span className="text-muted-foreground">vs</span> {s.match?.away_team?.name ?? "?"}</div>
                    <div className="text-xs text-muted-foreground">{s.match?.name}</div>
                    <div className="mt-1">Pick: <b>{s.selection_label}</b> @ <span className="text-gold">{Number(s.locked_odds).toFixed(2)}</span></div>
                    {s.match?.status === "live" && <div className="text-xs text-red-400 font-bold">LIVE {s.match.home_score}-{s.match.away_score}</div>}
                    {s.match?.status === "ended" && <div className="text-xs">Final: {s.match.home_score} - {s.match.away_score}</div>}
                  </div>
                  {s.odd?.is_winner === true && <Badge className="bg-emerald-600">WON</Badge>}
                  {s.odd?.is_winner === false && <Badge variant="destructive">LOST</Badge>}
                  {s.odd?.is_winner == null && s.match?.status !== "ended" && <Badge variant="outline">Pending</Badge>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-6 flex-wrap">
            <Button variant="outline" onClick={share} className="flex-1"><Copy className="h-4 w-4" />Share Booking Code</Button>
            {bet.status === "won" && bet.user_id === user?.id && (
              <Button onClick={cashout} disabled={loading} className="btn-luxury flex-1">Claim winnings</Button>
            )}
            {bet.status === "open" && bet.user_id === user?.id && (
              <div className="w-full text-xs text-center text-muted-foreground p-2 bg-secondary/40 rounded">
                Cashout is locked until the ticket settles. If it wins you'll claim the full payout; if it loses, the stake is forfeited.
              </div>
            )}
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-4">Virtual tokens only · No real money</p>
        </Card>
        <div className="text-center mt-4"><Link to="/dashboard" className="text-gold hover:underline text-sm">← Back to dashboard</Link></div>
      </div>
    </Layout>
  );
};
export default TicketSlip;
