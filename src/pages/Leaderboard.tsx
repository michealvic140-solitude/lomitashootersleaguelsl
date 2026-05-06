import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_COLORS, ROLE_LABELS, AppRole } from "@/contexts/AuthContext";

interface ShooterRow { id: string; full_name: string; gang_name: string | null; gang_type: string | null; points: number; roles: AppRole[]; }

const Leaderboard = () => {
  const [shooters, setShooters] = useState<ShooterRow[]>([]);
  const [factions, setFactions] = useState<{ name: string; type: string; points: number; members: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: bets } = await supabase.from("bets").select("user_id, potential_payout, status").eq("status", "won");
      const points: Record<string, number> = {};
      (bets ?? []).forEach((b: any) => { points[b.user_id] = (points[b.user_id] ?? 0) + Number(b.potential_payout); });
      const ids = Object.keys(points);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id,full_name,gang_name,gang_type").in("id", ids)
        : { data: [] as any[] };
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id,role").in("user_id", ids)
        : { data: [] as any[] };
      const rolesByUser: Record<string, AppRole[]> = {};
      (roles ?? []).forEach((r: any) => { (rolesByUser[r.user_id] ??= []).push(r.role); });
      const rows = (profs ?? []).map((p: any) => ({
        id: p.id, full_name: p.full_name, gang_name: p.gang_name, gang_type: p.gang_type,
        points: points[p.id] ?? 0, roles: rolesByUser[p.id] ?? ["viewer"],
      })).sort((a, b) => b.points - a.points).slice(0, 50);
      setShooters(rows);

      const fmap: Record<string, { name: string; type: string; points: number; members: Set<string> }> = {};
      (profs ?? []).forEach((p: any) => {
        if (!p.gang_name) return;
        const k = `${p.gang_name}|${p.gang_type ?? "G"}`;
        fmap[k] ??= { name: p.gang_name, type: p.gang_type ?? "G", points: 0, members: new Set() };
        fmap[k].points += points[p.id] ?? 0;
        fmap[k].members.add(p.id);
      });
      setFactions(Object.values(fmap).map((f) => ({ ...f, members: f.members.size })).sort((a, b) => b.points - a.points).slice(0, 20));
    };
    load();
    const ch = supabase.channel("lb")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <Layout>
      <div className="container py-8 grid md:grid-cols-2 gap-6">
        <Card className="glass p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Crown className="h-5 w-5 text-gold" />Top Factions / Gangs</h2>
          <div className="space-y-2">
            {factions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No data yet.</p>}
            {factions.map((f, i) => (
              <div key={f.name + f.type} className="flex items-center gap-3 p-3 rounded glass">
                <span className="text-gold font-bold w-6">{i + 1}</span>
                <div className="flex-1">
                  <div className="font-bold">{f.name} <span className="text-xs text-gold">({f.type})</span></div>
                  <div className="text-xs text-muted-foreground">{f.members} members</div>
                </div>
                <span className="text-gold font-bold">{f.points.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Trophy className="h-5 w-5 text-gold" />Best Shooters</h2>
          <div className="space-y-2">
            {shooters.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No data yet.</p>}
            {shooters.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded glass">
                <span className="text-gold font-bold w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.gang_name && <>{s.gang_name} ({s.gang_type}) · </>}
                    <Badge variant="outline" className={`${ROLE_COLORS[s.roles[0]]} text-[9px]`}>{ROLE_LABELS[s.roles[0]]}</Badge>
                  </div>
                </div>
                <span className="text-gold font-bold">{s.points.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
export default Leaderboard;
