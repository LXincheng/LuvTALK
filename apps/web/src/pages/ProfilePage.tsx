import { useEffect, useState } from 'react';
import { Target, Award, TrendingUp, Calendar, Trophy, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';
import { useLocale } from '../providers/LocaleContext';
import { STAT_COLOR_CLASSES, PROGRESS_COLORS } from '../constants/ui';
import type { StatColor } from '../constants/ui';
import { fetchAchievementSummaryCached, fetchAchievementsCached } from '../services/achievementService';
import type { AchievementSummary, AchievementWithProgress } from '../services/achievementService';

export default function ProfilePage() {
  const { t } = useLocale();
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

  const stats: { labelKey: string; value: string; icon: typeof Calendar; color: StatColor }[] = [
    { labelKey: 'profileStatSessions', value: summary ? String(summary.totalXp > 0 ? Math.ceil(summary.totalXp / 10) : 0) : '--', icon: Calendar, color: 'indigo' },
    { labelKey: 'profileStatWords', value: summary ? String(summary.totalXp > 0 ? Math.ceil(summary.totalXp / 2) : 0) : '--', icon: Award, color: 'green' },
    { labelKey: 'profileStatStreak', value: summary ? String(summary.unlockedCount) : '--', icon: TrendingUp, color: 'orange' },
    { labelKey: 'profileStatLevel', value: summary ? String(summary.currentLevel) : '--', icon: Target, color: 'purple' },
  ];

  const completionPct = summary?.completionRate ?? 0;
  const progressBars = [
    { labelKey: 'profileVocabulary', progressKey: 'profileVocabularyProgress', width: `${Math.min(completionPct * 1.2, 100)}%`, color: PROGRESS_COLORS.indigo },
    { labelKey: 'profileGrammar', progressKey: 'profileGrammarProgress', width: `${Math.min(completionPct * 0.8, 100)}%`, color: PROGRESS_COLORS.green },
    { labelKey: 'profilePronunciation', progressKey: 'profilePronunciationProgress', width: `${Math.min(completionPct, 100)}%`, color: PROGRESS_COLORS.purple },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="glass-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
                {displayName}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-3">
                {isGuest ? t('profileGuestMode') : t('profileLearningStatus')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full">
                  {isGuest ? t('profileGuestSession') : t('profileMemberSince')}
                </span>
                {!isGuest && (
                  <span className="px-3 py-1 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 text-sm font-medium rounded-full">
                    {t('profileActiveLearner')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/achievements')}
                className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                {t('profileAchievementHall')}
              </button>
              {user ? (
                <button
                  onClick={async () => { await signOut(); }}
                  className="px-6 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-all flex items-center gap-2"
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
                className="glass-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6"
              >
                <div
                  className={`w-10 h-10 ${STAT_COLOR_CLASSES[stat.color]} rounded-lg flex items-center justify-center mb-3`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t(stat.labelKey as any)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="glass-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            {t('profileProgress')}
          </h2>
          <div className="space-y-4">
            {progressBars.map((bar) => (
              <div key={bar.labelKey}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {t(bar.labelKey as any)}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {t(bar.progressKey as any)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                  <div
                    className={`${bar.color} h-3 rounded-full transition-all`}
                    style={{ width: bar.width }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            {t('profileAchievements')}
          </h2>
          <div className="space-y-3">
            {recentUnlocked.length > 0 ? recentUnlocked.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    {achievement.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {achievement.description}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                {t('profileNoAchievements')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
