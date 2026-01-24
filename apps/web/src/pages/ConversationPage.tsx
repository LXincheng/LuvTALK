import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize2, X } from 'lucide-react';
import MessageBubble from '../components/chat/MessageBubble';
import VoiceInput from '../components/chat/VoiceInput';
import { API_BASE_URL } from '../services/apiClient';
import {
  sendConversationMessage,
  startConversation,
  uploadConversationVoice,
} from '../services/conversationService';
import { createFavorite } from '../services/favoritesService';
import { useLocale } from '../providers/LocaleContext';
import type { Annotation, Message } from '../types/chat';
import type { ConversationSession, LanguageCode } from '../types/api';
import type { Locale } from '../providers/LocaleContext';

interface AnnotationDefinition {
  word: string;
  explanation: Record<Locale, string>;
  examples?: Record<Locale, string[]>;
}

const annotationLibrary: Record<LanguageCode, AnnotationDefinition[]> = {
  cantonese: [
    {
      word: '你好',
      explanation: {
        zh: '常见粤语问候语，用于打招呼。',
        en: 'A common Cantonese greeting meaning “hello”.',
      },
      examples: {
        zh: ['你好呀！今日过得点？', '你好，欢迎来到 LuvTALK。'],
        en: ['你好呀！(Hello, how are you?)', '你好，欢迎来到 LuvTALK。'],
      },
    },
    {
      word: '唔该',
      explanation: {
        zh: '粤语中表示“请、麻烦你”的礼貌表达。',
        en: 'A polite Cantonese expression meaning “please” or “thanks”.',
      },
      examples: {
        zh: ['唔该帮我解释下。', '唔该晒！'],
        en: ['唔该帮我解释下。', '唔该晒！(Thanks a lot!)'],
      },
    },
    {
      word: '多谢',
      explanation: {
        zh: '粤语中常用的“谢谢”。',
        en: 'A Cantonese way to say “thank you”.',
      },
      examples: {
        zh: ['多谢你嘅帮助。', '多谢晒！'],
        en: ['多谢你嘅帮助。', '多谢晒！(Thanks a lot!)'],
      },
    },
  ],
  mandarin: [
    {
      word: '你好',
      explanation: {
        zh: '普通话里最常见的问候语。',
        en: 'A standard Mandarin greeting meaning “hello”.',
      },
      examples: {
        zh: ['你好，很高兴认识你。', '你好呀，今天怎么样？'],
        en: ['你好，很高兴认识你。', '你好呀，今天怎么样？'],
      },
    },
    {
      word: '谢谢',
      explanation: {
        zh: '普通话中表示感谢的礼貌说法。',
        en: 'A common Mandarin expression for “thank you”.',
      },
      examples: {
        zh: ['谢谢你的帮助。', '谢谢你今天的陪伴。'],
        en: ['谢谢你的帮助。', '谢谢你今天的陪伴。'],
      },
    },
    {
      word: '麻烦',
      explanation: {
        zh: '表示请求或打扰时的礼貌用语。',
        en: 'A polite way to ask for help or make a request.',
      },
      examples: {
        zh: ['麻烦再解释一次。', '麻烦帮我检查一下。'],
        en: ['麻烦再解释一次。', '麻烦帮我检查一下。'],
      },
    },
  ],
  english: [
    {
      word: 'Hello',
      explanation: {
        zh: '常见英文问候语，表示“你好”。',
        en: 'A common English greeting.',
      },
      examples: {
        zh: ['Hello! Nice to meet you.', 'Hello, how are you today?'],
        en: ['Hello! Nice to meet you.', 'Hello, how are you today?'],
      },
    },
    {
      word: 'Great',
      explanation: {
        zh: '用于表达认可或赞赏，意为“太棒了”。',
        en: 'Used to show approval, meaning “excellent”.',
      },
      examples: {
        zh: ['Great job on that sentence!', 'Great, let’s continue.'],
        en: ['Great job on that sentence!', 'Great, let’s continue.'],
      },
    },
    {
      word: 'Could you',
      explanation: {
        zh: '礼貌提问句式，表示“你能否…”。',
        en: 'A polite way to request something.',
      },
      examples: {
        zh: ['Could you say that again?', 'Could you help me with this?'],
        en: ['Could you say that again?', 'Could you help me with this?'],
      },
    },
  ],
};

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

const buildAnnotations = (
  content: string,
  language: LanguageCode,
  locale: Locale,
): Annotation[] => {
  const definitions = annotationLibrary[language] ?? [];
  const lowerContent = content.toLowerCase();

  return definitions
    .filter((definition) => {
      const word = definition.word;
      return language === 'english'
        ? lowerContent.includes(word.toLowerCase())
        : content.includes(word);
    })
    .map((definition) => ({
      word: definition.word,
      explanation: definition.explanation[locale],
      examples: definition.examples?.[locale],
    }));
};

const mapSessionToMessages = (
  session: ConversationSession,
  locale: Locale,
): Message[] => {
  const mapped: Message[] = session.messages.map((message) => ({
    id: message.id,
    type: message.sender,
    content: message.text,
    translation: message.meta?.translation,
    timestamp: new Date(message.createdAt),
    audioUrl: message.meta?.audioUrl,
    annotations:
      message.sender === 'ai'
        ? buildAnnotations(message.text, session.targetLanguage, locale)
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

export default function ConversationPage() {
  const { t, locale } = useLocale();
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;
    setIsInitializing(true);
    setErrorMessage(null);
    setVoiceStatus(null);
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
    setMessages(mapSessionToMessages(session, locale));
  }, [locale, session]);

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
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || !session || isSending) {
      return;
    }
    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setErrorMessage(null);

    try {
      const nextSession = await sendConversationMessage(
        session.id,
        messageText,
      );
      setSession(nextSession);
    } catch {
      setErrorMessage(t('sendError'));
      setInputValue(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveVocabulary = async (payload: Annotation) => {
    try {
      await createFavorite({
        title: payload.word,
        content: payload.explanation,
        type: 'vocabulary',
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
    setVoiceStatus(t('voiceSending'));
    setErrorMessage(null);
    try {
      await uploadConversationVoice(session.id, audio);
    } catch {
      setVoiceStatus(t('voiceSendError'));
      return;
    }
    setVoiceStatus(t('voiceWaiting'));
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
    setVoiceStatus(t('recording'));

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
          setVoiceStatus(t('voiceNoCapture'));
          return;
        }
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        void handleVoiceUpload(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMessage(t('voicePermissionDenied'));
      setVoiceStatus(null);
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
      {voiceStatus && (
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
          {voiceStatus}
        </div>
      )}
      <AnimatePresence>
        {messages.map((message) => (
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
