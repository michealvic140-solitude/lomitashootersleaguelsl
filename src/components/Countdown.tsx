import { useEffect, useState } from "react";

const calc = (target: Date) => {
  const diff = Math.max(0, target.getTime() - Date.now());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s, done: diff === 0 };
};

const pad = (n: number) => String(n).padStart(2, "0");

export const Countdown = ({ target }: { target: string | Date }) => {
  const t = typeof target === "string" ? new Date(target) : target;
  const [v, setV] = useState(() => calc(t));
  useEffect(() => {
    const id = setInterval(() => setV(calc(t)), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (v.done) return <span className="text-gold font-mono">LIVE</span>;
  return (
    <span className="font-mono text-gold tracking-wider tabular-nums">
      {pad(v.d)}:{pad(v.h)}:{pad(v.m)}:{pad(v.s)}
    </span>
  );
};