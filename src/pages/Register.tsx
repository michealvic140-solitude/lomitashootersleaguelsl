import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Eye, EyeOff, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const schema = z.object({
  full_name: z.string().trim().min(2, "Name too short").max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  discord_username: z.string().trim().max(50).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  server: z.string().trim().max(40),
  gang_name: z.string().trim().min(1, "Gang/Faction name required").max(60),
  gang_type: z.enum(["G", "F"]),
  password: z.string().min(6, "Password must be 6+ chars").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

const Register = () => {
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [show2, setShow2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", discord_username: "",
    country: "", server: "LOMITA AFR", gang_name: "", gang_type: "G" as "G" | "F",
    password: "", confirm: "",
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.full_name,
          phone: form.phone,
          discord_username: form.discord_username,
          country: form.country,
          server: form.server,
          gang_name: form.gang_name,
          gang_type: form.gang_type,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome to the League! Check your email to verify.");
    nav("/");
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-12">
        <Card className="glass p-8">
          <div className="text-center mb-6">
            <Crosshair className="h-10 w-10 text-primary mx-auto animate-glow-pulse" />
            <h1 className="text-3xl font-bold gradient-gold-text mt-2">Join the League</h1>
            <p className="text-sm text-muted-foreground">Forge your legend in Lomita Shooters League</p>
          </div>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Preferred / In-game Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label>Discord Username</Label>
              <Input value={form.discord_username} onChange={(e) => update("discord_username", e.target.value)} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
            </div>
            <div>
              <Label>Server</Label>
              <Input value={form.server} onChange={(e) => update("server", e.target.value)} placeholder="LOMITA AFR" />
            </div>
            <div>
              <Label>Gang / Faction Type</Label>
              <Select value={form.gang_type} onValueChange={(v) => update("gang_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="G">G — Gang</SelectItem>
                  <SelectItem value="F">F — Faction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Gang / Faction Name *</Label>
              <Input value={form.gang_name} onChange={(e) => update("gang_name", e.target.value)} required />
            </div>
            <div>
              <Label>Password *</Label>
              <div className="relative">
                <Input type={show ? "text" : "password"} value={form.password} onChange={(e) => update("password", e.target.value)} required />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm Password *</Label>
              <div className="relative">
                <Input type={show2 ? "text" : "password"} value={form.confirm} onChange={(e) => update("confirm", e.target.value)} required />
                <button type="button" onClick={() => setShow2((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col gap-3 mt-2">
              <Button type="submit" disabled={loading} className="btn-luxury h-11 text-base font-bold">
                {loading ? "Creating account..." : "ENTER THE ARENA"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Already a shooter?{" "}
                <Link to="/login" className="text-gold hover:underline">Sign in</Link>
              </p>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default Register;