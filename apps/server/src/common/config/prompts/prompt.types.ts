import { LanguageCode } from "../../enums/language-code.enum";

export type TutorInteractionMode = "text" | "voice" | "immersive" | "review";
export type TutorLearnerLevel = "beginner" | "intermediate" | "advanced";

export interface ConversationPromptInput {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  scenarioLabel: string;
  interactionMode?: TutorInteractionMode;
  learnerLevel?: TutorLearnerLevel;
}

export interface ConversationPromptContext {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  targetLabel: string;
  nativeLabel: string;
  scenarioLabel: string;
  interactionMode: TutorInteractionMode;
  learnerLevel: TutorLearnerLevel;
}
