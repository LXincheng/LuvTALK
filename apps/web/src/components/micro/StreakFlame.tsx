import { motion } from 'motion/react';

interface StreakFlameProps {
  streak: number;
}

export default function StreakFlame({ streak }: StreakFlameProps) {
  if (streak <= 0) return null;

  return (
    <motion.span
      className="inline-flex items-center streak-flame"
      animate={{ scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        className="drop-shadow-sm"
      >
        <path
          d="M12 2C12 2 4.5 10 4.5 15C4.5 19.14 7.86 22 12 22C16.14 22 19.5 19.14 19.5 15C19.5 10 12 2 12 2Z"
          fill="url(#flame-gradient)"
        />
        <path
          d="M12 10C12 10 9 13.5 9 16C9 17.66 10.34 19 12 19C13.66 19 15 17.66 15 16C15 13.5 12 10 12 10Z"
          fill="url(#flame-inner)"
        />
        <defs>
          <linearGradient id="flame-gradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF9500" />
            <stop offset="1" stopColor="#FF3B30" />
          </linearGradient>
          <linearGradient id="flame-inner" x1="12" y1="10" x2="12" y2="19" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD60A" />
            <stop offset="1" stopColor="#FF9500" />
          </linearGradient>
        </defs>
      </svg>
    </motion.span>
  );
}
