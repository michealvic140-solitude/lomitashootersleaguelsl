import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Ticket, AlertTriangle } from "lucide-react";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const MAX_PAYOUT = 60_000_000;

export const BetSlipPanel = () => {
  const { selections, remove, clear, totalOdds } = useBetSlip();
  const { user, profile, refresh } = useAuth();
  const nav = useNavigate();
  const [stake, setStake] = useState("");
  const [loading, setLoading] = useState(false);

  const stakeNum = Math.max(0, parseInt(stake || "0", 10));
  const payout = Math.min(MAX_PAYOUT, Math.round(stakeNum * totalOdds));
  const exceedsCap = stakeNum * totalOdds > MAX_PAYOUT;

  const place = async () => {
    if (!user || !profile) { toast.error("Sign in to place bets"); nav("/login"); return; }
    if (profile.is_restricted) { toast.error("Your betting is restricted"); return; }
    if (profile.is_banned) { toast.error("Account banned"); return; }
    if (selections.length === 0) { toast.error("Add selections"); return; }
    if (stakeNum <= 0) { toast.error("Enter stake"); return; }
    if (stakeNum > profile.token_balance) { toast.error("Insufficient tokens"); return; }

    setLoading(true);
    // Check duplicate match bets
    const matchIds = selections.map((s) => s.match_id);
    const { data: existing } = await supabase
      .from("bet_selections")
      .select("match_id, bet:bets!inner(user_id,status)")
      .in("match_id", matchIds);
    const dup = (existing ?? []).find((r: any) => r.bet?.user_id === user.id && r.bet?.status === "open");
    if (dup) { toast.error("You already have an open bet on one of these matches"); setLoading(false); return; }

    const { data: bet, error } = await supabase.from("bets").insert({
      user_id: user.id,
      stake: stakeNum,
      total_odds: Number(totalOdds.toFixed(2)),
      potential_payout: payout,
    }).select().single();
    if (error || !bet) { toast.error(error?.message ?? "Failed"); setLoading(false); return; }

    const { error: e2 } = await supabase.from("bet_selections").insert(
      selections.map((s) => ({
        bet_id: bet.id, match_id: s.match_id, market_id: s.market_id,
        odd_id: s.odd_id, locked_odds: s.odds, selection_label: `${s.market_name}: ${s.selection_label}`,
      })),
    );
    if (e2) { toast.error(e2.message); setLoading(false); return; }

    // Deduct tokens
    await supabase.from("profiles").update({ token_balance: profile.token_balance - stakeNum }).eq("id", user.id);
    await supabase.from("notifications").insert({
      user_id: user.id, title: "Bet placed", body: `Booking code ${bet.booking_code} · stake ${stakeNum} tokens`,
      link: `/ticket/${bet.id}`,
    });
    await refresh();
    clear();
    setStake("");
    setLoading(false);
    toast.success("Bet placed!");
    nav(`/ticket/${bet.id}`);
  };

  return (
    <Card className="glass p-5 sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" />Bet Slip</h3>
        <Badge variant="outline" className="text-gold border-gold/40">{selections.length}</Badge>
      </div>
      {selections.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Click odds to add selections.</p>
      ) : (
        <>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {selections.map((s) => (
              <div key={s.odd_id} className="flex items-center justify-between gap-2 p-2 rounded bg-secondary/50 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.match_name}</div>
                  <div className="text-muted-foreground truncate">{s.market_name}: {s.selection_label}</div>
                </div>
                <span className="text-gold font-bold">{s.odds.toFixed(2)}</span>
                <button onClick={() => remove(s.odd_id)}><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total odds</span>
              <span className="text-gold font-bold">{totalOdds.toFixed(2)}</span>
            </div>
            <Input type="number" placeholder="Stake (tokens)" value={stake} onChange={(e) => setStake(e.target.value)} />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Potential payout</span>
              <span className="text-gold font-bold">{payout.toLocaleString()}</span>
            </div>
            {exceedsCap && (
              <div className="flex items-start gap-2 text-xs text-destructive p-2 bg-destructive/10 rounded">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Max payout capped at 60,000,000 tokens. Anything above is forfeited.</span>
              </div>
            )}
            <Button onClick={place} disabled={loading} className="btn-luxury w-full font-bold">
              {loading ? "Placing..." : "PLACE BET"}
            </Button>
            <Button onClick={clear} variant="ghost" size="sm" className="w-full">Clear slip</Button>
          </div>
        </>
      )}
    </Card>
  );
};
