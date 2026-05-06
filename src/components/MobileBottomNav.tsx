import { Link, useLocation } from "react-router-dom";
import { Home, Crosshair, Trophy, MessageSquare, LayoutDashboard, Bell, Shield, LifeBuoy, User as UserIcon, Ticket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const MobileBottomNav = () => {
  const { user, isAdmin } = useAuth();
  const loc = useLocation();
  const items = [
    { to: "/", label: "Home", icon: Home },
    { to: "/matches", label: "Matches", icon: Crosshair },
    { to: "/leaderboard", label: "Top", icon: Trophy },
    ...(user ? [
      { to: "/dashboard", label: "Bets", icon: Ticket },
      { to: "/chat", label: "Chat", icon: MessageSquare },
      { to: "/notifications", label: "Alerts", icon: Bell },
      { to: "/profile", label: "Profile", icon: UserIcon },
      { to: "/support", label: "Help", icon: LifeBuoy },
    ] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-primary/30">
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 px-2 py-2 min-w-max">
          {items.map((it) => {
            const Icon = it.icon;
            const active = loc.pathname === it.to || (it.to !== "/" && loc.pathname.startsWith(it.to));
            return (
              <Link key={it.to} to={it.to} className={`flex flex-col items-center px-3 py-1 rounded-lg text-[10px] min-w-[60px] ${active ? "text-gold bg-primary/10" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5 mb-0.5" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};