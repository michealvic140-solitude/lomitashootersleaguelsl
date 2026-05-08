import { createContext, useContext, useState, ReactNode } from "react";

export interface SlipSelection {
  match_id: string;
  match_name: string;
  market_id: string;
  market_name: string;
  odd_id: string;
  selection_label: string;
  odds: number;
}

interface Ctx {
  selections: SlipSelection[];
  add: (s: SlipSelection) => void;
  remove: (oddId: string) => void;
  clear: () => void;
  reorder: (from: number, to: number) => void;
  totalOdds: number;
}

const C = createContext<Ctx | undefined>(undefined);

export const BetSlipProvider = ({ children }: { children: ReactNode }) => {
  const [selections, setSelections] = useState<SlipSelection[]>([]);
  const add = (s: SlipSelection) =>
    setSelections((prev) => {
      const filtered = prev.filter((x) => x.match_id !== s.match_id);
      return [...filtered, s];
    });
  const remove = (oddId: string) => setSelections((p) => p.filter((s) => s.odd_id !== oddId));
  const clear = () => setSelections([]);
  const reorder = (from: number, to: number) =>
    setSelections((prev) => {
      const arr = [...prev];
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return arr;
    });
  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  return <C.Provider value={{ selections, add, remove, clear, reorder, totalOdds }}>{children}</C.Provider>;
};

export const useBetSlip = () => {
  const c = useContext(C);
  if (!c) throw new Error("useBetSlip must be in BetSlipProvider");
  return c;
};
