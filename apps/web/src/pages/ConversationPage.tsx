import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import MessageBubble from '../components/chat/MessageBubble';
import VoiceInput from '../components/chat/VoiceInput';
import ChatHistoryDrawer from '../components/chat/ChatHistoryDrawer';
import ChatModeSwitcher from '../components/chat/ChatModeSwitcher';
import VoiceStyleSelector from '../components/chat/VoiceStyleSelector';
import ConversationRecoveryBanner from '../components/chat/ConversationRecoveryBanner';
import SessionSummaryCard from '../components/chat/SessionSummaryCard';
import type { ConversationRecoveryState } from '../components/chat/ConversationRecoveryBanner';
import ImmersiveMode from '../components/immersive/ImmersiveMode';
import type { ChatMode } from '../components/chat/ChatModeSwitcher';
import { API_BASE_URL } from '../services/apiClient';
import {
  fetchConversationSummary,
  fetchConversationById,
  fetchConversationHistory,
  resumeConversation,
  sendConversationMessage,
  startConversation,
  synthesizeConversationSpeech,
  uploadConversationVoice,
} from '../services/conversationService';
import { createFavorite } from '../services/favoritesService';
import { reportLearningFocus } from '../services/learningGoalService';
import { useLocale } from '../providers/LocaleContext';
import { PREFERRED_RECORDING_MIMES, DEFAULT_TTS_VOICE } from '../constants/ui';
import type { Annotation, Message } from '../types/chat';
import type {
  ConversationHistorySummary,
  ConversationSession,
  ConversationMessage,
  SessionSummaryPayload,
  FavoriteType,
  LanguageCode,
} from '../types/api';

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

/** Read the list of known conversation IDs from localStorage. */
const getStoredConversationIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('conversationIds');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const GUEST_MAX_HISTORY = 5;

/** Add a conversation ID to the persisted list (deduped, most-recent first). */
const trackConversationId = (id: string) => {
  if (typeof window === 'undefined') return;
  const ids = getStoredConversationIds().filter((v) => v !== id);
  ids.unshift(id);
  // Keep at most 5 entries for guest users
  window.localStorage.setItem(
    'conversationIds',
    JSON.stringify(ids.slice(0, GUEST_MAX_HISTORY)),
  );
};

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
const resolveAudioUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  // Backend returns paths like /api/conversation/{id}/voice/{file}
  if (url.startsWith('/api/')) {
    return `${API_BASE_URL}${url.slice(4)}`;
  }
  return url;
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
    audioUrl: resolveAudioUrl(message.meta?.audioUrl) ?? ttsAudioMap[message.id],
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
          pronunciationScore: score,
          pronunciationTip: message.meta?.pronunciationTip,
          rhythmTip: message.meta?.rhythmTip,
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
): Message => ({
  id: buildTempId(),
  type: 'user',
  content,
  audioUrl,
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

const buildLocalSessionSummary = (
  currentSession: ConversationSession | null,
): SessionSummaryPayload | null => {
  if (!currentSession) {
    return null;
  }
  const aiMessages = currentSession.messages.filter((message) => message.sender === 'ai');
  const userMessages = currentSession.messages.filter((message) => message.sender === 'user');
  // Ignore pure welcome-only sessions to avoid noisy empty cards.
  if (userMessages.length < 1 || aiMessages.length < 2) {
    return null;
  }
  const scored = aiMessages
    .map((message) => message.meta?.score)
    .filter((score): score is number => typeof score === 'number');
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
    : null;
  const latestScore = scored.length ? scored[scored.length - 1] : null;
  const keyTerms = currentSession.messages
    .flatMap((message) => message.meta?.keyTerms ?? [])
    .map((term) => ({ term: term.term, definition: term.definition }))
    .filter((item) => item.term && item.definition)
    .slice(0, 6);

  return {
    conversationId: currentSession.id,
    durationMinutes: Math.max(
      1,
      Math.round(
        (new Date(currentSession.updatedAt).getTime() -
          new Date(currentSession.createdAt).getTime()) /
          60000,
      ),
    ),
    userTurns: userMessages.length,
    aiTurns: aiMessages.length,
    averageScore,
    latestScore,
    strengths: ['保持了连续对话，输出节奏稳定。'],
    improvements: ['可继续优化语法与发音细节。'],
    recommendedNextActions: ['继续下一轮对话并复用本轮关键词。'],
    keyTerms,
  };
};

export default function ConversationPage() {
  const { t, locale } = useLocale();
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
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
  const [ttsVoice, setTtsVoice] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_TTS_VOICE;
    return localStorage.getItem('ttsVoice') || DEFAULT_TTS_VOICE;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSessionMessageCountRef = useRef<number>(0);
  const ttsRequestsRef = useRef<Set<string>>(new Set());
  const [ttsAudioMap, setTtsAudioMap] = useState<Record<string, string>>({});
  const voiceDraftUrlRef = useRef<string | null>(null);
  const ttsAudioMapRef = useRef<Record<string, string>>({});
  const ttsVoiceRef = useRef(ttsVoice);
  const ttsBaselineRef = useRef(0);
  const prevChatModeRef = useRef<ChatMode>(chatMode);
  const streamRecoveryTimerRef = useRef<number | null>(null);
  const focusBufferRef = useRef(0);
  const summaryFetchSeqRef = useRef(0);
  const lastSummaryAiCountRef = useRef(0);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryPayload | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const clearStreamRecoveryTimer = useCallback(() => {
    if (streamRecoveryTimerRef.current !== null) {
      window.clearTimeout(streamRecoveryTimerRef.current);
      streamRecoveryTimerRef.current = null;
    }
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

  const loadOrResumeSession = useCallback(async () => {
    setIsInitializing(true);
    setRecoveryState('initializing');
    setRecoveryReason(undefined);
    clearStreamRecoveryTimer();
    const savedConversationId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('activeConversationId')
        : null;
    try {
      const nextSession = await resumeConversation({
        targetLanguage,
        nativeLanguage,
        conversationId: savedConversationId ?? undefined,
      });
      toast.dismiss('session-init');
      toast.dismiss('stream');
      setSession(nextSession);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('activeConversationId', nextSession.id);
        trackConversationId(nextSession.id);
      }
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
  }, [clearStreamRecoveryTimer, nativeLanguage, targetLanguage]);

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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ttsVoice', ttsVoice);
    }
  }, [ttsVoice]);

  useEffect(() => {
    ttsAudioMapRef.current = ttsAudioMap;
  }, [ttsAudioMap]);

  useEffect(() => {
    ttsVoiceRef.current = ttsVoice;
  }, [ttsVoice]);

  const sessionMessages = useMemo(
    () => (session ? mapSessionToMessages(session, ttsAudioMap) : []),
    [session, ttsAudioMap],
  );
  const mergedMessages = useMemo(
    () => [...sessionMessages, ...optimisticMessages],
    [sessionMessages, optimisticMessages],
  );

  const refreshSessionSummary = useCallback(async () => {
    if (!session?.id) {
      setSessionSummary(null);
      return;
    }
    const seq = ++summaryFetchSeqRef.current;
    setIsSummaryLoading(true);
    try {
      const payload = await fetchConversationSummary(session.id);
      if (seq !== summaryFetchSeqRef.current) {
        return;
      }
      setSessionSummary(payload);
    } catch {
      if (seq !== summaryFetchSeqRef.current) {
        return;
      }
      setSessionSummary((prev) => prev ?? buildLocalSessionSummary(session));
    } finally {
      if (seq === summaryFetchSeqRef.current) {
        setIsSummaryLoading(false);
      }
    }
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mergedMessages]);

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
  }, [loadOrResumeSession, t]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const nextCount = session.messages.length;
    const prevCount = lastSessionMessageCountRef.current;
    if (nextCount > prevCount) {
      setOptimisticMessages([]);
      setIsSending(false);
      if (voiceDraftUrlRef.current) {
        URL.revokeObjectURL(voiceDraftUrlRef.current);
        voiceDraftUrlRef.current = null;
      }
    }
    lastSessionMessageCountRef.current = nextCount;
  }, [session]);

  const handleRecoveryRetry = useCallback(async () => {
    clearStreamRecoveryTimer();
    setRecoveryState('recovering');
    setRecoveryReason('stream_recovering');
    try {
      if (session?.id) {
        const latest = await fetchConversationById(session.id);
        setSession(latest);
      } else {
        await loadOrResumeSession();
      }
      setRecoveryState(null);
      setRecoveryReason(undefined);
    } catch {
      setRecoveryState('error');
      setRecoveryReason(session?.id ? 'stream_unavailable' : 'init_failed');
    }
  }, [clearStreamRecoveryTimer, loadOrResumeSession, session?.id]);

  useEffect(() => {
    if (!session?.id || chatMode === 'immersive') {
      toast.dismiss('stream');
      clearStreamRecoveryTimer();
      return;
    }
    let disposed = false;
    const source = new EventSource(
      `${API_BASE_URL}/conversation/${session.id}/events`,
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
        setSession(payload);
      } catch {
        toast.error(t('streamParseError'), { id: 'stream' });
      }
    };
    source.onerror = () => {
      if (disposed) {
        return;
      }
      if (!navigator.onLine) {
        toast.error(t('streamError'), { id: 'stream' });
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
      toast.error(t('streamError'), { id: 'stream' });
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
  }, [chatMode, clearStreamRecoveryTimer, session?.id, t]);

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
        setSession(latestSession);
      })
      .catch(() => {
        // Snapshot pull is best-effort; SSE will continue syncing.
      });
    return () => {
      cancelled = true;
    };
  }, [chatMode, session?.id]);

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
    setSessionSummary((prev) => prev ?? buildLocalSessionSummary(session));
    lastSummaryAiCountRef.current = 0;
    setTtsAudioMap({});
    ttsRequestsRef.current.clear();
    ttsBaselineRef.current = 0;
    if (voiceDraftUrlRef.current) {
      URL.revokeObjectURL(voiceDraftUrlRef.current);
      voiceDraftUrlRef.current = null;
    }
  }, [session, session?.id]);

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
    synthesizeConversationSpeech(session.id, message.text, ttsVoiceRef.current)
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
    if (!session || chatMode === 'immersive') {
      return;
    }
    // Only TTS messages added after the baseline (skip messages from immersive session)
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
      clearStreamRecoveryTimer();
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (voiceDraftUrlRef.current) {
        URL.revokeObjectURL(voiceDraftUrlRef.current);
      }
    };
  }, [clearStreamRecoveryTimer]);

  const updateOptimisticVoiceStatus = (statusText: string | null) => {
    setOptimisticMessages((prev) => {
      const reversedIndex = [...prev]
        .reverse()
        .findIndex((message) => message.type === 'user' && message.audioUrl);
      if (reversedIndex < 0) {
        return prev;
      }
      const targetIndex = prev.length - 1 - reversedIndex;
      const next = [...prev];
      next[targetIndex] = {
        ...next[targetIndex],
        statusText: statusText ?? undefined,
      };
      return next;
    });
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const ids = getStoredConversationIds();
      const history = await fetchConversationHistory(ids);
      setConversationHistory(history);
    } catch {
      // Retry once after a short delay for transient failures
      try {
        await new Promise((r) => setTimeout(r, 800));
        const ids = getStoredConversationIds();
        const history = await fetchConversationHistory(ids);
        setConversationHistory(history);
      } catch {
        // History is non-critical, keep previous data if any
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    setIsInitializing(true);
    setHistoryDrawerOpen(false);
    try {
      const nextSession = await fetchConversationById(conversationId);
      setSession(nextSession);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('activeConversationId', nextSession.id);
        trackConversationId(nextSession.id);
      }
    } catch {
      toast.error(t('sessionInitError'), { id: 'session-init' });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleNewChat = async () => {
    setHistoryDrawerOpen(false);
    setIsInitializing(true);
    try {
      const newSession = await startConversation({
        targetLanguage,
        nativeLanguage,
      });
      setSession(newSession);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('activeConversationId', newSession.id);
        trackConversationId(newSession.id);
      }
      void loadHistory();
    } catch {
      toast.error(t('sessionInitError'), { id: 'session-init' });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleModeChange = (nextMode: ChatMode) => {
    if (nextMode === 'immersive') {
      // Record current message count so we skip TTS for these when exiting
      ttsBaselineRef.current = session?.messages.length ?? 0;
    }
    setChatMode(nextMode);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !session || isSending) {
      return;
    }
    // Reset TTS baseline so new AI replies get synthesized
    ttsBaselineRef.current = 0;
    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setOptimisticMessages([
      buildOptimisticUserMessage(messageText),
      buildTutorLoadingMessage(),
    ]);

    try {
      const nextSession = await sendConversationMessage(
        session.id,
        messageText,
      );
      setSession(nextSession);
      setOptimisticMessages([]);
      setRecoveryState(null);
      setRecoveryReason(undefined);
    } catch {
      toast.error(t('sendError'), { id: 'send' });
      setInputValue(messageText);
      setOptimisticMessages([]);
      setRecoveryState('error');
      setRecoveryReason('send_failed');
    } finally {
      setIsSending(false);
    }
  };

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
    // Reset TTS baseline so new AI replies get synthesized
    ttsBaselineRef.current = 0;
    updateOptimisticVoiceStatus(t('voiceSending'));
    try {
      await uploadConversationVoice(session.id, audio);
      setRecoveryState(null);
      setRecoveryReason(undefined);
    } catch {
      updateOptimisticVoiceStatus(t('voiceSendError'));
      setIsSending(false);
      setOptimisticMessages((prev) =>
        prev.filter((message) => !(message.type === 'ai' && message.isLoading)),
      );
      setRecoveryState('error');
      setRecoveryReason('voice_failed');
      return;
    }
    updateOptimisticVoiceStatus(t('voiceWaiting'));
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error(t('voiceUnsupported'), { id: 'voice' });
      return;
    }
    if (isRecording || isSending || !session) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedType = PREFERRED_RECORDING_MIMES.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
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
          toast.error(t('voiceNoCapture'), { id: 'voice' });
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
        setOptimisticMessages([
          {
            ...buildOptimisticUserMessage(t('voiceMessageLabel'), previewUrl),
            statusText: t('voiceSending'),
          },
          buildTutorLoadingMessage(),
        ]);
        void handleVoiceUpload(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error(t('voicePermissionDenied'), { id: 'voice' });
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
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
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
      onChange={setInputValue}
      onSend={handleSend}
      onToggleRecording={toggleRecording}
    />
  );

  if (chatMode === 'immersive') {
    if (!session?.id) {
      return (
        <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center">
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
            {t('sessionInit')}
          </div>
        </div>
      );
    }
    return (
      <ImmersiveMode
        conversationId={session.id}
        voice={ttsVoice}
        onVoiceChange={setTtsVoice}
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
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <ChatHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        conversations={conversationHistory}
        activeConversationId={session?.id}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        isLoading={isLoadingHistory}
      />

      <div className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        {/* Mobile */}
        <div className="flex flex-col md:hidden">
          <div className="flex items-center gap-1.5 px-2 py-2 min-w-0">
            <button
              onClick={() => {
                setHistoryDrawerOpen(true);
                void loadHistory();
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title={t('chatHistory')}
            >
              <History className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate min-w-0 flex-1">
              {session?.title || t('chatTitle')}
            </h2>
            <div className="shrink-0 ml-auto max-w-[48%]">
              <ChatModeSwitcher mode={chatMode} onChange={handleModeChange} compact />
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 pb-2 overflow-x-auto scrollbar-none min-w-0">
            <div className="inline-flex items-center gap-0.5 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-white/60 dark:bg-slate-900/60 shrink-0">
              {(Object.keys(targetLanguageLabels) as LanguageCode[]).map(
                (language) => {
                  const isActive = targetLanguage === language;
                  return (
                    <button
                      key={language}
                      onClick={() => setTargetLanguage(language)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? 'glass-button text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {targetLanguageLabels[language]}
                    </button>
                  );
                },
              )}
            </div>
            {chatMode !== 'text' && (
              <>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="shrink-0">
                  <VoiceStyleSelector value={ttsVoice} onChange={setTtsVoice} compact />
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
                setHistoryDrawerOpen(true);
                void loadHistory();
              }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title={t('chatHistory')}
            >
              <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                {session?.title || t('chatTitle')}
              </h2>
              <div className="flex items-center gap-1 mt-1 overflow-x-auto scrollbar-none">
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t('learningLanguage')}</span>
                <div className="inline-flex items-center gap-0.5 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-white/60 dark:bg-slate-900/60 shrink-0">
                  {(Object.keys(targetLanguageLabels) as LanguageCode[]).map(
                    (language) => {
                      const isActive = targetLanguage === language;
                      return (
                        <button
                          key={language}
                          onClick={() => setTargetLanguage(language)}
                          className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                            isActive
                              ? 'glass-button text-white'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {targetLanguageLabels[language]}
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
              <VoiceStyleSelector value={ttsVoice} onChange={setTtsVoice} compact />
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
        title={t('sessionSummaryTitle')}
        subtitle={t('sessionSummarySubtitle')}
        loadingText={t('sessionSummaryLoading')}
        refreshText={t('commonRetry')}
        strengthsTitle={t('sessionSummaryStrengths')}
        improvementsTitle={t('sessionSummaryImprovements')}
        nextActionsTitle={t('sessionSummaryNextActions')}
        keyTermsTitle={t('sessionSummaryKeyTerms')}
        emptyText={t('sessionSummaryEmpty')}
        collapseText={t('sessionSummaryCollapse')}
        expandText={t('sessionSummaryExpand')}
        averageLabel={t('sessionSummaryMetricAverage')}
        latestLabel={t('sessionSummaryMetricLatest')}
        turnsLabel={t('sessionSummaryMetricTurns')}
        minutesLabel={t('sessionSummaryMetricMinutes')}
        summary={sessionSummary}
        isLoading={isSummaryLoading}
        onRefresh={() => {
          void refreshSessionSummary();
        }}
      />

      {messageList}
      {inputArea}
    </div>
  );
}
