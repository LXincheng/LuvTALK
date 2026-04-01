import type { LocaleKey } from '../../../providers/LocaleContext';
import type { ConversationSession, LanguageCode } from '../../../types/api';
import type { QuickReplyOption } from '../../chat/ChatQuickReplies';
import type { ScenarioDefinition, ScenarioKey } from '../types';

type Translator = (key: LocaleKey) => string;

const QUESTION_PATTERN =
  /^(what|when|where|which|how|can|could|would|do|did|are|is)\b/i;
const CLOSING_PATTERN = /thank|thanks|完成|好了|冇問題|结账|that's all|all set/i;

const SCENARIO_OPENING_REPLIES: Record<
  ScenarioKey,
  Record<LanguageCode, string[]>
> = {
  hotel_checkin: {
    english: [
      "Hi, I'd like to check in.",
      'Hello, I have a reservation under Chan.',
      "Hi, I'm checking in for tonight.",
    ],
    mandarin: [
      '你好，我想办理入住。',
      '你好，我有预订，名字是陈。',
      '我今晚入住，麻烦帮我确认一下。',
    ],
    cantonese: [
      '你好，我想辦理入住。',
      '你好，我有預訂，名係陳。',
      '我今晚入住，麻煩幫我確認一下。',
    ],
  },
  doctor_visit_fever: {
    english: [
      "Hi doctor, I've had a fever since yesterday.",
      "I've been coughing and I feel weak.",
      'I took some medicine this morning, but I still feel sick.',
    ],
    mandarin: [
      '医生你好，我从昨天开始发烧。',
      '我一直咳嗽，而且觉得很没力气。',
      '我今天早上吃过药了，但还是不舒服。',
    ],
    cantonese: [
      '醫生你好，我由琴日開始發燒。',
      '我一直咳，仲覺得好攰。',
      '我今朝食過藥，但仲係唔舒服。',
    ],
  },
  restaurant_ordering: {
    english: [
      "Hi, I'd like to order a main dish, please.",
      'Could I get a latte with oat milk, please?',
      "I'd like this dish, but not too spicy.",
    ],
    mandarin: [
      '你好，我想点一份主菜。',
      '请给我一杯燕麦奶拿铁。',
      '我想点这个，但是不要太辣。',
    ],
    cantonese: [
      '你好，我想叫一份主菜。',
      '唔該，俾杯燕麥奶拿鐵我。',
      '我想叫呢個，但唔好太辣。',
    ],
  },
  shopping_in_store: {
    english: [
      "Hi, I'm looking for this in a larger size.",
      'Could you tell me how much this costs?',
      'Can I try this on first?',
    ],
    mandarin: [
      '你好，我想看看大一点的尺码。',
      '请问这个多少钱？',
      '我可以先试穿一下吗？',
    ],
    cantonese: [
      '你好，我想睇大一個碼。',
      '唔該，呢件幾多錢？',
      '我可唔可以試着先？',
    ],
  },
  asking_directions: {
    english: [
      "Excuse me, how do I get to the station?",
      'How long does it take to get there from here?',
      'Would you recommend walking or taking a taxi?',
    ],
    mandarin: [
      '请问去车站怎么走？',
      '从这里过去大概要多久？',
      '你觉得走路还是打车更方便？',
    ],
    cantonese: [
      '唔好意思，去車站點行？',
      '由呢度去大概要幾耐？',
      '你覺得行路定搭的士方便啲？',
    ],
  },
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
    return (SCENARIO_OPENING_REPLIES[scenario.key][language] ?? []).map((text, index) => ({
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
