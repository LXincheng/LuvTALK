import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../../providers/LocaleContext';
import { scenarioDefinitions } from '../data/scenarioDefinitions';
import {
  resolveScenarioIcon,
  scenarioDifficultyLabelKeyMap,
} from '../data/scenarioUi';

export default function ScenarioHubPage() {
  const { t } = useLocale();

  return (
    <div className="page-shell h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <section className="page-panel relative overflow-hidden rounded-[30px] p-5 md:p-6">
          <div className="pointer-events-none absolute right-[-2.5rem] top-[-2.5rem] h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-3rem] left-[-1rem] h-36 w-36 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-400/10" />
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
            return (
              <motion.div
                key={scenario.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <Link
                  to={`/scenarios/${scenario.key}`}
                  className="page-panel group relative flex h-full flex-col overflow-hidden rounded-[26px] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--surface-shadow-hover)]"
                >
                  <div className="pointer-events-none absolute right-4 top-3 text-[52px] opacity-[0.16] saturate-[0.9] transition-transform duration-300 group-hover:scale-105">
                    {scenario.emoji}
                  </div>
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

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-label-secondary">
                    <span className="page-chip inline-flex h-8 items-center rounded-full px-3 dark:text-slate-200">
                      {t(scenarioDifficultyLabelKeyMap[scenario.difficulty])}
                    </span>
                    <span className="page-chip inline-flex h-8 items-center rounded-full px-3 dark:text-slate-200">
                      {t('scenarioMinutesValue').replace('{value}', String(scenario.estimatedMinutes))}
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
