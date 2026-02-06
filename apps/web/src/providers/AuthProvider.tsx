import { useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AuthContext } from './auth-context';
import { getSupabaseClient } from '../services/supabaseClient';
import { getAuthSnapshot, onAuthStateChange } from '../services/authService';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(() => Boolean(getSupabaseClient()));

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      return undefined;
    }
    void getAuthSnapshot().then((snapshot) => {
      setUser(snapshot.user);
      setSession(snapshot.session);
      setReady(true);
    });
    const { data } = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      ready,
      enabled: Boolean(getSupabaseClient()),
    }),
    [ready, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
