import type { User } from '@supabase/supabase-js';
import type { Locale } from '../providers/LocaleContext';
import type { AchievementSummary } from '../services/achievementService';

const LEVEL_LABELS: Record<number, { zh: string; en: string }> = {
  1: { zh: '初学者', en: 'Beginner' },
  2: { zh: '新手', en: 'Novice' },
  3: { zh: '学习者', en: 'Learner' },
  4: { zh: '中级', en: 'Intermediate' },
  5: { zh: '高级', en: 'Advanced' },
  6: { zh: '专家', en: 'Expert' },
  7: { zh: '大师', en: 'Master' },
  8: { zh: '传奇', en: 'Legend' },
};

export function isAnonymousAppUser(user: User | null | undefined) {
  return !user || user.is_anonymous === true || user.app_metadata?.provider === 'anonymous';
}

export function getDisplayName(user: User | null | undefined, fallbackGuest: string, fallbackLearner: string) {
  const isGuest = isAnonymousAppUser(user);
  return (
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    user?.phone ||
    (isGuest ? fallbackGuest : fallbackLearner)
  );
}

export function getInitials(displayName: string) {
  return displayName.trim().slice(0, 2).toUpperCase();
}

export function getLevelLabel(level: number | undefined, locale: Locale) {
  if (!level || !LEVEL_LABELS[level]) {
    return locale === 'zh' ? '未定级' : 'Unranked';
  }
  return LEVEL_LABELS[level][locale];
}

export function getUserMetaLine(params: {
  user: User | null | undefined;
  summary: AchievementSummary | null | undefined;
  locale: Locale;
  guestLabel: string;
}) {
  if (isAnonymousAppUser(params.user)) {
    return params.guestLabel;
  }

  const level = getLevelLabel(params.summary?.currentLevel, params.locale);
  const xp = params.summary?.totalXp ?? 0;
  return params.locale === 'zh' ? `${level} · ${xp} XP` : `${level} · ${xp} XP`;
}
