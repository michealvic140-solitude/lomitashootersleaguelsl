import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Profile = () => {
  const { user, profile, roles, loading, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", discord_username: "", country: "", server: "", gang_name: "" });
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) return <Layout><div className="container py-12">Loading...</div></Layout>;
  if (!user || !profile) return <Navigate to="/login" replace />;

  const init = form.full_name === "" ? { full_name: profile.full_name, phone: profile.phone ?? "", discord_username: profile.discord_username ?? "", country: profile.country ?? "", server: profile.server ?? "", gang_name: profile.gang_name ?? "" } : form;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update(init).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); await refresh(); }
  };

  const changePw = async () => {
    if (pw.length < 6) return toast.error("Min 6 chars");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message);
    else { toast.success("Password changed"); setPw(""); }
  };

  return (
    <Layout>
      <div className="container max-w-3xl py-8 space-y-6">
        <Card className="glass p-6">
          <h2 className="text-2xl font-bold gradient-gold-text mb-1">{profile.full_name}</h2>
          {profile.gang_name && <p className="text-gold text-sm">{profile.gang_name} ({profile.gang_type})</p>}
          <div className="flex flex-wrap gap-1 mt-3">
            {roles.map((r) => <Badge key={r} variant="outline" className={ROLE_COLORS[r]}>{ROLE_LABELS[r]}</Badge>)}
          </div>
        </Card>

        <Card className="glass p-6 space-y-4">
          <h3 className="font-bold">Edit Profile</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Full name</Label><Input value={init.full_name} onChange={(e) => setForm({ ...init, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={init.phone} onChange={(e) => setForm({ ...init, phone: e.target.value })} /></div>
            <div><Label>Discord</Label><Input value={init.discord_username} onChange={(e) => setForm({ ...init, discord_username: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={init.country} onChange={(e) => setForm({ ...init, country: e.target.value })} /></div>
            <div><Label>Server</Label><Input value={init.server} onChange={(e) => setForm({ ...init, server: e.target.value })} /></div>
            <div><Label>Gang/Faction name</Label><Input value={init.gang_name} onChange={(e) => setForm({ ...init, gang_name: e.target.value })} /></div>
          </div>
          <Button onClick={save} disabled={saving} className="btn-luxury">{saving ? "Saving..." : "Save changes"}</Button>
        </Card>

        <Card className="glass p-6 space-y-3">
          <h3 className="font-bold">Change Password</h3>
          <Input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button onClick={changePw} className="btn-luxury">Update password</Button>
        </Card>
      </div>
    </Layout>
  );
};
export default Profile;
