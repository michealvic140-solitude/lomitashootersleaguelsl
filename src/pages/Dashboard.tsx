import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Ticket, Gift, Copy, Upload, History, Banknote } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, profile, loading, refresh } = useAuth();
  const [bets, setBets] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [stake, setStake] = useState("");
  const [previewBet, setPreviewBet] = useState<any | null>(null);
  const [reqAmount, setReqAmount] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [reqFile, setReqFile] = useState<File | null>(null);
  const [wAmount, setWAmount] = useState("");
  const [wIgn, setWIgn] = useState("");
  const [wGang, setWGang] = useState("");
  const [wTicket, setWTicket] = useState("");
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadBets = () => supabase.from("bets").select("*,bet_selections(*)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setBets(data ?? []));
    const loadTxs = () => supabase.from("token_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setTxs(data ?? []));
    loadBets(); loadTxs();
    const loadW = () => supabase.from("withdrawal_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20).then(({ data }) => setWithdrawals(data ?? []));
    loadW();
    const ch = supabase.channel(`dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${user.id}` }, loadBets)
      .on("postgres_changes", { event: "*", schema: "public", table: "token_transactions", filter: `user_id=eq.${user.id}` }, loadTxs)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${user.id}` }, loadW)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
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

  const submitTokenRequest = async () => {
    const amt = parseInt(reqAmount || "0", 10);
    if (!amt || amt <= 0) return toast.error("Enter amount");
    let proof_image_url: string | null = null;
    if (reqFile && user) {
      const path = `${user.id}/${Date.now()}_${reqFile.name}`;
      const { error } = await supabase.storage.from("token-proofs").upload(path, reqFile);
      if (error) return toast.error(error.message);
      proof_image_url = supabase.storage.from("token-proofs").getPublicUrl(path).data.publicUrl;
    }
    if (!user) return;
    const { error } = await supabase.from("token_requests").insert({ user_id: user.id, amount: amt, note: reqNote || null, proof_image_url });
    if (error) return toast.error(error.message);
    toast.success("Token request submitted");
    setReqAmount(""); setReqNote(""); setReqFile(null);
  };

  const submitWithdrawal = async () => {
    if (!user || !profile) return;
    const amt = parseInt(wAmount || "0", 10);
    if (!wIgn.trim()) return toast.error("In-game name required");
    if (!wGang.trim()) return toast.error("Gang name required");
    if (!amt || amt <= 0) return toast.error("Enter amount");
    if (amt > profile.token_balance) return toast.error("Amount exceeds balance");
    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id, in_game_name: wIgn, gang_name: wGang, amount: amt,
      ticket_tracking_id: wTicket || null,
    });
    if (error) return toast.error(error.message);
    // immediately deduct
    await supabase.from("profiles").update({ token_balance: profile.token_balance - amt }).eq("id", user.id);
    await refresh();
    setWAmount(""); setWIgn(""); setWGang(""); setWTicket("");
    setShowSuccess(true);
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
          <h3 className="font-bold mb-3 flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Request token top-up</h3>
          <div className="grid md:grid-cols-4 gap-2">
            <Input placeholder="Amount" type="number" value={reqAmount} onChange={(e) => setReqAmount(e.target.value)} />
            <Input placeholder="Note (optional)" value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
            <Input type="file" accept="image/*" onChange={(e) => setReqFile(e.target.files?.[0] ?? null)} />
            <Button onClick={submitTokenRequest} className="btn-luxury">Submit request</Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Admins will review your request and credit your account if approved.</p>
        </Card>

        <Card className="glass-gold p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2 gradient-gold-text"><Banknote className="h-4 w-4" />Withdraw Tokens</h3>
          <div className="grid md:grid-cols-2 gap-2">
            <Input placeholder="In-game Name *" value={wIgn} onChange={(e) => setWIgn(e.target.value)} />
            <Input placeholder="In-game Gang Name *" value={wGang} onChange={(e) => setWGang(e.target.value)} />
            <Input placeholder={`Withdrawal Amount (max ${profile.token_balance.toLocaleString()})`} type="number" value={wAmount} onChange={(e) => setWAmount(e.target.value)} />
            <Input placeholder="Bet Ticket / Tracking ID (optional)" value={wTicket} onChange={(e) => setWTicket(e.target.value)} />
          </div>
          <Button onClick={submitWithdrawal} className="btn-luxury mt-3 w-full md:w-auto">Submit Withdrawal Request</Button>
          {withdrawals.length > 0 && (
            <div className="mt-4 space-y-1">
              <div className="text-xs text-muted-foreground uppercase">Your withdrawal requests</div>
              {withdrawals.map((w) => (
                <div key={w.id} className="flex justify-between items-center text-xs glass p-2 rounded">
                  <span>{new Date(w.created_at).toLocaleString()} · {w.in_game_name} · {Number(w.amount).toLocaleString()}</span>
                  <Badge variant={w.status === "approved" ? "default" : w.status === "declined" ? "destructive" : "outline"}>{w.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {showSuccess && (
          <div onClick={() => setShowSuccess(false)} className="fixed inset-0 z-[80] bg-black/70 backdrop-blur flex items-center justify-center p-4">
            <div onClick={(e) => e.stopPropagation()} className="glass-gold max-w-md w-full p-6 rounded-2xl text-center space-y-3">
              <Banknote className="h-12 w-12 mx-auto text-gold" />
              <h3 className="text-xl font-black gradient-gold-text">Request submitted</h3>
              <p className="text-sm text-muted-foreground">
                Your withdrawal request has been sent and you'll receive it on or before 24hrs after the admin approves it.
                Approval withdrawal request is carefully tracked by our support team to avoid inconvenience.
                Stay tuned for notifications from the admin on how to cash out your withdrawal after it's been approved.
              </p>
              <Button onClick={() => setShowSuccess(false)} className="btn-luxury w-full">OK</Button>
            </div>
          </div>
        )}

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

        <Card className="glass p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><History className="h-4 w-4 text-primary" />Transaction history</h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {txs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No transactions yet.</p>}
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 glass rounded text-xs">
                <div>
                  <div className="font-bold">{t.description ?? t.kind}</div>
                  <div className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${Number(t.amount) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {Number(t.amount) > 0 ? "+" : ""}{Number(t.amount).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">bal {Number(t.balance_after).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
export default Dashboard;
