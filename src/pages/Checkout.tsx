import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X, AlertTriangle } from "lucide-react";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_PAYOUT = 60_000_000;
const QUICK = [100, 200, 500, 1000, 5000];

const Checkout = () => {
  const { selections, remove, clear, totalOdds } = useBetSlip();
  const { user, profile, refresh } = useAuth();
  const nav = useNavigate();
  const [stake, setStake] = useState("");
  const [loading, setLoading] = useState(false);

  const stakeNum = Math.max(0, parseInt(stake || "0", 10));
  const payout = Math.min(MAX_PAYOUT, Math.round(stakeNum * totalOdds));
  const exceeds = stakeNum * totalOdds > MAX_PAYOUT;

  const place = async (book = false) => {
    if (!user || !profile) return nav("/login");
    if (profile.is_restricted) return toast.error("Your betting is restricted");
    if (profile.is_banned) return toast.error("Account banned");
    if (selections.length === 0) return toast.error("Add selections");
    if (!book && stakeNum <= 0) return toast.error("Enter a stake");
    if (!book && stakeNum > profile.token_balance) return toast.error("Insufficient tokens");
    setLoading(true);

    const finalStake = book ? 0 : stakeNum;
    const { data: bet, error } = await supabase.from("bets").insert({
      user_id: user.id, stake: finalStake,
      total_odds: Number(totalOdds.toFixed(2)),
      potential_payout: book ? 0 : payout,
      status: book ? "open" : "open",
    }).select().single();
    if (error || !bet) { toast.error(error?.message ?? "Failed"); setLoading(false); return; }
    await supabase.from("bet_selections").insert(selections.map((s) => ({
      bet_id: bet.id, match_id: s.match_id, market_id: s.market_id, odd_id: s.odd_id,
      locked_odds: s.odds, selection_label: `${s.market_name}: ${s.selection_label}`,
    })));
    if (!book) await supabase.from("profiles").update({ token_balance: profile.token_balance - finalStake }).eq("id", user.id);
    await supabase.from("notifications").insert({
      user_id: user.id, title: book ? "Booking saved" : "Bet placed",
      body: `Code ${bet.booking_code}`, link: `/ticket/${bet.id}`,
    });
    await refresh(); clear(); setStake(""); setLoading(false);
    toast.success(book ? "Booked! Share your code." : "Bet placed!");
    nav(`/ticket/${bet.id}`);
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-6">
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" />Back</Link>
          <Badge variant="outline" className="text-gold border-gold/40">{selections.length} Selections</Badge>
        </div>

        {selections.length === 0 ? (
          <Card className="glass p-12 text-center text-muted-foreground">
            Your bet slip is empty. Pick odds from the homepage.
            <div className="mt-4"><Link to="/"><Button className="btn-luxury">Browse matches</Button></Link></div>
          </Card>
        ) : (
          <Card className="glass p-4 space-y-3">
            {selections.map((s) => (
              <div key={s.odd_id} className="glass p-3 rounded">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{s.match_name}</div>
                    <div className="text-xs text-muted-foreground">{s.market_name}</div>
                    <div className="text-xs mt-1"><span className="text-foreground">{s.selection_label}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-gold font-bold">{s.odds.toFixed(2)}</div>
                    <button onClick={() => remove(s.odd_id)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-primary/20 pt-3 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Odds</span>
                <span className="text-gold font-bold text-lg">{totalOdds.toFixed(2)}</span>
              </div>
              <Input type="number" placeholder="Enter stake (tokens)" value={stake} onChange={(e) => setStake(e.target.value)} className="text-lg" />
              <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <Button key={q} size="sm" variant="outline" onClick={() => setStake(String(q))}>{q}</Button>
                ))}
                <Button size="sm" variant="outline" onClick={() => setStake("")}>Clear</Button>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Stake</span><span className="font-bold">{stakeNum.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Potential Win</span><span className="text-gold font-bold text-lg">{payout.toLocaleString()}</span></div>
              {exceeds && (
                <div className="flex items-start gap-2 text-xs text-destructive p-2 bg-destructive/10 rounded">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Max payout capped at 60,000,000 tokens.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={loading} onClick={() => place(true)}>Book a bet</Button>
                <Button className="btn-luxury" disabled={loading} onClick={() => place(false)}>Place bet</Button>
              </div>
              <Button onClick={clear} variant="ghost" size="sm" className="w-full">Clear betslip</Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};
export default Checkout;