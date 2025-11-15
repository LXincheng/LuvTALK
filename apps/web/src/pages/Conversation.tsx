import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonFab,
  IonFabButton,
  IonIcon,
  IonFooter,
  IonList,
  IonItem,
  IonLabel,
  IonButtons,
  IonBackButton,
} from '@ionic/react';
import { mic } from 'ionicons/icons';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import './Conversation.css';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

interface Scenario {
  title: string;
  initialMessages: Message[];
}

const scenarios: Record<string, Scenario> = {
  restaurant: {
    title: 'Restaurant',
    initialMessages: [
      { id: 1, text: '你好！我想练习一下在餐厅点餐。', sender: 'user' },
      { id: 2, text: '好的，没问题！我们开始吧。请问你想点些什么？', sender: 'ai' },
    ],
  },
  directions: {
    title: 'Directions',
    initialMessages: [
      { id: 1, text: '你好，请问去最近的地铁站怎么走？', sender: 'user' },
      { id: 2, text: '当然，你往前走，在第二个路口左转就到了。', sender: 'ai' },
    ],
  },
  shopping: {
    title: 'Shopping',
    initialMessages: [
      { id: 1, text: '这件衣服多少钱？', sender: 'user' },
      { id: 2, text: '这件是 199 元。您想试一下吗？', sender: 'ai' },
    ],
  },
};

const ConversationPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const scenario = scenarios[scenarioId] || scenarios.restaurant; // Default to restaurant
    setCurrentScenario(scenario);
    setMessages(scenario.initialMessages);
  }, [scenarioId]);

  const handleVoiceInput = () => {
    // TODO: Implement voice input logic (ASR)
    console.log('Voice input button clicked. Ready for ASR integration.');
    // Mock user response for UI testing
    const newUserMessage: Message = {
      id: Date.now(),
      text: '我想要一份叉烧饭，唔该。',
      sender: 'user',
    };
    setMessages(prev => [...prev, newUserMessage]);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/scenarios" />
          </IonButtons>
          <IonTitle>
            {currentScenario ? currentScenario.title : 'Conversation'}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonList>
          {messages.map(message => (
            <IonItem key={message.id} lines="none" className={`message-item message-item-${message.sender}`}>
              <div className={`message-bubble message-bubble-${message.sender}`}>
                <IonLabel className="ion-text-wrap">{message.text}</IonLabel>
              </div>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
      <IonFooter>
        <IonToolbar>
          {/* Voice input button as per PRD */}
          <IonFab vertical="bottom" horizontal="center" slot="fixed">
            <IonFabButton onClick={handleVoiceInput}>
              <IonIcon icon={mic}></IonIcon>
            </IonFabButton>
          </IonFab>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default ConversationPage;
