import { UiLanguage } from '../../types/language';

export const SCENARIO_IDS = ['daily', 'restaurant', 'shopping', 'directions'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const SCENARIO_LABELS: Record<UiLanguage, Record<ScenarioId, string>> = {
  zh: {
    daily: '日常',
    restaurant: '餐厅',
    shopping: '购物',
    directions: '问路',
  },
  en: {
    daily: 'Casual',
    restaurant: 'Dining',
    shopping: 'Shopping',
    directions: 'Directions',
  },
};

export const getScenarioLabel = (scenarioId: string | undefined, uiLanguage: UiLanguage): string => {
  const normalized = (SCENARIO_IDS.includes(scenarioId as ScenarioId) ? scenarioId : 'daily') as ScenarioId;
  return SCENARIO_LABELS[uiLanguage][normalized];
};
