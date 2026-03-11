import { LanguageCode } from "../../common/enums/language-code.enum";
import { TutorInteractionMode } from "../../common/config/prompt.config";
import { AiResponse } from "../../common/types/ai-response.schema";

export interface PromptRegressionCase {
  id: string;
  title: string;
  interactionMode: TutorInteractionMode;
  nativeLanguage: LanguageCode;
  scenarioId: string;
  latestUserMessage: string;
  payload: AiResponse;
  expectedMinScore: number;
  requiredFailures?: string[];
}

export interface PromptRegressionResult {
  id: string;
  score: number;
  checks: string[];
  failures: string[];
}
