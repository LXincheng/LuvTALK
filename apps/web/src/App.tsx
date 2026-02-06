import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ConversationPage from './pages/ConversationPage';
import DailyReviewPage from './pages/DailyReviewPage';
import FavoritesPage from './pages/FavoritesPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import AchievementHallPage from './pages/AchievementHallPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ConversationPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="review" element={<DailyReviewPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="achievements" element={<AchievementHallPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
