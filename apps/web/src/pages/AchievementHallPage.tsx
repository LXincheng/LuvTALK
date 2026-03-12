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
    <div className="h-full overflow-y-auto bg-surface">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-semibold text-label mb-2">{t('achievementHallTitle')}</h1>
          <p className="text-label-secondary">{t('achievementHallSubtitle')}</p>
        </div>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card rounded-xl p-3 md:p-4">
                  <div className="h-8 bg-fill rounded w-16 mx-auto mb-2" />
                  <div className="h-4 bg-fill rounded w-20 mx-auto" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 md:p-5">
                  <div className="h-10 w-10 bg-fill rounded mb-3" />
                  <div className="h-4 bg-fill rounded w-3/4 mb-2" />
                  <div className="h-3 bg-fill rounded w-full mb-3" />
                  <div className="h-1.5 bg-fill rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
              <div className="glass-card rounded-xl p-3 md:p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{unlockedCount}</div>
                <div className="text-xs md:text-sm text-label-secondary">{t('achievementUnlocked')}</div>
              </div>
              <div className="glass-card rounded-xl p-3 md:p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-[#AF52DE] dark:text-[#BF5AF2] mb-1">{currentLevel}</div>
                <div className="text-xs md:text-sm text-label-secondary">{t('achievementCurrentLevel')}</div>
              </div>
              <div className="glass-card rounded-xl p-3 md:p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-warning mb-1">{currentXP}</div>
                <div className="text-xs md:text-sm text-label-secondary">{t('achievementTotalXP')}</div>
              </div>
              <div className="glass-card rounded-xl p-3 md:p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-success mb-1">{completionRate}%</div>
                <div className="text-xs md:text-sm text-label-secondary">{t('achievementCompletion')}</div>
              </div>
            </div>

            <div className="flex gap-2 mb-6 glass-card rounded-xl p-1">
              <button onClick={() => setActiveTab('achievements')} className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base ${activeTab === 'achievements' ? 'bg-primary text-white shadow-lg' : 'text-label-secondary hover:bg-fill'}`}>
                {t('achievementTabAchievements')}
              </button>
              <button onClick={() => setActiveTab('levels')} className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base ${activeTab === 'levels' ? 'bg-primary text-white shadow-lg' : 'text-label-secondary hover:bg-fill'}`}>
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
      className={`glass-card rounded-xl p-4 md:p-5 border-2 ${achievement.unlocked ? `shadow-lg ${RARITY_GLOW[achievement.rarity]}` : 'border-separator opacity-75'} relative overflow-hidden group hover:scale-105 transition-transform`}
    >
      {achievement.unlocked && <div className={`absolute inset-0 bg-gradient-to-br ${achievement.color} opacity-5`} />}
      {!achievement.unlocked && <div className="absolute top-2 right-2"><Lock className="w-4 h-4 text-label-tertiary" /></div>}
      <div className="relative">
        <div className={`text-3xl md:text-4xl mb-3 ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>{achievement.icon}</div>
        <h3 className={`font-semibold mb-1 text-sm md:text-base ${achievement.unlocked ? 'text-label' : 'text-label-tertiary'}`}>{achievement.title}</h3>
        <p className="text-xs md:text-sm text-label-secondary mb-3 line-clamp-2">{achievement.description}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-label-tertiary">{t('achievementProgress')}</span>
            <span className="font-medium text-label-secondary">{achievement.progress}/{achievement.total}</span>
          </div>
          <div className="w-full bg-fill rounded-full h-1.5">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: delay + 0.3 }} className={`h-1.5 rounded-full bg-gradient-to-r ${achievement.color}`} />
          </div>
        </div>
        <div className="mt-2.5">
          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold uppercase ${achievement.rarity === 'legendary' ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300' : achievement.rarity === 'epic' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : achievement.rarity === 'rare' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-fill text-label-secondary'}`}>
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
      className={`glass-card rounded-xl p-4 md:p-6 border-2 ${level.unlocked ? 'border-separator shadow-lg' : 'border-separator opacity-60'} relative overflow-hidden group`}
    >
      <div className="flex items-center gap-4 md:gap-6">
        <div className={`text-4xl md:text-5xl flex-shrink-0 ${level.unlocked ? '' : 'grayscale opacity-50'}`}>{level.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <span className="text-xl md:text-2xl font-bold text-label">{t('achievementLevel')}{level.level}</span>
            <span className={`text-base md:text-lg font-semibold truncate ${level.unlocked ? 'text-label-secondary' : 'text-label-tertiary'}`}>{level.title}</span>
            {level.unlocked ? (
              <div className="ml-auto flex-shrink-0"><div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-success/10 flex items-center justify-center"><span className="text-sm md:text-base">✓</span></div></div>
            ) : (
              <div className="ml-auto flex-shrink-0"><Lock className="w-5 h-5 md:w-6 md:h-6 text-label-tertiary" /></div>
            )}
          </div>
          <p className="text-xs md:text-sm text-label-secondary mb-2 md:mb-3">
            {level.unlocked ? t('achievementUnlockedAt').replace('{xp}', level.minXP.toString()) : t('achievementRequires').replace('{xp}', level.minXP.toString())}
          </p>
          {level.unlocked && nextLevel && (
            <div className="space-y-1.5 md:space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-label-tertiary">{t('achievementToLevel').replace('{level}', (level.level + 1).toString())}</span>
                <span className="font-medium text-label-secondary">{xpProgress}/{xpNeeded} {t('achievementXP')}</span>
              </div>
              <div className="w-full bg-fill rounded-full h-2">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: delay + 0.3 }} className={`h-2 rounded-full bg-gradient-to-r ${level.color}`} />
              </div>
            </div>
          )}
        </div>
        {nextLevel && <ChevronRight className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 hidden md:block ${level.unlocked ? 'text-label-tertiary' : 'text-label-tertiary'}`} />}
      </div>
    </motion.div>
  );
}
