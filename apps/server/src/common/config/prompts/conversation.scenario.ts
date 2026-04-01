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
    roleplayRules,
    completionSignals,
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
    "- Role-play execution rules:",
    ...roleplayRules.map((item) => `  - ${item}.`),
    "- Consider the scenario successfully completed only when most of these are true:",
    ...completionSignals.map((item) => `  - ${item}.`),
    "- Coaching priorities for this scenario:",
    ...coachingFocus.map((item) => `  - ${item}.`),
    "- Reply like the tutor ROLE inside the scene, not like a detached teacher explaining the scene from outside.",
    "- If the learner goes off-topic, redirect naturally from inside the role-play instead of switching to generic examples.",
  ];
};
