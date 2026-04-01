import {
  BriefcaseMedical,
  Building2,
  MapPinned,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { LocaleKey } from '../../../providers/LocaleContext';
import type { LanguageCode } from '../../../types/api';
import type { ScenarioDefinition, ScenarioDifficulty } from '../types';

export const scenarioLanguageOrder: LanguageCode[] = ['mandarin', 'cantonese', 'english'];

export const scenarioDifficultyLabelKeyMap: Record<ScenarioDifficulty, LocaleKey> = {
  basic: 'scenarioDifficultyBasic',
  natural: 'scenarioDifficultyNatural',
  challenge: 'scenarioDifficultyChallenge',
};

const scenarioIconMap: Record<ScenarioDefinition['icon'], LucideIcon> = {
  hotel: Building2,
  stethoscope: BriefcaseMedical,
  utensils: UtensilsCrossed,
  bag: ShoppingBag,
  map: MapPinned,
};

export const resolveScenarioIcon = (
  icon: ScenarioDefinition['icon'],
): LucideIcon => scenarioIconMap[icon];

export const resolveLanguageLabelKey = (language: LanguageCode): LocaleKey => {
  if (language === 'mandarin') {
    return 'languageMandarin';
  }
  if (language === 'cantonese') {
    return 'languageCantonese';
  }
  return 'languageEnglish';
};
