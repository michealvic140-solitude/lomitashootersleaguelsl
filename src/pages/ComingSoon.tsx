import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Crosshair } from "lucide-react";

const ComingSoon = ({ title }: { title: string }) => (
  <Layout>
    <div className="container max-w-2xl py-20">
      <Card className="glass p-12 text-center">
        <Crosshair className="h-12 w-12 text-primary mx-auto mb-4 animate-glow-pulse" />
        <h1 className="text-3xl font-bold gradient-gold-text mb-2">{title}</h1>
        <p className="text-muted-foreground">This section is being forged in the armory. Check back soon.</p>
      </Card>
    </div>
  </Layout>
);
export default ComingSoon;