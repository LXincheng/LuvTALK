import { useEffect, useState } from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from '../providers/LocaleContext';
import type { LocaleKey } from '../providers/LocaleContext';
import { RARITY_GLOW } from '../constants/ui';
import {
  fetchAchievementsCached,
  fetchLevelsCached,
  fetchAchievementSummaryCached,
} from '../services/achievementService';
import type {
  AchievementWithProgress,
  LevelWithProgress,
  AchievementSummary,
} from '../services/achievementService';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  progress: number;
  total: number;
  unlocked: boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Level {
  level: number;
  title: string;
  icon: string;
  color: string;
  minXP: number;
  unlocked: boolean;
}

type TranslateFn = (key: LocaleKey) => string;

const ACHIEVEMENT_I18N: Record<
  string,
  { titleKey: LocaleKey; descKey: LocaleKey }
> = {
  first_steps: { titleKey: 'achievementFirstStepsTitle', descKey: 'achievementFirstStepsDesc' },
  week_warrior: { titleKey: 'achievementWeekWarriorTitle', descKey: 'achievementWeekWarriorDesc' },
  vocab_master: { titleKey: 'achievementVocabMasterTitle', descKey: 'achievementVocabMasterDesc' },
  perfect_pronunciation: { titleKey: 'achievementPerfectPronunciationTitle', descKey: 'achievementPerfectPronunciationDesc' },
  social_butterfly: { titleKey: 'achievementSocialButterflyTitle', descKey: 'achievementSocialButterflyDesc' },
  speed_learner: { titleKey: 'achievementSpeedLearnerTitle', descKey: 'achievementSpeedLearnerDesc' },
  polyglot: { titleKey: 'achievementPolyglotTitle', descKey: 'achievementPolyglotDesc' },
  diamond_streak: { titleKey: 'achievementDiamondStreakTitle', descKey: 'achievementDiamondStreakDesc' },
};

const LEVEL_I18N: Record<number, LocaleKey> = {
  1: 'levelBeginner', 2: 'levelNovice', 3: 'levelLearner', 4: 'levelIntermediate',
  5: 'levelAdvanced', 6: 'levelExpert', 7: 'levelMaster', 8: 'levelLegend',
};

const mapApiAchievement = (raw: AchievementWithProgress, t: TranslateFn): Achievement => {
  const i18n = ACHIEVEMENT_I18N[raw.code];
  return {
    id: raw.id,
    title: i18n ? t(i18n.titleKey) : raw.title,
    description: i18n ? t(i18n.descKey) : raw.description,
    icon: raw.icon, color: raw.color,
    progress: raw.progress, total: raw.targetValue,
    unlocked: raw.unlocked, rarity: raw.rarity,
  };
};

const mapApiLevel = (raw: LevelWithProgress, t: TranslateFn): Level => {
  const titleKey = LEVEL_I18N[raw.level];
  return {
    level: raw.level,
    title: titleKey ? t(titleKey) : raw.title,
    icon: raw.icon, color: raw.color,
    minXP: raw.minXp, unlocked: raw.unlocked,
  };
};

export default function AchievementHallPage() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'achievements' | 'levels'>('achievements');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { cached: cachedA, fresh: freshA } = fetchAchievementsCached();
    const { cached: cachedL, fresh: freshL } = fetchLevelsCached();
    const { cached: cachedS, fresh: freshS } = fetchAchievementSummaryCached();

    if (cachedA && cachedL && cachedS) {
      void Promise.resolve().then(() => {
        if (!mounted) return;
        setAchievements(cachedA.map((a) => mapApiAchievement(a, t)));
        setLevels(cachedL.map((l) => mapApiLevel(l, t)));
        setSummary(cachedS);
        setIsLoading(false);
      });
    }

    Promise.all([freshA, freshL, freshS])
      .then(([rawAchievements, rawLevels, rawSummary]) => {
        if (!mounted) return;
        setAchievements(rawAchievements.map((a) => mapApiAchievement(a, t)));
        setLevels(rawLevels.map((l) => mapApiLevel(l, t)));
        setSummary(rawSummary);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [t]);

  const getRarityTranslation = (rarity: 'common' | 'rare' | 'epic' | 'legendary') => {
    const keys: Record<typeof rarity, LocaleKey> = {
      common: 'achievementRarityCommon',
      rare: 'achievementRarityRare',
      epic: 'achievementRarityEpic',
      legendary: 'achievementRarityLegendary',
    };
    return t(keys[rarity]);
  };

  const currentXP = summary?.totalXp ?? 0;
  const currentLevel = summary?.currentLevel ?? 0;
  const unlockedCount = summary?.unlockedCount ?? 0;
  const completionRate = summary?.completionRate ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">{t('achievementHallTitle')}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t('achievementHallSubtitle')}</p>
        </div>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700">
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mx-auto mb-2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mx-auto" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 md:p-5 border border-slate-200 dark:border-slate-700">
                  <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-3" />
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
              <div className="glass-card rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{unlockedCount}</div>
                <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">{t('achievementUnlocked')}</div>
              </div>
              <div className="glass-card rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{currentLevel}</div>
                <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">{t('achievementCurrentLevel')}</div>
              </div>
              <div className="glass-card rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl md:text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">{currentXP}</div>
                <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">{t('achievementTotalXP')}</div>
              </div>
              <div className="glass-card rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{completionRate}%</div>
                <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">{t('achievementCompletion')}</div>
              </div>
            </div>

            <div className="flex gap-2 mb-6 glass-card rounded-xl p-1 border border-slate-200 dark:border-slate-700">
              <button onClick={() => setActiveTab('achievements')} className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base ${activeTab === 'achievements' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {t('achievementTabAchievements')}
              </button>
              <button onClick={() => setActiveTab('levels')} className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base ${activeTab === 'levels' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {t('achievementTabLevels')}
              </button>
            </div>

            {activeTab === 'achievements' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {achievements.map((achievement, index) => (
                  <AchievementCard key={achievement.id} achievement={achievement} t={t} getRarityTranslation={getRarityTranslation} delay={index * 0.05} />
                ))}
              </motion.div>
            )}

            {activeTab === 'levels' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 md:space-y-4">
                {levels.map((level, index) => (
                  <LevelCard key={level.level} level={level} levels={levels} currentXP={currentXP} t={t} delay={index * 0.05} />
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AchievementCard({ achievement, t, getRarityTranslation, delay }: {
  achievement: Achievement; t: TranslateFn;
  getRarityTranslation: (rarity: 'common' | 'rare' | 'epic' | 'legendary') => string; delay: number;
}) {
  const progress = Math.min((achievement.progress / achievement.total) * 100, 100);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`glass-card rounded-xl p-4 md:p-5 border-2 ${achievement.unlocked ? `shadow-lg ${RARITY_GLOW[achievement.rarity]}` : 'border-slate-200 dark:border-slate-700 opacity-75'} relative overflow-hidden group hover:scale-105 transition-transform`}
    >
      {achievement.unlocked && <div className={`absolute inset-0 bg-gradient-to-br ${achievement.color} opacity-5`} />}
      {!achievement.unlocked && <div className="absolute top-2 right-2"><Lock className="w-4 h-4 text-slate-400 dark:text-slate-600" /></div>}
      <div className="relative">
        <div className={`text-3xl md:text-4xl mb-3 ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>{achievement.icon}</div>
        <h3 className={`font-semibold mb-1 text-sm md:text-base ${achievement.unlocked ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-600'}`}>{achievement.title}</h3>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{achievement.description}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-500">{t('achievementProgress')}</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{achievement.progress}/{achievement.total}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: delay + 0.3 }} className={`h-1.5 rounded-full bg-gradient-to-r ${achievement.color}`} />
          </div>
        </div>
        <div className="mt-2.5">
          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold uppercase ${achievement.rarity === 'legendary' ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300' : achievement.rarity === 'epic' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : achievement.rarity === 'rare' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
            {getRarityTranslation(achievement.rarity)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function LevelCard({ level, levels, currentXP, t, delay }: {
  level: Level; levels: Level[]; currentXP: number; t: TranslateFn; delay: number;
}) {
  const nextLevel = levels.find((item) => item.level === level.level + 1);
  const xpNeeded = nextLevel ? nextLevel.minXP - level.minXP : 1000;
  const xpProgress = level.unlocked ? Math.min(currentXP - level.minXP, xpNeeded) : 0;
  const progress = (xpProgress / xpNeeded) * 100;

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
      className={`glass-card rounded-xl p-4 md:p-6 border-2 ${level.unlocked ? 'border-slate-200 dark:border-slate-700 shadow-lg' : 'border-slate-200 dark:border-slate-700 opacity-60'} relative overflow-hidden group`}
    >
      <div className="flex items-center gap-4 md:gap-6">
        <div className={`text-4xl md:text-5xl flex-shrink-0 ${level.unlocked ? '' : 'grayscale opacity-50'}`}>{level.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <span className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{t('achievementLevel')}{level.level}</span>
            <span className={`text-base md:text-lg font-semibold truncate ${level.unlocked ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-600'}`}>{level.title}</span>
            {level.unlocked ? (
              <div className="ml-auto flex-shrink-0"><div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center"><span className="text-sm md:text-base">✓</span></div></div>
            ) : (
              <div className="ml-auto flex-shrink-0"><Lock className="w-5 h-5 md:w-6 md:h-6 text-slate-400 dark:text-slate-600" /></div>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-2 md:mb-3">
            {level.unlocked ? t('achievementUnlockedAt').replace('{xp}', level.minXP.toString()) : t('achievementRequires').replace('{xp}', level.minXP.toString())}
          </p>
          {level.unlocked && nextLevel && (
            <div className="space-y-1.5 md:space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-500">{t('achievementToLevel').replace('{level}', (level.level + 1).toString())}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{xpProgress}/{xpNeeded} {t('achievementXP')}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: delay + 0.3 }} className={`h-2 rounded-full bg-gradient-to-r ${level.color}`} />
              </div>
            </div>
          )}
        </div>
        {nextLevel && <ChevronRight className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 hidden md:block ${level.unlocked ? 'text-slate-400 dark:text-slate-600' : 'text-slate-300 dark:text-slate-700'}`} />}
      </div>
    </motion.div>
  );
}
