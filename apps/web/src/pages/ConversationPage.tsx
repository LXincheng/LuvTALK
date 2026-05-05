import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { History, LoaderCircle } from 'lucide-react';
import ChatQuickReplies, { type QuickReplyOption } from '../components/chat/ChatQuickReplies';
import MessageBubble from '../components/chat/MessageBubble';
import VoiceInput from '../components/chat/VoiceInput';
import ChatModeSwitcher from '../components/chat/ChatModeSwitcher';
import VoiceStyleSelector from '../components/chat/VoiceStyleSelector';
import VoiceSpeedSelector from '../components/chat/VoiceSpeedSelector';
import ConversationRecoveryBanner from '../components/chat/ConversationRecoveryBanner';
import SessionSummaryCard from '../components/chat/SessionSummaryCard';
import type { ConversationRecoveryState } from '../components/chat/ConversationRecoveryBanner';
import { API_BASE_URL } from '../services/apiClient';
import {
  deleteConversation,
  getStoredActiveConversationIdByLanguage,
  getStoredConversationIds,
  MAX_STORED_CONVERSATIONS,
  removeConversationPersistence,
  storeActiveConversationIdByLanguage,
  storeConversationAccessKey,
  trackConversationId,
  fetchVoiceConfig,
  fetchConversationSummary,
  fetchConversationById,
  fetchConversationHistory,
  fetchConversationQuickReplies,
  fetchVoiceOperationStatus,
  resumeConversation,
  sendConversationImageMessage,
  sendConversationMessage,
  startConversation,
  synthesizeConversationSpeech,
  uploadConversationVoice,
  withConversationAccessQuery,
} from '../services/conversationService';
import { createFavorite } from '../services/favoritesService';
import { reportLearningFocus } from '../services/learningGoalService';
import { useLocale } from '../providers/LocaleContext';
import { toast } from '../utils/toast';
import {
  getDefaultTtsVoice,
  getTtsVoiceOptions,
  isTtsVoiceSupported,
  setVoiceCatalog,
} from '../config/voice';
import type { Annotation, ChatMode, Message, MessageStatusTone } from '../types/chat';
import type {
  ConversationHistorySummary,
  ConversationSession,
  ConversationMessage,
  SessionSummaryPayload,
  FavoriteType,
  LanguageCode,
} from '../types/api';
import {
  getStoredRealtimeVoice,
  getStoredTtsSpeed,
  getStoredTtsVoice,
  setStoredRealtimeVoice,
  setStoredTtsSpeed,
  setStoredTtsVoice,
} from '../utils/voicePreferences';
import {
  formatUploadLimit,
  getPreferredRecordingMime,
  isVoiceRecordingSupported,
  MAX_IMAGE_UPLOAD_BYTES,
} from '../utils/media';

interface PendingTutorReply {
  channel: 'text' | 'voice';
  startedAiCount: number;
  startedUserCount: number;
  optimisticUserId?: string;
  loadingMessageId: string;
}

interface ActiveVoiceOperation {
  conversationId: string;
  operationId: string;
}

const LazyChatHistoryDrawer = lazy(
  () => import('../components/chat/ChatHistoryDrawer'),
);
const LazyImmersiveMode = lazy(
  () => import('../components/immersive/ImmersiveMode'),
);

const getInitialTargetLanguage = (): LanguageCode => {
  if (typeof window === 'undefined') {
    return 'cantonese';
  }
  const stored = window.localStorage.getItem('targetLanguage') as
    | LanguageCode
    | null;
  if (stored === 'cantonese' || stored === 'mandarin' || stored === 'english') {
    return stored;
  }
  return 'cantonese';
};

const MEANINGFUL_HISTORY_MIN_MESSAGES = 2;
const NEW_CHAT_QUICK_REPLY_DELAY_MS = 1400;
const EXISTING_CHAT_QUICK_REPLY_DELAY_MS = 5000;
const SESSION_BOOTSTRAP_TIMEOUT_MS = 12_000;
const SESSION_SWITCH_TIMEOUT_MS = 10_000;

let startupSessionPromise: Promise<ConversationSession> | null = null;

const withAsyncTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });

const mapAnnotationTypeToFavoriteType = (
  value?: string,
): FavoriteType => {
  const normalized = value?.toLowerCase();
  if (normalized === 'phrase' || normalized === 'expression') {
    return 'phrase';
  }
  if (normalized === 'cultural') {
    return 'cultural';
  }
  if (normalized === 'scenario') {
    return 'scenario';
  }
  return 'vocabulary';
};

/** Resolve backend-relative audio URLs to full URLs using the API base. */
const resolveAudioUrl = (
  url: string | undefined,
  conversationId: string,
): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  // Backend returns paths like /api/conversation/{id}/voice/{file}
  if (url.startsWith('/api/')) {
    return withConversationAccessQuery(
      `${API_BASE_URL}${url.slice(4)}`,
      conversationId,
    );
  }
  return withConversationAccessQuery(url, conversationId);
};

const mapSessionToMessages = (
  session: ConversationSession,
  ttsAudioMap: Record<string, string>,
): Message[] => {
  const mapped: Message[] = session.messages.map((message, index) => ({
    id: message.id,
    type: message.sender,
    content: message.text,
    translation: message.meta?.translation,
    timestamp: new Date(message.createdAt),
    audioUrl:
      resolveAudioUrl(message.meta?.audioUrl, session.id) ??
      ttsAudioMap[message.id],
    imageUrl: resolveAudioUrl(message.meta?.imageUrl, session.id),
    inputMode:
      message.sender === 'user'
        ? message.meta?.audioUrl
          ? message.meta?.source === 'realtime'
            ? 'realtime'
            : 'voice'
          : message.meta?.imageUrl
            ? 'image'
            : 'text'
        : undefined,
    annotations:
      message.sender === 'ai' && index > 0
        ? message.meta?.keyTerms?.map((term) => ({
            word: term.term,
            explanation: term.definition,
            examples: term.examples,
            type: term.type,
          }))
        : undefined,
  }));

  session.messages.forEach((message, index) => {
    if (message.sender !== 'ai') {
      return;
    }
    const score = message.meta?.score;
    if (typeof score !== 'number') {
      return;
    }
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (session.messages[cursor]?.sender === 'user') {
        mapped[cursor] = {
          ...mapped[cursor],
          overallScore: score,
          pronunciationScore: score,
          pronunciationTip:
            session.messages[cursor]?.meta?.audioUrl ? message.meta?.pronunciationTip : undefined,
          rhythmTip:
            session.messages[cursor]?.meta?.audioUrl ? message.meta?.rhythmTip : undefined,
          grammarTip: message.meta?.grammarTip,
        };
        break;
      }
    }
  });

  return mapped;
};

const buildTempId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `temp-${Date.now()}-${Math.round(Math.random() * 10000)}`;
};

const buildOptimisticUserMessage = (
  content: string,
  audioUrl?: string,
  options?: {
    statusText?: string;
    statusTone?: MessageStatusTone;
  },
): Message => ({
  id: buildTempId(),
  type: 'user',
  content,
  audioUrl,
  statusText: options?.statusText,
  statusTone: options?.statusTone,
  timestamp: new Date(),
  isOptimistic: true,
});

const buildTutorLoadingMessage = (): Message => ({
  id: buildTempId(),
  type: 'ai',
  content: '',
  timestamp: new Date(),
  isLoading: true,
  isOptimistic: true,
});

const countSessionMessages = (messages: ConversationMessage[]) => {
  const aiCount = messages.filter((message) => message.sender === 'ai').length;
  const userCount = messages.filter((message) => message.sender === 'user').length;
  return { aiCount, userCount };
};

const isFreshSession = (currentSession: ConversationSession | null): boolean =>
  Boolean(currentSession && currentSession.messages.every((message) => message.sender !== 'user'));

const isMeaningfulHistoryItem = (item: ConversationHistorySummary): boolean =>
  (item.messageCount ?? MEANINGFUL_HISTORY_MIN_MESSAGES) >= MEANINGFUL_HISTORY_MIN_MESSAGES;

const normalizeHistoryList = (
  history: ConversationHistorySummary[],
  activeConversationId?: string,
): ConversationHistorySummary[] => {
  const seen = new Set<string>();
  return history
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      if (item.id === activeConversationId) {
        return true;
      }
      return isMeaningfulHistoryItem(item);
    })
    .slice(0, MAX_STORED_CONVERSATIONS);
};

export default function ConversationPage() {
  const { t, locale } = useLocale();
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSessionSwitching, setIsSessionSwitching] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<LanguageCode | null>(null);
  const [recoveryState, setRecoveryState] = useState<ConversationRecoveryState | null>(
    'initializing',
  );
  const [recoveryReason, setRecoveryReason] = useState<
    | 'init_failed'
    | 'stream_recovering'
    | 'stream_unavailable'
    | 'send_failed'
    | 'voice_failed'
    | undefined
  >(undefined);
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    if (typeof window === 'undefined') return 'voice';
    return (localStorage.getItem('chatMode') as ChatMode) || 'voice';
  });
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyDrawerMounted, setHistoryDrawerMounted] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationHistorySummary[]
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(
    getInitialTargetLanguage,
  );
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>(
    locale === 'zh' ? 'mandarin' : 'english',
  );
  const [ttsVoice, setTtsVoice] = useState<string>(() =>
    getStoredTtsVoice(getInitialTargetLanguage()),
  );
  const [realtimeVoice, setRealtimeVoice] = useState<string>(() =>
    getStoredRealtimeVoice(getInitialTargetLanguage()),
  );
  const [ttsSpeed, setTtsSpeed] = useState<'slow' | 'normal' | 'fast'>(getStoredTtsSpeed);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSessionMessageCountRef = useRef<number>(0);
  const ttsRequestsRef = useRef<Set<string>>(new Set());
  const [ttsAudioMap, setTtsAudioMap] = useState<Record<string, string>>({});
  const voiceDraftUrlRef = useRef<string | null>(null);
  const imageDraftUrlRef = useRef<string | null>(null);
  const [imageDraftFile, setImageDraftFile] = useState<File | null>(null);
  const [imageDraftUrl, setImageDraftUrl] = useState<string | null>(null);
  const ttsAudioMapRef = useRef<Record<string, string>>({});
  const ttsVoiceRef = useRef(ttsVoice);
  const ttsSpeedRef = useRef(ttsSpeed);
  const ttsBaselineRef = useRef(0);
  const prevChatModeRef = useRef<ChatMode>(chatMode);
  const prevAutoTtsModeRef = useRef<ChatMode>(chatMode);
  const currentSessionIdRef = useRef<string | null>(null);
  const streamRecoveryTimerRef = useRef<number | null>(null);
  const pendingVoiceStatusTimerRef = useRef<number | null>(null);
  const voiceOperationPollTimerRef = useRef<number | null>(null);
  const voiceCompletionSyncTimerRef = useRef<number | null>(null);
  const sessionTransitionLockRef = useRef(false);
  const activeVoiceOperationRef = useRef<ActiveVoiceOperation | null>(null);
  const pendingTutorReplyRef = useRef<PendingTutorReply | null>(null);
  const focusBufferRef = useRef(0);
  const summaryFetchSeqRef = useRef(0);
  const lastSummaryAiCountRef = useRef(0);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryPayload | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [quickReplyOptions, setQuickReplyOptions] = useState<QuickReplyOption[]>([]);
  const [quickRepliesVisible, setQuickRepliesVisible] = useState(false);
  const [dismissedQuickReplyKey, setDismissedQuickReplyKey] = useState<string | null>(null);
  const quickReplyFetchSeqRef = useRef(0);
  const targetLanguageRef = useRef<LanguageCode>(targetLanguage);
  const nativeLanguageRef = useRef<LanguageCode>(nativeLanguage);
  const quickReplyTimerRef = useRef<number | null>(null);
  const ttsVoiceOptions = useMemo(
    () => getTtsVoiceOptions(targetLanguage),
    [targetLanguage],
  );

  useEffect(() => {
    void fetchVoiceConfig()
      .then((catalog) => {
        setVoiceCatalog(catalog);
        setTtsVoice((currentVoice) =>
          isTtsVoiceSupported(targetLanguageRef.current, currentVoice)
            ? currentVoice
            : getDefaultTtsVoice(targetLanguageRef.current),
        );
      })
      .catch(() => {
        // Keep local fallback catalog when the server config is unavailable.
      });
  }, []);

  const syncActiveSession = useCallback((nextSession: ConversationSession) => {
    setSession(nextSession);
    setTargetLanguage(nextSession.targetLanguage);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('activeConversationId', nextSession.id);
      storeActiveConversationIdByLanguage(nextSession.targetLanguage, nextSession.id);
      trackConversationId(nextSession.id);
      storeConversationAccessKey(nextSession.id, nextSession.accessKey);
    }
  }, []);

  const beginSessionTransition = useCallback((language?: LanguageCode) => {
    if (sessionTransitionLockRef.current) {
      return false;
    }
    sessionTransitionLockRef.current = true;
    setIsSessionSwitching(true);
    setPendingLanguage(language ?? null);
    setIsInitializing(true);
    return true;
  }, []);

  const finishSessionTransition = useCallback(() => {
    sessionTransitionLockRef.current = false;
    setIsSessionSwitching(false);
    setPendingLanguage(null);
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    if (!session?.id) {
      return;
    }
    storeConversationAccessKey(session.id, session.accessKey);
  }, [session?.accessKey, session?.id]);

  const clearStreamRecoveryTimer = useCallback(() => {
    if (streamRecoveryTimerRef.current !== null) {
      window.clearTimeout(streamRecoveryTimerRef.current);
      streamRecoveryTimerRef.current = null;
    }
  }, []);

  const clearPendingVoiceStatusTimer = useCallback(() => {
    if (pendingVoiceStatusTimerRef.current !== null) {
      window.clearInterval(pendingVoiceStatusTimerRef.current);
      pendingVoiceStatusTimerRef.current = null;
    }
  }, []);

  const clearVoiceOperationPoll = useCallback(() => {
    if (voiceOperationPollTimerRef.current !== null) {
      window.clearTimeout(voiceOperationPollTimerRef.current);
      voiceOperationPollTimerRef.current = null;
    }
    activeVoiceOperationRef.current = null;
  }, []);

  const clearVoiceCompletionSync = useCallback(() => {
    if (voiceCompletionSyncTimerRef.current !== null) {
      window.clearTimeout(voiceCompletionSyncTimerRef.current);
      voiceCompletionSyncTimerRef.current = null;
    }
  }, []);

  const clearQuickReplyTimer = useCallback(() => {
    if (quickReplyTimerRef.current !== null) {
      window.clearTimeout(quickReplyTimerRef.current);
      quickReplyTimerRef.current = null;
    }
  }, []);

  const updateOptimisticVoiceStatus = useCallback(
    (
      statusText: string | null,
      statusTone?: MessageStatusTone,
      specificMessageId?: string,
    ) => {
      setOptimisticMessages((prev) => {
        if (!prev.length) {
          return prev;
        }
        const targetId =
          specificMessageId ??
          pendingTutorReplyRef.current?.optimisticUserId ??
          [...prev].reverse().find((message) => message.type === 'user' && message.audioUrl)?.id;
        if (!targetId) {
          return prev;
        }
        const index = prev.findIndex((message) => message.id === targetId);
        if (index < 0) {
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...next[index],
          statusText: statusText ?? undefined,
          statusTone: statusTone ?? next[index].statusTone,
        };
        return next;
      });
    },
    [],
  );

  const removeOptimisticTutorLoading = useCallback(() => {
    setOptimisticMessages((prev) =>
      prev.filter((message) => !(message.type === 'ai' && message.isLoading)),
    );
  }, []);

  const recoveryMessage = useMemo(() => {
    if (!recoveryState) {
      return '';
    }
    if (recoveryReason === 'stream_recovering') {
      return t('streamRecovering');
    }
    if (recoveryReason === 'stream_unavailable') {
      return t('streamError');
    }
    if (recoveryReason === 'send_failed') {
      return t('sendError');
    }
    if (recoveryReason === 'voice_failed') {
      return t('voiceSendError');
    }
    if (recoveryReason === 'init_failed') {
      return t('sessionInitError');
    }
    if (recoveryState === 'initializing') {
      return t('sessionInit');
    }
    return t('streamRecovering');
  }, [recoveryReason, recoveryState, t]);

  const beginPendingTutorReply = useCallback(
    (
      channel: 'text' | 'voice',
      optimisticUserId: string | undefined,
      loadingMessageId: string,
    ) => {
      if (!session) {
        return;
      }
      const { aiCount, userCount } = countSessionMessages(session.messages);
      pendingTutorReplyRef.current = {
        channel,
        startedAiCount: aiCount,
        startedUserCount: userCount,
        optimisticUserId,
        loadingMessageId,
      };
      if (channel === 'voice' && optimisticUserId) {
        const startedAt = Date.now();
        let hasTriggeredSnapshotPull = false;
        clearPendingVoiceStatusTimer();
        pendingVoiceStatusTimerRef.current = window.setInterval(() => {
          const elapsedMs = Date.now() - startedAt;
          if (elapsedMs < 2_000) {
            updateOptimisticVoiceStatus(t('voiceSending'), 'sending', optimisticUserId);
            return;
          }
          if (elapsedMs < 6_000) {
            updateOptimisticVoiceStatus(t('voiceWaiting'), 'waiting', optimisticUserId);
            return;
          }
          if (elapsedMs < 10_000) {
            updateOptimisticVoiceStatus(t('voiceRoutingFast'), 'rerouting', optimisticUserId);
            return;
          }
          updateOptimisticVoiceStatus(t('voiceStillWorking'), 'waiting', optimisticUserId);
          if (!hasTriggeredSnapshotPull && elapsedMs >= 12_000 && session?.id) {
            hasTriggeredSnapshotPull = true;
            void fetchConversationById(session.id)
              .then((latestSession) => {
                syncActiveSession(latestSession);
              })
              .catch(() => {
                // Best-effort pull; SSE remains primary source of truth.
              });
          }
        }, 1_500);
      }
    },
    [clearPendingVoiceStatusTimer, session, t, updateOptimisticVoiceStatus],
  );

  const clearPendingTutorReply = useCallback(() => {
    clearPendingVoiceStatusTimer();
    clearVoiceOperationPoll();
    clearVoiceCompletionSync();
    pendingTutorReplyRef.current = null;
    removeOptimisticTutorLoading();
  }, [
    clearVoiceCompletionSync,
    clearPendingVoiceStatusTimer,
    clearVoiceOperationPoll,
    removeOptimisticTutorLoading,
  ]);

  const syncSessionAfterVoiceCompleted = useCallback(
    (conversationId: string, baseAiCount: number, attempt = 0) => {
      clearVoiceCompletionSync();
      void fetchConversationById(conversationId)
        .then((latestSession) => {
          if (latestSession.id !== currentSessionIdRef.current) {
            return;
          }
          const aiCount = latestSession.messages.filter(
            (message) => message.sender === 'ai',
          ).length;
          syncActiveSession(latestSession);
          if (aiCount > baseAiCount) {
            return;
          }
          if (attempt >= 8) {
            return;
          }
          voiceCompletionSyncTimerRef.current = window.setTimeout(() => {
            syncSessionAfterVoiceCompleted(conversationId, baseAiCount, attempt + 1);
          }, 250);
        })
        .catch(() => {
          if (attempt >= 8) {
            return;
          }
          voiceCompletionSyncTimerRef.current = window.setTimeout(() => {
            syncSessionAfterVoiceCompleted(conversationId, baseAiCount, attempt + 1);
          }, 250);
        });
    },
    [clearVoiceCompletionSync, syncActiveSession],
  );

  const startVoiceOperationPoll = useCallback(
    (conversationId: string, operationId: string) => {
      clearVoiceOperationPoll();
      activeVoiceOperationRef.current = { conversationId, operationId };

      const poll = async () => {
        const active = activeVoiceOperationRef.current;
        if (
          !active ||
          active.conversationId !== conversationId ||
          active.operationId !== operationId
        ) {
          return;
        }

        try {
          const snapshot = await fetchVoiceOperationStatus(conversationId, operationId);
          const latestActive = activeVoiceOperationRef.current;
          if (
            !latestActive ||
            latestActive.conversationId !== conversationId ||
            latestActive.operationId !== operationId
          ) {
            return;
          }

          if (snapshot.status === 'received' || snapshot.status === 'transcribing') {
            updateOptimisticVoiceStatus(t('voiceWaiting'), 'waiting');
          } else if (snapshot.status === 'responding') {
            updateOptimisticVoiceStatus(t('voiceRoutingFast'), 'rerouting');
          } else if (snapshot.status === 'completed') {
            const baseAiCount = pendingTutorReplyRef.current?.startedAiCount ?? 0;
            clearVoiceOperationPoll();
            clearPendingVoiceStatusTimer();
            setIsSending(false);
            updateOptimisticVoiceStatus(t('voiceStillWorking'), 'waiting');
            syncSessionAfterVoiceCompleted(conversationId, baseAiCount);
            return;
          } else if (snapshot.status === 'failed') {
            clearPendingTutorReply();
            updateOptimisticVoiceStatus(t('voiceSendError'), 'error');
            setIsSending(false);
            setRecoveryState('error');
            setRecoveryReason('voice_failed');
            return;
          }
        } catch {
          // Operation may not be visible immediately; keep polling.
        }

        if (
          activeVoiceOperationRef.current?.conversationId === conversationId &&
          activeVoiceOperationRef.current?.operationId === operationId
        ) {
          voiceOperationPollTimerRef.current = window.setTimeout(() => {
            void poll();
          }, 1200);
        }
      };

      void poll();
    },
    [
      clearPendingTutorReply,
      clearPendingVoiceStatusTimer,
      clearVoiceOperationPoll,
      syncSessionAfterVoiceCompleted,
      t,
      updateOptimisticVoiceStatus,
    ],
  );

  const loadOrResumeSession = useCallback(async () => {
    setIsInitializing(true);
    setRecoveryState('initializing');
    setRecoveryReason(undefined);
    clearStreamRecoveryTimer();
    try {
      const runBootstrap = async (): Promise<ConversationSession> => {
        const ids = getStoredConversationIds();
        const history = await withAsyncTimeout(
          fetchConversationHistory(ids),
          SESSION_SWITCH_TIMEOUT_MS,
          'SESSION_HISTORY_TIMEOUT',
        ).catch(
          () => [] as ConversationHistorySummary[],
        );
        const normalizedHistory = normalizeHistoryList(history);
        setConversationHistory(normalizedHistory);

        if (history.length > 0) {
          const preferredLanguageId = getStoredActiveConversationIdByLanguage(
            targetLanguageRef.current,
          );
          const activeConversationId =
            typeof window !== 'undefined'
              ? window.localStorage.getItem('activeConversationId')
              : null;
          const preferred =
            history.find((item) => item.id === preferredLanguageId) ??
            history.find((item) => item.id === activeConversationId) ??
            history.find(isMeaningfulHistoryItem) ??
            history[0];
          try {
            return await withAsyncTimeout(
              fetchConversationById(preferred.id),
              SESSION_SWITCH_TIMEOUT_MS,
              'SESSION_FETCH_TIMEOUT',
            );
          } catch {
            // Stale guest history or a dropped DB connection should not block boot.
          }
        }

        return withAsyncTimeout(
          resumeConversation({
            targetLanguage: targetLanguageRef.current,
            nativeLanguage: nativeLanguageRef.current,
          }),
          SESSION_BOOTSTRAP_TIMEOUT_MS,
          'SESSION_RESUME_TIMEOUT',
        );
      };

      const inFlight =
        startupSessionPromise ??
        (startupSessionPromise = runBootstrap().finally(() => {
          startupSessionPromise = null;
        }));
      const nextSession = await inFlight;
      toast.dismiss('session-init');
      toast.dismiss('stream');
      syncActiveSession(nextSession);
      setRecoveryState(null);
      setRecoveryReason(undefined);
      return nextSession;
    } catch {
      setRecoveryState('error');
      setRecoveryReason('init_failed');
      throw new Error('SESSION_INIT_FAILED');
    } finally {
      setIsInitializing(false);
    }
  }, [clearStreamRecoveryTimer, syncActiveSession]);

  const targetLanguageLabels = useMemo(
    () => ({
      cantonese: t('languageCantonese'),
      mandarin: t('languageMandarin'),
      english: t('languageEnglish'),
    }),
    [t],
  );

  useEffect(() => {
    setNativeLanguage(locale === 'zh' ? 'mandarin' : 'english');
  }, [locale]);

  useEffect(() => {
    targetLanguageRef.current = targetLanguage;
  }, [targetLanguage]);

  useEffect(() => {
    nativeLanguageRef.current = nativeLanguage;
  }, [nativeLanguage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('targetLanguage', targetLanguage);
    }
  }, [targetLanguage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('chatMode', chatMode);
    }
  }, [chatMode]);

  useEffect(() => {
    setStoredTtsVoice(targetLanguage, ttsVoice);
  }, [targetLanguage, ttsVoice]);

  useEffect(() => {
    setStoredRealtimeVoice(targetLanguage, realtimeVoice);
  }, [targetLanguage, realtimeVoice]);

  useEffect(() => {
    setStoredTtsSpeed(ttsSpeed);
  }, [ttsSpeed]);

  useEffect(() => {
    setTtsVoice(getStoredTtsVoice(targetLanguage));
  }, [targetLanguage]);

  useEffect(() => {
    setRealtimeVoice(getStoredRealtimeVoice(targetLanguage));
  }, [targetLanguage]);

  useEffect(() => {
    ttsAudioMapRef.current = ttsAudioMap;
  }, [ttsAudioMap]);

  useEffect(() => {
    ttsVoiceRef.current = ttsVoice;
  }, [ttsVoice]);

  useEffect(() => {
    ttsSpeedRef.current = ttsSpeed;
  }, [ttsSpeed]);

  useEffect(() => {
    currentSessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  const sessionMessages = useMemo(
    () => (session ? mapSessionToMessages(session, ttsAudioMap) : []),
    [session, ttsAudioMap],
  );
  const mergedMessages = useMemo(
    () => [...sessionMessages, ...optimisticMessages],
    [sessionMessages, optimisticMessages],
  );
  const isNewChatSession = useMemo(() => isFreshSession(session), [session]);
  const quickReplySuggestionKey = useMemo(() => {
    if (!session?.id) {
      return null;
    }
    return `${session.id}:${session.messages.length}:${isNewChatSession ? 'starter' : 'reply'}`;
  }, [isNewChatSession, session?.id, session?.messages.length]);
  const refreshSessionSummary = useCallback(async () => {
    if (!session?.id) {
      setSessionSummary(null);
      return;
    }
    const seq = ++summaryFetchSeqRef.current;
    setIsSummaryLoading(true);
    try {
      const payload = await fetchConversationSummary(session.id, locale);
      if (seq !== summaryFetchSeqRef.current) {
        return;
      }
      setSessionSummary(payload);
    } catch {
      if (seq !== summaryFetchSeqRef.current) {
        return;
      }
    } finally {
      if (seq === summaryFetchSeqRef.current) {
        setIsSummaryLoading(false);
      }
    }
  }, [locale, session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mergedMessages]);

  useEffect(() => {
    if (!session?.id) {
      clearQuickReplyTimer();
      startTransition(() => {
        setQuickRepliesVisible(false);
        setQuickReplyOptions([]);
      });
      return;
    }

    const shouldHideImmediately =
      Boolean(inputValue.trim()) ||
      isRecording ||
      isSending ||
      historyDrawerOpen ||
      chatMode === 'immersive' ||
      recoveryState === 'recovering' ||
      recoveryState === 'error' ||
      dismissedQuickReplyKey === quickReplySuggestionKey;

    if (shouldHideImmediately) {
      clearQuickReplyTimer();
      if (quickRepliesVisible) {
        startTransition(() => {
          setQuickRepliesVisible(false);
        });
      }
      return;
    }

    if (document.visibilityState !== 'visible') {
      clearQuickReplyTimer();
      startTransition(() => {
        setQuickRepliesVisible(false);
      });
      return;
    }

    clearQuickReplyTimer();
    quickReplyTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const activeSessionId = session.id;
      const activeSuggestionKey = quickReplySuggestionKey;
      const seq = ++quickReplyFetchSeqRef.current;
      void fetchConversationQuickReplies(activeSessionId, locale)
        .then((payload) => {
          if (
            seq !== quickReplyFetchSeqRef.current ||
            activeSessionId !== session?.id ||
            activeSuggestionKey !== quickReplySuggestionKey
          ) {
            return;
          }
          const options = payload.options.map((text, index) => ({
            id: `chat-${activeSessionId}-${activeSuggestionKey}-${index}`,
            text,
          }));
          startTransition(() => {
            setQuickReplyOptions(options);
            setQuickRepliesVisible(options.length > 0);
          });
        })
        .catch(() => {
          if (
            seq !== quickReplyFetchSeqRef.current ||
            activeSessionId !== session?.id ||
            activeSuggestionKey !== quickReplySuggestionKey
          ) {
            return;
          }
          startTransition(() => {
            setQuickReplyOptions([]);
            setQuickRepliesVisible(false);
          });
        });
    }, isNewChatSession ? NEW_CHAT_QUICK_REPLY_DELAY_MS : EXISTING_CHAT_QUICK_REPLY_DELAY_MS);

    return () => {
      clearQuickReplyTimer();
    };
  }, [
    chatMode,
    clearQuickReplyTimer,
    dismissedQuickReplyKey,
    historyDrawerOpen,
    inputValue,
    isNewChatSession,
    isRecording,
    isSending,
    locale,
    quickReplySuggestionKey,
    quickRepliesVisible,
    recoveryState,
    session,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        clearQuickReplyTimer();
        startTransition(() => {
          setQuickRepliesVisible(false);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearQuickReplyTimer]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const ids = getStoredConversationIds();
      const history = await fetchConversationHistory(ids);
      setConversationHistory(normalizeHistoryList(history, session?.id));
    } catch {
      // Retry once after a short delay for transient failures
      try {
        await new Promise((r) => setTimeout(r, 800));
        const ids = getStoredConversationIds();
        const history = await fetchConversationHistory(ids);
        setConversationHistory(normalizeHistoryList(history, session?.id));
      } catch {
        // History is non-critical, keep previous data if any
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, [session?.id]);

  useEffect(() => {
    let isMounted = true;
    loadOrResumeSession()
      .then(() => {
        if (!isMounted) {
          return;
        }
        // Pre-load history so it's ready when the drawer opens
        void loadHistory();
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        toast.error(t('sessionInitError'), { id: 'session-init' });
      });

    return () => {
      isMounted = false;
    };
  }, [loadHistory, loadOrResumeSession, t]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const nextCount = session.messages.length;
    const prevCount = lastSessionMessageCountRef.current;
    const pending = pendingTutorReplyRef.current;
    const { aiCount, userCount } = countSessionMessages(session.messages);

    if (pending) {
      const tutorReplied = aiCount > pending.startedAiCount;
      if (tutorReplied) {
        clearPendingTutorReply();
        setOptimisticMessages([]);
        setIsSending(false);
        if (voiceDraftUrlRef.current) {
          URL.revokeObjectURL(voiceDraftUrlRef.current);
          voiceDraftUrlRef.current = null;
        }
      } else if (pending.optimisticUserId && userCount > pending.startedUserCount) {
        const optimisticUserId = pending.optimisticUserId;
        pendingTutorReplyRef.current = {
          ...pending,
          optimisticUserId: undefined,
        };
        setOptimisticMessages((prev) =>
          prev.filter((message) => message.id !== optimisticUserId),
        );
      }
    } else if (nextCount > prevCount) {
      setIsSending(false);
      setOptimisticMessages((prev) =>
        prev.filter((message) => !(message.type === 'ai' && message.isLoading)),
      );
      if (voiceDraftUrlRef.current) {
        URL.revokeObjectURL(voiceDraftUrlRef.current);
        voiceDraftUrlRef.current = null;
      }
    }
    lastSessionMessageCountRef.current = nextCount;
  }, [clearPendingTutorReply, session]);

  const handleRecoveryRetry = useCallback(async () => {
    clearStreamRecoveryTimer();
    setRecoveryState('recovering');
    setRecoveryReason('stream_recovering');
    try {
      if (session?.id) {
        const latest = await fetchConversationById(session.id);
        syncActiveSession(latest);
      } else {
        await loadOrResumeSession();
      }
      setRecoveryState(null);
      setRecoveryReason(undefined);
    } catch {
      setRecoveryState('error');
      setRecoveryReason(session?.id ? 'stream_unavailable' : 'init_failed');
    }
  }, [clearStreamRecoveryTimer, loadOrResumeSession, session?.id, syncActiveSession]);

  useEffect(() => {
    if (!session?.id || chatMode === 'immersive') {
      toast.dismiss('stream');
      clearStreamRecoveryTimer();
      return;
    }
    let disposed = false;
    const source = new EventSource(
      withConversationAccessQuery(
        `${API_BASE_URL}/conversation/${session.id}/events`,
        session.id,
      ),
    );
    source.onopen = () => {
      toast.dismiss('stream');
      clearStreamRecoveryTimer();
      setRecoveryState(null);
      setRecoveryReason(undefined);
    };
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ConversationSession;
        toast.dismiss('stream');
        clearStreamRecoveryTimer();
        setRecoveryState(null);
        setRecoveryReason(undefined);
        syncActiveSession(payload);
      } catch {
        toast.error(t('streamParseError'), { id: 'stream' });
      }
    };
    source.onerror = () => {
      if (disposed) {
        return;
      }
      if (!navigator.onLine) {
        toast.warning(t('streamError'), { id: 'stream' });
      }
      setRecoveryState('recovering');
      setRecoveryReason('stream_recovering');
      clearStreamRecoveryTimer();
      streamRecoveryTimerRef.current = window.setTimeout(() => {
        setRecoveryState('error');
        setRecoveryReason('stream_unavailable');
      }, 12_000);
    };
    const handleOnline = () => {
      toast.dismiss('stream');
      clearStreamRecoveryTimer();
      setRecoveryState(null);
      setRecoveryReason(undefined);
    };
    const handleOffline = () => {
      toast.warning(t('streamError'), { id: 'stream' });
      setRecoveryState('recovering');
      setRecoveryReason('stream_recovering');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      source.close();
      toast.dismiss('stream');
      clearStreamRecoveryTimer();
    };
  }, [chatMode, clearStreamRecoveryTimer, session?.id, syncActiveSession, t]);

  useEffect(() => {
    const prevMode = prevChatModeRef.current;
    prevChatModeRef.current = chatMode;
    if (prevMode !== 'immersive' || chatMode === 'immersive' || !session?.id) {
      return;
    }
    let cancelled = false;
    void fetchConversationById(session.id)
      .then((latestSession) => {
        if (cancelled) {
          return;
        }
        syncActiveSession(latestSession);
      })
      .catch(() => {
        // Snapshot pull is best-effort; SSE will continue syncing.
      });
    return () => {
      cancelled = true;
    };
  }, [chatMode, session?.id, syncActiveSession]);

  useEffect(() => {
    if (!session?.id || isInitializing) {
      focusBufferRef.current = 0;
      return;
    }
    let disposed = false;

    const flushFocus = async () => {
      const seconds = focusBufferRef.current;
      if (seconds < 15 || disposed || !navigator.onLine) {
        return;
      }
      focusBufferRef.current = 0;
      try {
        await reportLearningFocus(seconds);
      } catch {
        focusBufferRef.current += seconds;
      }
    };

    const ticker = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      focusBufferRef.current += 15;
      if (focusBufferRef.current >= 60) {
        void flushFocus();
      }
    }, 15_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushFocus();
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(ticker);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onVisibilityChange);
      void flushFocus();
    };
  }, [isInitializing, session?.id]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }
    clearPendingTutorReply();
    setIsSending(false);
    lastSummaryAiCountRef.current = 0;
    setTtsAudioMap({});
    ttsRequestsRef.current.clear();
    ttsBaselineRef.current = session.messages.length;
    if (voiceDraftUrlRef.current) {
      URL.revokeObjectURL(voiceDraftUrlRef.current);
      voiceDraftUrlRef.current = null;
    }
    if (imageDraftUrlRef.current) {
      URL.revokeObjectURL(imageDraftUrlRef.current);
      imageDraftUrlRef.current = null;
    }
    setImageDraftFile(null);
    setImageDraftUrl(null);
  }, [clearPendingTutorReply, session?.id]);

  useEffect(() => {
    if (!session?.id) {
      prevAutoTtsModeRef.current = chatMode;
      return;
    }
    const prevMode = prevAutoTtsModeRef.current;
    prevAutoTtsModeRef.current = chatMode;
    if (prevMode === chatMode) {
      return;
    }
    if (chatMode === 'text' || prevMode === 'text') {
      // Do not backfill older tutor replies when toggling between text and voice.
      ttsBaselineRef.current = session.messages.length;
    }
  }, [chatMode, session?.id, session?.messages.length]);

  useEffect(() => {
    if (!session?.id || chatMode === 'immersive') {
      return;
    }
    const aiCount = session.messages.filter((message) => message.sender === 'ai').length;
    if (aiCount < 1 || aiCount === lastSummaryAiCountRef.current) {
      return;
    }
    lastSummaryAiCountRef.current = aiCount;
    const timer = window.setTimeout(() => {
      void refreshSessionSummary();
    }, 420);
    return () => {
      window.clearTimeout(timer);
    };
  }, [chatMode, refreshSessionSummary, session, session?.id, session?.messages]);

  const queueTtsForMessage = useCallback((message: ConversationMessage) => {
    if (!session) {
      return;
    }
    if (message.sender !== 'ai') {
      return;
    }
    if (message.meta?.source === 'realtime') {
      return;
    }
    if (message.meta?.audioUrl || ttsAudioMapRef.current[message.id]) {
      return;
    }
    if (ttsRequestsRef.current.has(message.id)) {
      return;
    }
    ttsRequestsRef.current.add(message.id);
    synthesizeConversationSpeech(
      session.id,
      message.text,
      ttsVoiceRef.current,
      ttsSpeedRef.current,
    )
      .then((payload) => {
        setTtsAudioMap((prev) => ({
          ...prev,
          [message.id]: payload.audioUrl,
        }));
      })
      .catch(() => {
        toast.error(t('tutorTtsError'), { id: 'tts' });
      })
      .finally(() => {
        ttsRequestsRef.current.delete(message.id);
      });
  }, [session, t]);

  useEffect(() => {
    if (!session || chatMode !== 'voice') {
      return;
    }
    // Only TTS messages added after the baseline. This skips the opening line and
    // avoids backfilling tutor replies created while text mode was active.
    const baseline = ttsBaselineRef.current;
    const candidates = baseline > 0
      ? session.messages.slice(baseline)
      : session.messages;
    const pending = candidates.filter(
      (message) =>
        message.sender === 'ai' &&
        message.meta?.source !== 'realtime' &&
        !message.meta?.audioUrl &&
        !ttsAudioMapRef.current[message.id],
    );
    if (!pending.length) {
      return;
    }
    const latest = pending[pending.length - 1];
    queueTtsForMessage(latest);
    const rest = pending.slice(0, -1);
    if (!rest.length) {
      return;
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        rest.forEach(queueTtsForMessage);
      });
    } else {
      setTimeout(() => {
        rest.forEach(queueTtsForMessage);
      }, 0);
    }
  }, [chatMode, queueTtsForMessage, session]);

  useEffect(() => {
    return () => {
      clearPendingTutorReply();
      clearStreamRecoveryTimer();
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (voiceDraftUrlRef.current) {
        URL.revokeObjectURL(voiceDraftUrlRef.current);
      }
      if (imageDraftUrlRef.current) {
        URL.revokeObjectURL(imageDraftUrlRef.current);
      }
    };
  }, [clearPendingTutorReply, clearStreamRecoveryTimer]);

  const handleSelectConversation = async (conversationId: string) => {
    if (isSending || isSessionSwitching || !beginSessionTransition()) {
      return;
    }
    setIsInitializing(true);
    setHistoryDrawerOpen(false);
    try {
      const selectedLanguage =
        conversationHistory.find((item) => item.id === conversationId)?.targetLanguage ??
        targetLanguageRef.current;
      let nextSession: ConversationSession;
      try {
        nextSession = await withAsyncTimeout(
          fetchConversationById(conversationId),
          SESSION_SWITCH_TIMEOUT_MS,
          'SESSION_FETCH_TIMEOUT',
        );
      } catch {
        nextSession = await withAsyncTimeout(
          resumeConversation({
            targetLanguage: selectedLanguage,
            nativeLanguage: nativeLanguageRef.current,
            conversationId,
          }),
          SESSION_BOOTSTRAP_TIMEOUT_MS,
          'SESSION_RESUME_TIMEOUT',
        );
      }
      syncActiveSession(nextSession);
    } catch {
      toast.error(t('sessionInitError'), { id: 'session-init' });
    } finally {
      finishSessionTransition();
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (isSending || isSessionSwitching || !beginSessionTransition()) {
      return;
    }

    const historyItem = conversationHistory.find((item) => item.id === conversationId);
    const deletingActiveConversation = session?.id === conversationId;
    const nextLanguage =
      historyItem?.targetLanguage ??
      session?.targetLanguage ??
      targetLanguageRef.current;

    try {
      await deleteConversation(conversationId);
      removeConversationPersistence(conversationId, historyItem?.targetLanguage);
      setConversationHistory((prev) =>
        normalizeHistoryList(
          prev.filter((item) => item.id !== conversationId),
          deletingActiveConversation ? undefined : session?.id,
        ),
      );

      if (deletingActiveConversation) {
        const freshSession = await withAsyncTimeout(
          startConversation({
            targetLanguage: nextLanguage,
            nativeLanguage: nativeLanguageRef.current,
          }),
          SESSION_BOOTSTRAP_TIMEOUT_MS,
          'SESSION_RESUME_TIMEOUT',
        );
        syncActiveSession(freshSession);
      }

      toast.success(t('conversationDeleteSuccess'), { id: 'conversation-delete' });
      void loadHistory();
    } catch {
      if (deletingActiveConversation) {
        try {
          await loadOrResumeSession();
        } catch {
          setSession(null);
        }
      }
      toast.error(t('conversationDeleteError'), { id: 'conversation-delete' });
    } finally {
      finishSessionTransition();
    }
  };

  const handleNewChat = async () => {
    if (isSending || isSessionSwitching || !beginSessionTransition()) {
      return;
    }
    setHistoryDrawerOpen(false);
    try {
      const newSession = await startConversation({
        targetLanguage,
        nativeLanguage,
      });
      syncActiveSession(newSession);
      void loadHistory();
    } catch {
      toast.error(t('sessionInitError'), { id: 'session-init' });
    } finally {
      finishSessionTransition();
    }
  };

  const handleTargetLanguageChange = async (language: LanguageCode) => {
    if (isSending || isSessionSwitching) {
      return;
    }
    if (!session || language === session.targetLanguage) {
      setTargetLanguage(language);
      return;
    }
    if (!beginSessionTransition(language)) {
      return;
    }
    try {
      const nextSession = await withAsyncTimeout(
        startConversation({
          targetLanguage: language,
          nativeLanguage: nativeLanguageRef.current,
        }),
        SESSION_BOOTSTRAP_TIMEOUT_MS,
        'SESSION_RESUME_TIMEOUT',
      );
      syncActiveSession(nextSession);
      void loadHistory();
    } catch {
      setTargetLanguage(session.targetLanguage);
      toast.error(t('sessionInitError'), { id: 'session-init' });
    } finally {
      finishSessionTransition();
    }
  };

  const handleModeChange = (nextMode: ChatMode) => {
    if (nextMode === 'immersive') {
      // Record current message count so we skip TTS for these when exiting
      ttsBaselineRef.current = session?.messages.length ?? 0;
    }
    setChatMode(nextMode);
  };

  const handleSend = useCallback(async (overrideText?: string) => {
    const messageText = (overrideText ?? inputValue).trim();
    if (!messageText || !session || isSending) {
      return;
    }
    clearQuickReplyTimer();
    setQuickRepliesVisible(false);
    setDismissedQuickReplyKey(quickReplySuggestionKey);
    // Only synthesize replies appended after this send action.
    ttsBaselineRef.current = session.messages.length;
    setInputValue('');
    setIsSending(true);
    const optimisticUser = buildOptimisticUserMessage(messageText);
    const loadingMessage = buildTutorLoadingMessage();
    setOptimisticMessages([optimisticUser, loadingMessage]);
    beginPendingTutorReply('text', optimisticUser.id, loadingMessage.id);

    try {
      const nextSession = await sendConversationMessage(
        session.id,
        messageText,
        chatMode,
      );
      clearPendingTutorReply();
      syncActiveSession(nextSession);
      setOptimisticMessages([]);
      setRecoveryState(null);
      setRecoveryReason(undefined);
    } catch {
      clearPendingTutorReply();
      toast.error(t('sendError'), { id: 'send' });
      setInputValue(messageText);
      setOptimisticMessages([]);
      setRecoveryState('error');
      setRecoveryReason('send_failed');
    } finally {
      setIsSending(false);
    }
  }, [
    beginPendingTutorReply,
    chatMode,
    clearPendingTutorReply,
    clearQuickReplyTimer,
    inputValue,
    isSending,
    quickReplySuggestionKey,
    session,
    t,
  ]);

  const handleQuickReplySelect = useCallback((text: string) => {
    if (!text.trim() || isSending) {
      return;
    }
    void handleSend(text);
  }, [handleSend, isSending]);

  const handleSaveVocabulary = async (payload: Annotation) => {
    if (!session) {
      return;
    }
    try {
      await createFavorite({
        title: payload.word,
        content: payload.explanation,
        type: mapAnnotationTypeToFavoriteType(payload.type),
        conversationId: session.id,
        metadata: payload.examples ? { examples: payload.examples } : undefined,
      });
    } catch {
      toast.error(t('favoritesSaveError'), { id: 'favorites' });
    }
  };

  const handleVoiceUpload = async (audio: Blob) => {
    if (!session) {
      return;
    }
    // Only synthesize replies appended after this voice upload.
    ttsBaselineRef.current = session.messages.length;
    updateOptimisticVoiceStatus(t('voiceSending'), 'sending');
    try {
      const uploadResult = await uploadConversationVoice(session.id, audio);
      startVoiceOperationPoll(session.id, uploadResult.operationId);
      setRecoveryState(null);
      setRecoveryReason(undefined);
    } catch {
      clearPendingTutorReply();
      updateOptimisticVoiceStatus(t('voiceSendError'), 'error');
      setIsSending(false);
      setOptimisticMessages((prev) =>
        prev.filter((message) => !(message.type === 'ai' && message.isLoading)),
      );
      setRecoveryState('error');
      setRecoveryReason('voice_failed');
      return;
    }
    updateOptimisticVoiceStatus(t('voiceWaiting'), 'waiting');
  };

  const clearImageDraft = useCallback(() => {
    setImageDraftFile(null);
    setImageDraftUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    imageDraftUrlRef.current = null;
  }, []);

  const handleImageFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.warning(t('imageUnsupported'), { id: 'image-upload-type' });
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.warning(
        t('imageTooLarge').replace('{size}', formatUploadLimit(MAX_IMAGE_UPLOAD_BYTES)),
        { id: 'image-upload-limit' },
      );
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    if (imageDraftUrlRef.current) {
      URL.revokeObjectURL(imageDraftUrlRef.current);
    }
    imageDraftUrlRef.current = nextUrl;
    setImageDraftFile(file);
    setImageDraftUrl(nextUrl);
    toast.success(t('imageFileSelected'), { id: 'image-upload-picked' });
  }, [t]);

  const startRecording = async () => {
    if (!isVoiceRecordingSupported()) {
      toast.warning(t('voiceUnsupported'), { id: 'voice' });
      return;
    }
    if (isRecording || isSending || !session) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedType = getPreferredRecordingMime();
      const options = supportedType ? { mimeType: supportedType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      streamRef.current = stream;
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsRecording(false);
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (!chunks.length) {
          toast.warning(t('voiceNoCapture'), { id: 'voice' });
          return;
        }
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const previewUrl = URL.createObjectURL(blob);
        if (voiceDraftUrlRef.current) {
          URL.revokeObjectURL(voiceDraftUrlRef.current);
        }
        voiceDraftUrlRef.current = previewUrl;
        setIsSending(true);
        const optimisticVoiceUser = buildOptimisticUserMessage(
          t('voiceMessageLabel'),
          previewUrl,
          {
            statusText: t('voiceSending'),
            statusTone: 'sending',
          },
        );
        const loadingMessage = buildTutorLoadingMessage();
        setOptimisticMessages([optimisticVoiceUser, loadingMessage]);
        beginPendingTutorReply('voice', optimisticVoiceUser.id, loadingMessage.id);
        void handleVoiceUpload(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      toast.warning(t('voicePermissionDenied'), { id: 'voice' });
    }
  };

  const stopRecording = () => {
    if (!isRecording) {
      return;
    }
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const handleSendImage = useCallback(async () => {
    if (!session || !imageDraftFile || isSending) {
      return;
    }
    const messageText = inputValue.trim();
    const draftFile = imageDraftFile;
    const draftUrl = imageDraftUrl;
    setIsSending(true);
    setQuickRepliesVisible(false);
    setDismissedQuickReplyKey(quickReplySuggestionKey);
    const optimisticUser = buildOptimisticUserMessage(
      messageText || t('imageMessageLabel'),
      undefined,
    );
    optimisticUser.imageUrl = draftUrl ?? undefined;
    const loadingMessage = buildTutorLoadingMessage();
    setOptimisticMessages([optimisticUser, loadingMessage]);
    beginPendingTutorReply('text', optimisticUser.id, loadingMessage.id);
    setInputValue('');
    setImageDraftFile(null);
    setImageDraftUrl(null);
    imageDraftUrlRef.current = null;

    try {
      const nextSession = await sendConversationImageMessage(
        session.id,
        draftFile,
        messageText,
      );
      clearPendingTutorReply();
      if (draftUrl) {
        URL.revokeObjectURL(draftUrl);
      }
      syncActiveSession(nextSession);
      setOptimisticMessages([]);
      setRecoveryState(null);
      setRecoveryReason(undefined);
    } catch {
      clearPendingTutorReply();
      toast.error(t('imageSendError'), { id: 'image-send' });
      setOptimisticMessages([]);
      setInputValue(messageText);
      setImageDraftFile(draftFile);
      setImageDraftUrl(draftUrl);
      imageDraftUrlRef.current = draftUrl ?? null;
    } finally {
      setIsSending(false);
    }
  }, [
    beginPendingTutorReply,
    clearPendingTutorReply,
    imageDraftFile,
    imageDraftUrl,
    inputValue,
    isSending,
    quickReplySuggestionKey,
    session,
    syncActiveSession,
    t,
  ]);

  useEffect(() => {
    if (chatMode !== 'immersive') {
      return;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [chatMode]);

  const messageList = (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-16 space-y-3 md:pb-16">
      <AnimatePresence>
        {mergedMessages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <MessageBubble
              message={message}
              onSaveVocabulary={handleSaveVocabulary}
              showTranslation={targetLanguage !== 'english'}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={messagesEndRef} />
    </div>
  );

  const inputArea = (
    <VoiceInput
      value={inputValue}
      isRecording={isRecording}
      isSending={isSending}
      isDisabled={isInitializing || !session}
      hideVoice={chatMode === 'text'}
      placeholder={t('placeholder')}
      recordingLabel={t('recording')}
      imagePreviewUrl={imageDraftUrl}
      imageButtonLabel={t('imageUploadAction')}
      onChange={setInputValue}
      onSend={() => {
        if (imageDraftFile) {
          void handleSendImage();
          return;
        }
        void handleSend();
      }}
      onToggleRecording={toggleRecording}
      onImageFileSelect={handleImageFileSelect}
      onClearImage={clearImageDraft}
    />
  );

  const disableSessionButtons = isInitializing || isSessionSwitching || isSending;

  if (chatMode === 'immersive') {
    if (!session?.id) {
      return (
        <div className="fixed inset-0 z-50 bg-surface flex items-center justify-center">
          <div className="rounded-xl glass-card px-4 py-3 text-sm text-label-secondary">
            {t('sessionInit')}
          </div>
        </div>
      );
    }
    return (
      <Suspense
        fallback={(
          <div className="fixed inset-0 z-50 bg-surface flex items-center justify-center">
            <div className="rounded-xl glass-card px-4 py-3 text-sm text-label-secondary">
              {t('immersiveConnecting')}
            </div>
          </div>
        )}
      >
        <LazyImmersiveMode
          conversationId={session.id}
          targetLanguage={targetLanguage}
          voice={realtimeVoice}
          onVoiceChange={setRealtimeVoice}
          onExit={() => {
            // Skip existing messages but allow new incoming AI messages after exit.
            ttsBaselineRef.current = session.messages.length;
            setChatMode('voice');
          }}
          onFallbackToText={() => {
            ttsBaselineRef.current = session.messages.length;
            setChatMode('voice');
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="page-shell h-full flex flex-col">
      {historyDrawerMounted && (
        <Suspense
          fallback={(
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute left-0 top-0 bottom-0 w-[84vw] max-w-sm border-r border-separator glass-sidebar p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-24 rounded bg-fill" />
                  <div className="h-10 rounded-xl bg-fill" />
                  <div className="h-20 rounded-2xl bg-fill" />
                  <div className="h-20 rounded-2xl bg-fill" />
                  <div className="h-20 rounded-2xl bg-fill" />
                </div>
              </div>
            </div>
          )}
        >
          <LazyChatHistoryDrawer
            isOpen={historyDrawerOpen}
            onClose={() => setHistoryDrawerOpen(false)}
            conversations={conversationHistory}
            activeConversationId={session?.id}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onNewChat={handleNewChat}
            isLoading={isLoadingHistory}
            isDisabled={disableSessionButtons}
          />
        </Suspense>
      )}

      <div className="border-b border-separator bg-[var(--surface-panel)]">
        {/* Mobile */}
        <div className="flex flex-col md:hidden">
          <div className="flex items-center gap-1.5 px-2 py-2 min-w-0">
            <button
              onClick={() => {
                setHistoryDrawerMounted(true);
                setHistoryDrawerOpen(true);
                void loadHistory();
              }}
              className="press-scale p-1.5 rounded-lg hover:bg-fill-secondary transition-colors shrink-0"
              title={t('chatHistory')}
            >
              <History className="w-5 h-5 text-label-tertiary" />
            </button>
            <h2 className="text-sm font-semibold text-label truncate min-w-0 flex-1">
              {session?.title || t('chatTitle')}
            </h2>
            <div className="shrink-0 ml-auto max-w-[48%]">
              <ChatModeSwitcher mode={chatMode} onChange={handleModeChange} compact />
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 pb-2 overflow-x-auto scrollbar-none min-w-0">
            <div className="inline-flex items-center gap-0.5 border border-separator rounded-lg p-0.5 glass-card shrink-0">
              {(Object.keys(targetLanguageLabels) as LanguageCode[]).map(
                (language) => {
                  const isActive = targetLanguage === language;
                  const isPending = pendingLanguage === language && isSessionSwitching;
                  return (
                    <button
                      key={language}
                      onClick={() => {
                        void handleTargetLanguageChange(language);
                      }}
                      disabled={disableSessionButtons}
                      className={`press-scale px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? 'glass-button text-white'
                          : 'text-label-secondary hover:bg-fill-secondary'
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isPending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
                        {targetLanguageLabels[language]}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
            {chatMode !== 'text' && (
              <>
                <div className="w-px h-5 bg-separator shrink-0" />
                <div className="shrink-0">
                  <VoiceStyleSelector
                    value={ttsVoice}
                    onChange={setTtsVoice}
                    options={ttsVoiceOptions}
                    compact
                    disabled={disableSessionButtons}
                  />
                </div>
                <div className="shrink-0">
                  <VoiceSpeedSelector value={ttsSpeed} onChange={setTtsSpeed} compact />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-2 px-3 lg:px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => {
                setHistoryDrawerMounted(true);
                setHistoryDrawerOpen(true);
                void loadHistory();
              }}
              className="press-scale p-2 rounded-lg hover:bg-fill-secondary transition-colors shrink-0"
              title={t('chatHistory')}
            >
              <History className="w-5 h-5 text-label-secondary" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-label truncate">
                {session?.title || t('chatTitle')}
              </h2>
              <div className="flex items-center gap-1 mt-1 overflow-x-auto scrollbar-none">
                <span className="inline-flex items-center gap-1.5 text-xs text-label-tertiary shrink-0">
                  {t('learningLanguage')}
                  {isSessionSwitching ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
                </span>
                <div className="inline-flex items-center gap-0.5 border border-separator rounded-lg p-0.5 glass-card shrink-0">
                  {(Object.keys(targetLanguageLabels) as LanguageCode[]).map(
                    (language) => {
                      const isActive = targetLanguage === language;
                      const isPending = pendingLanguage === language && isSessionSwitching;
                      return (
                        <button
                          key={language}
                          onClick={() => {
                            void handleTargetLanguageChange(language);
                          }}
                          disabled={disableSessionButtons}
                          className={`press-scale px-2 py-0.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                            isActive
                              ? 'glass-button text-white'
                              : 'text-label-secondary hover:bg-fill-secondary'
                          } disabled:cursor-not-allowed disabled:opacity-45`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {isPending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
                            {targetLanguageLabels[language]}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 shrink-0 min-w-0">
            {chatMode !== 'text' && (
              <>
                <VoiceStyleSelector
                  value={ttsVoice}
                  onChange={setTtsVoice}
                  options={ttsVoiceOptions}
                  compact
                  disabled={disableSessionButtons}
                />
                <VoiceSpeedSelector value={ttsSpeed} onChange={setTtsSpeed} compact />
              </>
            )}
            <ChatModeSwitcher mode={chatMode} onChange={handleModeChange} compact />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {recoveryState && recoveryMessage && (
          <ConversationRecoveryBanner
            state={recoveryState}
            message={recoveryMessage}
            onRetry={handleRecoveryRetry}
          />
        )}
      </AnimatePresence>

      <SessionSummaryCard
        summary={sessionSummary}
        isLoading={isSummaryLoading}
        onRefresh={() => {
          void refreshSessionSummary();
        }}
      />

      {messageList}
      <div className="sticky bottom-[var(--bottom-bar-h)] z-30 -mb-px md:static md:mb-0">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 bottom-full px-3 pb-2 sm:px-4">
            <div className="mx-auto flex max-w-4xl justify-start">
              <ChatQuickReplies
                visible={quickRepliesVisible}
                options={quickReplyOptions}
                disabled={isSending || isRecording}
                onSelect={handleQuickReplySelect}
                onClose={() => {
                  setQuickRepliesVisible(false);
                  setDismissedQuickReplyKey(quickReplySuggestionKey);
                }}
              />
            </div>
          </div>
          {inputArea}
        </div>
      </div>
    </div>
  );
}
