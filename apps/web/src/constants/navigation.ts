import { Compass, MessageCircle, Star, BookOpen, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LocaleKey } from '../providers/LocaleContext';

export type NavItemId = 'chat' | 'scenarios' | 'favorites' | 'review' | 'profile';

export interface NavItem {
  id: NavItemId;
  labelKey: LocaleKey;
  path: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { id: 'chat', labelKey: 'navChat', path: '/chat', icon: MessageCircle },
  { id: 'scenarios', labelKey: 'navScenarios', path: '/scenarios', icon: Compass },
  {
    id: 'favorites',
    labelKey: 'navFavorites',
    path: '/favorites',
    icon: Star,
  },
  { id: 'review', labelKey: 'navReview', path: '/review', icon: BookOpen },
  { id: 'profile', labelKey: 'navProfile', path: '/profile', icon: User },
];
