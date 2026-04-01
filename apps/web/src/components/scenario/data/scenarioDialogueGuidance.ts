import type { LocaleKey } from '../../../providers/LocaleContext';
import type { ConversationSession, LanguageCode } from '../../../types/api';
import type { QuickReplyOption } from '../../chat/ChatQuickReplies';
import type { ScenarioDefinition } from '../types';

type Translator = (key: LocaleKey) => string;

const QUESTION_PATTERN =
  /^(what|when|where|which|how|can|could|would|do|did|are|is)\b/i;
const CLOSING_PATTERN = /thank|thanks|完成|好了|冇問題|结账|that's all|all set/i;

const buildOpeningReplies = (
  scenario: ScenarioDefinition,
  language: LanguageCode,
  t: Translator,
): string[] => {
  const firstGoal = t(scenario.goals[0]).replace(/\s+/g, ' ').trim();
  const secondGoal = t(scenario.goals[1]).replace(/\s+/g, ' ').trim();
  if (language === 'english') {
    return [
      `Let me start with ${firstGoal.toLowerCase()}.`,
      `First I'll handle ${firstGoal.toLowerCase()}, then add ${secondGoal.toLowerCase()}.`,
      'Please ask me the first natural question.',
    ];
  }
  if (language === 'cantonese') {
    return [
      `我想先處理${firstGoal}。`,
      `我會先講${firstGoal}，再補${secondGoal}。`,
      '你可以先問我第一條自然啲嘅問題嗎？',
    ];
  }
  return [
    `我想先处理${firstGoal}。`,
    `我会先说${firstGoal}，再补${secondGoal}。`,
    '你可以先问我第一个更自然的问题吗？',
  ];
};

const buildClosingReplies = (language: LanguageCode): string[] => {
  if (language === 'english') {
    return [
      'Great, that works for me. Thank you.',
      'Perfect, that is all I needed.',
      "Got it. I don't have any other questions.",
    ];
  }
  if (language === 'cantonese') {
    return [
      '好呀，噉就得，唔該晒。',
      '明白，我冇其他問題喇。',
      '好，噉樣安排就可以。',
    ];
  }
  return [
    '好的，那就这样安排，谢谢你。',
    '明白了，我没有其他问题了。',
    '好，这样就可以了。',
  ];
};

const buildQuestionReplies = (
  scenario: ScenarioDefinition,
  language: LanguageCode,
  t: Translator,
  topic?: string,
): string[] => {
  const primaryGoal = t(scenario.goals[0]).replace(/\s+/g, ' ').trim();
  const topicLead = topic ? topic.toLowerCase() : primaryGoal.toLowerCase();
  if (language === 'english') {
    return [
      `About ${topicLead}, I want to confirm one more detail.`,
      `Let me answer first, then I'll add one detail about ${primaryGoal.toLowerCase()}.`,
      'If possible, I also have one small request.',
    ];
  }
  if (language === 'cantonese') {
    return [
      topic ? `關於${topic}，我想再確認一件事。` : '我想再確認一件事。',
      `我先直接答你，再補充一個關於${primaryGoal}嘅細節。`,
      '如果可以，我仲有一個小要求。',
    ];
  }
  return [
    topic ? `关于${topic}，我想再确认一件事。` : '我想再确认一件事。',
    `我先直接回答，再补一个和${primaryGoal}有关的细节。`,
    '如果可以的话，我还有一个小需求。',
  ];
};

const buildProgressReplies = (
  scenario: ScenarioDefinition,
  language: LanguageCode,
  t: Translator,
): string[] => {
  const secondaryGoal = t(scenario.goals[1]).replace(/\s+/g, ' ').trim();
  const finalGoal = t(scenario.goals[2]).replace(/\s+/g, ' ').trim();
  if (language === 'english') {
    return [
      `Can we keep going and cover ${secondaryGoal.toLowerCase()}?`,
      `I also want to make sure I handle ${finalGoal.toLowerCase()}.`,
      'How would a native speaker say that more naturally?',
    ];
  }
  if (language === 'cantonese') {
    return [
      `我想繼續推進，順便處理${secondaryGoal}。`,
      `我都想確認下點樣完成${finalGoal}。`,
      '如果用母語者口吻，通常會點講？',
    ];
  }
  return [
    `我想继续往下走，顺便处理${secondaryGoal}。`,
    `我也想确认一下怎么完成${finalGoal}。`,
    '如果用母语者口吻，通常会怎么说？',
  ];
};

const cleanSnippet = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return undefined;
  }
  return compact.length > 28 ? `${compact.slice(0, 28).trim()}...` : compact;
};

const isQuestionLike = (text?: string): boolean => {
  if (!text) {
    return false;
  }
  const trimmed = text.trim();
  return /[?？]$/.test(trimmed) || QUESTION_PATTERN.test(trimmed);
};

const isClosingLike = (text?: string): boolean => {
  if (!text) {
    return false;
  }
  return CLOSING_PATTERN.test(text);
};

export const buildScenarioQuickReplyOptions = (
  scenario: ScenarioDefinition,
  session: ConversationSession,
  t: Translator,
): QuickReplyOption[] => {
  const { messages, targetLanguage } = session;
  const userTurns = messages.filter((message) => message.sender === 'user').length;
  const language = targetLanguage;

  if (userTurns === 0) {
    return buildOpeningReplies(scenario, language, t).map((text, index) => ({
      id: `starter-${scenario.key}-${index}`,
      text,
    }));
  }

  const associativePhrases = session.coach?.associativePhrases
    ?.map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (associativePhrases?.length) {
    return associativePhrases.map((text, index) => ({
      id: `scenario-coach-${session.id}-${index}`,
      text,
    }));
  }

  const lastAiMessage = [...messages].reverse().find((message) => message.sender === 'ai');
  const lastUserMessage = [...messages].reverse().find((message) => message.sender === 'user');
  const aiText = lastAiMessage?.text?.trim() ?? '';
  const userText = lastUserMessage?.text?.trim() ?? '';
  const topic = cleanSnippet(userText || aiText);
  const isClosingTurn = isClosingLike(aiText);
  const asksQuestion = isQuestionLike(aiText);

  const candidates = isClosingTurn
    ? buildClosingReplies(language)
    : asksQuestion
      ? buildQuestionReplies(scenario, language, t, topic)
      : buildProgressReplies(scenario, language, t);

  return candidates.map((text, index) => ({
    id: `scenario-${scenario.key}-${userTurns}-${index}`,
    text,
  }));
};

export const buildScenarioStageLabel = (
  t: Translator,
  userTurns: number,
  lastAiText?: string,
): string => {
  if (userTurns === 0) {
    return t('scenarioHeaderStageStart');
  }
  if (isQuestionLike(lastAiText)) {
    return t('scenarioHeaderStageRespond');
  }
  if (userTurns >= 4) {
    return t('scenarioHeaderStageWrap');
  }
  return t('scenarioHeaderStageAdvance');
};
