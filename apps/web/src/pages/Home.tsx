import {
  IonContent,
  IonPage,
  IonTitle,
  IonToolbar,
  IonHeader,
  IonButton,
  IonButtons,
} from '@ionic/react';
import React from 'react';
import './Home.css';
import ThemeToggle from '../components/ThemeToggle';

const HomePage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>LuvTALK</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="home-container">
          <h1>Welcome to LuvTALK</h1>
          <p>Your personal AI language partner.</p>
          <IonButton routerLink="/scenarios" expand="block" size="large">Start Practicing</IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;