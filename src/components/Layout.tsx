import { Link, useNavigate } from "react-router-dom";
import { Crosshair, LogOut, User as UserIcon, Bell, Shield, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "@/contexts/AuthContext";
import { ParticleBackground } from "./ParticleBackground";
import { MobileBottomNav } from "./MobileBottomNav";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Layout = ({ children }: { children: ReactNode }) => {
  const { user, profile, roles, isAdmin, isMod, signOut } = useAuth();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const load = async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase.channel(`bell-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <header className="sticky top-0 z-50 glass border-b border-primary/20">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Crosshair className="h-7 w-7 text-primary animate-slow-spin" />
              <div className="absolute inset-0 bg-primary/30 blur-lg group-hover:bg-primary/50 transition-all" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold gradient-gold-text tracking-widest">LOMITA</div>
              <div className="text-[10px] text-muted-foreground tracking-[0.3em]">SHOOTERS LEAGUE</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/matches"><Button variant="ghost" size="sm">Matches</Button></Link>
            <Link to="/leaderboard"><Button variant="ghost" size="sm">Leaderboard</Button></Link>
            {user && <Link to="/chat"><Button variant="ghost" size="sm"><MessageSquare className="h-4 w-4" />Chat</Button></Link>}
            {user && <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>}
            {user && <Link to="/support"><Button variant="ghost" size="sm">Support</Button></Link>}
            {isAdmin && <Link to="/admin"><Button variant="ghost" size="sm" className="text-red-300"><Shield className="h-4 w-4" />Admin</Button></Link>}
          </nav>

          <div className="flex items-center gap-2">
            {user && profile ? (
              <>
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-xs text-muted-foreground">Tokens</span>
                  <span className="text-sm font-bold text-gold">{profile.token_balance.toLocaleString()}</span>
                </div>
                <Link to="/notifications" className="relative">
                  <Button variant="ghost" size="icon"><Bell className="h-4 w-4" /></Button>
                  {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread > 99 ? "99+" : unread}</span>}
                </Link>
                <Link to="/profile">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <UserIcon className="h-4 w-4" />
                    <span className="hidden sm:flex flex-col items-start leading-tight">
                      <span className="text-xs">{profile.full_name}</span>
                      {profile.gang_name && (
                        <span className="text-[10px] text-gold">
                          {profile.gang_name} ({profile.gang_type})
                        </span>
                      )}
                    </span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav("/"); }}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/register"><Button size="sm" className="btn-luxury">Join League</Button></Link>
              </>
            )}
          </div>
        </div>
        {user && roles.length > 0 && (
          <div className="container pb-2 flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className={ROLE_COLORS[r]}>{ROLE_LABELS[r]}</Badge>
            ))}
          </div>
        )}
      </header>
      <main className="relative">{children}</main>
      <div className="md:hidden h-20" />
      <MobileBottomNav />
      <footer className="glass border-t border-primary/20 mt-20">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <div className="gradient-gold-text font-bold tracking-widest mb-2">LOMITA SHOOTERS LEAGUE</div>
          <p>Virtual token-only platform · No real money gambling</p>
          <p className="mt-2 text-xs">© {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};