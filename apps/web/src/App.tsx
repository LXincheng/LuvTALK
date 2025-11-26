import { Redirect, Route } from "react-router-dom";
import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import ConversationPage from "./pages/Conversation";
import FavoritesPage from "./pages/Favorites";
import { ThemeProvider } from "./hooks/useTheme";
import { LocaleProvider } from "./shared/i18n/LocaleProvider";
import { fadePageTransition } from "./shared/transitions/fade";
import { useEffect } from "react";
import { useAuthStore } from "./store/useAuthStore";
/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* We will use the class-based dark mode to allow for a manual toggle */
import "@ionic/react/css/palettes/dark.class.css";

/* Theme variables */
import "./theme/variables.css";

setupIonicReact();

const App: React.FC = () => {
  const initializeAuth = useAuthStore((state) => state.initialize);
  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);
  return (
    <LocaleProvider>
      <ThemeProvider>
        <IonApp>
          <IonReactRouter>
            <IonRouterOutlet animation={fadePageTransition}>
              <Route exact path="/" component={ConversationPage} />
              <Route exact path="/conversation/:scenarioId?" component={ConversationPage} />
              <Route exact path="/favorites" component={FavoritesPage} />
              <Redirect to="/" />
            </IonRouterOutlet>
          </IonReactRouter>
        </IonApp>
      </ThemeProvider>
    </LocaleProvider>
  );
};

export default App;
