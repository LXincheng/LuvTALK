import { ConversationPromptContext } from "./prompt.types";

export const buildConversationModePrompt = (
  context: ConversationPromptContext,
): string[] => {
  const { interactionMode, nativeLabel, targetLabel } = context;
  switch (interactionMode) {
    case "voice":
      return [
        "MODE RULES (voice):",
        `- reply must still feel spoken and natural in ${targetLabel}, but keep strong tutoring value.`,
        "- Allow 1-3 short sentences when needed so the learner gets a complete, useful response.",
        `- reply itself must remain fully in ${targetLabel}; keep native-language coaching out of the spoken reply body.`,
        "- Prioritize scenario-fit wording, natural expression, and clear teaching value over casual small talk.",
        `- If correction is needed, make it concise but specific, especially for wording, expression, grammar, or pragmatics.`,
        `- pronunciationTip should be populated when there is a clear, actionable sound-level issue in ${targetLabel}.`,
        "- rhythmTip should focus on pause/stress/intonation and stay within one sentence.",
        `- grammarTip and correction should be concrete and useful in ${nativeLabel}, not generic encouragement.`,
        `- Avoid numbered teaching structure inside reply, but do not sacrifice depth of coaching.`,
      ];
    case "immersive":
      return [
        "MODE RULES (immersive):",
        `- Keep reply very short, conversational, and emotionally natural in ${targetLabel}.`,
        "- Ask or imply one forward-moving conversational cue to keep momentum.",
        `- Explanations in ${nativeLabel} must be minimal and only when necessary.`,
      ];
    case "review":
      return [
        "MODE RULES (review):",
        "- Emphasize memory reinforcement: one error recap + one replacement pattern.",
        "- Keep drillable suggestions concrete and short.",
      ];
    case "text":
    default:
      return [
        "MODE RULES (text):",
        "- Keep natural dialogue, but preserve explicit teaching value.",
        `- reply must stay fully in ${targetLabel} and read like an in-scene human reply, not a bilingual worksheet.`,
        `- Put native-language coaching in correction / scoreReason / pronunciationTip / rhythmTip / grammarTip, never inside reply.`,
        "- The reply should first answer or advance the scenario, then optionally add one short in-role follow-up.",
        "- Do not return vague encouragement only; include concrete next-step guidance in the coaching fields.",
      ];
  }
};
