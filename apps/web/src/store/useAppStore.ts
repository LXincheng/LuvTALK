import { create } from "zustand";
import {
  FavoriteItem,
  ConversationMessage,
  ConversationSession,
} from "../types/api";
import { LanguageCode } from "../types/language";
import {
  createFavorite,
  fetchFavorites,
  FavoritePayload,
  removeFavorite,
} from "../services/favoritesService";
import {
  sendConversationMessage,
  startConversation,
} from "../services/conversationService";
import { createConversationStream } from "../services/conversationStream";

interface ConversationSlice {
  session?: ConversationSession;
  scenarioId?: string;
  loading: boolean;
  error?: string;
  start: (params: {
    scenarioId?: string;
    targetLanguage: LanguageCode;
    nativeLanguage?: LanguageCode;
  }) => Promise<void>;
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

export const useAppStore = create<AppState>((set, get)  => {
  let stream: EventSource | undefined;

  const closeStream = () => {
    if (stream) {
      stream.close();
      stream = undefined;
    }
  };

  const openStream = (sessionId: string) => {
    const source = createConversationStream(sessionId, (latest) => {
      set((state) => ({
        conversation: {
          ...state.conversation,
          session: latest,
        },
      }));
    });
    if (source) {
      closeStream();
      stream = source;
    }
  };

  const deriveUserAvatar = (session: ConversationSession | undefined) => {
    if (!session?.messages?.length) {
      return "/favicon.png";
    }
    for (let i = session.messages.length - 1; i >= 0; i -= 1) {
      const message = session.messages[i];
      if (message.sender === "user" && message.avatar) {
        return message.avatar;
      }
    }
    for (let i = session.messages.length - 1; i >= 0; i -= 1) {
      const message = session.messages[i];
      if (message.sender === "ai" && message.avatar) {
        return message.avatar.replace("coach", "learner");
      }
    }
    return "/favicon.png";
  };

  return {
    conversation: {
      session: undefined,
      scenarioId: undefined,
      loading: false,
      error: undefined,
      async start({ scenarioId, targetLanguage, nativeLanguage }) {
        set((state) => ({
          conversation: {
            ...state.conversation,
            loading: true,
            error: undefined,
          },
        }));
        try {
          const session = await startConversation({
            scenarioId,
            targetLanguage,
            nativeLanguage,
          });
          set((state) => ({
            conversation: {
              ...state.conversation,
              loading: false,
              session,
              scenarioId,
            },
          }));
          openStream(session.id);
        } catch (error) {
          set((state) => ({
            conversation: {
              ...state.conversation,
              loading: false,
              error: error instanceof Error ? error.message : "无法开启会话",
            },
          }));
        }
      },
      async send(message) {
        const trimmed = message.trim();
        const { session } = get().conversation;
        if (!session || !trimmed) {
          return;
        }
        const previous = session;
        const optimistic: ConversationMessage = {
          id: `local-${Date.now()}`,
          sender: "user",
          avatar: deriveUserAvatar(session),
          text: trimmed,
          language: session.targetLanguage,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          conversation: {
            ...state.conversation,
            session: {
              ...session,
              messages: [...session.messages, optimistic],
              updatedAt: new Date().toISOString(),
            },
          },
        }));
        try {
          const updated = await sendConversationMessage(session.id, trimmed);
          set((state) => ({
            conversation: {
              ...state.conversation,
              session: updated,
            },
          }));
        } catch (error) {
          set((state) => ({
            conversation: {
              ...state.conversation,
              error: error instanceof Error ? error.message : "发送消息失败",
              session: previous,
            },
          }));
        }
      },
      reset: () => {
        closeStream();
        set((state) => ({
          conversation: {
            ...state.conversation,
            session: undefined,
            scenarioId: undefined,
          },
        }));
      },
    },
    favorites: {
      items: [],
      loading: false,
      error: undefined,
      async load() {
        set((state) => ({
          favorites: { ...state.favorites, loading: true, error: undefined },
        }));
        try {
          const items = await fetchFavorites();
          const hydrated = items;
          set((state) => ({
            favorites: { ...state.favorites, loading: false, items: hydrated },
          }));
        } catch (error) {
          set((state) => ({
            favorites: {
              ...state.favorites,
              loading: false,
              error: error instanceof Error ? error.message : "无法加载收藏",
            },
          }));
        }
      },
      async add(payload) {
        set((state) => ({
          favorites: { ...state.favorites, loading: true, error: undefined },
        }));
        try {
          const created = await createFavorite(payload);
          set((state) => ({
            favorites: {
              ...state.favorites,
              loading: false,
              items: [
                created,
                ...state.favorites.items.filter(
                  (item) => item.id !== created.id
                ),
              ],
            },
          }));
          return created;
        } catch (error) {
          set((state) => ({
            favorites: {
              ...state.favorites,
              loading: false,
              error: error instanceof Error ? error.message : "保存收藏失败",
            },
          }));
          return undefined;
        }
      },
      async remove(id) {
        const { items } = get().favorites;
        const nextItems = items.filter((item) => item.id !== id);
        set((state) => ({
          favorites: {
            ...state.favorites,
            items: nextItems,
          },
        }));
        try {
          await removeFavorite(id);
          return true;
        } catch (error) {
          console.warn("Failed to remove favorite", error);
          set((state) => ({
            favorites: {
              ...state.favorites,
              items,
            },
          }));
          return false;
        }
      },
    },
  };
});
