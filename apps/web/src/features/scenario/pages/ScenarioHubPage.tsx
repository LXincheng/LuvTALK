import { motion } from 'motion/react';
import { BriefcaseMedical, Building2, MapPinned, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../../providers/LocaleContext';
import { scenarioDefinitions } from '../data/scenarioDefinitions';
import type { LocaleKey } from '../../../providers/LocaleContext';

const scenarioIconMap = {
  hotel: Building2,
  stethoscope: BriefcaseMedical,
  utensils: UtensilsCrossed,
  bag: ShoppingBag,
  map: MapPinned,
} as const;

const scenarioEmojiMap = {
  hotel: '🏨',
  stethoscope: '🩺',
  utensils: '🍽️',
  bag: '🛍️',
  map: '🗺️',
} as const;

export default function ScenarioHubPage() {
  const { t } = useLocale();
  const difficultyLabelMap: Record<string, LocaleKey> = {
    basic: 'scenarioDifficultyBasic',
    natural: 'scenarioDifficultyNatural',
    challenge: 'scenarioDifficultyChallenge',
  };

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <section className="glass-card rounded-[24px] p-4 md:p-5">
          <div className="max-w-2xl">
            <h1 className="text-[1.15rem] font-semibold leading-[1.15] tracking-[-0.03em] text-label md:text-[1.25rem]">
              {t('scenarioHubTitle')}
            </h1>
            <p className="mt-1 text-sm leading-6 text-label-secondary">
              {t('scenarioHubSubtitle')}
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scenarioDefinitions.map((scenario, index) => {
            const Icon = scenarioIconMap[scenario.icon];
            return (
              <motion.div
                key={scenario.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <Link
                  to={`/scenarios/${scenario.key}`}
                  className="glass-card relative overflow-hidden flex h-full flex-col rounded-[24px] p-4 transition-colors hover:bg-fill-secondary/50"
                >
                  <div className="pointer-events-none absolute right-4 top-3 text-[52px] opacity-[0.16] saturate-[0.9]">
                    {scenarioEmojiMap[scenario.icon]}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-fill-secondary text-label">
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

                  <p className="mt-3 flex-1 text-sm leading-6 text-label-secondary">
                    {t(scenario.summaryKey)}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-sm text-label-secondary">
                    <span>{t(difficultyLabelMap[scenario.difficulty])}</span>
                    <span className="text-label-tertiary">·</span>
                    <span>{t('scenarioMinutesValue').replace('{value}', String(scenario.estimatedMinutes))}</span>
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
