import { create } from 'zustand';
import { FavoriteItem, ConversationSession } from '../types/api';
import { LanguageCode } from '../types/language';
import { createFavorite, fetchFavorites, FavoritePayload, removeFavorite } from '../services/favoritesService';
import { sendConversationMessage, startConversation } from '../services/conversationService';

interface ConversationSlice {
  session?: ConversationSession;
  scenarioId?: string;
  loading: boolean;
  error?: string;
  start: (params: { scenarioId?: string; targetLanguage: LanguageCode }) => Promise<void>;
  send: (message: string) => Promise<void>;
  reset: () => void;
}

interface FavoritesSlice {
  items: FavoriteItem[];
  loading: boolean;
  error?: string;
  load: () => Promise<void>;
  add: (payload: FavoritePayload) => Promise<FavoriteItem | undefined>;
  remove: (id: string) => Promise<void>;
}

interface AppState {
  conversation: ConversationSlice;
  favorites: FavoritesSlice;
}

export const useAppStore = create<AppState>((set, get) => ({
  conversation: {
    session: undefined,
    scenarioId: undefined,
    loading: false,
    error: undefined,
    async start({ scenarioId, targetLanguage }) {
      set(state => ({ conversation: { ...state.conversation, loading: true, error: undefined } }));
      try {
        const session = await startConversation({ scenarioId, targetLanguage });
        set(state => ({
          conversation: {
            ...state.conversation,
            loading: false,
            session,
            scenarioId,
          },
        }));
      } catch (error) {
        set(state => ({
          conversation: {
            ...state.conversation,
            loading: false,
            error: error instanceof Error ? error.message : '会话启动失败',
          },
        }));
      }
    },
    async send(message) {
      const { session } = get().conversation;
      if (!session || !message.trim()) {
        return;
      }
      set(state => ({ conversation: { ...state.conversation, loading: true, error: undefined } }));
      try {
        const updated = await sendConversationMessage(session.id, message);
        set(state => ({
          conversation: { ...state.conversation, loading: false, session: updated },
        }));
      } catch (error) {
        set(state => ({
          conversation: {
            ...state.conversation,
            loading: false,
            error: error instanceof Error ? error.message : '发送失败',
          },
        }));
      }
    },
    reset: () =>
      set(state => ({
        conversation: { ...state.conversation, session: undefined, scenarioId: undefined },
      })),
  },
  favorites: {
    items: [],
    loading: false,
    error: undefined,
    async load() {
      set(state => ({ favorites: { ...state.favorites, loading: true, error: undefined } }));
      try {
        const items = await fetchFavorites();
        set(state => ({ favorites: { ...state.favorites, loading: false, items } }));
      } catch (error) {
        set(state => ({
          favorites: {
            ...state.favorites,
            loading: false,
            error: error instanceof Error ? error.message : '无法加载收藏',
          },
        }));
      }
    },
    async add(payload) {
      set(state => ({ favorites: { ...state.favorites, loading: true, error: undefined } }));
      try {
        const created = await createFavorite(payload);
        set(state => ({
          favorites: {
            ...state.favorites,
            loading: false,
            items: [created, ...state.favorites.items.filter(item => item.id !== created.id)],
          },
        }));
        return created;
      } catch (error) {
        set(state => ({
          favorites: {
            ...state.favorites,
            loading: false,
            error: error instanceof Error ? error.message : '收藏失败',
          },
        }));
        return undefined;
      }
    },
    async remove(id) {
      const { items } = get().favorites;
      set(state => ({
        favorites: { ...state.favorites, items: items.filter(item => item.id !== id) },
      }));
      try {
        await removeFavorite(id);
      } catch (error) {
        console.warn('Failed to remove favorite', error);
      }
    },
  },
}));
