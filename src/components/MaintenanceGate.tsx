import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Wrench, Skull } from "lucide-react";

export const MaintenanceGate = ({ children }: { children: ReactNode }) => {
  const { isAdmin } = useAuth();
  const [s, setS] = useState<{ maintenance_mode: boolean; maintenance_message: string | null } | null>(null);

  useEffect(() => {
    const load = () => supabase.from("app_settings").select("maintenance_mode, maintenance_message").eq("id", 1).maybeSingle()
      .then(({ data }) => setS(data as any));
    load();
    const ch = supabase.channel("maintenance")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (s?.maintenance_mode && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="glass-gold p-10 max-w-md text-center">
          <Wrench className="h-12 w-12 text-gold mx-auto mb-3 animate-glow-pulse" />
          <h1 className="text-2xl font-black gradient-gold-text">UNDER MAINTENANCE</h1>
          <p className="text-muted-foreground mt-3">{s.maintenance_message ?? "We'll be back shortly. The arena is being upgraded."}</p>
          <Skull className="h-6 w-6 text-muted-foreground mx-auto mt-6 opacity-50" />
        </Card>
      </div>
    );
  }
  return <>{children}</>;
};