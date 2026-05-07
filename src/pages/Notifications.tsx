import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Notifications = () => {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
    setItems(data ?? []);
  };
  useEffect(() => {
    if (!user) return;
    load();
    supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false).then(() => {});
    const ch = supabase.channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    load();
  };
  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  };

  if (loading) return <Layout><div className="container py-12">Loading...</div></Layout>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold gradient-gold-text flex items-center gap-2"><Bell />Notifications</h1>
          {items.length > 0 && <Button size="sm" variant="outline" onClick={clearAll}><Trash2 className="h-4 w-4" />Clear all</Button>}
        </div>
        <div className="space-y-2">
          {items.length === 0 && <Card className="glass p-12 text-center text-muted-foreground">No notifications yet.</Card>}
          {items.map((n) => (
            <Card key={n.id} className={`glass p-4 flex justify-between gap-3 ${!n.is_read ? "border-gold/40" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="font-bold flex items-center gap-2">{!n.is_read && <span className="h-2 w-2 rounded-full bg-emerald-500" />}{n.title}</div>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                {n.link && <Link to={n.link} className="text-xs text-gold hover:underline">View →</Link>}
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.is_read && <button onClick={() => markRead(n.id)} className="text-xs text-gold flex items-center gap-1"><Check className="h-3 w-3" />Read</button>}
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};
export default Notifications;
