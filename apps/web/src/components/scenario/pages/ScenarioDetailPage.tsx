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
    <div className="page-shell h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
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

        <section className="page-panel rounded-[30px] p-4 md:p-5">
          <div className="page-panel-soft relative overflow-hidden rounded-[24px] px-4 py-5">
            <div className="pointer-events-none absolute right-4 top-2 text-[62px] opacity-[0.16]">
              {scenario.emoji}
            </div>
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
                      ? 'bg-primary text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)]'
                      : 'page-chip text-label-secondary dark:text-slate-200'
                  }`}
                >
                  {t(resolveLanguageLabelKey(language))}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <div className="page-panel-soft rounded-[22px] px-4 py-4">
              <h2 className="text-sm font-medium text-label">
                {t('scenarioPrepGoals')}
              </h2>
              <div className="mt-2 space-y-3">
                {scenario.goals.map((goalKey, index) => (
                  <div key={goalKey} className="page-panel-soft flex items-start gap-3 rounded-[18px] px-3.5 py-3">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-fill text-xs font-medium text-label-tertiary">
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
              <div className="page-panel-soft rounded-[22px] px-4 py-4">
                <h2 className="text-sm font-medium text-label">
                  {t('scenarioPrepRoleUser')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-label-secondary">
                  {t(scenario.roleUserKey)}
                </p>
              </div>
              <div className="page-panel-soft rounded-[22px] px-4 py-4">
                <h2 className="text-sm font-medium text-label">
                  {t('scenarioPrepRoleTutor')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-label-secondary">
                  {t(scenario.roleTutorKey)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate(`/scenarios/${scenario.key}/session/new?lang=${targetLanguage}`)}
              className="press-scale inline-flex h-12 min-w-[156px] items-center justify-center gap-2 rounded-[16px] bg-primary px-5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(37,99,235,0.2)]"
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
