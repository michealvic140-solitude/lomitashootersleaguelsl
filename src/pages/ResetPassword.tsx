import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const ResetPassword = () => {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error("Min 6 chars"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); nav("/"); }
  };
  return (
    <Layout>
      <div className="container max-w-md py-16">
        <Card className="glass p-8">
          <h1 className="text-2xl font-bold gradient-gold-text mb-4 text-center">Set New Password</h1>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>New Password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
            <Button type="submit" disabled={loading} className="btn-luxury w-full">{loading ? "Updating..." : "Update Password"}</Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
};
export default ResetPassword;
