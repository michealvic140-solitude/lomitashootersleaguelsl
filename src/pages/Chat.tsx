import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, ImagePlus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_COLORS, ROLE_LABELS, AppRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

type Room = "general" | "gang" | "moderator";
interface Msg { id: string; user_id: string; content: string | null; image_url: string | null; created_at: string; }

const RoomChat = ({ room }: { room: Room }) => {
  const { user, profile } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; gang_name: string | null; gang_type: string | null }>>({});
  const [roles, setRoles] = useState<Record<string, AppRole[]>>({});
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadProfiles = async (uids: string[]) => {
    const missing = uids.filter((u) => !profiles[u]);
    if (missing.length === 0) return;
    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,gang_name,gang_type").in("id", missing),
      supabase.from("user_roles").select("user_id,role").in("user_id", missing),
    ]);
    setProfiles((p) => { const n = { ...p }; (ps ?? []).forEach((x: any) => { n[x.id] = x; }); return n; });
    setRoles((r) => {
      const n = { ...r };
      (rs ?? []).forEach((x: any) => { (n[x.user_id] ??= []).push(x.role); });
      return n;
    });
  };

  useEffect(() => {
    supabase.from("chat_messages").select("*").eq("room", room).order("created_at").limit(100)
      .then(async ({ data }) => {
        setMsgs((data ?? []) as Msg[]);
        await loadProfiles([...new Set((data ?? []).map((m: any) => m.user_id))]);
      });
    const ch = supabase.channel(`chat-${room}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${room}` },
      async (payload) => {
        const m = payload.new as Msg;
        setMsgs((prev) => [...prev, m]);
        await loadProfiles([m.user_id]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (image_url?: string) => {
    if (!user) return;
    if (!text.trim() && !image_url) return;
    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id, room, content: text.trim() || null, image_url: image_url ?? null,
    });
    if (error) toast.error(error.message);
    else setText("");
  };

  const upload = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
    await send(data.publicUrl);
  };

  if (profile?.is_muted) return <p className="text-center py-8 text-destructive">You are muted in chat.</p>;

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto space-y-3 p-3 glass rounded-lg">
        {msgs.map((m) => {
          const p = profiles[m.user_id];
          const userRoles = roles[m.user_id] ?? ["viewer" as AppRole];
          const top = userRoles[0];
          return (
            <div key={m.id} className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                {p?.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">{p?.full_name ?? "Unknown"}</span>
                  <Badge variant="outline" className={`${ROLE_COLORS[top]} text-[9px]`}>{ROLE_LABELS[top]}</Badge>
                  {p?.gang_name && <span className="text-[10px] text-gold">{p.gang_name} ({p.gang_type})</span>}
                </div>
                {m.content && <p className="text-sm text-foreground/90">{m.content}</p>}
                {m.image_url && <img src={m.image_url} alt="" className="mt-2 max-w-xs rounded" />}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <Input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Type a message..." />
        <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /></Button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button onClick={() => send()} className="btn-luxury"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

const Chat = () => {
  const { user, loading, isMod, roles } = useAuth();
  if (loading) return <Layout><div className="container py-12">Loading...</div></Layout>;
  if (!user) return <Navigate to="/login" replace />;
  const canGang = roles.includes("gang_leader") || isMod;
  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold gradient-gold-text mb-4 flex items-center gap-2"><MessageSquare /> Arena Chat</h1>
        <Card className="glass p-4">
          <Tabs defaultValue="general">
            <TabsList className="glass">
              <TabsTrigger value="general">General</TabsTrigger>
              {canGang && <TabsTrigger value="gang">Gang</TabsTrigger>}
              {isMod && <TabsTrigger value="moderator">Moderator</TabsTrigger>}
            </TabsList>
            <TabsContent value="general"><RoomChat room="general" /></TabsContent>
            {canGang && <TabsContent value="gang"><RoomChat room="gang" /></TabsContent>}
            {isMod && <TabsContent value="moderator"><RoomChat room="moderator" /></TabsContent>}
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
};
export default Chat;
