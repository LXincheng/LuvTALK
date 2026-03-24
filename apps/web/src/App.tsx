import { Suspense, lazy, useEffect } from 'react';
import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import RouteLoadingFallback from './components/layout/RouteLoadingFallback';

const loadConversationPage = () => import('./pages/ConversationPage');
const loadDailyReviewPage = () => import('./pages/DailyReviewPage');
const loadFavoritesPage = () => import('./pages/FavoritesPage');
const loadProfilePage = () => import('./pages/ProfilePage');
const loadLoginPage = () => import('./pages/LoginPage');
const loadAchievementHallPage = () => import('./pages/AchievementHallPage');

const ConversationPage = lazy(loadConversationPage);
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
      if (location.pathname !== '/chat') {
        loadConversationPage();
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
