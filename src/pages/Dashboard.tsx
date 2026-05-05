import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Ticket, Gift, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, profile, loading, refresh } = useAuth();
  const [bets, setBets] = useState<any[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [stake, setStake] = useState("");
  const [previewBet, setPreviewBet] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("bets").select("*,bet_selections(*)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setBets(data ?? []));
  }, [user]);

  if (loading) return <Layout><div className="container py-12">Loading...</div></Layout>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  const open = bets.filter((b) => b.status === "open");
  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");

  const redeem = async () => {
    if (!promoCode.trim()) return;
    const { data: promo } = await supabase.from("promo_codes").select("*").eq("code", promoCode.trim().toUpperCase()).maybeSingle();
    if (!promo) { toast.error("Invalid code"); return; }
    if (!promo.is_active) { toast.error("Code inactive"); return; }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) { toast.error("Code expired"); return; }
    if (promo.used_count >= promo.usage_limit) { toast.error("Code fully redeemed"); return; }
    const { data: existing } = await supabase.from("promo_redemptions").select("id").eq("promo_id", promo.id).eq("user_id", user.id).maybeSingle();
    if (existing) { toast.error("Already redeemed"); return; }
    const { error } = await supabase.from("promo_redemptions").insert({ promo_id: promo.id, user_id: user.id, amount: promo.amount });
    if (error) { toast.error(error.message); return; }
    await supabase.from("promo_codes").update({ used_count: promo.used_count + 1 }).eq("id", promo.id);
    await supabase.from("profiles").update({ token_balance: profile.token_balance + Number(promo.amount) }).eq("id", user.id);
    await supabase.from("notifications").insert({ user_id: user.id, title: "Promo redeemed", body: `+${promo.amount} tokens` });
    await refresh();
    setPromoCode("");
    toast.success(`+${promo.amount} tokens!`);
  };

  const lookup = async () => {
    const code = bookingCode.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase.from("bets").select("*,bet_selections(*,match:matches(name,status))").eq("booking_code", code).maybeSingle();
    if (!data) { toast.error("Booking code not found"); setPreviewBet(null); return; }
    setPreviewBet(data);
  };

  const cloneBet = async () => {
    if (!previewBet || !user || !profile) return;
    const stakeNum = Math.max(0, parseInt(stake || "0", 10));
    if (stakeNum <= 0) return toast.error("Enter stake");
    if (stakeNum > profile.token_balance) return toast.error("Insufficient tokens");
    const odds = Number(previewBet.total_odds);
    const payout = Math.min(60_000_000, Math.round(stakeNum * odds));
    const { data: bet, error } = await supabase.from("bets").insert({
      user_id: user.id, stake: stakeNum, total_odds: odds, potential_payout: payout,
    }).select().single();
    if (error || !bet) return toast.error(error?.message ?? "Failed");
    await supabase.from("bet_selections").insert(
      previewBet.bet_selections.map((s: any) => ({
        bet_id: bet.id, match_id: s.match_id, market_id: s.market_id,
        odd_id: s.odd_id, locked_odds: s.locked_odds, selection_label: s.selection_label,
      })),
    );
    await supabase.from("profiles").update({ token_balance: profile.token_balance - stakeNum }).eq("id", user.id);
    await refresh();
    toast.success(`Bet cloned! Code ${bet.booking_code}`);
    setBookingCode(""); setStake(""); setPreviewBet(null);
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="glass-gold p-5">
            <div className="text-xs text-muted-foreground uppercase">Tokens</div>
            <div className="text-3xl font-black gradient-gold-text flex items-center gap-2 mt-1"><Coins className="h-6 w-6" />{profile.token_balance.toLocaleString()}</div>
          </Card>
          <Card className="glass p-5">
            <div className="text-xs text-muted-foreground uppercase">Open Bets</div>
            <div className="text-3xl font-black mt-1">{open.length}</div>
          </Card>
          <Card className="glass p-5">
            <div className="text-xs text-muted-foreground uppercase">Won</div>
            <div className="text-3xl font-black text-green-400 mt-1">{won.length}</div>
          </Card>
          <Card className="glass p-5">
            <div className="text-xs text-muted-foreground uppercase">Lost</div>
            <div className="text-3xl font-black text-red-400 mt-1">{lost.length}</div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="glass p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Gift className="h-4 w-4 text-primary" />Redeem Promo Code</h3>
            <div className="flex gap-2">
              <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" />
              <Button onClick={redeem} className="btn-luxury">Redeem</Button>
            </div>
          </Card>
          <Card className="glass p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Copy className="h-4 w-4 text-primary" />Play a friend's booking code</h3>
            <div className="flex gap-2">
              <Input value={bookingCode} onChange={(e) => setBookingCode(e.target.value.toUpperCase())} placeholder="BOOKING CODE" />
              <Button onClick={lookup} variant="outline">Lookup</Button>
            </div>
            {previewBet && (
              <div className="mt-3 p-3 bg-secondary/40 rounded text-xs space-y-1">
                <div className="font-bold text-gold">Odds {Number(previewBet.total_odds).toFixed(2)} · {previewBet.bet_selections.length} selection(s)</div>
                {previewBet.bet_selections.map((s: any) => (
                  <div key={s.id}>{s.match?.name} — {s.selection_label} @ {Number(s.locked_odds).toFixed(2)}</div>
                ))}
                <div className="flex gap-2 mt-2">
                  <Input value={stake} onChange={(e) => setStake(e.target.value)} placeholder="Your stake" type="number" />
                  <Button onClick={cloneBet} className="btn-luxury">Place</Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card className="glass p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" />My Bets</h3>
          <div className="space-y-2">
            {bets.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No bets yet.</p>}
            {bets.map((b) => (
              <Link key={b.id} to={`/ticket/${b.id}`}>
                <div className="flex items-center justify-between p-3 glass rounded hover:border-primary/50">
                  <div>
                    <div className="text-xs text-muted-foreground font-mono">{b.tracking_id}</div>
                    <div className="text-sm">{b.bet_selections?.length ?? 0} selection(s) · stake {b.stake} · odds {Number(b.total_odds).toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant={b.status === "won" ? "default" : b.status === "lost" ? "destructive" : "outline"}>
                      {b.status}
                    </Badge>
                    <div className="text-xs text-gold mt-1">{Number(b.potential_payout).toLocaleString()} potential</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
export default Dashboard;
