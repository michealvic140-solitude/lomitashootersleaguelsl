export function teamColor(name?: string | null): string {
  const palette = [
    "linear-gradient(135deg,#10b981,#059669)",
    "linear-gradient(135deg,#f59e0b,#d97706)",
    "linear-gradient(135deg,#ef4444,#b91c1c)",
    "linear-gradient(135deg,#3b82f6,#1d4ed8)",
    "linear-gradient(135deg,#a855f7,#7e22ce)",
    "linear-gradient(135deg,#ec4899,#be185d)",
    "linear-gradient(135deg,#14b8a6,#0f766e)",
    "linear-gradient(135deg,#eab308,#a16207)",
  ];
  const s = (name ?? "?").toString();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}