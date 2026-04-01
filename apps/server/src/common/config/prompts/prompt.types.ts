import { LanguageCode } from "../../enums/language-code.enum";

export type TutorInteractionMode = "text" | "voice" | "immersive" | "review";
export type TutorLearnerLevel = "beginner" | "intermediate" | "advanced";

export interface ConversationPromptInput {
  scenarioId?: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  scenarioLabel: string;
  interactionMode?: TutorInteractionMode;
  learnerLevel?: TutorLearnerLevel;
}

export interface ConversationPromptContext {
  scenarioId: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  targetLabel: string;
  nativeLabel: string;
  scenarioLabel: string;
  learnerRole: string;
  tutorRole: string;
  scenarioGoals: string[];
  scenarioFocus: string[];
  coachingFocus: string[];
  interactionMode: TutorInteractionMode;
  learnerLevel: TutorLearnerLevel;
}
