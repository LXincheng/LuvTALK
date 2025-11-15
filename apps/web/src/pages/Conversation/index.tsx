import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { bookmarkOutline, chatbubbleEllipsesOutline, micOutline, sendOutline } from 'ionicons/icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import AppDock from '../../components/navigation/AppDock';
import ThemeToggle from '../../components/ThemeToggle';
import { useAppStore } from '../../store/useAppStore';
import { ConversationMessage } from '../../types/api';
import { LANGUAGE_LABELS, LanguageCode } from '../../types/language';
import './Conversation.css';

const scenarioOptions = [
  { id: 'daily', label: '日常' },
  { id: 'restaurant', label: '餐厅' },
  { id: 'shopping', label: '购物' },
  { id: 'directions', label: '问路' },
];

const languageOptions: { id: LanguageCode; label: string }[] = [
  { id: 'cantonese', label: '粤语' },
  { id: 'mandarin', label: '普通话' },
  { id: 'english', label: 'English' },
];

const dockItems = [
  { label: 'AI 问答', icon: chatbubbleEllipsesOutline, href: '/' },
  { label: '收藏夹', icon: bookmarkOutline, href: '/favorites' },
];

const ConversationPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId?: string }>();
  const location = useLocation();
  const conversation = useAppStore(state => state.conversation);
  const favorites = useAppStore(state => state.favorites);

  const languageOrder: LanguageCode[] = ['cantonese', 'english', 'mandarin'];
  const [language, setLanguage] = useState<LanguageCode>(languageOrder[0]);
  const [activeScenario, setActiveScenario] = useState(scenarioId ?? 'daily');
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    setActiveScenario(scenarioId ?? 'daily');
  }, [scenarioId]);

  useEffect(() => {
    conversation.start({ scenarioId: activeScenario, targetLanguage: language });
  }, [activeScenario, language]);

  useEffect(() => {
    if (!favorites.items.length) {
      favorites.load();
    }
  }, []);

  const session = conversation.session;

  const handleSend = async () => {
    if (!input.trim()) return;
    await conversation.send(input);
    setInput('');
  };

  const handleFavorite = async (message: ConversationMessage) => {
    await favorites.add({
      title: message.sender === 'ai' ? 'AI 回复' : '我的表达',
      content: message.text,
      type: message.sender === 'ai' ? 'cultural' : 'phrase',
      metadata: { language: message.language, scenario: activeScenario },
    });
  };

  const coachNotes = useMemo(() => session?.coach, [session]);

  const cycleLanguage = () => {
    const index = languageOrder.indexOf(language);
    setLanguage(languageOrder[(index + 1) % languageOrder.length]);
  };

  const handleMicrophone = () => {
    setIsRecording(prev => !prev);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setInput('我想练习点餐对话');
      }, 1800);
    }
  };

  const activeDock = location.pathname.startsWith('/favorites') ? '/favorites' : '/';

  return (
    <IonPage className="conversation-page">
      <IonHeader translucent>
        <IonToolbar className="conversation-toolbar">
          <div className="conversation-brand">
            <span className="brand-pill">LuvTALK</span>
            <IonButton size="small" fill="clear" onClick={cycleLanguage}>
              {LANGUAGE_LABELS[language]}
            </IonButton>
          </div>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="conversation-content">
        <section className="conversation-panel">
          <header>
            <div>
              <p>目标场景</p>
              <strong>{scenarioOptions.find(option => option.id === activeScenario)?.label}</strong>
            </div>
          </header>
          <div className="conversation-presets" role="tablist">
            {scenarioOptions.map(option => (
              <IonChip
                key={option.id}
                color={activeScenario === option.id ? 'primary' : 'medium'}
                onClick={() => setActiveScenario(option.id)}
              >
                {option.label}
              </IonChip>
            ))}
          </div>
          <div className="language-chip-row" aria-label="选择目标语言">
            {languageOptions.map(option => (
              <IonChip
                key={option.id}
                color={language === option.id ? 'primary' : 'medium'}
                onClick={() => setLanguage(option.id)}
              >
                {option.label}
              </IonChip>
            ))}
          </div>
          {coachNotes && (
            <div className="conversation-coach-card">
              <div className="coach-score">
                <span>评分</span>
                <strong>{coachNotes.overallScore}</strong>
              </div>
              <div className="coach-details">
                {coachNotes.correction && <p>{coachNotes.correction}</p>}
                {coachNotes.cultureNote && <p>{coachNotes.cultureNote}</p>}
              </div>
            </div>
          )}
        </section>

        {conversation.loading && !session && (
          <div className="conversation-loading">
            <IonSpinner name="crescent" />
            <p>AI 正在准备场景…</p>
          </div>
        )}

        <div className="conversation-messages">
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
                  {message.meta?.score && <span>得分 {message.meta.score}</span>}
                  <IonButton fill="clear" size="small" onClick={() => handleFavorite(message)} title="收藏此内容">
                    <IonIcon icon={bookmarkOutline} />
                  </IonButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      </IonContent>
      <IonFooter>
        <div className="conversation-footer">
          <div className={`conversation-input-row ${isRecording ? 'recording' : ''}`}>
            <IonTextarea
              autoGrow
              rows={1}
              value={input}
              placeholder="输入或长按语音按钮开始说话…"
              onIonChange={event => setInput(event.detail.value ?? '')}
            />
            <div className="conversation-input-actions">
              <IonButton fill={isRecording ? 'solid' : 'clear'} color="primary" onClick={handleMicrophone}>
                <IonIcon icon={micOutline} />
              </IonButton>
              <IonButton shape="round" onClick={handleSend} disabled={conversation.loading}>
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
