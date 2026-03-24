import { useEffect, useState, useRef } from 'react';

const PARTICLE_COUNT = 18;
const DURATION_MS = 1500;

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

interface Particle {
  id: number;
  color: string;
  angle: number;
  speed: number;
  size: number;
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5,
    speed: 60 + Math.random() * 80,
    size: 4 + Math.random() * 5,
  }));
}

function getPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function ProgressCelebration({ trigger }: { trigger: boolean }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [reducedMotion] = useState(getPrefersReducedMotion);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!trigger) return;

    if (reducedMotion) {
      const t0 = setTimeout(() => setVisible(true), 0);
      const timer = setTimeout(() => setVisible(false), 1200);
      return () => { clearTimeout(t0); clearTimeout(timer); };
    }

    startRef.current = Date.now();

    // Use rAF to avoid synchronous setState in the effect body
    const initFrame = requestAnimationFrame(() => {
      setParticles(createParticles());
      setVisible(true);
      setProgress(0);

      const tick = () => {
        const elapsed = Date.now() - startRef.current;
        if (elapsed > DURATION_MS) {
          setVisible(false);
          setProgress(0);
          return;
        }
        setProgress(elapsed / DURATION_MS);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    });

    return () => { cancelAnimationFrame(initFrame); cancelAnimationFrame(rafRef.current); };
  }, [trigger, reducedMotion]);

  if (!visible) return null;

  if (reducedMotion) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <span className="text-4xl animate-pulse">✨</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${50 + Math.cos(p.angle) * p.speed * progress}%`,
            top: `${50 + Math.sin(p.angle) * p.speed * progress - 20 * progress + 40 * progress * progress}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: 1 - progress,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}
