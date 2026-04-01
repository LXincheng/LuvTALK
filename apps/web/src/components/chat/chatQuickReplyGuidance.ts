import type { ConversationSession, LanguageCode } from '../../types/api';
import type { QuickReplyOption } from './ChatQuickReplies';

const QUESTION_PATTERN =
  /^(what|when|where|which|how|can|could|would|do|did|are|is)\b/i;
const CLOSE_PATTERN = /thank|thanks|got it|all set|冇問題|谢谢|好的|明白了/i;

const cleanSnippet = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return undefined;
  }
  return compact.length > 40 ? `${compact.slice(0, 40).trim()}...` : compact;
};

const isQuestionLike = (text?: string): boolean => {
  if (!text) {
    return false;
  }
  const trimmed = text.trim();
  return /[?？]$/.test(trimmed) || QUESTION_PATTERN.test(trimmed);
};

const isClosingLike = (text?: string): boolean =>
  Boolean(text && CLOSE_PATTERN.test(text));

const buildOpeningReplies = (
  language: LanguageCode,
  topic?: string,
): string[] => {
  if (language === 'english') {
    return [
      topic ? `Hi, I want to practice around ${topic.toLowerCase()}.` : 'Hi, I want to practice naturally.',
      'Please ask me one simple question first.',
      'I will answer briefly, then add one detail.',
    ];
  }
  if (language === 'cantonese') {
    return [
      topic ? `你好，我想圍繞${topic}練習。` : '你好，我想自然咁練習對話。',
      '你可以先問我一條簡單問題嗎？',
      '我會先簡短回答，再補一個細節。',
    ];
  }
  return [
    topic ? `你好，我想围绕${topic}练习。` : '你好，我想自然地练习对话。',
    '你可以先问我一个简单问题吗？',
    '我会先简短回答，再补一个细节。',
  ];
};

const buildQuestionReplies = (
  language: LanguageCode,
  topic?: string,
): string[] => {
  if (language === 'english') {
    return [
      topic ? `About ${topic.toLowerCase()}, let me answer first.` : 'Let me answer directly first.',
      'I can add one more concrete detail.',
      'How would a native speaker say that more naturally?',
    ];
  }
  if (language === 'cantonese') {
    return [
      topic ? `關於${topic}，我先直接答你。` : '我先直接答你。',
      '我可以再補一個具體細節。',
      '如果用母語者口吻，通常會點講？',
    ];
  }
  return [
    topic ? `关于${topic}，我先直接回答。` : '我先直接回答。',
    '我可以再补一个具体细节。',
    '如果用母语者口吻，通常会怎么说？',
  ];
};

const buildClosingReplies = (language: LanguageCode): string[] => {
  if (language === 'english') {
    return [
      'Great, that works for me. Thank you.',
      'Perfect, I understand the key point now.',
      'Can we do one quick review before we end?',
    ];
  }
  if (language === 'cantonese') {
    return [
      '好呀，噉就清楚喇，唔該晒。',
      '明白，我而家捉到重點喇。',
      '完之前可唔可以同我快啲複習一次？',
    ];
  }
  return [
    '好的，这样我就清楚了，谢谢你。',
    '明白了，我现在抓到重点了。',
    '结束前可以帮我快速复习一下吗？',
  ];
};

const buildProgressReplies = (
  language: LanguageCode,
  topic?: string,
): string[] => {
  if (language === 'english') {
    return [
      topic ? `Can we keep going on ${topic.toLowerCase()}?` : 'Can we keep going on this topic?',
      'Please give me one more natural example.',
      'I want to try one more turn by myself.',
    ];
  }
  if (language === 'cantonese') {
    return [
      topic ? `我想圍繞${topic}再講多一輪。` : '我想圍繞呢個話題再講多一輪。',
      '你可唔可以再俾我一個自然例句？',
      '我想自己再試講一次。',
    ];
  }
  return [
    topic ? `我想围绕${topic}再来一轮。` : '我想围绕这个话题再来一轮。',
    '你可以再给我一个自然例句吗？',
    '我想自己再试着说一次。',
  ];
};

export const buildChatQuickReplyOptions = (
  session: ConversationSession,
): QuickReplyOption[] => {
  const lastAiMessage = [...session.messages].reverse().find((message) => message.sender === 'ai');
  const lastUserMessage = [...session.messages].reverse().find((message) => message.sender === 'user');
  const topic = cleanSnippet(lastUserMessage?.text ?? lastAiMessage?.text);
  const userTurns = session.messages.filter((message) => message.sender === 'user').length;

  const candidates =
    userTurns === 0
      ? buildOpeningReplies(session.targetLanguage, topic)
      : isClosingLike(lastAiMessage?.text)
        ? buildClosingReplies(session.targetLanguage)
        : isQuestionLike(lastAiMessage?.text)
          ? buildQuestionReplies(session.targetLanguage, topic)
          : buildProgressReplies(session.targetLanguage, topic);

  return candidates.map((text, index) => ({
    id: `chat-${session.id}-${userTurns}-${index}`,
    text,
  }));
};
