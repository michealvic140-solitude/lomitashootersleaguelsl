import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "viewer" | "shooter" | "gang_leader" | "registered" | "moderator" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  discord_username: string | null;
  country: string | null;
  server: string | null;
  gang_name: string | null;
  gang_type: "G" | "F" | null;
  avatar_url: string | null;
  token_balance: number;
  is_banned: boolean;
  ban_reason: string | null;
  is_muted: boolean;
  is_restricted: boolean;
  accepted_terms: boolean;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isMod: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p as Profile | null);
    setRoles((r ?? []).map((x: { role: AppRole }) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadUserData(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadUserData(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Realtime: live profile + role updates so token balance / bans reflect instantly
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`me-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setProfile((prev) => ({ ...(prev as Profile), ...(payload.new as Profile) })))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => loadUserData(user.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user,
        profile,
        roles,
        loading,
        isAdmin: roles.includes("admin"),
        isMod: roles.includes("admin") || roles.includes("moderator"),
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};

export const ROLE_COLORS: Record<AppRole, string> = {
  viewer: "bg-gray-500/20 text-gray-300 border-gray-500/40",
  shooter: "bg-green-500/20 text-green-300 border-green-500/40",
  gang_leader: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  registered: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  moderator: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  admin: "bg-red-500/20 text-red-300 border-red-500/40",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  viewer: "Viewer",
  shooter: "Shooter",
  gang_leader: "Gang Leader",
  registered: "Registered",
  moderator: "Moderator",
  admin: "Admin",
};