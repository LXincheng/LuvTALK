import { motion } from 'motion/react';
import type { RealtimeStatus } from '../../hooks/useRealtimeSession';

interface AudioOrbProps {
  level: number;
  status: RealtimeStatus;
  isAiSpeaking: boolean;
}

export default function AudioOrb({ level, status, isAiSpeaking }: AudioOrbProps) {
  const clamped = Math.min(1, Math.max(0, level));
  const isConnected = status === 'connected';
  const auraScale = isAiSpeaking ? 1.015 + clamped * 0.055 : 1 + clamped * 0.022;
  const auraOpacity = isConnected ? 0.18 + clamped * 0.08 : 0.1;
  const vaporOpacity = isConnected ? 0.18 + clamped * 0.12 : 0.11;

  return (
    <div className="relative flex h-[17rem] w-[17rem] items-center justify-center md:h-[20rem] md:w-[20rem]">
      <motion.div
        aria-hidden="true"
        className="absolute inset-[6%] rounded-full immersive-orb-aura"
        animate={{
          scale: [1, auraScale, 1],
          opacity: [auraOpacity * 0.82, auraOpacity, auraOpacity * 0.82],
        }}
        transition={{
          duration: isAiSpeaking ? 1.8 : 4,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-[11%] rounded-full immersive-orb-vapor"
        animate={{
          rotate: isAiSpeaking ? 360 : 240,
          scale: [1, 1.008 + clamped * 0.02, 1],
          opacity: [vaporOpacity * 0.78, vaporOpacity, vaporOpacity * 0.78],
        }}
        transition={{
          rotate: { duration: isAiSpeaking ? 12 : 18, ease: 'linear', repeat: Infinity },
          scale: { duration: isAiSpeaking ? 1.8 : 3.6, ease: 'easeInOut', repeat: Infinity },
          opacity: { duration: isAiSpeaking ? 1.7 : 3.4, ease: 'easeInOut', repeat: Infinity },
        }}
      />

      <motion.div
        className="relative h-[9rem] w-[9rem] rounded-full md:h-[10.5rem] md:w-[10.5rem]"
        animate={{
          scale: [1, 1.008 + clamped * (isAiSpeaking ? 0.024 : 0.012), 1],
          y: isAiSpeaking ? [0, -1.2, 0] : [0, -0.6, 0],
        }}
        transition={{
          duration: isAiSpeaking ? 1.6 : 3.3,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      >
        <div className="absolute inset-0 rounded-full immersive-orb-core-shell" />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[7%] rounded-full immersive-orb-core-inner"
          animate={{
            rotate: isAiSpeaking ? 360 : -240,
            scale: [1, 1.015 + clamped * 0.012, 1],
          }}
          transition={{
            rotate: { duration: isAiSpeaking ? 9 : 14, ease: 'linear', repeat: Infinity },
            scale: { duration: isAiSpeaking ? 1.8 : 3.4, ease: 'easeInOut', repeat: Infinity },
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[4%] rounded-full immersive-orb-current"
          animate={{
            rotate: isAiSpeaking ? 360 : 220,
            opacity: isAiSpeaking ? [0.2, 0.34, 0.2] : [0.12, 0.18, 0.12],
          }}
          transition={{
            rotate: { duration: isAiSpeaking ? 10 : 16, ease: 'linear', repeat: Infinity },
            opacity: { duration: isAiSpeaking ? 1.7 : 3.5, ease: 'easeInOut', repeat: Infinity },
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[18%] rounded-full immersive-orb-core-pulse"
          animate={{
            scale: [1, 1.03 + clamped * 0.03, 1],
            opacity: isAiSpeaking ? [0.26, 0.42, 0.26] : [0.18, 0.28, 0.18],
          }}
          transition={{
            duration: isAiSpeaking ? 1.25 : 2.9,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-[24%] top-[16%] h-[22%] w-[20%] rounded-full immersive-orb-highlight"
          animate={{
            x: isAiSpeaking ? [0, 1.2, 0] : [0, 0.6, 0],
            y: isAiSpeaking ? [0, -1.2, 0] : [0, -0.6, 0],
          }}
          transition={{
            duration: isAiSpeaking ? 1.9 : 4.2,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      </motion.div>
    </div>
  );
}
