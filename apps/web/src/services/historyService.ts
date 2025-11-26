import { apiClient } from "./apiClient";
import { ConversationSession } from "../types/api";

export interface ConversationHistoryItem {
  id: string;
  scenarioId: string;
  targetLanguage: string;
  nativeLanguage?: string | null;
  updatedAt: string;
  score?: number;
  lastMessage: string;
}

interface CacheRecord<T> {
  value: T;
  timestamp: number;
}

const HISTORY_CACHE_TTL_MS = 60 * 1000;
const CONVERSATION_CACHE_TTL_MS = 5 * 60 * 1000;

let historyCache: CacheRecord<ConversationHistoryItem[]> | null = null;
const conversationCache = new Map<string, CacheRecord<ConversationSession>>();

const isFresh = (record: CacheRecord<unknown>, ttl: number) =>
  Date.now() - record.timestamp < ttl;

async function fetchHistoryList() {
  const items = await apiClient.get<ConversationHistoryItem[]>(
    "/conversation/history",
  );
  historyCache = { value: items, timestamp: Date.now() };
  return items;
}

async function fetchConversation(conversationId: string) {
  const session = await apiClient.get<ConversationSession>(
    `/conversation/${conversationId}/history`,
  );
  conversationCache.set(conversationId, {
    value: session,
    timestamp: Date.now(),
  });
  return session;
}

export const historyService = {
  async list(options?: { force?: boolean }) {
    if (
      !options?.force &&
      historyCache &&
      isFresh(historyCache, HISTORY_CACHE_TTL_MS)
    ) {
      return historyCache.value;
    }
    return fetchHistoryList();
  },
  async getConversation(conversationId: string, options?: { force?: boolean }) {
    const cached = conversationCache.get(conversationId);
    if (
      !options?.force &&
      cached &&
      isFresh(cached, CONVERSATION_CACHE_TTL_MS)
    ) {
      return cached.value;
    }
    return fetchConversation(conversationId);
  },
  clearCache() {
    historyCache = null;
    conversationCache.clear();
  },
};
