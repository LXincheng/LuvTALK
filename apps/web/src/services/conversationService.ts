import { ConversationSession } from '../types/api';
import { LanguageCode } from '../types/language';
import { apiClient } from './apiClient';

export interface StartConversationPayload {
  scenarioId?: string;
  targetLanguage: LanguageCode;
}

const mockSessions = new Map<string, ConversationSession>();
const mockAvatars = {
  ai: 'https://api.dicebear.com/6.x/bottts-neutral/svg?seed=coach',
  user: 'https://api.dicebear.com/6.x/bottts-neutral/svg?seed=learner',
};

function createMockSession(payload: StartConversationPayload): ConversationSession {
  const id = crypto.randomUUID();
  const scenarioId = payload.scenarioId ?? 'daily';
  const now = new Date().toISOString();

  const session: ConversationSession = {
    id,
    scenarioId,
    targetLanguage: payload.targetLanguage,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: crypto.randomUUID(),
        sender: 'ai',
        senderName: 'LuvTALK 导师',
        avatar: mockAvatars.ai,
        language: payload.targetLanguage,
        createdAt: now,
        text: `这是 ${scenarioId} 场景。我会用自然的语气陪你练习，请告诉我想模拟的内容。`,
      },
    ],
    coach: {
      correction: '保持句尾礼貌用语，例如「唔该晒」或「谢谢」。',
      cultureNote: '在粤语场景中，先寒暄再进入主题会更自然。',
      associativePhrases: ['可唔可以再讲慢啲？', 'Could you say that again slowly?'],
      overallScore: 95,
    },
  };

  mockSessions.set(id, session);
  return session;
}

function respondMock(session: ConversationSession, message: string): ConversationSession {
  const userMessage = {
    id: crypto.randomUUID(),
    sender: 'user' as const,
    senderName: '我',
    avatar: mockAvatars.user,
    language: session.targetLanguage,
    createdAt: new Date().toISOString(),
    text: message,
  };
  const aiMessage = {
    id: crypto.randomUUID(),
    sender: 'ai' as const,
    senderName: 'LuvTALK 导师',
    avatar: mockAvatars.ai,
    language: session.targetLanguage,
    createdAt: new Date().toISOString(),
    text: `我听到你说：「${message}」。可以尝试这样讲会更地道：${message}，唔该晒。`,
    meta: { score: 92 },
  };

  session.messages = [...session.messages, userMessage, aiMessage];
  session.updatedAt = new Date().toISOString();
  session.coach = {
    correction: '语速可再放慢并加上问候语。',
    cultureNote: '句尾轻微上扬语调，可以让人感觉更友好。',
    associativePhrases: ['Hello, nice to meet you!', '唔好意思，麻烦你啦。'],
    overallScore: aiMessage.meta?.score ?? 90,
  };

  mockSessions.set(session.id, session);
  return session;
}

export async function startConversation(payload: StartConversationPayload) {
  try {
    return await apiClient.post<ConversationSession, StartConversationPayload>('/conversation/session', payload);
  } catch {
    return createMockSession(payload);
  }
}

export async function sendConversationMessage(conversationId: string, message: string) {
  try {
    return await apiClient.post<ConversationSession, { message: string }>(
      `/conversation/${conversationId}/message`,
      { message },
    );
  } catch {
    const mock = mockSessions.get(conversationId);
    if (!mock) throw new Error('Mock session not found');
    return respondMock(mock, message);
  }
}

export async function fetchConversation(conversationId: string) {
  try {
    return await apiClient.get<ConversationSession>(`/conversation/${conversationId}`);
  } catch {
    const mock = mockSessions.get(conversationId);
    if (!mock) throw new Error('Mock session not found');
    return mock;
  }
}
