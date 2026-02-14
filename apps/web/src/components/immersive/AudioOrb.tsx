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
    const s = isActive ? 1 + clamped * 0.15 : 1;
    const glowSize = isActive ? 60 + clamped * 80 : 40;
    const glowAlpha = isActive ? 0.15 + clamped * 0.25 : 0.1;

    return {
      orb: {
        transform: `scale(${s})`,
        boxShadow: isAiSpeaking
          ? `0 0 ${glowSize * 1.2}px ${glowSize * 0.6}px rgba(168, 130, 255, ${glowAlpha * 1.3})`
          : `0 0 ${glowSize}px ${glowSize * 0.4}px rgba(120, 100, 255, ${glowAlpha})`,
        transition: 'transform 0.15s ease-out, box-shadow 0.2s ease-out',
      },
      ambient: {
        opacity: isActive ? 0.04 + clamped * 0.08 : 0.03,
        transform: `scale(${1 + clamped * 0.1})`,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      },
    };
  }, [clamped, isActive, isAiSpeaking]);

  return (
    <div className="relative flex items-center justify-center w-44 h-44 md:w-52 md:h-52">
      {/* Ambient glow */}
      <div
        className="absolute inset-[-20%] rounded-full bg-violet-500/10 blur-3xl"
        style={styles.ambient}
      />

      {/* Main orb */}
      <motion.div
        className={`relative w-28 h-28 md:w-36 md:h-36 rounded-full ${isConnecting ? 'animate-orb-pulse' : ''}`}
        style={styles.orb}
      >
        {/* Base gradient */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-700 ease-out ${
            isAiSpeaking
              ? 'bg-gradient-to-br from-violet-400 via-purple-400 to-fuchsia-500'
              : 'bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600'
          }`}
          style={{ opacity: isAiSpeaking ? 0.85 : 0.7 }}
        />

        {/* Glass sheen */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.15] via-transparent to-transparent" />

        {/* Inner depth */}
        <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-white/[0.05] to-transparent blur-sm" />

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-1.5 h-1.5 rounded-full bg-white/50"
            style={{
              opacity: isActive ? 0.4 + clamped * 0.6 : 0.2,
              transform: `scale(${1 + clamped * 1.2})`,
              transition: 'all 0.1s ease-out',
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
