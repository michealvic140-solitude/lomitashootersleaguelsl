import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Users, Crosshair, Megaphone, Gift, Settings, FileText, Coins, Calculator, Trash2, Lock, AlertTriangle, CalendarClock, Sparkles, ListChecks, Send, LifeBuoy, Trophy, Bot } from "lucide-react";
import { useAuth, AppRole, ROLE_COLORS, ROLE_LABELS } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmModal";

const ROLES: AppRole[] = ["viewer", "shooter", "gang_leader", "registered", "moderator", "admin"];

const UserManagement = () => {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<any[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "banned" | "muted" | "restricted" | "recent" | "old">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [detail, setDetail] = useState<any | null>(null);
  const [detailBets, setDetailBets] = useState<any[]>([]);
  const [detailTx, setDetailTx] = useState<any[]>([]);
  const [detailLogs, setDetailLogs] = useState<any[]>([]);

  const load = async () => {
    const { data: ps } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    setUsers(ps ?? []);
    const ids = (ps ?? []).map((p: any) => p.id);
    if (!ids.length) return;
    const { data: rs } = await supabase.from("user_roles").select("user_id,role").in("user_id", ids);
    const map: Record<string, AppRole[]> = {};
    (rs ?? []).forEach((r: any) => { (map[r.user_id] ??= []).push(r.role); });
    setRolesByUser(map);
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (u: any) => {
    setDetail(u);
    const [b, t, l] = await Promise.all([
      supabase.from("bets").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("token_transactions").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("audit_logs").select("*").eq("target_id", u.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setDetailBets(b.data ?? []); setDetailTx(t.data ?? []); setDetailLogs(l.data ?? []);
  };

  const toggleRole = async (uid: string, role: AppRole) => {
    const has = (rolesByUser[uid] ?? []).includes(role);
    if (has) await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    else await supabase.from("user_roles").insert({ user_id: uid, role, assigned_by: me?.id });
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: has ? "role_remove" : "role_assign", target_type: "user", target_id: uid, metadata: { role } });
    await load();
  };

  const setFlag = async (uid: string, field: string, value: boolean, reasonField?: string) => {
    let reason = "";
    if (value) {
      const r = await confirm({ title: `Confirm ${field.replace("is_","")}`, destructive: true, reasonRequired: true, confirmLabel: "Apply" });
      if (!r.confirmed) return;
      reason = r.reason ?? "";
    } else {
      const r = await confirm({ title: `Lift ${field.replace("is_","")}?`, confirmLabel: "Lift" });
      if (!r.confirmed) return;
    }
    const update: any = { [field]: value };
    if (reasonField) update[reasonField] = reason;
    await supabase.from("profiles").update(update).eq("id", uid);
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: `${field}_${value}`, target_type: "user", target_id: uid, metadata: { reason } });
    await supabase.from("notifications").insert({ user_id: uid, title: `Account ${field}`, body: reason || `Status updated` });
    await load();
  };

  const giveTokens = async (uid: string, current: number) => {
    const r = await confirm({
      title: "Adjust tokens", description: "Use negative to remove.",
      inputLabel: "Amount", inputType: "number", inputPlaceholder: "e.g. 1000 or -500",
      reasonRequired: true, confirmLabel: "Apply",
    });
    if (!r.confirmed) return;
    const v = parseInt(r.value || "0", 10);
    if (!v) return;
    const reason = r.reason ?? "";
    await supabase.from("profiles").update({ token_balance: Math.max(0, current + v) }).eq("id", uid);
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: "tokens_adjust", target_type: "user", target_id: uid, metadata: { amount: v, reason } });
    await supabase.from("notifications").insert({ user_id: uid, title: "Token balance updated", body: `${v > 0 ? "+" : ""}${v} · ${reason}` });
    await load();
  };

  let filtered = users.filter((u) => !search || (u.full_name + u.email + (u.gang_name ?? "")).toLowerCase().includes(search.toLowerCase()));
  if (filter === "banned") filtered = filtered.filter((u) => u.is_banned);
  if (filter === "muted") filtered = filtered.filter((u) => u.is_muted);
  if (filter === "restricted") filtered = filtered.filter((u) => u.is_restricted);
  if (filter === "recent") filtered = [...filtered].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  if (filter === "old") filtered = [...filtered].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  if (roleFilter !== "all") filtered = filtered.filter((u) => (rolesByUser[u.id] ?? []).includes(roleFilter as AppRole));

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-2">
        <Input placeholder="Search name, email, gang..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
            <SelectItem value="muted">Muted</SelectItem>
            <SelectItem value="restricted">Restricted</SelectItem>
            <SelectItem value="recent">Newest first</SelectItem>
            <SelectItem value="old">Oldest first</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any role</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="text-xs text-muted-foreground">{filtered.length} of {users.length} users</div>
      {filtered.map((u) => (
        <Card key={u.id} className="glass p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <button onClick={() => openDetail(u)} className="font-bold text-left hover:text-gold">{u.full_name}</button>
              <div className="text-xs text-muted-foreground">{u.email} {u.gang_name && <>· {u.gang_name} ({u.gang_type})</>}</div>
              <div className="text-xs text-gold mt-1">Tokens: {u.token_balance.toLocaleString()}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(rolesByUser[u.id] ?? []).map((r) => (<Badge key={r} variant="outline" className={ROLE_COLORS[r]}>{ROLE_LABELS[r]}</Badge>))}
                {u.is_banned && <Badge variant="destructive">BANNED</Badge>}
                {u.is_muted && <Badge variant="destructive">MUTED</Badge>}
                {u.is_restricted && <Badge variant="destructive">RESTRICTED</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {ROLES.map((r) => (
                <Button key={r} size="sm" variant={(rolesByUser[u.id] ?? []).includes(r) ? "default" : "outline"} onClick={() => toggleRole(u.id, r)}>{r}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => giveTokens(u.id, u.token_balance)}>± Tokens</Button>
            <Button size="sm" variant="outline" onClick={() => setFlag(u.id, "is_banned", !u.is_banned, "ban_reason")}>{u.is_banned ? "Unban" : "Ban"}</Button>
            <Button size="sm" variant="outline" onClick={() => setFlag(u.id, "is_muted", !u.is_muted, "mute_reason")}>{u.is_muted ? "Unmute" : "Mute"}</Button>
            <Button size="sm" variant="outline" onClick={() => setFlag(u.id, "is_restricted", !u.is_restricted, "restrict_reason")}>{u.is_restricted ? "Unrestrict" : "Restrict bets"}</Button>
            <Button size="sm" variant="outline" onClick={() => openDetail(u)}>View profile</Button>
          </div>
        </Card>
      ))}
      {detail && (
        <div onClick={() => setDetail(null)} className="fixed inset-0 z-[80] bg-black/70 backdrop-blur flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="glass-gold max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 rounded-2xl space-y-3">
            <h3 className="text-2xl font-black gradient-gold-text">{detail.full_name}</h3>
            <div className="text-xs text-muted-foreground">{detail.email} · {detail.country ?? ""} · {detail.discord_username ?? ""} · {detail.phone ?? ""}</div>
            <div className="text-xs">Server: {detail.server} · Gang: {detail.gang_name ?? "—"} ({detail.gang_type ?? "—"})</div>
            <div className="text-sm text-gold">Tokens: {detail.token_balance.toLocaleString()}</div>
            <div>
              <h4 className="font-bold text-sm mt-3">Bets ({detailBets.length})</h4>
              {detailBets.map((b) => <div key={b.id} className="text-xs flex justify-between"><span className="font-mono">{b.tracking_id}</span><span>{b.status} · stake {b.stake} · payout {b.potential_payout}</span></div>)}
            </div>
            <div>
              <h4 className="font-bold text-sm mt-3">Transactions ({detailTx.length})</h4>
              {detailTx.map((t) => <div key={t.id} className="text-xs flex justify-between"><span>{new Date(t.created_at).toLocaleString()} · {t.description ?? t.kind}</span><span className={Number(t.amount)>0?"text-emerald-400":"text-red-400"}>{Number(t.amount)>0?"+":""}{t.amount}</span></div>)}
            </div>
            <div>
              <h4 className="font-bold text-sm mt-3">Audit ({detailLogs.length})</h4>
              {detailLogs.map((l) => <div key={l.id} className="text-xs"><b className="text-gold">{l.action}</b> · {new Date(l.created_at).toLocaleString()}</div>)}
            </div>
            <Button onClick={() => setDetail(null)} className="btn-luxury w-full">Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const MatchBuilder = () => {
  const confirm = useConfirm();
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [name, setName] = useState(""); const [home, setHome] = useState(""); const [away, setAway] = useState("");
  const [loc, setLoc] = useState(""); const [start, setStart] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newTeamGang, setNewTeamGang] = useState<"G" | "F" | "">("");
  const [newTeamLogo, setNewTeamLogo] = useState<File | null>(null);

  const load = async () => {
    const { data: t } = await supabase.from("teams").select("*").order("created_at", { ascending: false });
    setTeams(t ?? []);
    const { data: m } = await supabase.from("matches").select("*,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)").order("start_time", { ascending: false }).limit(50);
    setMatches(m ?? []);
  };
  useEffect(() => { load(); }, []);

  // realtime so admin sees live state
  useEffect(() => {
    const ch = supabase.channel("admin-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "odds" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const createTeam = async () => {
    if (!newTeam.trim()) return;
    let logo_url: string | null = null;
    if (newTeamLogo) {
      const path = `teams/${Date.now()}_${newTeamLogo.name}`;
      const { error } = await supabase.storage.from("team-logos").upload(path, newTeamLogo);
      if (error) return toast.error(error.message);
      logo_url = supabase.storage.from("team-logos").getPublicUrl(path).data.publicUrl;
    }
    await supabase.from("teams").insert({ name: newTeam, gang_type: newTeamGang || null, logo_url });
    setNewTeam(""); setNewTeamGang(""); setNewTeamLogo(null); await load(); toast.success("Team added");
  };
  const createMatch = async () => {
    if (!name || !home || !away || !start) return toast.error("Fill all fields");
    await supabase.from("matches").insert({ name, home_team_id: home, away_team_id: away, location: loc, start_time: new Date(start).toISOString() });
    setName(""); setLoc(""); setStart(""); await load(); toast.success("Match created");
  };
  const updateScore = async (id: string, h: number, a: number) => {
    await supabase.from("matches").update({ home_score: h, away_score: a }).eq("id", id); await load();
  };
  const setLive = async (id: string) => {
    await supabase.from("matches").update({ status: "live" as const }).eq("id", id); await load();
  };
  const endMatch = async (m: any) => {
    const r = await confirm({ title: "End match?", description: "Open winning bets will pay out, losing bets will lose.", destructive: true, confirmLabel: "End match" });
    if (!r.confirmed) return;
    const winner = m.home_score > m.away_score ? m.home_team_id : m.away_score > m.home_score ? m.away_team_id : null;
    await supabase.from("matches").update({ status: "ended", winner_team_id: winner }).eq("id", m.id);
    // Settle bets touching this match
    const { data: sels } = await supabase.from("bet_selections").select("bet_id, market_id, odd_id").eq("match_id", m.id);
    const betIds = [...new Set((sels ?? []).map((s: any) => s.bet_id))];
    for (const bid of betIds) {
      const { data: b } = await supabase.from("bets").select("*,bet_selections(*,odd:odds(is_winner))").eq("id", bid).single();
      if (!b || b.status !== "open") continue;
      const allWon = b.bet_selections.every((s: any) => s.odd?.is_winner === true);
      const anyLost = b.bet_selections.some((s: any) => s.odd?.is_winner === false);
      if (anyLost) {
        await supabase.from("bets").update({ status: "lost", settled_at: new Date().toISOString() }).eq("id", bid);
        await supabase.from("notifications").insert({ user_id: b.user_id, title: "Bet lost", body: `Ticket ${b.tracking_id}` });
      } else if (allWon) {
        await supabase.from("bets").update({ status: "won", settled_at: new Date().toISOString() }).eq("id", bid);
        const { data: prof } = await supabase.from("profiles").select("token_balance").eq("id", b.user_id).single();
        await supabase.from("profiles").update({ token_balance: (prof?.token_balance ?? 0) + Number(b.potential_payout) }).eq("id", b.user_id);
        await supabase.from("notifications").insert({ user_id: b.user_id, title: "Bet won! 🏆", body: `+${b.potential_payout} tokens` });
      }
    }
    await load(); toast.success("Match ended & bets settled");
  };

  const deleteMatch = async (m: any) => {
    const r = await confirm({ title: "Delete match?", description: "Bet history is preserved; the match itself will be removed from listings.", destructive: true, reasonRequired: false, confirmLabel: "Delete" });
    if (!r.confirmed) return;
    await supabase.from("matches").delete().eq("id", m.id);
    toast.success("Match deleted"); load();
  };

  const toggleAllOdds = async (matchId: string, open: boolean) => {
    const { data: mks } = await supabase.from("markets").select("id").eq("match_id", matchId);
    if (!mks?.length) return;
    await supabase.from("markets").update({ is_open: open }).in("id", mks.map((x: any) => x.id));
    toast.success(open ? "Odds enabled" : "Odds disabled");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="glass p-4 space-y-2">
        <h3 className="font-bold">Add team</h3>
        <div className="grid md:grid-cols-4 gap-2">
          <Input placeholder="Team name" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} />
          <Select value={newTeamGang} onValueChange={(v) => setNewTeamGang(v as any)}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent><SelectItem value="G">G - Gang</SelectItem><SelectItem value="F">F - Faction</SelectItem></SelectContent>
          </Select>
          <Input type="file" accept="image/*" onChange={(e) => setNewTeamLogo(e.target.files?.[0] ?? null)} />
          <Button onClick={createTeam} className="btn-luxury">Add team</Button>
        </div>
        <div className="grid md:grid-cols-3 gap-2 mt-3">
          {teams.map((t) => (
            <div key={t.id} className="glass p-2 rounded flex items-center gap-2">
              {t.logo_url ? <img src={t.logo_url} className="h-10 w-10 rounded-full object-cover" alt="" /> : <Crosshair className="h-6 w-6 text-primary" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{t.name} {t.gang_type && <span className="text-xs text-gold">({t.gang_type})</span>}</div>
                <PlayerEditor teamId={t.id} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="glass p-4 space-y-2">
        <h3 className="font-bold">Create match</h3>
        <Input placeholder="Match name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid md:grid-cols-2 gap-2">
          <Select value={home} onValueChange={setHome}><SelectTrigger><SelectValue placeholder="Home team" /></SelectTrigger><SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
          <Select value={away} onValueChange={setAway}><SelectTrigger><SelectValue placeholder="Away team" /></SelectTrigger><SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <Input placeholder="Location" value={loc} onChange={(e) => setLoc(e.target.value)} />
        <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <Button onClick={createMatch} className="btn-luxury">Create</Button>
      </Card>
      <div className="space-y-2">
        {matches.map((m) => (
          <Card key={m.id} className="glass p-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <div className="font-bold">{m.home_team?.name} vs {m.away_team?.name}</div>
                <div className="text-xs text-muted-foreground">{new Date(m.start_time).toLocaleString()} · {m.status}</div>
              </div>
              <div className="flex gap-2 items-center">
                <Input type="number" defaultValue={m.home_score} className="w-16" onBlur={(e) => updateScore(m.id, parseInt(e.target.value) || 0, m.away_score)} />
                <span>-</span>
                <Input type="number" defaultValue={m.away_score} className="w-16" onBlur={(e) => updateScore(m.id, m.home_score, parseInt(e.target.value) || 0)} />
                {m.status === "scheduled" && <Button size="sm" onClick={() => setLive(m.id)}>Set Live</Button>}
                {m.status !== "ended" && <Button size="sm" variant="destructive" onClick={() => endMatch(m)}>End</Button>}
                <Button size="sm" variant="outline" onClick={() => toggleAllOdds(m.id, true)}>Enable odds</Button>
                <Button size="sm" variant="outline" onClick={() => toggleAllOdds(m.id, false)}><Lock className="h-3 w-3 mr-1" />Disable odds</Button>
                {m.status === "ended" && <Button size="sm" variant="destructive" onClick={() => deleteMatch(m)}><Trash2 className="h-3 w-3" /></Button>}
                <MarketsEditor matchId={m.id} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const MarketsEditor = ({ matchId }: { matchId: string }) => {
  const [open, setOpen] = useState(false);
  const [markets, setMarkets] = useState<any[]>([]);
  const [name, setName] = useState("");
  const load = () => supabase.from("markets").select("*,odds(*)").eq("match_id", matchId).then(({ data }) => setMarkets(data ?? []));
  useEffect(() => { if (open) load(); }, [open, matchId]);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Markets</Button>;
  return (
    <div className="w-full mt-3 p-3 glass rounded space-y-2">
      <div className="flex gap-2">
        <Input placeholder="Market name (e.g. Match Winner)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={async () => { if (name) { await supabase.from("markets").insert({ match_id: matchId, name }); setName(""); load(); } }} size="sm">+ Market</Button>
      </div>
      {markets.map((mk) => (
        <div key={mk.id} className="p-2 bg-secondary/30 rounded">
          <div className="font-bold text-sm">{mk.name}</div>
          <div className="space-y-1 mt-2">
            {mk.odds?.map((o: any) => (
              <div key={o.id} className="flex gap-1 items-center text-xs">
                <span className="flex-1">{o.label}</span>
                <Input type="number" step="0.01" defaultValue={o.value} className="w-20 h-7" onBlur={(e) => supabase.from("odds").update({ value: parseFloat(e.target.value) }).eq("id", o.id).then(load)} />
                <Button size="sm" variant={o.is_winner === true ? "default" : "outline"} onClick={() => supabase.from("odds").update({ is_winner: true }).eq("id", o.id).then(load)}>Win</Button>
                <Button size="sm" variant={o.is_winner === false ? "destructive" : "outline"} onClick={() => supabase.from("odds").update({ is_winner: false }).eq("id", o.id).then(load)}>Lose</Button>
              </div>
            ))}
            <AddOdd marketId={mk.id} onDone={load} />
          </div>
        </div>
      ))}
    </div>
  );
};

const AddOdd = ({ marketId, onDone }: { marketId: string; onDone: () => void }) => {
  const [l, setL] = useState(""); const [v, setV] = useState("");
  return (
    <div className="flex gap-1 mt-1">
      <Input placeholder="Label" value={l} onChange={(e) => setL(e.target.value)} className="h-7 text-xs" />
      <Input placeholder="Odds" type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)} className="h-7 text-xs w-20" />
      <Button size="sm" onClick={async () => { if (l && v) { await supabase.from("odds").insert({ market_id: marketId, label: l, value: parseFloat(v) }); setL(""); setV(""); onDone(); } }}>+</Button>
    </div>
  );
};

const PlayerEditor = ({ teamId }: { teamId: string }) => {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [name, setName] = useState(""); const [pos, setPos] = useState(""); const [sub, setSub] = useState(false);
  const load = () => supabase.from("players").select("*").eq("team_id", teamId).then(({ data }) => setPlayers(data ?? []));
  useEffect(() => { if (open) load(); }, [open, teamId]);
  if (!open) return <button className="text-[10px] text-gold underline" onClick={() => setOpen(true)}>Manage squad</button>;
  return (
    <div className="mt-1 space-y-1">
      {players.map((p) => (
        <div key={p.id} className="flex items-center justify-between text-[11px]">
          <span>{p.name}{p.position && ` · ${p.position}`}{p.is_substitute && " (sub)"}</span>
          <button className="text-destructive" onClick={async () => { await supabase.from("players").delete().eq("id", p.id); load(); }}>×</button>
        </div>
      ))}
      <div className="flex gap-1">
        <Input className="h-6 text-[11px]" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="h-6 text-[11px] w-20" placeholder="Pos" value={pos} onChange={(e) => setPos(e.target.value)} />
        <label className="text-[10px] flex items-center gap-1"><input type="checkbox" checked={sub} onChange={(e) => setSub(e.target.checked)} />sub</label>
        <Button size="sm" className="h-6 text-[10px]" onClick={async () => { if (name) { await supabase.from("players").insert({ team_id: teamId, name, position: pos || null, is_substitute: sub }); setName(""); setPos(""); setSub(false); load(); } }}>+</Button>
      </div>
    </div>
  );
};

const Promos = () => {
  const [items, setItems] = useState<any[]>([]);
  const [code, setCode] = useState(""); const [amount, setAmount] = useState(""); const [limit, setLimit] = useState("1");
  const load = () => supabase.from("promo_codes").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!code || !amount) return;
    await supabase.from("promo_codes").insert({ code: code.toUpperCase(), amount: parseInt(amount), usage_limit: parseInt(limit) });
    setCode(""); setAmount(""); load();
  };
  return (
    <div className="space-y-3">
      <Card className="glass p-4 grid md:grid-cols-4 gap-2">
        <Input placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Input placeholder="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="Usage limit" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
        <Button onClick={create} className="btn-luxury">Generate</Button>
      </Card>
      {items.map((p) => (
        <Card key={p.id} className="glass p-3 flex justify-between items-center">
          <div><div className="font-mono text-gold font-bold">{p.code}</div><div className="text-xs text-muted-foreground">+{p.amount} · used {p.used_count}/{p.usage_limit}</div></div>
          <Button size="sm" variant="outline" onClick={async () => { await supabase.from("promo_codes").update({ is_active: !p.is_active }).eq("id", p.id); load(); }}>{p.is_active ? "Disable" : "Enable"}</Button>
        </Card>
      ))}
    </div>
  );
};

const Content = () => {
  const [anns, setAnns] = useState<any[]>([]);
  const [t, setT] = useState(""); const [b, setB] = useState("");
  const load = () => supabase.from("announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setAnns(data ?? []));
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3">
      <Card className="glass p-4 space-y-2">
        <h3 className="font-bold">New announcement</h3>
        <Input placeholder="Title" value={t} onChange={(e) => setT(e.target.value)} />
        <Textarea placeholder="Body" value={b} onChange={(e) => setB(e.target.value)} />
        <Button onClick={async () => { if (t) { await supabase.from("announcements").insert({ title: t, body: b }); setT(""); setB(""); load(); } }} className="btn-luxury">Post</Button>
      </Card>
      {anns.map((a) => (
        <Card key={a.id} className="glass p-3 flex justify-between items-center">
          <div><div className="font-bold">{a.title}</div><div className="text-xs text-muted-foreground">{a.body}</div></div>
          <Button size="sm" variant="outline" onClick={async () => { await supabase.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id); load(); }}>{a.is_active ? "Hide" : "Show"}</Button>
        </Card>
      ))}
    </div>
  );
};

const TokenRequests = () => {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const load = () => supabase.from("token_requests").select("*,profile:profiles(full_name,email,token_balance)").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-tr").on("postgres_changes", { event: "*", schema: "public", table: "token_requests" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const decide = async (r: any, approve: boolean) => {
    const res = await confirm({
      title: approve ? "Approve request" : "Deny request",
      description: `${r.amount} tokens · ${r.profile?.full_name}`,
      destructive: !approve, reasonRequired: !approve,
      confirmLabel: approve ? "Approve" : "Deny",
    });
    if (!res.confirmed) return;
    const note = res.reason ?? "";
    await supabase.from("token_requests").update({ status: approve ? "approved" : "denied", reviewed_by: me?.id, reviewed_at: new Date().toISOString(), review_note: note }).eq("id", r.id);
    if (approve) {
      await supabase.from("profiles").update({ token_balance: (r.profile?.token_balance ?? 0) + Number(r.amount) }).eq("id", r.user_id);
    }
    await supabase.from("notifications").insert({ user_id: r.user_id, title: `Token request ${approve ? "approved" : "denied"}`, body: `${r.amount} tokens · ${note}` });
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: approve ? "tokens_request_approve" : "tokens_request_deny", target_type: "user", target_id: r.user_id, metadata: { amount: r.amount, note } });
    load();
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
      {items.map((r) => (
        <Card key={r.id} className="glass p-3">
          <div className="flex justify-between flex-wrap gap-2">
            <div>
              <div className="font-bold">{r.profile?.full_name} · <span className="text-gold">+{r.amount}</span></div>
              <div className="text-xs text-muted-foreground">{r.profile?.email} · {new Date(r.created_at).toLocaleString()}</div>
              {r.note && <div className="text-xs mt-1">{r.note}</div>}
              {r.proof_image_url && <a href={r.proof_image_url} target="_blank" rel="noreferrer"><img src={r.proof_image_url} className="mt-2 max-w-[140px] rounded" alt="" /></a>}
            </div>
            <div className="flex flex-col gap-1">
              <Badge variant="outline">{r.status}</Badge>
              {r.status === "pending" && <>
                <Button size="sm" onClick={() => decide(r, true)} className="btn-luxury">Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => decide(r, false)}>Deny</Button>
              </>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

const OddsCalculator = () => {
  const [legs, setLegs] = useState<string[]>(["2.00", "1.50"]);
  const [stake, setStake] = useState("1000");
  const total = legs.reduce((acc, v) => acc * (parseFloat(v) || 1), 1);
  const payout = Math.min(60_000_000, Math.round((parseFloat(stake) || 0) * total));
  return (
    <Card className="glass p-4 space-y-2">
      <h3 className="font-bold flex items-center gap-2"><Calculator className="h-4 w-4" />Odds Calculator</h3>
      {legs.map((l, i) => (
        <div key={i} className="flex gap-2">
          <Input type="number" step="0.01" value={l} onChange={(e) => { const c = [...legs]; c[i] = e.target.value; setLegs(c); }} />
          <Button variant="outline" size="sm" onClick={() => setLegs(legs.filter((_, j) => j !== i))}>×</Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setLegs([...legs, "2.00"])}>+ Add leg</Button>
      <div><Label>Stake</Label><Input type="number" value={stake} onChange={(e) => setStake(e.target.value)} /></div>
      <div className="flex justify-between text-sm"><span>Total odds</span><span className="text-gold font-bold">{total.toFixed(2)}</span></div>
      <div className="flex justify-between text-sm"><span>Payout (capped 60M)</span><span className="text-gold font-bold">{payout.toLocaleString()}</span></div>
    </Card>
  );
};

const SettingsTab = () => {
  const confirm = useConfirm();
  const [s, setS] = useState<any>(null);
  const reload = () => supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setS(data));
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (!data) {
        await supabase.from("app_settings").insert({ id: 1 });
        reload();
      } else setS(data);
    })();
  }, []);
  if (!s) return null;
  const save = async () => {
    const { id, updated_at, ...rest } = s;
    const { error } = await supabase.from("app_settings").update(rest).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Saved");
  };
  const wipeAll = async () => {
    const r = await confirm({
      title: "EMERGENCY: Wipe ALL user tokens?",
      description: "Every user's token balance will be reset to zero. This cannot be undone.",
      destructive: true, reasonRequired: true,
      confirmLabel: "WIPE ALL TOKENS",
    });
    if (!r.confirmed) return;
    const { error } = await supabase.rpc("wipe_all_tokens");
    if (error) return toast.error(error.message);
    toast.success("All tokens wiped");
  };
  return (
    <div className="space-y-4">
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 p-3 rounded glass-gold">
        <div>
          <div className="font-bold gradient-gold-text">Maintenance mode</div>
          <div className="text-xs text-muted-foreground">Locks the platform for non-admins.</div>
        </div>
        <button
          onClick={() => setS({ ...s, maintenance_mode: !s.maintenance_mode })}
          className={`relative h-7 w-12 rounded-full transition ${s.maintenance_mode ? "bg-emerald-500" : "bg-secondary"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-background transition ${s.maintenance_mode ? "left-6" : "left-1"}`} />
        </button>
      </div>
      <div><Label>Maintenance message</Label><Textarea value={s.maintenance_message ?? ""} onChange={(e) => setS({ ...s, maintenance_message: e.target.value })} /></div>
      <div><Label>Terms & Conditions</Label><Textarea rows={6} value={s.terms_content ?? ""} onChange={(e) => setS({ ...s, terms_content: e.target.value })} /></div>
      <div><Label>About Us</Label><Textarea rows={3} value={s.about_us ?? ""} onChange={(e) => setS({ ...s, about_us: e.target.value })} /></div>
      <div><Label>Why Trust Us</Label><Textarea rows={3} value={s.why_trust_us ?? ""} onChange={(e) => setS({ ...s, why_trust_us: e.target.value })} /></div>
      <div className="grid md:grid-cols-3 gap-2">
        <div><Label>Email</Label><Input value={s.contact_email ?? ""} onChange={(e) => setS({ ...s, contact_email: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={s.contact_phone ?? ""} onChange={(e) => setS({ ...s, contact_phone: e.target.value })} /></div>
        <div><Label>WhatsApp</Label><Input value={s.contact_whatsapp ?? ""} onChange={(e) => setS({ ...s, contact_whatsapp: e.target.value })} /></div>
      </div>
      <Button onClick={save} className="btn-luxury">Save settings</Button>
    </Card>
    <Card className="glass p-4 border border-destructive/40">
      <h3 className="font-bold text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Emergency controls</h3>
      <p className="text-xs text-muted-foreground mt-1">One-tap kill-switch. Use with extreme care.</p>
      <Button onClick={wipeAll} variant="destructive" className="mt-3 w-full font-black">🚨 WIPE ALL USER TOKENS</Button>
    </Card>
    </div>
  );
};

const Logs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200).then(async ({ data }) => {
      setLogs(data ?? []);
      const ids = [...new Set([...(data ?? []).map((l: any) => l.actor_id), ...(data ?? []).map((l: any) => l.target_id)].filter(Boolean))];
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids as string[]);
        const m: Record<string, string> = {};
        (ps ?? []).forEach((p: any) => { m[p.id] = p.full_name; });
        setProfiles(m);
      }
    });
  }, []);
  return (
    <div className="space-y-1">
      {logs.map((l) => (
        <Card key={l.id} className="glass p-3 text-xs">
          <div className="flex justify-between flex-wrap gap-2">
            <div>
              <div><span className="text-gold font-bold">{l.action}</span> by <b>{profiles[l.actor_id] ?? l.actor_id?.slice(0, 8) ?? "system"}</b></div>
              {l.target_id && <div className="text-muted-foreground">Target: {l.target_type}/{profiles[l.target_id] ?? l.target_id?.slice(0, 8)}</div>}
              {l.metadata && <pre className="text-[10px] text-muted-foreground mt-1 overflow-x-auto">{JSON.stringify(l.metadata, null, 2)}</pre>}
            </div>
            <span className="text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</span>
          </div>
        </Card>
      ))}
    </div>
  );
};

const Admin = () => {
  return <AdminInner />;
};

const EventsTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [start, setStart] = useState(""); const [file, setFile] = useState<File | null>(null);
  const load = () => supabase.from("upcoming_events").select("*").order("starts_at").then(({ data }) => setItems(data ?? []));
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-events").on("postgres_changes", { event: "*", schema: "public", table: "upcoming_events" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const create = async () => {
    if (!title || !start) return toast.error("Title & date required");
    let image_url: string | null = null;
    if (file) {
      const path = `events/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("announcements").upload(path, file);
      if (error) return toast.error(error.message);
      image_url = supabase.storage.from("announcements").getPublicUrl(path).data.publicUrl;
    }
    await supabase.from("upcoming_events").insert({ title, description: desc || null, image_url, starts_at: new Date(start).toISOString() });
    setTitle(""); setDesc(""); setStart(""); setFile(null); toast.success("Event posted");
  };
  return (
    <div className="space-y-3">
      <Card className="glass p-4 space-y-2">
        <h3 className="font-bold gradient-gold-text">Post bold countdown event</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="grid md:grid-cols-2 gap-2">
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button className="btn-luxury" onClick={create}>Publish event</Button>
      </Card>
      {items.map((ev) => (
        <Card key={ev.id} className="glass p-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {ev.image_url && <img src={ev.image_url} className="h-12 w-20 object-cover rounded" alt="" />}
            <div className="min-w-0">
              <div className="font-bold truncate">{ev.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(ev.starts_at).toLocaleString()}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => supabase.from("upcoming_events").update({ is_active: !ev.is_active }).eq("id", ev.id).then(load)}>{ev.is_active ? "Hide" : "Show"}</Button>
            <Button size="sm" variant="destructive" onClick={() => supabase.from("upcoming_events").delete().eq("id", ev.id).then(load)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

const HighlightsTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState(""); const [type, setType] = useState<"image" | "video">("image"); const [file, setFile] = useState<File | null>(null);
  const load = () => supabase.from("highlights").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!title || !file) return toast.error("Title & file required");
    const path = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("highlights").upload(path, file);
    if (error) return toast.error(error.message);
    const media_url = supabase.storage.from("highlights").getPublicUrl(path).data.publicUrl;
    await supabase.from("highlights").insert({ title, media_url, media_type: type });
    setTitle(""); setFile(null); load(); toast.success("Highlight posted");
  };
  return (
    <div className="space-y-3">
      <Card className="glass p-4 space-y-2">
        <h3 className="font-bold gradient-gold-text">Post highlight</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid md:grid-cols-2 gap-2">
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent>
          </Select>
          <Input type="file" accept={type === "video" ? "video/*" : "image/*"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button className="btn-luxury" onClick={create}>Publish</Button>
      </Card>
      <div className="grid md:grid-cols-3 gap-2">
        {items.map((h) => (
          <Card key={h.id} className="glass overflow-hidden">
            {h.media_type === "video" ? <video src={h.media_url} className="w-full aspect-video" controls /> : <img src={h.media_url} className="w-full aspect-video object-cover" alt="" />}
            <div className="p-2 flex justify-between items-center"><div className="text-xs font-bold truncate">{h.title}</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => supabase.from("highlights").update({ is_active: !h.is_active }).eq("id", h.id).then(load)}>{h.is_active ? "Hide" : "Show"}</Button>
                <Button size="sm" variant="destructive" onClick={() => supabase.from("highlights").delete().eq("id", h.id).then(load)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const CategoriesTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState(""); const [icon, setIcon] = useState("");
  const load = () => supabase.from("categories").select("*").order("created_at").then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3">
      <Card className="glass p-4 grid md:grid-cols-3 gap-2">
        <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Icon (emoji)" value={icon} onChange={(e) => setIcon(e.target.value)} />
        <Button className="btn-luxury" onClick={async () => { if (!name) return; await supabase.from("categories").insert({ name, icon: icon || null }); setName(""); setIcon(""); load(); }}>Add</Button>
      </Card>
      {items.map((c) => (
        <Card key={c.id} className="glass p-3 flex justify-between items-center">
          <div><span className="mr-2">{c.icon}</span><b>{c.name}</b></div>
          <Button size="sm" variant="destructive" onClick={() => supabase.from("categories").delete().eq("id", c.id).then(load)}><Trash2 className="h-3 w-3" /></Button>
        </Card>
      ))}
    </div>
  );
};

const SendNotificationsTab = () => {
  const { user: me } = useAuth();
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [target, setTarget] = useState<string>("all");
  const [users, setUsers] = useState<any[]>([]);
  const [pickedUser, setPickedUser] = useState<string>("");
  useEffect(() => { supabase.from("profiles").select("id,full_name,email").order("full_name").then(({ data }) => setUsers(data ?? [])); }, []);
  const send = async () => {
    if (!title) return toast.error("Title required");
    let recipientIds: string[] = [];
    if (target === "all") recipientIds = users.map((u) => u.id);
    else if (target === "user") { if (!pickedUser) return toast.error("Pick user"); recipientIds = [pickedUser]; }
    else { // role
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", target as AppRole);
      recipientIds = (data ?? []).map((r: any) => r.user_id);
    }
    if (!recipientIds.length) return toast.error("No recipients");
    await supabase.from("notifications").insert(recipientIds.map((uid) => ({ user_id: uid, title, body: body || null })));
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: "notification_send", target_type: "broadcast", metadata: { count: recipientIds.length, target } });
    toast.success(`Sent to ${recipientIds.length} user(s)`);
    setTitle(""); setBody("");
  };
  return (
    <Card className="glass p-4 space-y-2">
      <h3 className="font-bold gradient-gold-text">Send notification</h3>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="grid md:grid-cols-2 gap-2">
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="user">Specific user</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>Role: {r}</SelectItem>)}
          </SelectContent>
        </Select>
        {target === "user" && (
          <Select value={pickedUser} onValueChange={setPickedUser}>
            <SelectTrigger><SelectValue placeholder="Pick user" /></SelectTrigger>
            <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      <Button className="btn-luxury" onClick={send}><Send className="h-4 w-4 mr-1" />Send</Button>
    </Card>
  );
};

const SupportTab = () => {
  const { user: me } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const load = () => supabase.from("support_tickets").select("*,profile:profiles(full_name,email)").order("created_at", { ascending: false }).then(({ data }) => setTickets(data ?? []));
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-support").on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const openTicket = async (t: any) => {
    setOpen(t);
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", t.id).order("created_at");
    setMsgs(data ?? []);
  };
  const send = async () => {
    if (!open || !reply.trim() || !me) return;
    await supabase.from("ticket_messages").insert({ ticket_id: open.id, user_id: me.id, content: reply });
    setReply(""); openTicket(open);
  };
  const close = async (t: any) => {
    await supabase.from("support_tickets").update({ status: "closed" }).eq("id", t.id); load();
  };
  return (
    <div className="space-y-2">
      {tickets.map((t) => (
        <Card key={t.id} className="glass p-3 flex justify-between items-center">
          <div>
            <div className="font-bold">{t.subject}</div>
            <div className="text-xs text-muted-foreground">{t.profile?.full_name} · {t.status} · {new Date(t.created_at).toLocaleString()}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => openTicket(t)}>Open</Button>
            {t.status !== "closed" && <Button size="sm" variant="destructive" onClick={() => close(t)}>Close</Button>}
          </div>
        </Card>
      ))}
      {open && (
        <div onClick={() => setOpen(null)} className="fixed inset-0 z-[80] bg-black/70 backdrop-blur flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="glass-gold max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 rounded-2xl space-y-3">
            <h3 className="text-xl font-bold gradient-gold-text">{open.subject}</h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {msgs.map((m) => (
                <div key={m.id} className="text-sm p-2 bg-secondary/30 rounded">
                  <div className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</div>
                  {m.content}
                </div>
              ))}
            </div>
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply..." />
            <div className="flex gap-2"><Button onClick={send} className="btn-luxury flex-1">Send reply</Button><Button variant="outline" onClick={() => setOpen(null)}>Close</Button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const LeaderboardTab = () => {
  const [users, setUsers] = useState<any[]>([]);
  const load = () => supabase.from("profiles").select("id,full_name,gang_name,token_balance").order("token_balance", { ascending: false }).limit(50).then(({ data }) => setUsers(data ?? []));
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Leaderboard auto-updates from token balances. Adjust tokens via Users tab to influence rankings.</p>
      {users.map((u, i) => (
        <Card key={u.id} className="glass p-3 flex justify-between items-center">
          <div className="flex items-center gap-3"><span className="text-xl font-black gradient-gold-text">#{i + 1}</span><div><div className="font-bold">{u.full_name}</div><div className="text-xs text-muted-foreground">{u.gang_name ?? "—"}</div></div></div>
          <div className="text-gold font-bold">{u.token_balance.toLocaleString()}</div>
        </Card>
      ))}
    </div>
  );
};

const AdminInner = () => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Layout><div className="container py-12">Loading...</div></Layout>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold gradient-gold-text mb-6 flex items-center gap-2"><Shield />Admin Panel</h1>
        <Tabs defaultValue="users">
          <TabsList className="glass flex-wrap h-auto">
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="matches"><Crosshair className="h-4 w-4 mr-1" />Matches</TabsTrigger>
            <TabsTrigger value="categories"><ListChecks className="h-4 w-4 mr-1" />Categories</TabsTrigger>
            <TabsTrigger value="events"><CalendarClock className="h-4 w-4 mr-1" />Events</TabsTrigger>
            <TabsTrigger value="highlights"><Sparkles className="h-4 w-4 mr-1" />Highlights</TabsTrigger>
            <TabsTrigger value="content"><Megaphone className="h-4 w-4 mr-1" />Announcements</TabsTrigger>
            <TabsTrigger value="promos"><Gift className="h-4 w-4 mr-1" />Promos</TabsTrigger>
            <TabsTrigger value="tokens"><Coins className="h-4 w-4 mr-1" />Token Requests</TabsTrigger>
            <TabsTrigger value="notify"><Send className="h-4 w-4 mr-1" />Notifications</TabsTrigger>
            <TabsTrigger value="support"><LifeBuoy className="h-4 w-4 mr-1" />Support</TabsTrigger>
            <TabsTrigger value="leaderboard"><Trophy className="h-4 w-4 mr-1" />Leaderboard</TabsTrigger>
            <TabsTrigger value="calc"><Calculator className="h-4 w-4 mr-1" />Calculator</TabsTrigger>
            <TabsTrigger value="ai"><Bot className="h-4 w-4 mr-1" />AI</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Settings</TabsTrigger>
            <TabsTrigger value="logs"><FileText className="h-4 w-4 mr-1" />Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="users"><UserManagement /></TabsContent>
          <TabsContent value="matches"><MatchBuilder /></TabsContent>
          <TabsContent value="categories"><CategoriesTab /></TabsContent>
          <TabsContent value="events"><EventsTab /></TabsContent>
          <TabsContent value="highlights"><HighlightsTab /></TabsContent>
          <TabsContent value="content"><Content /></TabsContent>
          <TabsContent value="promos"><Promos /></TabsContent>
          <TabsContent value="tokens"><TokenRequests /></TabsContent>
          <TabsContent value="notify"><SendNotificationsTab /></TabsContent>
          <TabsContent value="support"><SupportTab /></TabsContent>
          <TabsContent value="leaderboard"><LeaderboardTab /></TabsContent>
          <TabsContent value="calc"><OddsCalculator /></TabsContent>
          <TabsContent value="ai"><Card className="glass-gold p-10 text-center"><Bot className="h-12 w-12 mx-auto text-gold" /><h3 className="text-2xl font-black gradient-gold-text mt-3">AI Assistant</h3><p className="text-muted-foreground mt-2">Coming soon — match creation, smart announcements, and AI-powered support.</p></Card></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
          <TabsContent value="logs"><Logs /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};
export default Admin;
