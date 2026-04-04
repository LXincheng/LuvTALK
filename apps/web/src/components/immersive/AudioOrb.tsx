import { motion } from 'motion/react';
import type { RealtimeStatus } from '../../hooks/useRealtimeSession';

interface AudioOrbProps {
  level: number;
  status: RealtimeStatus;
  isAiSpeaking: boolean;
}

export default function AudioOrb({ level, status, isAiSpeaking }: AudioOrbProps) {
  const energy = Math.min(1, Math.max(0, level));
  const isConnected = status === 'connected';
  const phaseScale = isAiSpeaking ? 1.07 + energy * 0.09 : 1.02 + energy * 0.04;
  const auraOpacity = isConnected ? 0.22 + energy * 0.24 : 0.1;

  return (
    <div className="relative flex h-[18rem] w-[18rem] items-center justify-center md:h-[22rem] md:w-[22rem]">
      <motion.div
        aria-hidden="true"
        className="absolute inset-[7%] rounded-full immersive-orb-shadow"
        animate={{
          scale: [1, 1.05 + energy * 0.06, 1],
          opacity: [0.38, 0.68, 0.38],
        }}
        transition={{
          duration: isAiSpeaking ? 2.4 : 5.6,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-[1%] rounded-full immersive-orb-atmosphere"
        animate={{
          scale: [1, phaseScale, 1],
          opacity: [auraOpacity * 0.7, auraOpacity, auraOpacity * 0.7],
        }}
        transition={{
          duration: isAiSpeaking ? 2.2 : 5,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-[12%] rounded-full immersive-orb-halo"
        animate={{
          rotate: isAiSpeaking ? 360 : 240,
          scale: [1, 1.02 + energy * 0.03, 1],
        }}
        transition={{
          rotate: { duration: isAiSpeaking ? 14 : 24, ease: 'linear', repeat: Infinity },
          scale: { duration: isAiSpeaking ? 2 : 4.8, ease: 'easeInOut', repeat: Infinity },
        }}
      />

      <motion.div
        className="relative h-[10.5rem] w-[10.5rem] rounded-full md:h-[13rem] md:w-[13rem]"
        animate={{
          scale: [1, 1.012 + energy * (isAiSpeaking ? 0.045 : 0.02), 1],
          y: isAiSpeaking ? [0, -2, 0] : [0, -0.8, 0],
        }}
        transition={{
          duration: isAiSpeaking ? 1.9 : 4.2,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      >
        <div className="absolute inset-0 rounded-full immersive-orb-shell" />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[-4%] rounded-full immersive-orb-current"
          animate={{
            rotate: isAiSpeaking ? 360 : 220,
            scale: [1, 1.02 + energy * 0.035, 1],
            opacity: isConnected ? [0.34, 0.58, 0.34] : [0.16, 0.24, 0.16],
          }}
          transition={{
            rotate: { duration: isAiSpeaking ? 12 : 24, ease: 'linear', repeat: Infinity },
            scale: { duration: isAiSpeaking ? 1.8 : 4.8, ease: 'easeInOut', repeat: Infinity },
            opacity: { duration: isAiSpeaking ? 2 : 4.8, ease: 'easeInOut', repeat: Infinity },
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[4%] rounded-full immersive-orb-clouds"
          animate={{
            rotate: isAiSpeaking ? 360 : 180,
            scale: [1, 1.018 + energy * 0.024, 1],
          }}
          transition={{
            rotate: { duration: isAiSpeaking ? 18 : 30, ease: 'linear', repeat: Infinity },
            scale: { duration: isAiSpeaking ? 2.1 : 5, ease: 'easeInOut', repeat: Infinity },
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[12%] rounded-full immersive-orb-depth"
          animate={{
            rotate: isAiSpeaking ? -360 : -220,
            opacity: isAiSpeaking ? [0.36, 0.6, 0.36] : [0.24, 0.42, 0.24],
          }}
          transition={{
            rotate: { duration: isAiSpeaking ? 16 : 28, ease: 'linear', repeat: Infinity },
            opacity: { duration: isAiSpeaking ? 1.8 : 4.2, ease: 'easeInOut', repeat: Infinity },
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[19%] rounded-full immersive-orb-core"
          animate={{
            scale: [1, 1.05 + energy * 0.045, 1],
            opacity: isAiSpeaking ? [0.44, 0.74, 0.44] : [0.28, 0.52, 0.28],
          }}
          transition={{
            duration: isAiSpeaking ? 1.5 : 3.6,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-[24%] rounded-full immersive-orb-breath"
          animate={{
            scale: [1, 1.06 + energy * 0.03, 1],
            opacity: isAiSpeaking ? [0.22, 0.46, 0.22] : [0.12, 0.28, 0.12],
          }}
          transition={{
            duration: isAiSpeaking ? 1.9 : 4.4,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-[18%] top-[14%] h-[30%] w-[28%] rounded-full immersive-orb-specular"
          animate={{
            x: isAiSpeaking ? [0, 2.2, 0] : [0, 0.8, 0],
            y: isAiSpeaking ? [0, -2.8, 0] : [0, -0.8, 0],
          }}
          transition={{
            duration: isAiSpeaking ? 2 : 4.8,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      </motion.div>
    </div>
  );
}
