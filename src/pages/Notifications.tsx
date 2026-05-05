import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Notifications = () => {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setItems(data ?? []));
    supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false).then(() => {});
  }, [user]);

  if (loading) return <Layout><div className="container py-12">Loading...</div></Layout>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <h1 className="text-3xl font-bold gradient-gold-text mb-6 flex items-center gap-2"><Bell />Notifications</h1>
        <div className="space-y-2">
          {items.length === 0 && <Card className="glass p-12 text-center text-muted-foreground">No notifications yet.</Card>}
          {items.map((n) => (
            <Card key={n.id} className="glass p-4">
              <div className="font-bold">{n.title}</div>
              {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
              {n.link && <Link to={n.link} className="text-xs text-gold hover:underline">View →</Link>}
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};
export default Notifications;
