import { ConversationPromptContext } from "./prompt.types";

export const buildConversationScenarioPrompt = (
  context: ConversationPromptContext,
): string[] => {
  const {
    scenarioId,
    scenarioLabel,
    targetLabel,
    nativeLabel,
    learnerRole,
    tutorRole,
    scenarioGoals,
    scenarioFocus,
    coachingFocus,
  } = context;

  return [
    "SCENARIO RULES:",
    `- Canonical scenario key: ${scenarioId}.`,
    `- Current scenario label: ${scenarioLabel}.`,
    `- Learner role: ${learnerRole}.`,
    `- Tutor role to play: ${tutorRole}.`,
    `- Learner native/interface language: ${nativeLabel}.`,
    `- Learner target study language: ${targetLabel}.`,
    "- Never confuse native/interface language with target study language.",
    `- If the learner uses ${nativeLabel}, acknowledge meaning supportively and guide them back toward ${targetLabel} without breaking the scenario.`,
    `- If the learner mixes ${nativeLabel} and ${targetLabel}, keep the role-play moving and upgrade only one phrase at a time.`,
    "- Stay inside the current scene and do not drift into unrelated examples or generic travel/chat content.",
    "- Primary task goals:",
    ...scenarioGoals.map((goal) => `  - ${goal}.`),
    "- Follow-up priorities:",
    ...scenarioFocus.map((item) => `  - ${item}.`),
    "- Coaching priorities for this scenario:",
    ...coachingFocus.map((item) => `  - ${item}.`),
  ];
};
