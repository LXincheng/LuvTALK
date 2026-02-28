import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { RealtimeStatus } from '../../hooks/useRealtimeSession';

interface AudioOrbProps {
  level: number;
  status: RealtimeStatus;
  isAiSpeaking: boolean;
}

export default function AudioOrb({ level, status, isAiSpeaking }: AudioOrbProps) {
  const clamped = Math.min(1, Math.max(0, level));
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  const isActive = status === 'connected';

  const styles = useMemo(() => {
    const s = isActive ? 1 + clamped * 0.2 : 1;
    const glowSize = isActive ? 68 + clamped * 96 : 46;
    const glowAlpha = isActive ? 0.18 + clamped * 0.24 : 0.12;

    return {
      orb: {
        transform: `scale(${s})`,
        boxShadow: isAiSpeaking
          ? `0 0 ${glowSize * 1.2}px ${glowSize * 0.54}px rgba(54, 196, 206, ${glowAlpha * 1.35})`
          : `0 0 ${glowSize}px ${glowSize * 0.42}px rgba(127, 132, 255, ${glowAlpha})`,
        transition: 'transform 0.15s ease-out, box-shadow 0.2s ease-out',
      },
      ambient: {
        opacity: isActive ? 0.06 + clamped * 0.1 : 0.04,
        transform: `scale(${1 + clamped * 0.12})`,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      },
    };
  }, [clamped, isActive, isAiSpeaking]);

  return (
    <div className="relative flex items-center justify-center w-52 h-52 md:w-60 md:h-60">
      {/* Ambient glow */}
      <div
        className="absolute inset-[-24%] rounded-full bg-indigo-500/12 blur-3xl"
        style={styles.ambient}
      />
      <div className="absolute inset-[8%] rounded-full border border-white/[0.12]" />

      {/* Main orb */}
      <motion.div
        className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full ${isConnecting ? 'animate-orb-pulse' : ''}`}
        style={styles.orb}
      >
        {/* Base gradient */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-700 ease-out ${
            isAiSpeaking
              ? 'bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500'
              : 'bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500'
          }`}
          style={{ opacity: isAiSpeaking ? 0.92 : 0.78 }}
        />

        {/* Glass sheen */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.24] via-transparent to-transparent" />

        {/* Inner depth */}
        <div className="absolute inset-[14%] rounded-full bg-gradient-to-br from-white/[0.07] to-transparent blur-sm" />

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-2 h-2 rounded-full bg-white/80"
            style={{
              opacity: isActive ? 0.52 + clamped * 0.48 : 0.26,
              transform: `scale(${1 + clamped * 1.3})`,
              transition: 'all 0.1s ease-out',
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
