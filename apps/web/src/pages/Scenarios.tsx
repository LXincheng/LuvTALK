import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonBackButton,
  IonButtons,
} from '@ionic/react';
import React from 'react';
import './Scenarios.css';

const scenarios = [
  { id: 'restaurant', title: 'Restaurant Ordering', description: 'Practice ordering food and drinks in a restaurant.' },
  { id: 'directions', title: 'Asking for Directions', description: 'Learn how to ask for and understand directions.' },
  { id: 'shopping', title: 'Shopping', description: 'Practice conversations while shopping for clothes or groceries.' },
];

const ScenariosPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Choose a Scenario</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonGrid>
          <IonRow>
            {scenarios.map(scenario => (
              <IonCol size="12" size-md="6" size-lg="4" key={scenario.id}>
                <IonCard button routerLink={`/conversation/${scenario.id}`}>
                  <IonCardHeader><IonCardTitle>{scenario.title}</IonCardTitle></IonCardHeader>
                  <IonCardContent>{scenario.description}</IonCardContent>
                </IonCard>
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default ScenariosPage;