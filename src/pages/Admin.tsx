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
import { Shield, Users, Crosshair, Megaphone, Gift, Settings, FileText } from "lucide-react";
import { useAuth, AppRole, ROLE_COLORS, ROLE_LABELS } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ROLES: AppRole[] = ["viewer", "shooter", "gang_leader", "registered", "moderator", "admin"];

const UserManagement = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});
  const [search, setSearch] = useState("");

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

  const toggleRole = async (uid: string, role: AppRole) => {
    const has = (rolesByUser[uid] ?? []).includes(role);
    if (has) await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    else await supabase.from("user_roles").insert({ user_id: uid, role, assigned_by: me?.id });
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: has ? "role_remove" : "role_assign", target_type: "user", target_id: uid, metadata: { role } });
    await load();
  };

  const setFlag = async (uid: string, field: string, value: boolean, reasonField?: string) => {
    const reason = value ? prompt("Reason?") || "" : "";
    const update: any = { [field]: value };
    if (reasonField) update[reasonField] = reason;
    await supabase.from("profiles").update(update).eq("id", uid);
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: `${field}_${value}`, target_type: "user", target_id: uid, metadata: { reason } });
    await supabase.from("notifications").insert({ user_id: uid, title: `Account ${field}`, body: reason || `Status updated` });
    await load();
  };

  const giveTokens = async (uid: string, current: number) => {
    const v = parseInt(prompt("Amount (use negative to remove)") || "0", 10);
    if (!v) return;
    const reason = prompt("Reason?") || "";
    await supabase.from("profiles").update({ token_balance: Math.max(0, current + v) }).eq("id", uid);
    await supabase.from("audit_logs").insert({ actor_id: me?.id, action: "tokens_adjust", target_type: "user", target_id: uid, metadata: { amount: v, reason } });
    await supabase.from("notifications").insert({ user_id: uid, title: "Token balance updated", body: `${v > 0 ? "+" : ""}${v} · ${reason}` });
    await load();
  };

  const filtered = users.filter((u) => !search || (u.full_name + u.email + (u.gang_name ?? "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <Input placeholder="Search by name, email, gang..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {filtered.map((u) => (
        <Card key={u.id} className="glass p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-bold">{u.full_name}</div>
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
          </div>
        </Card>
      ))}
    </div>
  );
};

const MatchBuilder = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [name, setName] = useState(""); const [home, setHome] = useState(""); const [away, setAway] = useState("");
  const [loc, setLoc] = useState(""); const [start, setStart] = useState("");
  const [newTeam, setNewTeam] = useState("");

  const load = async () => {
    const { data: t } = await supabase.from("teams").select("*").order("created_at", { ascending: false });
    setTeams(t ?? []);
    const { data: m } = await supabase.from("matches").select("*,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)").order("start_time", { ascending: false }).limit(50);
    setMatches(m ?? []);
  };
  useEffect(() => { load(); }, []);

  const createTeam = async () => {
    if (!newTeam.trim()) return;
    await supabase.from("teams").insert({ name: newTeam });
    setNewTeam(""); await load();
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

  return (
    <div className="space-y-4">
      <Card className="glass p-4 space-y-2">
        <h3 className="font-bold">Quick add team</h3>
        <div className="flex gap-2"><Input placeholder="Team name" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} /><Button onClick={createTeam} className="btn-luxury">Add</Button></div>
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

const SettingsTab = () => {
  const [s, setS] = useState<any>(null);
  useEffect(() => { supabase.from("app_settings").select("*").eq("id", 1).single().then(({ data }) => setS(data)); }, []);
  if (!s) return null;
  const save = async () => { await supabase.from("app_settings").update(s).eq("id", 1); toast.success("Saved"); };
  return (
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center justify-between"><Label>Maintenance mode</Label><input type="checkbox" checked={s.maintenance_mode} onChange={(e) => setS({ ...s, maintenance_mode: e.target.checked })} /></div>
      <div><Label>Maintenance message</Label><Textarea value={s.maintenance_message ?? ""} onChange={(e) => setS({ ...s, maintenance_message: e.target.value })} /></div>
      <div><Label>Terms & Conditions</Label><Textarea rows={6} value={s.terms_content ?? ""} onChange={(e) => setS({ ...s, terms_content: e.target.value })} /></div>
      <div className="grid md:grid-cols-3 gap-2">
        <div><Label>Email</Label><Input value={s.contact_email ?? ""} onChange={(e) => setS({ ...s, contact_email: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={s.contact_phone ?? ""} onChange={(e) => setS({ ...s, contact_phone: e.target.value })} /></div>
        <div><Label>WhatsApp</Label><Input value={s.contact_whatsapp ?? ""} onChange={(e) => setS({ ...s, contact_whatsapp: e.target.value })} /></div>
      </div>
      <Button onClick={save} className="btn-luxury">Save settings</Button>
    </Card>
  );
};

const Logs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setLogs(data ?? [])); }, []);
  return (
    <div className="space-y-1">
      {logs.map((l) => (
        <Card key={l.id} className="glass p-2 text-xs flex justify-between">
          <span><b>{l.action}</b> · {l.target_type}/{l.target_id?.slice(0, 8)}</span>
          <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
        </Card>
      ))}
    </div>
  );
};

const Admin = () => {
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
            <TabsTrigger value="content"><Megaphone className="h-4 w-4 mr-1" />Announcements</TabsTrigger>
            <TabsTrigger value="promos"><Gift className="h-4 w-4 mr-1" />Promos</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Settings</TabsTrigger>
            <TabsTrigger value="logs"><FileText className="h-4 w-4 mr-1" />Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="users"><UserManagement /></TabsContent>
          <TabsContent value="matches"><MatchBuilder /></TabsContent>
          <TabsContent value="content"><Content /></TabsContent>
          <TabsContent value="promos"><Promos /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
          <TabsContent value="logs"><Logs /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};
export default Admin;
