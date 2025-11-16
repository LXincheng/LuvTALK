import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonPopover,
  IonSpinner,
  IonText,
  IonTextarea,
  IonToolbar,
} from '@ionic/react';
import {
  bookmarkOutline,
  bookOutline,
  chevronDownOutline,
  micOutline,
  sendOutline,
  sparklesOutline,
} from 'ionicons/icons';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import AppDock, { DockItem } from '../../components/navigation/AppDock';
import ThemeToggle from '../../components/ThemeToggle';
import { useAppStore } from '../../store/useAppStore';
import { ConversationMessage } from '../../types/api';
import { LANGUAGE_LABELS, LanguageCode, UI_LANGUAGE_LABELS, UiLanguage, UI_LANGUAGE_TO_NATIVE } from '../../types/language';
import { useLocale } from '../../shared/i18n/LocaleProvider';
import { SCENARIO_IDS, SCENARIO_LABELS, ScenarioId } from '../../shared/constants/scenarios';
import './Conversation.css';

const dockItems: DockItem[] = [
  { labelKey: 'navConversation', icon: sparklesOutline, href: '/' },
  { labelKey: 'navFavorites', icon: bookOutline, href: '/favorites' },
];

const learningLanguageOrder: LanguageCode[] = ['cantonese', 'english', 'mandarin'];

const ensureScenario = (value?: string): ScenarioId =>
  SCENARIO_IDS.includes(value as ScenarioId) ? (value as ScenarioId) : 'daily';

const ConversationPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId?: ScenarioId }>();
  const location = useLocation();
  const { uiLanguage, setUiLanguage, t } = useLocale();
  const conversation = useAppStore(state => state.conversation);
  const favorites = useAppStore(state => state.favorites);

  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>(learningLanguageOrder[0]);
  const [activeScenario, setActiveScenario] = useState<ScenarioId>(ensureScenario(scenarioId));
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [languagePopoverEvent, setLanguagePopoverEvent] = useState<MouseEvent | undefined>(undefined);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setActiveScenario(ensureScenario(scenarioId));
  }, [scenarioId]);

  useEffect(() => {
    const nativeLanguage = UI_LANGUAGE_TO_NATIVE[uiLanguage];
    conversation.start({ scenarioId: activeScenario, targetLanguage: learningLanguage, nativeLanguage });
  }, [activeScenario, learningLanguage, uiLanguage]);

  useEffect(() => {
    if (!favorites.items.length) {
      favorites.load();
    }
  }, []);

  const session = conversation.session;
  const messagesCount = session?.messages.length ?? 0;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversation.session || isSending) {
      return;
    }
    setIsSending(true);
    try {
      await conversation.send(text);
      setInput('');
    } finally {
      setIsSending(false);
    }
  };

  const handleFavorite = async (message: ConversationMessage) => {
    await favorites.add({
      title: message.sender === 'ai' ? 'AI Reply' : 'Learner Note',
      content: message.text,
      type: message.sender === 'ai' ? 'cultural' : 'phrase',
      metadata: { language: message.language, scenario: activeScenario },
    });
  };

  const handleMicrophone = () => {
    setIsRecording(prev => !prev);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setInput(t('conversationMicSeedText'));
      }, 1800);
    }
  };

  useEffect(() => {
    if (!messagesContainerRef.current) {
      return;
    }
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messagesCount]);

  const activeDock = location.pathname.startsWith('/favorites') ? '/favorites' : '/';
  const scenarioName = SCENARIO_LABELS[uiLanguage][activeScenario];
  const uiLanguageLabel = UI_LANGUAGE_LABELS[uiLanguage];
  const learningLanguageLabel = LANGUAGE_LABELS[uiLanguage][learningLanguage];

  const openLanguageMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setLanguagePopoverEvent(event.nativeEvent);
  };

  const handleLanguageSelect = (language: LanguageCode) => {
    setLearningLanguage(language);
    setLanguagePopoverEvent(undefined);
  };

  const handleUiLanguageSelect = (language: UiLanguage) => {
    setUiLanguage(language);
    setLanguagePopoverEvent(undefined);
  };

  return (
    <IonPage className="conversation-page">
      <IonHeader translucent>
        <IonToolbar className="conversation-toolbar">
          <div className="conversation-brand">
            <span className="brand-pill">LuvTALK</span>
            <button className="language-menu-trigger" type="button" onClick={openLanguageMenu}>
              <span>{t('conversationLanguageHeading')}</span>
              <strong>
                {learningLanguageLabel} · {uiLanguageLabel}
              </strong>
              <IonIcon icon={chevronDownOutline} />
            </button>
          </div>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonPopover
        isOpen={Boolean(languagePopoverEvent)}
        event={languagePopoverEvent}
        onDidDismiss={() => setLanguagePopoverEvent(undefined)}
        arrow={false}
        className="language-menu-popover"
      >
        <div className="language-menu">
          <section>
            <p>{t('conversationUiLanguageLabel')}</p>
            <div className="language-menu-options">
              {(['zh', 'en'] as UiLanguage[]).map(option => (
                <button
                  key={option}
                  type="button"
                  className={uiLanguage === option ? 'active' : ''}
                  onClick={() => handleUiLanguageSelect(option)}
                >
                  <span>{UI_LANGUAGE_LABELS[option]}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <p>{t('conversationLanguageHeading')}</p>
            <div className="language-menu-options">
              {learningLanguageOrder.map(option => (
                <button
                  key={option}
                  type="button"
                  className={learningLanguage === option ? 'active' : ''}
                  onClick={() => handleLanguageSelect(option)}
                >
                  <span>{LANGUAGE_LABELS[uiLanguage][option]}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </IonPopover>
      <IonContent fullscreen className="conversation-content">
        <div className="conversation-layout">
          <section className="conversation-stream-card">
            <div className="conversation-controls">
              <div>
                <p>{t('conversationScenarioHeading')}</p>
                <strong>{scenarioName}</strong>
              </div>
              <div className="conversation-presets" role="tablist" aria-label={t('conversationScenarioAria')}>
                {SCENARIO_IDS.map(option => (
                  <IonChip
                    key={option}
                    color={activeScenario === option ? 'primary' : 'medium'}
                    onClick={() => setActiveScenario(option)}
                  >
                    {SCENARIO_LABELS[uiLanguage][option]}
                  </IonChip>
                ))}
              </div>
            </div>

            {conversation.loading && !session && (
              <div className="conversation-loading">
                <IonSpinner name="crescent" />
                <p>{t('conversationLoading')}</p>
              </div>
            )}

            <div className="conversation-messages" ref={messagesContainerRef}>
              {session?.messages.map(message => (
                <article key={message.id} className={`message-row message-${message.sender}`}>
                  <img src={message.avatar} alt={`${message.senderName} avatar`} className="message-avatar" />
                  <div className="message-bubble">
                    <div className="message-header">
                      <strong>{message.senderName}</strong>
                      <IonText color="medium">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </IonText>
                    </div>
                    <p>{message.text}</p>
                    <div className="message-meta">
                      {message.meta?.score && (
                        <span className="message-score">
                          <IonIcon icon={sparklesOutline} />
                          {message.meta.score}
                          {message.meta.scoreReason ? ` · ${message.meta.scoreReason}` : ''}
                        </span>
                      )}
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={() => handleFavorite(message)}
                        title={t('conversationFavoriteButton')}
                      >
                        <IonIcon icon={bookmarkOutline} />
                      </IonButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </IonContent>
      <IonFooter>
        <div className="conversation-footer">
          <div className={`conversation-input-row ${isRecording ? 'recording' : ''}`}>
            <IonTextarea
              autoGrow
              rows={1}
              value={input}
              placeholder={t('conversationInputPlaceholder')}
              onIonChange={event => setInput(event.detail.value ?? '')}
            />
            <div className="conversation-input-actions">
              <IonButton fill={isRecording ? 'solid' : 'clear'} color="primary" onClick={handleMicrophone}>
                <IonIcon icon={micOutline} />
              </IonButton>
              <IonButton
                className="conversation-send-button"
                fill="clear"
                onClick={handleSend}
                disabled={!session || !input.trim() || isSending}
              >
                <IonIcon icon={sendOutline} slot="icon-only" />
              </IonButton>
            </div>
          </div>
          <AppDock items={dockItems} active={activeDock} />
        </div>
      </IonFooter>
    </IonPage>
  );
};

export default ConversationPage;
