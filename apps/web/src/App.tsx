import { Suspense, lazy, useEffect } from 'react';
import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import RouteLoadingFallback from './components/layout/RouteLoadingFallback';

const loadConversationPage = () => import('./pages/ConversationPage');
const loadScenarioHubPage = () => import('./components/scenario/pages/ScenarioHubPage');
const loadScenarioDetailPage = () => import('./components/scenario/pages/ScenarioDetailPage');
const loadScenarioSessionPage = () => import('./components/scenario/pages/ScenarioSessionPage');
const loadDailyReviewPage = () => import('./pages/DailyReviewPage');
const loadFavoritesPage = () => import('./pages/FavoritesPage');
const loadProfilePage = () => import('./pages/ProfilePage');
const loadLoginPage = () => import('./pages/LoginPage');
const loadAchievementHallPage = () => import('./pages/AchievementHallPage');

const ConversationPage = lazy(loadConversationPage);
const ScenarioHubPage = lazy(loadScenarioHubPage);
const ScenarioDetailPage = lazy(loadScenarioDetailPage);
const ScenarioSessionPage = lazy(loadScenarioSessionPage);
const DailyReviewPage = lazy(loadDailyReviewPage);
const FavoritesPage = lazy(loadFavoritesPage);
const ProfilePage = lazy(loadProfilePage);
const LoginPage = lazy(loadLoginPage);
const AchievementHallPage = lazy(loadAchievementHallPage);

const runWhenIdle = (callback: () => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 1200 });
    return () => window.cancelIdleCallback(idleId);
  }
  const timeoutId = globalThis.setTimeout(callback, 350);
  return () => globalThis.clearTimeout(timeoutId);
};

function LazyPage({ children }: { children: ReactElement }) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      {children}
    </Suspense>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    return runWhenIdle(() => {
      loadFavoritesPage();
      loadDailyReviewPage();
      loadProfilePage();
      loadScenarioHubPage();
      if (location.pathname !== '/chat') {
        loadConversationPage();
      }
      if (!location.pathname.startsWith('/scenarios/')) {
        loadScenarioDetailPage();
        loadScenarioSessionPage();
      }
      if (location.pathname !== '/achievements') {
        loadAchievementHallPage();
      }
      if (location.pathname !== '/login') {
        loadLoginPage();
      }
    });
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route
          path="chat"
          element={(
            <LazyPage>
              <ConversationPage />
            </LazyPage>
          )}
        />
        <Route
          path="scenarios"
          element={(
            <LazyPage>
              <ScenarioHubPage />
            </LazyPage>
          )}
        />
        <Route
          path="scenarios/:scenarioKey"
          element={(
            <LazyPage>
              <ScenarioDetailPage />
            </LazyPage>
          )}
        />
        <Route
          path="scenarios/:scenarioKey/session/:sessionId"
          element={(
            <LazyPage>
              <ScenarioSessionPage />
            </LazyPage>
          )}
        />
        <Route
          path="favorites"
          element={(
            <LazyPage>
              <FavoritesPage />
            </LazyPage>
          )}
        />
        <Route
          path="review"
          element={(
            <LazyPage>
              <DailyReviewPage />
            </LazyPage>
          )}
        />
        <Route
          path="profile"
          element={(
            <LazyPage>
              <ProfilePage />
            </LazyPage>
          )}
        />
        <Route
          path="login"
          element={(
            <LazyPage>
              <LoginPage />
            </LazyPage>
          )}
        />
        <Route
          path="achievements"
          element={(
            <LazyPage>
              <AchievementHallPage />
            </LazyPage>
          )}
        />
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
