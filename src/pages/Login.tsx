import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Login = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banned, setBanned] = useState<{ reason: string | null; userId: string } | null>(null);
  const [appeal, setAppeal] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.user) {
      const { data: prof } = await supabase.from("profiles").select("is_banned, ban_reason").eq("id", data.user.id).maybeSingle();
      if (prof?.is_banned) {
        setBanned({ reason: prof.ban_reason, userId: data.user.id });
        await supabase.auth.signOut();
        return;
      }
    }
    toast.success("Welcome back, shooter.");
    nav("/");
  };

  const sendAppeal = async () => {
    if (!banned || !appeal.trim()) return;
    await supabase.from("support_tickets").insert({ user_id: banned.userId, subject: `Ban appeal — ${email}` }).select().single().then(async ({ data }) => {
      if (data) await supabase.from("ticket_messages").insert({ ticket_id: data.id, user_id: banned.userId, content: appeal });
    });
    toast.success("Appeal submitted. Admins will review.");
    setBanned(null); setAppeal("");
  };

  return (
    <Layout>
      <div className="container max-w-md py-16">
        <Card className="glass p-8">
          <div className="text-center mb-6">
            <Crosshair className="h-10 w-10 text-primary mx-auto animate-glow-pulse" />
            <h1 className="text-3xl font-bold gradient-gold-text mt-2">Sign In</h1>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative">
                <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="btn-luxury w-full h-11 font-bold">
              {loading ? "Signing in..." : "ENTER ARENA"}
            </Button>
            <div className="flex justify-between text-xs">
              <Link to="/forgot-password" className="text-gold hover:underline">Forgot password?</Link>
              <Link to="/register" className="text-gold hover:underline">Create account</Link>
            </div>
          </form>
        </Card>
      </div>
      {banned && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <Card className="glass-gold border-destructive/50 max-w-md w-full p-6">
            <h2 className="text-2xl font-black text-red-400">Account Banned</h2>
            <p className="text-sm text-muted-foreground mt-2"><b>Reason:</b> {banned.reason || "No reason provided."}</p>
            <div className="mt-4">
              <label className="text-xs text-muted-foreground">Submit an appeal</label>
              <Textarea value={appeal} onChange={(e) => setAppeal(e.target.value)} placeholder="Explain your case..." />
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" className="flex-1" onClick={() => setBanned(null)}>Close</Button>
              <Button onClick={sendAppeal} className="btn-luxury flex-1" disabled={!appeal.trim()}>Send appeal</Button>
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
};

export default Login;