import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../../providers/LocaleContext';
import { scenarioDefinitions } from '../data/scenarioDefinitions';
import {
  resolveScenarioIcon,
  scenarioDifficultyLabelKeyMap,
} from '../data/scenarioUi';

const scenarioAccentMap: Record<string, { glow: string; chip: string; orb: string }> = {
  hotel_checkin: {
    glow: 'from-sky-400/18 via-cyan-300/10 to-transparent',
    chip: 'from-sky-500 to-cyan-500',
    orb: 'bg-sky-500/10',
  },
  doctor_visit_fever: {
    glow: 'from-emerald-400/18 via-teal-300/10 to-transparent',
    chip: 'from-emerald-500 to-teal-500',
    orb: 'bg-emerald-500/10',
  },
  restaurant_ordering: {
    glow: 'from-amber-400/18 via-orange-300/10 to-transparent',
    chip: 'from-amber-500 to-orange-500',
    orb: 'bg-amber-500/10',
  },
  shopping_in_store: {
    glow: 'from-rose-400/18 via-pink-300/10 to-transparent',
    chip: 'from-rose-500 to-pink-500',
    orb: 'bg-rose-500/10',
  },
  asking_directions: {
    glow: 'from-indigo-400/18 via-blue-300/10 to-transparent',
    chip: 'from-indigo-500 to-blue-500',
    orb: 'bg-indigo-500/10',
  },
};

export default function ScenarioHubPage() {
  const { t } = useLocale();

  return (
    <div className="page-shell h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
        <section className="page-panel relative overflow-hidden rounded-[32px] p-5 md:p-6">
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute right-[-2rem] top-[-2rem] h-36 w-36 rounded-full bg-primary/10 blur-3xl"
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-3rem] left-[-1rem] h-40 w-40 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-400/10"
            animate={{ scale: [1.04, 0.96, 1.04], opacity: [0.48, 0.82, 0.48] }}
            transition={{ duration: 8.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/12" />
          <div className="relative max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-label-tertiary">
              {t('scenarioHubEyebrow')}
            </p>
            <h1 className="mt-2 text-[1.45rem] font-semibold leading-[1.02] tracking-[-0.055em] text-label md:text-[2.15rem]">
              {t('scenarioHubTitle')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-label-secondary md:text-[0.98rem]">
              {t('scenarioHubSubtitle')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {['scenarioHubChipFocused', 'scenarioHubChipGuided', 'scenarioHubChipFeedback'].map((key) => (
                <span
                  key={key}
                  className="page-chip inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-label-secondary dark:text-slate-200"
                >
                  {t(key as never)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scenarioDefinitions.map((scenario, index) => {
            const Icon = resolveScenarioIcon(scenario.icon);
            const accent = scenarioAccentMap[scenario.key];
            return (
              <motion.div
                key={scenario.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
              >
                <Link
                  to={`/scenarios/${scenario.key}`}
                  className="page-panel group relative flex h-full flex-col overflow-hidden rounded-[28px] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--surface-shadow-hover)]"
                >
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${accent.glow}`} />
                  <motion.div
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-5 top-5 h-16 w-16 rounded-full ${accent.orb} blur-2xl`}
                    animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.88, 0.45] }}
                    transition={{ duration: 6 + index * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="pointer-events-none absolute right-4 top-3 text-[52px] opacity-[0.14] saturate-[0.92] transition-transform duration-300 group-hover:scale-105 group-hover:rotate-[-4deg]">
                    {scenario.emoji}
                  </div>
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/10" />
                  <div className="flex items-center gap-3">
                    <div className="page-panel-soft inline-flex h-11 w-11 items-center justify-center rounded-[16px] text-label dark:text-slate-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold tracking-[-0.025em] text-label">
                        {t(scenario.titleKey)}
                      </h2>
                      <p className="mt-0.5 text-sm text-label-secondary">
                        {t(scenario.metaKey)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 flex-1 text-sm leading-6 text-label-secondary">
                    {t(scenario.summaryKey)}
                  </p>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-label-secondary">
                      <span className="page-chip inline-flex h-8 items-center rounded-full px-3 dark:text-slate-200">
                        {t(scenarioDifficultyLabelKeyMap[scenario.difficulty])}
                      </span>
                      <span className="page-chip inline-flex h-8 items-center rounded-full px-3 dark:text-slate-200">
                        {t('scenarioMinutesValue').replace('{value}', String(scenario.estimatedMinutes))}
                      </span>
                    </div>
                    <span className={`inline-flex h-8 items-center rounded-full bg-gradient-to-r px-3 text-[12px] font-medium text-white ${accent.chip}`}>
                      {t('scenarioPrepStart')}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
