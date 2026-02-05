import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize2, X } from 'lucide-react';
import MessageBubble from '../components/chat/MessageBubble';
import VoiceInput from '../components/chat/VoiceInput';
import { API_BASE_URL } from '../services/apiClient';
import {
  sendConversationMessage,
  startConversation,
  synthesizeConversationSpeech,
  uploadConversationVoice,
} from '../services/conversationService';
import { createFavorite } from '../services/favoritesService';
import { useLocale } from '../providers/LocaleContext';
import type { Annotation, Message } from '../types/chat';
import type {
  ConversationSession,
  ConversationMessage,
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

const mapSessionToMessages = (
  session: ConversationSession,
  ttsAudioMap: Record<string, string>,
): Message[] => {
  const mapped: Message[] = session.messages.map((message) => ({
    id: message.id,
    type: message.sender,
    content: message.text,
    translation: message.meta?.translation,
    timestamp: new Date(message.createdAt),
    audioUrl: message.meta?.audioUrl ?? ttsAudioMap[message.id],
    annotations:
      message.sender === 'ai'
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
        mapped[cursor] = { ...mapped[cursor], pronunciationScore: score };
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

export default function ConversationPage() {
  const { t, locale } = useLocale();
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(
    getInitialTargetLanguage,
  );
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>(
    locale === 'zh' ? 'mandarin' : 'english',
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSessionMessageCountRef = useRef<number>(0);
  const ttsRequestsRef = useRef<Set<string>>(new Set());
  const [ttsAudioMap, setTtsAudioMap] = useState<Record<string, string>>({});
  const voiceDraftUrlRef = useRef<string | null>(null);
  const ttsAudioMapRef = useRef<Record<string, string>>({});

  const targetLanguageLabels = useMemo(
    () => ({
      cantonese: locale === 'zh' ? '粤语' : 'Cantonese',
      mandarin: locale === 'zh' ? '普通话' : 'Mandarin',
      english: locale === 'zh' ? '英语' : 'English',
    }),
    [locale],
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
    ttsAudioMapRef.current = ttsAudioMap;
  }, [ttsAudioMap]);

  const sessionMessages = useMemo(
    () => (session ? mapSessionToMessages(session, ttsAudioMap) : []),
    [session, ttsAudioMap],
  );
  const mergedMessages = useMemo(
    () => [...sessionMessages, ...optimisticMessages],
    [sessionMessages, optimisticMessages],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mergedMessages]);

  useEffect(() => {
    let isMounted = true;
    setIsInitializing(true);
    setErrorMessage(null);
    startConversation({
      targetLanguage,
      nativeLanguage,
    })
      .then((nextSession) => {
        if (!isMounted) {
          return;
        }
        setSession(nextSession);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setErrorMessage(t('sessionInitError'));
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
        setIsInitializing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [nativeLanguage, targetLanguage, t]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const nextCount = session.messages.length;
    const prevCount = lastSessionMessageCountRef.current;
    if (nextCount > prevCount) {
      setOptimisticMessages([]);
      if (voiceDraftUrlRef.current) {
        URL.revokeObjectURL(voiceDraftUrlRef.current);
        voiceDraftUrlRef.current = null;
      }
    }
    lastSessionMessageCountRef.current = nextCount;
  }, [session]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }
    const source = new EventSource(
      `${API_BASE_URL}/conversation/${session.id}/events`,
    );
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ConversationSession;
        setSession(payload);
      } catch {
        setErrorMessage(t('streamParseError'));
      }
    };
    source.onerror = () => {
      setErrorMessage(t('streamError'));
      source.close();
    };
    return () => {
      source.close();
    };
  }, [session?.id, t]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }
    setTtsAudioMap({});
    ttsRequestsRef.current.clear();
    if (voiceDraftUrlRef.current) {
      URL.revokeObjectURL(voiceDraftUrlRef.current);
      voiceDraftUrlRef.current = null;
    }
  }, [session?.id]);

  const queueTtsForMessage = useCallback((message: ConversationMessage) => {
    if (!session) {
      return;
    }
    if (message.sender !== 'ai') {
      return;
    }
    if (message.meta?.audioUrl || ttsAudioMapRef.current[message.id]) {
      return;
    }
    if (ttsRequestsRef.current.has(message.id)) {
      return;
    }
    ttsRequestsRef.current.add(message.id);
    synthesizeConversationSpeech(session.id, message.text)
      .then((payload) => {
        setTtsAudioMap((prev) => ({
          ...prev,
          [message.id]: payload.audioUrl,
        }));
      })
      .catch(() => {
        if (!errorMessage) {
          setErrorMessage(t('tutorTtsError'));
        }
      })
      .finally(() => {
        ttsRequestsRef.current.delete(message.id);
      });
  }, [errorMessage, session, t]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const pending = session.messages.filter(
      (message) =>
        message.sender === 'ai' &&
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
  }, [errorMessage, queueTtsForMessage, session, t]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (voiceDraftUrlRef.current) {
        URL.revokeObjectURL(voiceDraftUrlRef.current);
      }
    };
  }, []);

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

  const handleSend = async () => {
    if (!inputValue.trim() || !session || isSending) {
      return;
    }
    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setErrorMessage(null);
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
    } catch {
      setErrorMessage(t('sendError'));
      setInputValue(messageText);
      setOptimisticMessages([]);
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
      setErrorMessage(t('favoritesSaveError'));
    }
  };

  const handleVoiceUpload = async (audio: Blob) => {
    if (!session) {
      return;
    }
    setErrorMessage(null);
    updateOptimisticVoiceStatus(t('voiceSending'));
    try {
      await uploadConversationVoice(session.id, audio);
    } catch {
      updateOptimisticVoiceStatus(t('voiceSendError'));
      setOptimisticMessages((prev) =>
        prev.filter((message) => !(message.type === 'ai' && message.isLoading)),
      );
      return;
    }
    updateOptimisticVoiceStatus(t('voiceWaiting'));
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage(t('voiceUnsupported'));
      return;
    }
    if (isRecording || !session) {
      return;
    }
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];
      const supportedType = preferredTypes.find((type) =>
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
          setErrorMessage(t('voiceNoCapture'));
          return;
        }
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const previewUrl = URL.createObjectURL(blob);
        if (voiceDraftUrlRef.current) {
          URL.revokeObjectURL(voiceDraftUrlRef.current);
        }
        voiceDraftUrlRef.current = previewUrl;
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
      setErrorMessage(t('voicePermissionDenied'));
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

  const messageList = (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {isInitializing && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 glass-card px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          {t('sessionInit')}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}
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
      placeholder={t('placeholder')}
      recordingLabel={t('recording')}
      onChange={setInputValue}
      onSend={handleSend}
      onToggleRecording={toggleRecording}
    />
  );

  if (isImmersiveMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
        <div className="glass-sidebar border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">{t('chatTitle')}</h2>
          <button
            onClick={() => setIsImmersiveMode(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">{t('exitImmersive')}</span>
          </button>
        </div>
        {messageList}
        {inputArea}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="glass-card border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {t('chatTitle')}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t('learningLanguage')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(targetLanguageLabels) as LanguageCode[]).map(
                (language) => {
                  const isActive = targetLanguage === language;
                  return (
                    <button
                      key={language}
                      onClick={() => setTargetLanguage(language)}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        isActive
                          ? 'glass-button text-white'
                          : 'glass-card text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
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
        <button
          onClick={() => setIsImmersiveMode(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-all shadow-sm hover:shadow-md"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="text-sm">{t('immersiveMode')}</span>
        </button>
      </div>

      {messageList}
      {inputArea}
    </div>
  );
}
