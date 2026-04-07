import { useCallback, useEffect, useMemo, useState } from 'react';
import { Target, Award, TrendingUp, Calendar, Trophy, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import { useLocale } from '../providers/LocaleContext';
import type { LocaleKey } from '../providers/LocaleContext';
import { toast } from '../utils/toast';
import StreakFlame from '../components/micro/StreakFlame';
import { STAT_COLOR_CLASSES, PROGRESS_COLORS } from '../constants/ui';
import type { StatColor } from '../constants/ui';
import { fetchAchievementSummaryCached, fetchAchievementsCached } from '../services/achievementService';
import type { AchievementSummary, AchievementWithProgress } from '../services/achievementService';
import {
  fetchLearningGoalCached,
  saveLearningGoal,
  type LearningGoalPayload,
} from '../services/learningGoalService';
import { getDisplayName, getInitials, getUserMetaLine } from '../utils/userProfile';

/* ─── Font-size scale (decoupled from components) ─── */
const TXT = {
  /** Page title / hero name */
  title: 'text-xl font-semibold',
  /** Section heading */
  section: 'text-base font-semibold',
  /** Card primary value */
  value: 'text-2xl font-bold tabular-nums',
  /** Body / label */
  body: 'text-sm',
  /** Caption / meta */
  caption: 'text-xs',
} as const;

export default function ProfilePage() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userKey = user?.id ?? 'guest';
  const displayName = getDisplayName(user, t('profileGuest'), t('profileLearner'));
  const initials = getInitials(displayName);

  /* ─── State ─── */
  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const [recentUnlocked, setRecentUnlocked] = useState<AchievementWithProgress[]>([]);
  const [goalData, setGoalData] = useState<LearningGoalPayload | null>(null);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ dailyMinutes: 10, weeklyWords: 20, weeklySpeaking: 3 });
  const [, setIsGoalRefreshing] = useState(false);

  /* ─── Data fetching ─── */
  useEffect(() => {
    const { cached: cachedS, fresh: freshS } = fetchAchievementSummaryCached(userKey);
    const { cached: cachedA, fresh: freshA } = fetchAchievementsCached(userKey);
    if (cachedS) setSummary(cachedS);
    if (cachedA) setRecentUnlocked(cachedA.filter((a) => a.unlocked).slice(0, 3));
    freshS.then(setSummary).catch(() => {});
    freshA.then((all) => setRecentUnlocked(all.filter((a) => a.unlocked).slice(0, 3))).catch(() => {});
  }, [userKey]);

  const refreshLearningGoal = useCallback(async (showError = true) => {
    setIsGoalRefreshing(true);
    try {
      const next = await fetchLearningGoalCached().fresh;
      setGoalData(next);
      setGoalDraft({ dailyMinutes: next.goal.dailyMinutes, weeklyWords: next.goal.weeklyWords, weeklySpeaking: next.goal.weeklySpeaking });
    } catch {
      if (showError) toast.error(t('profileGoalLoadError'), { id: 'profile-goal' });
    } finally {
      setIsGoalRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    const { cached, fresh } = fetchLearningGoalCached();
    if (cached) {
      setGoalData(cached);
      setGoalDraft({ dailyMinutes: cached.goal.dailyMinutes, weeklyWords: cached.goal.weeklyWords, weeklySpeaking: cached.goal.weeklySpeaking });
    }
    fresh.then((d) => {
      setGoalData(d);
      setGoalDraft({ dailyMinutes: d.goal.dailyMinutes, weeklyWords: d.goal.weeklyWords, weeklySpeaking: d.goal.weeklySpeaking });
    }).catch(() => { toast.error(t('profileGoalLoadError'), { id: 'profile-goal' }); });
  }, [t]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshLearningGoal(false);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [refreshLearningGoal]);

  /* ─── Derived ─── */
  const stats: { labelKey: LocaleKey; value: string; icon: typeof Calendar; color: StatColor }[] = [
    { labelKey: 'profileStatSessions', value: summary ? String(summary.conversationCount) : '--', icon: Calendar, color: 'indigo' },
    { labelKey: 'profileStatWords', value: summary ? String(summary.vocabCount) : '--', icon: Award, color: 'green' },
    { labelKey: 'profileStatStreak', value: summary ? String(summary.streakDays) : '--', icon: TrendingUp, color: 'orange' },
    { labelKey: 'profileStatLevel', value: summary ? String(summary.currentLevel) : '--', icon: Target, color: 'purple' },
  ];

  const progressBars = [
    {
      label: t('profileVocabulary'),
      valueLabel: summary ? `${summary.vocabCount} ${t('profileWordsUnit')}` : '--',
      width: `${Math.min(100, ((summary?.vocabCount ?? 0) / 500) * 100)}%`,
      color: PROGRESS_COLORS.indigo,
    },
    {
      label: t('profilePractice'),
      valueLabel: summary ? `${summary.conversationCount} ${t('profileSessionsUnit')}` : '--',
      width: `${Math.min(100, ((summary?.conversationCount ?? 0) / 100) * 100)}%`,
      color: PROGRESS_COLORS.green,
    },
    {
      label: t('profilePronunciation'),
      valueLabel: summary?.averageScore != null ? `${summary.averageScore}/100` : t('profileNotEnoughData'),
      width: `${Math.min(100, Math.max(0, summary?.averageScore ?? 0))}%`,
      color: PROGRESS_COLORS.purple,
    },
  ];

  const metaLine = getUserMetaLine({
    user,
    summary,
    locale,
    guestLabel: t('profileGuestModeSimple'),
  });

  const goalUpdatedText = useMemo(() => {
    if (!goalData?.goal.updatedAt) return t('profileGoalNotSet');
    const date = new Date(goalData.goal.updatedAt);
    if (Number.isNaN(date.getTime())) return t('profileGoalNotSet');
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  }, [goalData?.goal.updatedAt, locale, t]);

  async function handleSaveGoal() {
    if (isSavingGoal) return;
    const payload = {
      dailyMinutes: Math.min(180, Math.max(5, Math.round(goalDraft.dailyMinutes || 0))),
      weeklyWords: Math.min(500, Math.max(5, Math.round(goalDraft.weeklyWords || 0))),
      weeklySpeaking: Math.min(50, Math.max(1, Math.round(goalDraft.weeklySpeaking || 0))),
    };
    setIsSavingGoal(true);
    try {
      const next = await saveLearningGoal(payload);
      setGoalData(next);
      setGoalDraft({ dailyMinutes: next.goal.dailyMinutes, weeklyWords: next.goal.weeklyWords, weeklySpeaking: next.goal.weeklySpeaking });
      toast.success(t('profileGoalSaved'), { id: 'profile-goal-save' });
    } catch {
      toast.error(t('profileGoalSaveError'), { id: 'profile-goal-save' });
    } finally {
      setIsSavingGoal(false);
    }
  }

  /* ─── Render ─── */
  return (
    <div className="page-shell h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:py-6">

        {/* ── Hero ── */}
        <section className="page-panel mb-4 rounded-[28px] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#5856D6] text-lg font-bold text-white">
              {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className={`${TXT.title} truncate text-label`}>{displayName}</h1>
                <p className={`${TXT.caption} mt-0.5 truncate text-label-secondary`}>
                  {metaLine}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                onClick={() => navigate('/achievements')}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-warning px-3.5 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(245,158,11,0.18)] transition hover:opacity-90 sm:w-auto"
              >
                <Trophy className="h-4 w-4" />
                {t('profileAchievementHall')}
              </button>
              {user ? (
                <button
                  onClick={async () => { await signOut(); }}
                  className="page-chip inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-medium text-label-secondary transition hover:bg-fill-secondary dark:text-slate-200 sm:w-auto"
                >
                  <LogOut className="h-4 w-4" />
                  {t('profileLogout')}
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full rounded-2xl bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(37,99,235,0.2)] transition hover:opacity-90 sm:w-auto"
                >
                  {t('profileSignIn')}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Stats grid ── */}
        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.labelKey} className="page-panel rounded-[24px] p-4">
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${STAT_COLOR_CLASSES[stat.color]}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className={`${TXT.value} text-label flex items-center gap-1`}>
                  {stat.value}
                  {stat.labelKey === 'profileStatStreak' && <StreakFlame streak={Number(stat.value) || 0} />}
                </p>
                <p className={`${TXT.caption} text-label-secondary`}>{t(stat.labelKey)}</p>
              </div>
            );
          })}
        </section>

        {/* ── Learning progress ── */}
        <section className="page-panel mb-4 rounded-[28px] p-5">
          <h2 className={`${TXT.section} text-label mb-3`}>{t('profileProgress')}</h2>
          <div className="space-y-3">
            {progressBars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={`${TXT.body} font-medium text-label-secondary`}>{bar.label}</span>
                  <span className={`${TXT.caption} text-label-tertiary`}>{bar.valueLabel}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
                  <div className={`${bar.color} h-full rounded-full transition-all`} style={{ width: bar.width }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Learning goals ── */}
        <section className="page-panel mb-4 rounded-[30px] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className={`${TXT.section} text-label`}>{t('profileLearningGoalTitle')}</h2>
            </div>
            <span className={`${TXT.caption} shrink-0 text-label-tertiary`}>
              {t('profileGoalUpdatedAt')} {goalUpdatedText}
            </span>
          </div>

          {/* Overall donut + progress */}
          {goalData ? (
            <div className="page-panel-soft mb-4 flex items-center gap-4 rounded-[24px] p-4">
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative h-16 w-16 shrink-0"
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: `conic-gradient(var(--color-primary) ${goalData.completion.overall}%, rgba(148,163,184,0.15) 0%)` }}
                />
                <div className="absolute inset-[5px] flex items-center justify-center rounded-full border border-separator bg-surface-elevated">
                  <span className={`${TXT.body} font-semibold text-label`}>{goalData.completion.overall}%</span>
                </div>
              </motion.div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <GoalProgressRow label={t('profileGoalDailyMinutes')} value={goalData.progress.dailyMinutes} target={goalData.goal.dailyMinutes} percent={goalData.completion.dailyMinutes} barClass="from-cyan-500 to-blue-500" />
                <GoalProgressRow label={t('profileGoalWeeklyWords')} value={goalData.progress.weeklyWords} target={goalData.goal.weeklyWords} percent={goalData.completion.weeklyWords} barClass="from-emerald-500 to-teal-500" />
                <GoalProgressRow label={t('profileGoalWeeklySpeaking')} value={goalData.progress.weeklySpeaking} target={goalData.goal.weeklySpeaking} percent={goalData.completion.weeklySpeaking} barClass="from-indigo-500 to-fuchsia-500" />
              </div>
            </div>
          ) : null}

          {/* Goal inputs */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GoalInput label={t('profileGoalDailyMinutes')} min={5} max={180} value={goalDraft.dailyMinutes} onChange={(v) => setGoalDraft((p) => ({ ...p, dailyMinutes: v }))} />
            <GoalInput label={t('profileGoalWeeklyWords')} min={5} max={500} value={goalDraft.weeklyWords} onChange={(v) => setGoalDraft((p) => ({ ...p, weeklyWords: v }))} />
            <GoalInput label={t('profileGoalWeeklySpeaking')} min={1} max={50} value={goalDraft.weeklySpeaking} onChange={(v) => setGoalDraft((p) => ({ ...p, weeklySpeaking: v }))} />
          </div>
          <button
            onClick={handleSaveGoal}
            disabled={isSavingGoal}
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(37,99,235,0.2)] transition hover:opacity-90 disabled:opacity-50"
          >
            {isSavingGoal ? t('profileGoalSaving') : t('profileGoalSave')}
          </button>
        </section>

        {/* ── Recent achievements ── */}
        <section className="page-panel rounded-[28px] p-5">
          <h2 className={`${TXT.section} text-label mb-3`}>{t('profileAchievements')}</h2>
          {recentUnlocked.length > 0 ? (
            <div className="space-y-2">
              {recentUnlocked.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-[18px] p-3 transition hover:bg-fill-secondary">
                  <span className="text-2xl">{a.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`${TXT.body} font-medium text-label`}>{a.title}</p>
                    <p className={`${TXT.caption} text-label-secondary`}>{a.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`${TXT.body} py-4 text-center text-label-tertiary`}>{t('profileNoAchievements')}</p>
          )}
        </section>

      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function GoalInput({ label, min, max, value, onChange }: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-label-secondary">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-[18px] border border-separator bg-[var(--surface-panel-soft)] px-3 py-3 text-sm text-label outline-none transition focus:border-primary focus:bg-[var(--surface-panel)] dark:text-slate-100"
      />
    </label>
  );
}

function GoalProgressRow({ label, value, target, percent, barClass }: {
  label: string;
  value: number;
  target: number;
  percent: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs text-label-secondary">
        <span>{label}</span>
        <span className="tabular-nums">{value}/{target}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
        <motion.div
          className={`h-full bg-gradient-to-r ${barClass}`}
          animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
