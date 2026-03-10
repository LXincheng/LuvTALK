import { buildConversationBasePrompt } from "./conversation.base";
import { buildConversationLevelPrompt } from "./conversation.level";
import { buildConversationModePrompt } from "./conversation.mode";
import { buildConversationSafetyPrompt } from "./conversation.safety";
import { buildPromptContext } from "./prompt.shared";
import { ConversationPromptInput } from "./prompt.types";

export const buildLayeredConversationPrompt = (
  input: ConversationPromptInput,
): string => {
  const context = buildPromptContext(input);
  return [
    ...buildConversationBasePrompt(context),
    ...buildConversationModePrompt(context),
    ...buildConversationLevelPrompt(context),
    ...buildConversationSafetyPrompt(context),
  ].join("\n");
};
