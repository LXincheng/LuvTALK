import { useMemo, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
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

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <div className="glass-card flex items-center gap-3 rounded-[22px] px-3 py-3">
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

        <section className="glass-card rounded-[24px] p-4 md:p-5">
          <div className="relative overflow-hidden rounded-[20px] bg-fill-secondary px-4 py-4">
            <div className="pointer-events-none absolute right-4 top-2 text-[62px] opacity-[0.16]">
              {scenario.emoji}
            </div>
            <div className="relative flex items-start gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-surface text-label">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-label-secondary">{t(scenario.summaryKey)}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-label-secondary">
                  <span>{t(scenario.metaKey)}</span>
                  <span className="text-label-tertiary">·</span>
                  <span>{t(scenarioDifficultyLabelKeyMap[scenario.difficulty])}</span>
                  <span className="text-label-tertiary">·</span>
                  <span>{t('scenarioMinutesValue').replace('{value}', String(scenario.estimatedMinutes))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {supportedLanguages.map((language) => {
              const isActive = targetLanguage === language;
              return (
                <button
                  key={language}
                  type="button"
                  onClick={() => setTargetLanguage(language)}
                  className={`press-scale inline-flex h-11 min-w-[112px] items-center justify-center rounded-[14px] px-4 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-fill-secondary text-label-secondary'
                  }`}
                >
                  {t(resolveLanguageLabelKey(language))}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div>
              <h2 className="text-sm font-medium text-label">
                {t('scenarioPrepGoals')}
              </h2>
              <div className="mt-2 space-y-3">
                {scenario.goals.map((goalKey, index) => (
                  <div key={goalKey} className="flex items-start gap-3">
                    <span className="min-w-[1.1rem] pt-0.5 text-sm font-medium text-label-tertiary">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-label-secondary">
                      {t(goalKey)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-medium text-label">
                  {t('scenarioPrepRoleUser')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-label-secondary">
                  {t(scenario.roleUserKey)}
                </p>
              </div>
              <div>
                <h2 className="text-sm font-medium text-label">
                  {t('scenarioPrepRoleTutor')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-label-secondary">
                  {t(scenario.roleTutorKey)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate(`/scenarios/${scenario.key}/session/new?lang=${targetLanguage}`)}
              className="press-scale inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-[14px] bg-primary px-5 text-sm font-medium text-white"
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
