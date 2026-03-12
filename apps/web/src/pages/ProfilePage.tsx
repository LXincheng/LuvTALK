import { useCallback, useEffect, useMemo, useState } from 'react';
import { Target, Award, TrendingUp, Calendar, Trophy, LogOut, Timer } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import { useLocale } from '../providers/LocaleContext';
import type { LocaleKey } from '../providers/LocaleContext';
import { STAT_COLOR_CLASSES, PROGRESS_COLORS } from '../constants/ui';
import type { StatColor } from '../constants/ui';
import { fetchAchievementSummaryCached, fetchAchievementsCached } from '../services/achievementService';
import type { AchievementSummary, AchievementWithProgress } from '../services/achievementService';
import {
  fetchLearningGoalCached,
  saveLearningGoal,
  type LearningGoalPayload,
} from '../services/learningGoalService';

export default function ProfilePage() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGuest = user?.app_metadata?.provider === 'anonymous';
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    user?.phone ||
    (isGuest ? t('profileGuest') : t('profileLearner'));

  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const [recentUnlocked, setRecentUnlocked] = useState<AchievementWithProgress[]>([]);
  const [goalData, setGoalData] = useState<LearningGoalPayload | null>(null);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState({
    dailyMinutes: 10,
    weeklyWords: 20,
    weeklySpeaking: 3,
  });
  const [isGoalRefreshing, setIsGoalRefreshing] = useState(false);

  useEffect(() => {
    const { cached: cachedS, fresh: freshS } = fetchAchievementSummaryCached();
    const { cached: cachedA, fresh: freshA } = fetchAchievementsCached();
    if (cachedS) setSummary(cachedS);
    if (cachedA) setRecentUnlocked(cachedA.filter((a) => a.unlocked).slice(0, 3));
    freshS.then(setSummary).catch(() => {});
    freshA
      .then((all) => setRecentUnlocked(all.filter((a) => a.unlocked).slice(0, 3)))
      .catch(() => {});
  }, []);

  const refreshLearningGoal = useCallback(async (showErrorToast = true) => {
    setIsGoalRefreshing(true);
    try {
      const next = await fetchLearningGoalCached().fresh;
      setGoalData(next);
      setGoalDraft({
        dailyMinutes: next.goal.dailyMinutes,
        weeklyWords: next.goal.weeklyWords,
        weeklySpeaking: next.goal.weeklySpeaking,
      });
    } catch {
      if (showErrorToast) {
        toast.error(t('profileGoalLoadError'));
      }
    } finally {
      setIsGoalRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    const { cached, fresh } = fetchLearningGoalCached();
    if (cached) {
      setGoalData(cached);
      setGoalDraft({
        dailyMinutes: cached.goal.dailyMinutes,
        weeklyWords: cached.goal.weeklyWords,
        weeklySpeaking: cached.goal.weeklySpeaking,
      });
    }
    fresh
      .then((data) => {
        setGoalData(data);
        setGoalDraft({
          dailyMinutes: data.goal.dailyMinutes,
          weeklyWords: data.goal.weeklyWords,
          weeklySpeaking: data.goal.weeklySpeaking,
        });
      })
      .catch(() => {
        toast.error(t('profileGoalLoadError'));
      });
  }, [t]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void refreshLearningGoal(false);
    }, 20_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshLearningGoal]);

  const stats: { labelKey: LocaleKey; value: string; icon: typeof Calendar; color: StatColor }[] = [
    { labelKey: 'profileStatSessions', value: summary ? String(summary.totalXp > 0 ? Math.ceil(summary.totalXp / 10) : 0) : '--', icon: Calendar, color: 'indigo' },
    { labelKey: 'profileStatWords', value: summary ? String(summary.totalXp > 0 ? Math.ceil(summary.totalXp / 2) : 0) : '--', icon: Award, color: 'green' },
    { labelKey: 'profileStatStreak', value: summary ? String(summary.unlockedCount) : '--', icon: TrendingUp, color: 'orange' },
    { labelKey: 'profileStatLevel', value: summary ? String(summary.currentLevel) : '--', icon: Target, color: 'purple' },
  ];

  const completionPct = summary?.completionRate ?? 0;
  const progressBars: { labelKey: LocaleKey; progressKey: LocaleKey; width: string; color: string }[] = [
    { labelKey: 'profileVocabulary', progressKey: 'profileVocabularyProgress', width: `${Math.min(completionPct * 1.2, 100)}%`, color: PROGRESS_COLORS.indigo },
    { labelKey: 'profileGrammar', progressKey: 'profileGrammarProgress', width: `${Math.min(completionPct * 0.8, 100)}%`, color: PROGRESS_COLORS.green },
    { labelKey: 'profilePronunciation', progressKey: 'profilePronunciationProgress', width: `${Math.min(completionPct, 100)}%`, color: PROGRESS_COLORS.purple },
  ];

  const goalUpdatedText = useMemo(() => {
    if (!goalData?.goal.updatedAt) {
      return t('profileGoalNotSet');
    }
    const date = new Date(goalData.goal.updatedAt);
    if (Number.isNaN(date.getTime())) {
      return t('profileGoalNotSet');
    }
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }, [goalData?.goal.updatedAt, locale, t]);

  async function handleSaveGoal() {
    if (isSavingGoal) {
      return;
    }

    const payload = {
      dailyMinutes: Math.min(180, Math.max(5, Math.round(goalDraft.dailyMinutes || 0))),
      weeklyWords: Math.min(500, Math.max(5, Math.round(goalDraft.weeklyWords || 0))),
      weeklySpeaking: Math.min(50, Math.max(1, Math.round(goalDraft.weeklySpeaking || 0))),
    };

    setIsSavingGoal(true);
    try {
      const next = await saveLearningGoal(payload);
      setGoalData(next);
      setGoalDraft({
        dailyMinutes: next.goal.dailyMinutes,
        weeklyWords: next.goal.weeklyWords,
        weeklySpeaking: next.goal.weeklySpeaking,
      });
      toast.success(t('profileGoalSaved'));
    } catch {
      toast.error(t('profileGoalSaveError'));
    } finally {
      setIsSavingGoal(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="glass-card rounded-2xl shadow-sm p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[#5856D6] flex items-center justify-center text-white text-3xl font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-semibold text-label mb-1">
                {displayName}
              </h1>
              <p className="text-label-secondary mb-3">
                {isGuest ? t('profileGuestMode') : t('profileLearningStatus')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-[var(--color-primary-soft)] text-primary text-sm font-medium rounded-full">
                  {isGuest ? t('profileGuestSession') : t('profileMemberSince')}
                </span>
                {!isGuest && (
                  <span className="px-3 py-1 bg-success/10 text-success text-sm font-medium rounded-full">
                    {t('profileActiveLearner')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/achievements')}
                className="px-6 py-2 bg-warning text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                {t('profileAchievementHall')}
              </button>
              {user ? (
                <button
                  onClick={async () => { await signOut(); }}
                  className="px-6 py-2 bg-fill hover:bg-fill text-label-secondary rounded-xl font-medium transition-all flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {t('profileLogout')}
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-2 glass-button text-white rounded-xl font-medium transition-all hover:opacity-90"
                >
                  {t('profileSignIn')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.labelKey}
                className="glass-card rounded-xl shadow-sm p-4 md:p-6"
              >
                <div
                  className={`w-10 h-10 ${STAT_COLOR_CLASSES[stat.color]} rounded-lg flex items-center justify-center mb-3`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-label mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-label-secondary">
                  {t(stat.labelKey)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="glass-card rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-label mb-4">
            {t('profileProgress')}
          </h2>
          <div className="space-y-4">
            {progressBars.map((bar) => (
              <div key={bar.labelKey}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-label-secondary font-medium">
                    {t(bar.labelKey)}
                  </span>
                  <span className="text-label-secondary">
                    {t(bar.progressKey)}
                  </span>
                </div>
                <div className="w-full bg-fill rounded-full h-3">
                  <div
                    className={`${bar.color} h-3 rounded-full transition-all`}
                    style={{ width: bar.width }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-semibold text-label">
                {t('profileLearningGoalTitle')}
              </h2>
              <p className="text-sm text-label-secondary mt-1">
                {t('profileLearningGoalSubtitle')}
              </p>
            </div>
            <div className="text-xs text-label-tertiary whitespace-nowrap">
              {t('profileGoalUpdatedAt')} {goalUpdatedText}
            </div>
          </div>

          {goalData && (
            <div className="mb-5 rounded-xl glass-card backdrop-blur-xl p-4">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative w-20 h-20 shrink-0"
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(var(--color-primary) ${goalData.completion.overall}%, rgba(148,163,184,0.2) 0%)`,
                    }}
                  />
                  <div className="absolute inset-2 rounded-full bg-surface-elevated border border-separator flex items-center justify-center">
                    <span className="text-sm font-semibold text-label">
                      {goalData.completion.overall}%
                    </span>
                  </div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-label-secondary">
                    {t('profileGoalProgress')}
                  </p>
                  <p className="mt-1 text-xs text-label-tertiary flex items-center gap-1.5">
                    <Timer className={`w-3.5 h-3.5 ${isGoalRefreshing ? 'animate-spin' : ''}`} />
                    {t('profileGoalOverall')} {goalData.completion.overall}% · {t('profileGoalUpdatedAt')} {goalUpdatedText}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <label className="rounded-xl glass-card backdrop-blur-md p-4">
              <p className="text-sm text-label-secondary mb-2">{t('profileGoalDailyMinutes')}</p>
              <input
                type="number"
                min={5}
                max={180}
                value={goalDraft.dailyMinutes}
                onChange={(event) =>
                  setGoalDraft((prev) => ({
                    ...prev,
                    dailyMinutes: Number(event.target.value),
                  }))
                }
                className="w-full min-w-0 rounded-lg glass-input border border-separator px-3 py-2 text-label"
              />
            </label>
            <label className="rounded-xl glass-card backdrop-blur-md p-4">
              <p className="text-sm text-label-secondary mb-2">{t('profileGoalWeeklyWords')}</p>
              <input
                type="number"
                min={5}
                max={500}
                value={goalDraft.weeklyWords}
                onChange={(event) =>
                  setGoalDraft((prev) => ({
                    ...prev,
                    weeklyWords: Number(event.target.value),
                  }))
                }
                className="w-full min-w-0 rounded-lg glass-input border border-separator px-3 py-2 text-label"
              />
            </label>
            <label className="rounded-xl glass-card backdrop-blur-md p-4">
              <p className="text-sm text-label-secondary mb-2">{t('profileGoalWeeklySpeaking')}</p>
              <input
                type="number"
                min={1}
                max={50}
                value={goalDraft.weeklySpeaking}
                onChange={(event) =>
                  setGoalDraft((prev) => ({
                    ...prev,
                    weeklySpeaking: Number(event.target.value),
                  }))
                }
                className="w-full min-w-0 rounded-lg glass-input border border-separator px-3 py-2 text-label"
              />
            </label>
          </div>

          <button
            onClick={handleSaveGoal}
            disabled={isSavingGoal}
            className="px-5 py-2 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {isSavingGoal ? t('profileGoalSaving') : t('profileGoalSave')}
          </button>

          {goalData && (
            <div className="mt-6 rounded-xl glass-card backdrop-blur-md p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-label-secondary">{t('profileGoalProgress')}</p>
                <p className="text-sm text-label-secondary">
                  {t('profileGoalOverall')} {goalData.completion.overall}%
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <GoalProgressRow
                  label={t('profileGoalDailyMinutes')}
                  value={goalData.progress.dailyMinutes}
                  target={goalData.goal.dailyMinutes}
                  percent={goalData.completion.dailyMinutes}
                  barClass="from-cyan-500 to-blue-500"
                />
                <GoalProgressRow
                  label={t('profileGoalWeeklyWords')}
                  value={goalData.progress.weeklyWords}
                  target={goalData.goal.weeklyWords}
                  percent={goalData.completion.weeklyWords}
                  barClass="from-emerald-500 to-teal-500"
                />
                <GoalProgressRow
                  label={t('profileGoalWeeklySpeaking')}
                  value={goalData.progress.weeklySpeaking}
                  target={goalData.goal.weeklySpeaking}
                  percent={goalData.completion.weeklySpeaking}
                  barClass="from-indigo-500 to-fuchsia-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-label mb-4">
            {t('profileAchievements')}
          </h2>
          <div className="space-y-3">
            {recentUnlocked.length > 0 ? recentUnlocked.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-fill-secondary transition-colors"
              >
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h3 className="font-medium text-label">
                    {achievement.title}
                  </h3>
                  <p className="text-sm text-label-secondary">
                    {achievement.description}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-label-tertiary text-center py-4">
                {t('profileNoAchievements')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface GoalProgressRowProps {
  label: string;
  value: number;
  target: number;
  percent: number;
  barClass: string;
}

function GoalProgressRow({ label, value, target, percent, barClass }: GoalProgressRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-label-secondary">
        <span>{label}</span>
        <span>{value} / {target}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-fill overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${barClass}`}
          animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
