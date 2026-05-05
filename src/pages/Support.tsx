import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Send, ImagePlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Support = () => {
  const { user, loading, isMod } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [first, setFirst] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTickets = () => {
    if (!user) return;
    const q = isMod
      ? supabase.from("support_tickets").select("*").order("updated_at", { ascending: false })
      : supabase.from("support_tickets").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    q.then(({ data }) => setTickets(data ?? []));
  };
  useEffect(loadTickets, [user, isMod]);

  useEffect(() => {
    if (!active) return;
    supabase.from("ticket_messages").select("*").eq("ticket_id", active.id).order("created_at").then(({ data }) => setMsgs(data ?? []));
    const ch = supabase.channel(`tm-${active.id}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${active.id}` },
      (payload) => setMsgs((m) => [...m, payload.new])).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  if (loading) return <Layout><div className="container py-12">Loading...</div></Layout>;
  if (!user) return <Navigate to="/login" replace />;

  const create = async () => {
    if (!subject.trim() || !first.trim()) return toast.error("Subject + message required");
    const { data: t, error } = await supabase.from("support_tickets").insert({ user_id: user.id, subject }).select().single();
    if (error || !t) return toast.error(error?.message ?? "Failed");
    await supabase.from("ticket_messages").insert({ ticket_id: t.id, user_id: user.id, content: first });
    setSubject(""); setFirst(""); loadTickets(); setActive(t);
  };

  const reply = async (image_url?: string) => {
    if (!active || (!text.trim() && !image_url)) return;
    await supabase.from("ticket_messages").insert({ ticket_id: active.id, user_id: user.id, content: text.trim() || null, image_url: image_url ?? null });
    await supabase.from("support_tickets").update({ status: isMod ? "pending" : "open" }).eq("id", active.id);
    setText("");
  };

  const upload = async (f: File) => {
    const path = `${user.id}/${Date.now()}_${f.name}`;
    const { error } = await supabase.storage.from("ticket-uploads").upload(path, f);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("ticket-uploads").getPublicUrl(path);
    await reply(data.publicUrl);
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold gradient-gold-text mb-6 flex items-center gap-2"><LifeBuoy />Support</h1>
        <div className="grid md:grid-cols-[300px_1fr] gap-4">
          <div className="space-y-3">
            {!isMod && (
              <Card className="glass p-4 space-y-2">
                <Label>New ticket</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
                <Textarea value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Describe your issue..." />
                <Button onClick={create} className="btn-luxury w-full">Create ticket</Button>
              </Card>
            )}
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {tickets.map((t) => (
                <Card key={t.id} className={`glass p-3 cursor-pointer ${active?.id === t.id ? "border-primary" : ""}`} onClick={() => setActive(t)}>
                  <div className="font-bold text-sm truncate">{t.subject}</div>
                  <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
                </Card>
              ))}
            </div>
          </div>

          <Card className="glass p-4">
            {!active ? <p className="text-center text-muted-foreground py-12">Select a ticket</p> : (
              <div className="flex flex-col h-[65vh]">
                <div className="border-b border-border pb-2 mb-2">
                  <div className="font-bold">{active.subject}</div>
                  <Badge variant="outline" className="text-[9px]">{active.status}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {msgs.map((m) => (
                    <div key={m.id} className={`p-2 rounded text-sm ${m.user_id === user.id ? "bg-primary/10 ml-8" : "bg-secondary/50 mr-8"}`}>
                      {m.content}
                      {m.image_url && <img src={m.image_url} className="mt-2 max-w-xs rounded" alt="" />}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply..." onKeyDown={(e) => { if (e.key === "Enter") reply(); }} />
                  <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /></Button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  <Button onClick={() => reply()} className="btn-luxury"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};
export default Support;
