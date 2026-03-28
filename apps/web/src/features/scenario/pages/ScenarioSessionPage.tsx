import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MessageBubble from '../../../components/chat/MessageBubble';
import VoiceInput from '../../../components/chat/VoiceInput';
import ChatQuickReplies, { type QuickReplyOption } from '../../../components/chat/ChatQuickReplies';
import ScenarioScoreModal from '../../../components/report/ScenarioScoreModal';
import { useLocale } from '../../../providers/LocaleContext';
import { API_BASE_URL } from '../../../services/apiClient';
import {
  fetchConversationById,
  fetchVoiceOperationStatus,
  generateScenarioFeedback,
  sendConversationMessage,
  startConversation,
  storeConversationAccessKey,
  synthesizeConversationSpeech,
  uploadConversationVoice,
  withConversationAccessQuery,
} from '../../../services/conversationService';
import { DEFAULT_TTS_VOICE, PREFERRED_RECORDING_MIMES } from '../../../constants/ui';
import { toast } from '../../../utils/toast';
import ScenarioSessionHeader from '../components/ScenarioSessionHeader';
import { getScenarioDefinition } from '../data/scenarioDefinitions';
import type {
  ConversationSession,
  LanguageCode,
  ScenarioFeedbackPayload,
} from '../../../types/api';
import type { LocaleKey } from '../../../providers/LocaleContext';
import type { Message, MessageStatusTone } from '../../../types/chat';
import type { ScenarioDefinition, ScenarioFeedback } from '../types';

const buildTempId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `scenario-${Date.now()}-${Math.round(Math.random() * 10000)}`;
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

const resolveAudioUrl = (
  url: string | undefined,
  conversationId: string,
): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
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
  const mapped: Message[] = session.messages.map((message) => ({
    id: message.id,
    type: message.sender,
    content: message.text,
    translation: message.meta?.translation,
    timestamp: new Date(message.createdAt),
    audioUrl:
      resolveAudioUrl(message.meta?.audioUrl, session.id) ??
      ttsAudioMap[message.id],
    annotations: message.sender === 'ai'
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
      const candidate = session.messages[cursor];
      if (candidate?.sender === 'user') {
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

const scenarioEmojiMap = {
  hotel: '🏨',
  stethoscope: '🩺',
  utensils: '🍽️',
  bag: '🛍️',
  map: '🗺️',
} as const;

const cleanSnippet = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return undefined;
  }
  return compact.length > 24 ? `${compact.slice(0, 24).trim()}...` : compact;
};

const buildScenarioOpeningReplies = (
  scenario: ScenarioDefinition,
  language: LanguageCode,
  t: (key: LocaleKey) => string,
): string[] => {
  const goal = cleanSnippet(t(scenario.goals[0])) ?? cleanSnippet(t(scenario.titleKey));
  if (language === 'english') {
    return [
      goal ? `I want to start with ${goal.toLowerCase()}.` : 'I want to start with the key information.',
      'Let me say the main point first.',
      'I can answer step by step.',
    ];
  }
  if (language === 'cantonese') {
    return [
      goal ? `我想先講${goal}。` : '我想先講最重要嗰部分。',
      '我先講重點。',
      '我可以逐步答。',
    ];
  }
  return [
    goal ? `我想先说${goal}。` : '我想先说最重要的信息。',
    '我先把重点说明白。',
    '我可以一步一步回答。',
  ];
};

const buildScenarioQuickReplies = (
  scenario: ScenarioDefinition,
  session: ConversationSession,
  t: (key: LocaleKey) => string,
): QuickReplyOption[] => {
  const { messages } = session;
  const userTurns = messages.filter((message) => message.sender === 'user').length;
  if (userTurns === 0) {
    return buildScenarioOpeningReplies(scenario, session.targetLanguage, t).map((text, index) => ({
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
  const topic = cleanSnippet(lastUserMessage?.text ?? aiText);
  const isClosingTurn = /thank|thanks|完成|好了|冇問題|结账|that's all|all set/i.test(aiText);
  const asksQuestion = /[?？]$/.test(aiText) || /^(what|when|where|which|how|can|could|would|do|did|are|is)\b/i.test(aiText);

  const language = session.targetLanguage;
  const replySet = isClosingTurn
    ? language === 'english'
      ? [
          'Great, that works for me. Thank you.',
          'Perfect, that is all I needed.',
          'Got it. I do not have any other questions.',
        ]
      : language === 'cantonese'
        ? [
            '好呀，噉就得，唔該晒。',
            '明白，我冇其他問題喇。',
            '好，噉樣安排就可以。',
          ]
        : [
            '好的，那就这样安排，谢谢你。',
            '明白了，我没有其他问题了。',
            '好，这样就可以了。',
          ]
    : asksQuestion
      ? language === 'english'
        ? [
            topic ? `About ${topic.toLowerCase()}, I want to confirm one more thing.` : 'I want to confirm one more thing.',
            'Let me give you the key information first.',
            'If possible, I also have one small request.',
          ]
        : language === 'cantonese'
          ? [
              topic ? `關於${topic}，我想再確認一件事。` : '我想再確認一件事。',
              '我可以先講最重要嗰部分。',
              '如果可以，我仲有一個小要求。',
            ]
          : [
              topic ? `关于${topic}，我想再确认一件事。` : '我想再确认一件事。',
              '我先说最重要的信息。',
              '如果可以的话，我还有一个小需求。',
            ]
      : language === 'english'
        ? [
            'Can you give me one more example?',
            'How would a native speaker say that more naturally?',
            'Can we do one more turn in this situation?',
          ]
        : language === 'cantonese'
          ? [
              '你可唔可以再俾我一個例句？',
              '如果用母語者口吻，通常會點講？',
              '我想就呢個情境再練多一輪。',
            ]
          : [
              '你可以再给我一个例句吗？',
              '如果用母语者口吻，通常会怎么说？',
              '我想围绕这个情境再练一轮。',
            ];

  return replySet.map((text, index) => ({
    id: `scenario-${scenario.key}-${userTurns}-${index}`,
    text,
  }));
};

const buildStageLabel = (
  t: (key: LocaleKey) => string,
  userTurns: number,
  lastAiText?: string,
): string => {
  if (userTurns === 0) {
    return t('scenarioHeaderStageStart');
  }
  if (
    lastAiText &&
    (/[?？]$/.test(lastAiText.trim()) ||
      /^(what|when|where|which|how|can|could|would|do|did|are|is)\b/i.test(lastAiText.trim()))
  ) {
    return t('scenarioHeaderStageRespond');
  }
  if (userTurns >= 4) {
    return t('scenarioHeaderStageWrap');
  }
  return t('scenarioHeaderStageAdvance');
};

export default function ScenarioSessionPage() {
  const { scenarioKey, sessionId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [scenarioFeedback, setScenarioFeedback] = useState<ScenarioFeedback | null>(null);
  const [isScoreLoading, setIsScoreLoading] = useState(false);
  const [scoreErrorMessage, setScoreErrorMessage] = useState<string | null>(null);
  const [quickRepliesVisible, setQuickRepliesVisible] = useState(true);
  const [quickReplyOptions, setQuickReplyOptions] = useState<QuickReplyOption[]>([]);
  const [ttsAudioMap, setTtsAudioMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceDraftUrlRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const translationSyncTimerRef = useRef<number | null>(null);
  const ttsRequestsRef = useRef<Set<string>>(new Set());
  const ttsAudioMapRef = useRef<Record<string, string>>({});
  const scenario = getScenarioDefinition(scenarioKey);
  const language = (searchParams.get('lang') as LanguageCode | null) ?? 'mandarin';
  const normalizedLanguage: LanguageCode =
    language === 'cantonese' || language === 'english' ? language : 'mandarin';
  const nativeLanguage: LanguageCode = locale === 'zh' ? 'mandarin' : 'english';
  const languageLabel = t(
    normalizedLanguage === 'mandarin'
      ? 'languageMandarin'
      : normalizedLanguage === 'cantonese'
        ? 'languageCantonese'
        : 'languageEnglish',
  );
  const userTurnCount = session?.messages.filter((message) => message.sender === 'user').length ?? 0;
  const lastAiText = session?.messages
    .slice()
    .reverse()
    .find((message) => message.sender === 'ai')
    ?.text;
  const stageLabel = buildStageLabel(t, userTurnCount, lastAiText);
  const turnLabel = t('scenarioHeaderTurnsValue').replace('{value}', String(userTurnCount));

  const syncSession = useCallback((nextSession: ConversationSession) => {
    setSession(nextSession);
    if (nextSession.accessKey) {
      storeConversationAccessKey(nextSession.id, nextSession.accessKey);
    }
  }, []);

  const mapApiFeedback = useCallback(
    (payload: ScenarioFeedbackPayload): ScenarioFeedback => ({
      overallScore: payload.overallScore,
      summary: payload.summary,
      headline: payload.headline,
      dimensions: payload.dimensions,
      suggestions: payload.suggestions,
    }),
    [],
  );

  useEffect(() => () => {
    if (voiceDraftUrlRef.current) {
      URL.revokeObjectURL(voiceDraftUrlRef.current);
    }
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
    }
    if (translationSyncTimerRef.current) {
      window.clearTimeout(translationSyncTimerRef.current);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    ttsAudioMapRef.current = ttsAudioMap;
  }, [ttsAudioMap]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [optimisticMessages, session?.messages]);

  useEffect(() => {
    const activeScenario = scenario;
    if (!activeScenario) {
      return;
    }

    let disposed = false;
    const boot = async () => {
      setIsInitializing(true);
      try {
        if (sessionId && sessionId !== 'new') {
          const existing = await fetchConversationById(sessionId);
          if (!disposed) {
            syncSession(existing);
          }
        } else {
          const created = await startConversation({
            scenarioId: activeScenario.key,
            targetLanguage: normalizedLanguage,
            nativeLanguage,
          });
          if (!disposed) {
            syncSession(created);
            navigate(`/scenarios/${activeScenario.key}/session/${created.id}?lang=${normalizedLanguage}`, {
              replace: true,
            });
          }
        }
      } catch {
        if (!disposed) {
          toast.error(t('sessionInitError'), { id: 'scenario-session-init' });
        }
      } finally {
        if (!disposed) {
          setIsInitializing(false);
        }
      }
    };

    void boot();

    return () => {
      disposed = true;
    };
  }, [navigate, nativeLanguage, normalizedLanguage, scenario, sessionId, syncSession, t]);

  const queueTtsForLatestAiMessage = useCallback((activeSession: ConversationSession) => {
    const latestAiMessage = [...activeSession.messages]
      .reverse()
      .find((message) =>
        message.sender === 'ai' &&
        message.meta?.source !== 'realtime' &&
        !message.meta?.audioUrl &&
        !ttsAudioMapRef.current[message.id],
      );
    if (!latestAiMessage) {
      return;
    }
    if (ttsRequestsRef.current.has(latestAiMessage.id)) {
      return;
    }
    ttsRequestsRef.current.add(latestAiMessage.id);
    synthesizeConversationSpeech(activeSession.id, latestAiMessage.text, DEFAULT_TTS_VOICE)
      .then((payload) => {
        setTtsAudioMap((prev) => ({
          ...prev,
          [latestAiMessage.id]: payload.audioUrl,
        }));
      })
      .catch(() => {
        toast.error(t('tutorTtsError'), { id: 'scenario-tts' });
      })
      .finally(() => {
        ttsRequestsRef.current.delete(latestAiMessage.id);
      });
  }, [t]);

  const syncTranslationIfNeeded = useCallback((conversationId: string, attempt = 0) => {
    if (translationSyncTimerRef.current) {
      window.clearTimeout(translationSyncTimerRef.current);
    }
    translationSyncTimerRef.current = window.setTimeout(() => {
      void fetchConversationById(conversationId)
        .then((latestSession) => {
          syncSession(latestSession);
          const latestAiMessage = [...latestSession.messages]
            .reverse()
            .find((message) => message.sender === 'ai');
          if (latestAiMessage && !latestAiMessage.meta?.translation && attempt < 3) {
            syncTranslationIfNeeded(conversationId, attempt + 1);
          }
        })
        .catch(() => {
          if (attempt < 3) {
            syncTranslationIfNeeded(conversationId, attempt + 1);
          }
        });
    }, 700 + attempt * 350);
  }, [syncSession]);

  const mergedMessages = useMemo(
    () => [...(session ? mapSessionToMessages(session, ttsAudioMap) : []), ...optimisticMessages],
    [optimisticMessages, session, ttsAudioMap],
  );

  useEffect(() => {
    if (!session || !scenario) {
      return;
    }
    const nextOptions = buildScenarioQuickReplies(scenario, session, t);
    startTransition(() => {
      setQuickReplyOptions(nextOptions);
      setQuickRepliesVisible(nextOptions.length > 0);
    });
  }, [scenario, session, t]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const messageText = (overrideText ?? inputValue).trim();
    if (!messageText || !session || isSending) {
      return;
    }
    setInputValue('');
    setIsSending(true);
    setQuickRepliesVisible(false);
    const optimisticUser = buildOptimisticUserMessage(messageText);
    const loadingMessage = buildTutorLoadingMessage();
    setOptimisticMessages([optimisticUser, loadingMessage]);

    try {
      const nextSession = await sendConversationMessage(session.id, messageText, 'text');
      syncSession(nextSession);
      queueTtsForLatestAiMessage(nextSession);
      syncTranslationIfNeeded(nextSession.id);
      setOptimisticMessages([]);
    } catch {
      toast.error(t('sendError'), { id: 'scenario-send' });
      setInputValue(messageText);
      setOptimisticMessages([]);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, queueTtsForLatestAiMessage, session, syncSession, syncTranslationIfNeeded, t]);

  const pollVoiceResult = useCallback((conversationId: string, operationId: string) => {
    const run = async () => {
      try {
        const status = await fetchVoiceOperationStatus(conversationId, operationId);
        if (status.status === 'completed' || status.status === 'failed') {
          const nextSession = await fetchConversationById(conversationId);
          syncSession(nextSession);
          queueTtsForLatestAiMessage(nextSession);
          syncTranslationIfNeeded(nextSession.id);
          setOptimisticMessages([]);
          setIsSending(false);
          if (status.status === 'failed') {
            toast.error(t('voiceSendError'), { id: 'scenario-voice' });
          }
          return;
        }
      } catch {
        setOptimisticMessages([]);
        setIsSending(false);
        toast.error(t('voiceSendError'), { id: 'scenario-voice' });
        return;
      }
      pollTimerRef.current = window.setTimeout(run, 1200);
    };

    void run();
  }, [queueTtsForLatestAiMessage, syncSession, syncTranslationIfNeeded, t]);

  const handleVoiceUpload = useCallback(async (audio: Blob, previewUrl: string) => {
    if (!session) {
      return;
    }
    setIsSending(true);
    setQuickRepliesVisible(false);
    const optimisticVoice = buildOptimisticUserMessage(
      t('voiceMessageLabel'),
      previewUrl,
      {
        statusText: t('voiceWaiting'),
        statusTone: 'waiting',
      },
    );
    const loadingMessage = buildTutorLoadingMessage();
    setOptimisticMessages([optimisticVoice, loadingMessage]);
    try {
      const result = await uploadConversationVoice(session.id, audio);
      pollVoiceResult(session.id, result.operationId);
    } catch {
      setOptimisticMessages([]);
      setIsSending(false);
      toast.error(t('voiceSendError'), { id: 'scenario-voice' });
    }
  }, [pollVoiceResult, session, t]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.warning(t('voiceUnsupported'), { id: 'scenario-voice' });
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
      const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined);
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
          toast.warning(t('voiceNoCapture'), { id: 'scenario-voice' });
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const previewUrl = URL.createObjectURL(blob);
        if (voiceDraftUrlRef.current) {
          URL.revokeObjectURL(voiceDraftUrlRef.current);
        }
        voiceDraftUrlRef.current = previewUrl;
        void handleVoiceUpload(blob, previewUrl);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      toast.warning(t('voicePermissionDenied'), { id: 'scenario-voice' });
    }
  };

  const stopRecording = () => {
    if (!isRecording) {
      return;
    }
    mediaRecorderRef.current?.stop();
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const handleOpenScore = useCallback(async (force = false) => {
    if (!session || isScoreLoading) {
      return;
    }
    setScoreModalOpen(true);
    setIsScoreLoading(true);
    setScoreErrorMessage(null);
    setScenarioFeedback(null);
    try {
      const payload = await generateScenarioFeedback(session.id, { force });
      setScenarioFeedback(mapApiFeedback(payload));
    } catch {
      setScoreErrorMessage(t('scenarioScoreModalError'));
    } finally {
      setIsScoreLoading(false);
    }
  }, [isScoreLoading, mapApiFeedback, session, t]);

  if (!scenario) {
    return <Navigate to="/scenarios" replace />;
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      <ScenarioSessionHeader
        backTo={`/scenarios/${scenario.key}`}
        title={session?.title || t(scenario.titleKey)}
        emoji={scenarioEmojiMap[scenario.icon]}
        languageLabel={languageLabel}
        turnLabel={turnLabel}
        stageLabel={stageLabel}
        onEnd={() => {
          void handleOpenScore();
        }}
        endLabel={t('scenarioSessionEnd')}
      />

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-4 md:pb-10">
        <AnimatePresence>
          {mergedMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <MessageBubble message={message} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="h-4" ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-[var(--bottom-bar-h)] z-30 md:static">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 bottom-full px-3 pb-2 sm:px-4">
            <div className="mx-auto flex max-w-4xl justify-start">
              <ChatQuickReplies
                visible={quickRepliesVisible && quickReplyOptions.length > 0}
                options={quickReplyOptions}
                disabled={isSending || isRecording}
                onSelect={handleSend}
                onClose={() => setQuickRepliesVisible(false)}
              />
            </div>
          </div>
          <VoiceInput
            value={inputValue}
            isRecording={isRecording}
            isSending={isSending}
            isDisabled={isInitializing || !session}
            placeholder={t('placeholder')}
            recordingLabel={t('recording')}
            onChange={setInputValue}
            onSend={() => {
              void handleSend();
            }}
            onToggleRecording={toggleRecording}
          />
        </div>
      </div>

      <ScenarioScoreModal
        open={scoreModalOpen}
        title={t(scenario.titleKey)}
        feedback={scenarioFeedback}
        isLoading={isScoreLoading}
        errorMessage={scoreErrorMessage}
        onRefresh={() => {
          void handleOpenScore(true);
        }}
        onClose={() => setScoreModalOpen(false)}
        onRetry={() => {
          setScoreModalOpen(false);
          navigate(`/scenarios/${scenario.key}`);
        }}
        onNext={() => {
          setScoreModalOpen(false);
          navigate('/scenarios');
        }}
      />
    </div>
  );
}
