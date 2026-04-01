import type {
  LanguageCode,
  ScenarioFeedbackDimensionKey,
} from '../../types/api';
import type { LocaleKey } from '../../providers/LocaleContext';

export type ScenarioDifficulty = 'basic' | 'natural' | 'challenge';

export type ScenarioKey =
  | 'hotel_checkin'
  | 'doctor_visit_fever'
  | 'restaurant_ordering'
  | 'shopping_in_store'
  | 'asking_directions';

export interface ScenarioDefinition {
  key: ScenarioKey;
  icon: 'hotel' | 'stethoscope' | 'utensils' | 'bag' | 'map';
  emoji: string;
  estimatedMinutes: number;
  difficulty: ScenarioDifficulty;
  supportedLanguages: LanguageCode[];
  titleKey: LocaleKey;
  summaryKey: LocaleKey;
  metaKey: LocaleKey;
  roleUserKey: LocaleKey;
  roleTutorKey: LocaleKey;
  goals: readonly LocaleKey[];
}

export interface ScenarioFeedback {
  overallScore: number;
  summary: string;
  headline?: string;
  dimensions: Array<{
    key: ScenarioFeedbackDimensionKey;
    score: number;
  }>;
  suggestions: string[];
}
