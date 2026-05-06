import { ReactNode, useState, createContext, useContext } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

interface ConfirmOpts {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  reasonRequired?: boolean;
  inputLabel?: string;
  inputType?: "text" | "number";
  inputPlaceholder?: string;
  defaultValue?: string;
}
interface Resolved { confirmed: boolean; reason?: string; value?: string; }

interface Ctx { confirm: (o: ConfirmOpts) => Promise<Resolved>; }
const C = createContext<Ctx | undefined>(undefined);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const [resolver, setResolver] = useState<((r: Resolved) => void) | null>(null);
  const [reason, setReason] = useState("");
  const [value, setValue] = useState("");

  const confirm = (o: ConfirmOpts) => new Promise<Resolved>((res) => {
    setOpts(o); setReason(""); setValue(o.defaultValue ?? "");
    setResolver(() => res);
  });
  const close = (r: Resolved) => { resolver?.(r); setOpts(null); setResolver(null); };

  return (
    <C.Provider value={{ confirm }}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => { if (!o) close({ confirmed: false }); }}>
        <DialogContent className="glass-gold border-gold/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {opts?.destructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
              <span className="gradient-gold-text">{opts?.title}</span>
            </DialogTitle>
            {opts?.description && <DialogDescription>{opts.description}</DialogDescription>}
          </DialogHeader>
          {opts?.inputLabel && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{opts.inputLabel}</label>
              <Input type={opts.inputType ?? "text"} placeholder={opts.inputPlaceholder} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
          {opts?.reasonRequired && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Reason (required)</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain..." />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => close({ confirmed: false })}>Cancel</Button>
            <Button
              className={opts?.destructive ? "" : "btn-luxury"}
              variant={opts?.destructive ? "destructive" : "default"}
              disabled={(opts?.reasonRequired && !reason.trim()) || (!!opts?.inputLabel && !value.trim())}
              onClick={() => close({ confirmed: true, reason, value })}
            >
              {opts?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </C.Provider>
  );
};

export const useConfirm = () => {
  const c = useContext(C);
  if (!c) throw new Error("useConfirm must be inside ConfirmProvider");
  return c.confirm;
};