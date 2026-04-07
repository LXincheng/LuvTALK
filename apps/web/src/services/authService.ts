import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export interface AuthSnapshot {
  session: Session | null;
  user: User | null;
}

export type EmailOtpType = 'email' | 'email_change';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export function isAnonymousUser(user: User | null | undefined) {
  return user?.is_anonymous === true || user?.app_metadata?.provider === 'anonymous';
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

export async function requestEmailOtp(email: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function resendEmailOtp(email: string, type: EmailOtpType) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }
  const normalizedEmail = normalizeEmail(email);
  if (type === 'email_change') {
    const { data, error } = await client.auth.resend({
      type: 'email_change',
      email: normalizedEmail,
    });
    if (error) {
      throw error;
    }
    return data;
  }
  return requestEmailOtp(normalizedEmail);
}

export async function linkAnonymousEmail(email: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }
  const { data, error } = await client.auth.updateUser({
    email: normalizeEmail(email),
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function verifyEmailOtp(
  email: string,
  token: string,
  type: EmailOtpType = 'email',
) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase 未配置');
  }
  const { data, error } = await client.auth.verifyOtp({
    email: normalizeEmail(email),
    token,
    type,
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
