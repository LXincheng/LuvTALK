// Rarity color mappings for achievements
export const RARITY_COLORS = {
  common: 'from-slate-400 to-slate-500',
  rare: 'from-blue-400 to-cyan-500',
  epic: 'from-purple-400 to-pink-500',
  legendary: 'from-yellow-400 to-orange-500',
} as const;

export const RARITY_GLOW = {
  common: 'shadow-slate-500/20',
  rare: 'shadow-blue-500/30',
  epic: 'shadow-purple-500/40',
  legendary: 'shadow-yellow-500/50',
} as const;

// Audio MIME type preferences for voice recording
export const PREFERRED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
] as const;

// Voice recording MIME type preferences (browser MediaRecorder)
export const PREFERRED_RECORDING_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const;

// Default values for conversation settings
export const DEFAULTS = {
  targetLanguage: 'cantonese',
  nativeLanguage: 'zh',
} as const;

// Profile stat card icon color classes
export const STAT_COLOR_CLASSES = {
  indigo:
    'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
  green:
    'bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400',
  orange:
    'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400',
  purple:
    'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
} as const;

// Progress bar color classes
export const PROGRESS_COLORS = {
  indigo: 'bg-indigo-600 dark:bg-indigo-500',
  green: 'bg-green-600 dark:bg-green-500',
  purple: 'bg-purple-600 dark:bg-purple-500',
} as const;

export type RarityType = keyof typeof RARITY_COLORS;
export type StatColor = keyof typeof STAT_COLOR_CLASSES;
