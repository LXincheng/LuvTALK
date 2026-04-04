import { useMemo, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLocale } from '../../../providers/LocaleContext';
import { getScenarioDefinition } from '../data/scenarioDefinitions';
import type { LanguageCode } from '../../../types/api';
import {
  resolveLanguageLabelKey,
  resolveScenarioIcon,
  scenarioDifficultyLabelKeyMap,
  scenarioLanguageOrder,
} from '../data/scenarioUi';

const accentMap: Record<string, { glow: string; button: string; soft: string }> = {
  hotel_checkin: {
    glow: 'from-sky-400/18 via-cyan-300/10 to-transparent',
    button: 'from-sky-500 to-cyan-500',
    soft: 'bg-sky-500/8',
  },
  doctor_visit_fever: {
    glow: 'from-emerald-400/18 via-teal-300/10 to-transparent',
    button: 'from-emerald-500 to-teal-500',
    soft: 'bg-emerald-500/8',
  },
  restaurant_ordering: {
    glow: 'from-amber-400/18 via-orange-300/10 to-transparent',
    button: 'from-amber-500 to-orange-500',
    soft: 'bg-amber-500/8',
  },
  shopping_in_store: {
    glow: 'from-rose-400/18 via-pink-300/10 to-transparent',
    button: 'from-rose-500 to-pink-500',
    soft: 'bg-rose-500/8',
  },
  asking_directions: {
    glow: 'from-indigo-400/18 via-blue-300/10 to-transparent',
    button: 'from-indigo-500 to-blue-500',
    soft: 'bg-indigo-500/8',
  },
};

export default function ScenarioDetailPage() {
  const { scenarioKey } = useParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const scenario = getScenarioDefinition(scenarioKey);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('mandarin');

  const supportedLanguages = useMemo(
    () => scenarioLanguageOrder.filter((language) => scenario?.supportedLanguages.includes(language)),
    [scenario],
  );

  if (!scenario) {
    return <Navigate to="/scenarios" replace />;
  }

  const Icon = resolveScenarioIcon(scenario.icon);
  const accent = accentMap[scenario.key];

  return (
    <div className="page-shell h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
        <div className="page-panel flex items-center gap-3 rounded-[24px] px-3 py-3">
          <Link
            to="/scenarios"
            className="press-scale inline-flex h-10 w-10 items-center justify-center rounded-full border border-separator bg-fill-secondary/80 text-label-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="truncate text-base font-semibold text-label">
            {t(scenario.titleKey)}
          </h1>
        </div>

        <section className="page-panel overflow-hidden rounded-[32px] p-4 md:p-5">
          <div className="page-panel-soft relative overflow-hidden rounded-[26px] px-4 py-5">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${accent.glow}`} />
            <motion.div
              aria-hidden="true"
              className={`pointer-events-none absolute right-6 top-6 h-20 w-20 rounded-full ${accent.soft} blur-2xl`}
              animate={{ scale: [1, 1.09, 1], opacity: [0.42, 0.9, 0.42] }}
              transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="pointer-events-none absolute right-4 top-2 text-[62px] opacity-[0.15]">
              {scenario.emoji}
            </div>
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
            <div className="relative flex items-start gap-3">
              <div className="page-panel-soft inline-flex h-11 w-11 items-center justify-center rounded-[16px] text-label">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm leading-6 text-label-secondary">{t(scenario.summaryKey)}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-label-secondary">
                  <span className="page-chip inline-flex h-8 items-center rounded-full px-3 dark:text-slate-200">{t(scenario.metaKey)}</span>
                  <span className="page-chip inline-flex h-8 items-center rounded-full px-3 dark:text-slate-200">{t(scenarioDifficultyLabelKeyMap[scenario.difficulty])}</span>
                  <span className="page-chip inline-flex h-8 items-center rounded-full px-3 dark:text-slate-200">{t('scenarioMinutesValue').replace('{value}', String(scenario.estimatedMinutes))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {supportedLanguages.map((language) => {
              const isActive = targetLanguage === language;
              return (
                <button
                  key={language}
                  type="button"
                  onClick={() => setTargetLanguage(language)}
                  className={`press-scale inline-flex h-11 min-w-[112px] items-center justify-center rounded-[16px] px-4 text-sm font-medium transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${accent.button} text-white shadow-[0_12px_28px_rgba(37,99,235,0.18)]`
                      : 'page-chip text-label-secondary dark:text-slate-200'
                  }`}
                >
                  {t(resolveLanguageLabelKey(language))}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="page-panel-soft rounded-[24px] px-4 py-4"
            >
              <h2 className="text-sm font-medium text-label">
                {t('scenarioPrepGoals')}
              </h2>
              <div className="mt-3 space-y-3">
                {scenario.goals.map((goalKey, index) => (
                  <motion.div
                    key={goalKey}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: index * 0.06 }}
                    className="page-panel-soft flex items-start gap-3 rounded-[18px] px-3.5 py-3"
                  >
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-r ${accent.button} text-xs font-medium text-white`}>
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-label-secondary">
                      {t(goalKey)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08, ease: 'easeOut' }}
                className="page-panel-soft rounded-[24px] px-4 py-4"
              >
                <h2 className="text-sm font-medium text-label">
                  {t('scenarioPrepRoleUser')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-label-secondary">
                  {t(scenario.roleUserKey)}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.14, ease: 'easeOut' }}
                className="page-panel-soft rounded-[24px] px-4 py-4"
              >
                <h2 className="text-sm font-medium text-label">
                  {t('scenarioPrepRoleTutor')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-label-secondary">
                  {t(scenario.roleTutorKey)}
                </p>
              </motion.div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate(`/scenarios/${scenario.key}/session/new?lang=${targetLanguage}`)}
              className={`press-scale inline-flex h-12 min-w-[156px] items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r ${accent.button} px-5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(37,99,235,0.18)]`}
            >
              <Play className="h-4 w-4" />
              {t('scenarioPrepStart')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
