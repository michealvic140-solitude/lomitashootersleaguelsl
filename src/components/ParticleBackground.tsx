import { useMemo } from "react";
import { Skull, Crosshair, Target } from "lucide-react";

export const ParticleBackground = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 6,
        size: 4 + Math.random() * 10,
      })),
    [],
  );

  const icons = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: Math.random() * 95,
        top: Math.random() * 95,
        delay: Math.random() * 6,
        Icon: [Skull, Crosshair, Target][i % 3],
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl animate-glow-pulse" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl animate-glow-pulse" />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary/40 animate-float"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      {icons.map(({ id, left, top, delay, Icon }) => (
        <Icon
          key={id}
          className="absolute text-primary/10 animate-float"
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
          size={48}
        />
      ))}
    </div>
  );
};