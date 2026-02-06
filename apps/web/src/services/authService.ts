import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export interface AuthSnapshot {
  session: Session | null;
  user: User | null;
}

export async function signInAnonymously() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    throw error;
  }
  return data;
}

export async function requestPhoneOtp(phone: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }
  const { data, error } = await client.auth.signInWithOtp({ phone });
  if (error) {
    throw error;
  }
  return data;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function signOut() {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }
  await client.auth.signOut();
}

export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  const client = getSupabaseClient();
  if (!client) {
    return { session: null, user: null };
  }
  const { data } = await client.auth.getSession();
  return {
    session: data.session ?? null,
    user: data.session?.user ?? null,
  };
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: {
        subscription: {
          unsubscribe: () => undefined,
        },
      },
    };
  }
  return client.auth.onAuthStateChange(callback);
}

export async function getAccessToken(): Promise<string | undefined> {
  const client = getSupabaseClient();
  if (!client) {
    return undefined;
  }
  const { data } = await client.auth.getSession();
  return data.session?.access_token;
}
