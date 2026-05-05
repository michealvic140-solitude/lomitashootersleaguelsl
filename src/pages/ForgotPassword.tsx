import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Reset email sent if account exists.");
  };
  return (
    <Layout>
      <div className="container max-w-md py-16">
        <Card className="glass p-8">
          <h1 className="text-2xl font-bold gradient-gold-text mb-4 text-center">Reset Password</h1>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <Button type="submit" disabled={loading} className="btn-luxury w-full">{loading ? "Sending..." : "Send Reset Link"}</Button>
            <p className="text-xs text-center"><Link to="/login" className="text-gold hover:underline">Back to sign in</Link></p>
          </form>
        </Card>
      </div>
    </Layout>
  );
};
export default ForgotPassword;
