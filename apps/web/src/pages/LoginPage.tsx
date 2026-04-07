import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  isAnonymousUser,
  isValidEmail,
  linkAnonymousEmail,
  normalizeEmail,
  requestEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
  type EmailOtpType,
} from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../providers/LocaleContext';
import { toast } from '../utils/toast';

type AuthMode = 'signin' | 'signup';

const RESEND_SECONDS = 60;
const OTP_COOLDOWN_STORAGE_KEY = 'luvtalk.auth.otpCooldown';

function getOtpCooldownKey(email: string) {
  return `${OTP_COOLDOWN_STORAGE_KEY}:${email}`;
}

function readOtpCooldown(email: string) {
  if (!email || typeof window === 'undefined') {
    return 0;
  }
  const rawValue = window.localStorage.getItem(getOtpCooldownKey(email));
  if (!rawValue) {
    return 0;
  }
  const expiresAt = Number(rawValue);
  if (!Number.isFinite(expiresAt)) {
    window.localStorage.removeItem(getOtpCooldownKey(email));
    return 0;
  }
  const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
  if (remaining <= 0) {
    window.localStorage.removeItem(getOtpCooldownKey(email));
    return 0;
  }
  return remaining;
}

function writeOtpCooldown(email: string, seconds: number) {
  if (!email || typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    getOtpCooldownKey(email),
    String(Date.now() + seconds * 1000),
  );
}

function clearOtpCooldown(email: string) {
  if (!email || typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(getOtpCooldownKey(email));
}

function isOtpRateLimitError(message: string) {
  return /rate limit|security purposes|too many requests|after \d+ seconds/i.test(message);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, enabled } = useAuth();
  const { t } = useLocale();
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    location.pathname === '/signup' ? 'signup' : 'signin',
  );
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [otpType, setOtpType] = useState<EmailOtpType>('email');
  const [codeRequested, setCodeRequested] = useState(false);

  const isAnonymous = isAnonymousUser(user);
  const normalizedEmail = normalizeEmail(email);
  const canSendCode = isValidEmail(normalizedEmail) && enabled && !sending;
  const canVerify = canSendCode && verificationCode.length === 6 && countdown < RESEND_SECONDS + 1;

  useEffect(() => {
    setAuthMode(location.pathname === '/signup' ? 'signup' : 'signin');
  }, [location.pathname]);

  useEffect(() => {
    setVerificationCode('');
    setStatus(null);
    setCountdown(0);
    setCodeRequested(false);
    setOtpType(authMode === 'signup' && isAnonymous ? 'email_change' : 'email');
  }, [authMode, isAnonymous]);

  useEffect(() => {
    if (countdown <= 0) {
      clearOtpCooldown(normalizedEmail);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown, normalizedEmail]);

  useEffect(() => {
    setVerificationCode('');
    setStatus(null);
    const remainingCooldown = readOtpCooldown(normalizedEmail);
    setCountdown(remainingCooldown);
    setCodeRequested(remainingCooldown > 0);
    setOtpType(authMode === 'signup' && isAnonymous ? 'email_change' : 'email');
  }, [normalizedEmail]);

  const panelCopy = useMemo(() => {
    if (authMode === 'signup') {
      return {
        title: t('loginSignupTitle'),
        action: t('loginSignupAction'),
        otpSent: isAnonymous ? t('loginUpgradeOtpSent') : t('loginSignupOtpSent'),
      };
    }
    return {
      title: t('loginWelcome'),
      action: t('loginSigninAction'),
      otpSent: t('loginSigninOtpSent'),
    };
  }, [authMode, isAnonymous, t]);

  const persistStatus = (message: string, kind: 'success' | 'info' = 'info') => {
    setStatus(message);
    if (kind === 'success') {
      toast.success(message, { id: 'auth-status' });
      return;
    }
    toast.message(message, { id: 'auth-status' });
  };

  const handleSendCode = async () => {
    if (!enabled) {
      persistStatus(t('loginSupabaseNotConfigured'));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      persistStatus(t('loginEmailInvalid'));
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      let nextOtpType: EmailOtpType = 'email';
      if (authMode === 'signup' && isAnonymous) {
        await linkAnonymousEmail(normalizedEmail);
        nextOtpType = 'email_change';
      } else {
        await requestEmailOtp(normalizedEmail);
      }
      setOtpType(nextOtpType);
      setCodeRequested(true);
      setCountdown(RESEND_SECONDS);
      writeOtpCooldown(normalizedEmail, RESEND_SECONDS);
      persistStatus(panelCopy.otpSent, 'success');
    } catch (error) {
      const rawMessage = (error as Error).message || t('loginOtpFailed');
      const message = isOtpRateLimitError(rawMessage) ? t('loginOtpRateLimited') : rawMessage;
      if (isOtpRateLimitError(rawMessage)) {
        setCodeRequested(true);
        setCountdown(RESEND_SECONDS);
        writeOtpCooldown(normalizedEmail, RESEND_SECONDS);
      }
      setStatus(message);
      toast.error(message, { id: 'auth-status' });
    } finally {
      setSending(false);
    }
  };

  const handleResendCode = async () => {
    if (!enabled) {
      persistStatus(t('loginSupabaseNotConfigured'));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      persistStatus(t('loginEmailInvalid'));
      return;
    }
    setSending(true);
    try {
      await resendEmailOtp(normalizedEmail, otpType);
      setCountdown(RESEND_SECONDS);
      writeOtpCooldown(normalizedEmail, RESEND_SECONDS);
      persistStatus(t('loginOtpResent'), 'success');
    } catch (error) {
      const rawMessage = (error as Error).message || t('loginOtpFailed');
      const message = isOtpRateLimitError(rawMessage) ? t('loginOtpRateLimited') : rawMessage;
      if (isOtpRateLimitError(rawMessage)) {
        setCodeRequested(true);
        setCountdown(RESEND_SECONDS);
        writeOtpCooldown(normalizedEmail, RESEND_SECONDS);
      }
      setStatus(message);
      toast.error(message, { id: 'auth-status' });
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!enabled) {
      persistStatus(t('loginSupabaseNotConfigured'));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      persistStatus(t('loginEmailInvalid'));
      return;
    }
    if (verificationCode.length !== 6) {
      persistStatus(t('loginCodeInvalid'));
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      await verifyEmailOtp(normalizedEmail, verificationCode, otpType);
      const successMessage =
        authMode === 'signup'
          ? isAnonymous
            ? t('loginUpgradeSuccess')
            : t('loginSignupSuccess')
          : t('loginSigninSuccess');
      persistStatus(successMessage, 'success');
      navigate('/profile');
    } catch (error) {
      const fallbackKey = otpType === 'email_change' ? 'loginUpgradeFailed' : 'loginCodeFailed';
      const message = (error as Error).message || t(fallbackKey);
      setStatus(message);
      toast.error(message, { id: 'auth-status' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-shell h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-5xl items-center px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="page-panel auth-shell w-full rounded-[32px] p-5 sm:p-7"
          >
            <div className="auth-shell__glow auth-shell__glow--top" />
            <div className="auth-shell__glow auth-shell__glow--bottom" />
            <div className="mb-5 flex items-center justify-between gap-3">
              <button
                onClick={() => navigate(-1)}
                className="page-chip inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-label-secondary transition hover:bg-fill-secondary hover:text-label"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t('loginBack')}</span>
              </button>
            </div>

            <div className="mb-6">
              <div className="auth-switch mb-6 flex gap-2 rounded-full bg-[var(--surface-panel-soft)] p-1.5">
                <button
                  onClick={() => {
                    setAuthMode('signin');
                    navigate('/login', { replace: true });
                  }}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                    authMode === 'signin'
                      ? 'bg-[var(--color-surface-elevated)] text-label shadow-[0_10px_24px_rgba(20,32,51,0.08)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)]'
                      : 'text-label-secondary hover:text-label'
                  }`}
                >
                  {t('loginTabSignin')}
                </button>
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    navigate('/signup', { replace: true });
                  }}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                    authMode === 'signup'
                      ? 'bg-[var(--color-surface-elevated)] text-label shadow-[0_10px_24px_rgba(20,32,51,0.08)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)]'
                      : 'text-label-secondary hover:text-label'
                  }`}
                >
                  {t('loginTabSignup')}
                </button>
              </div>
            </div>

            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.35 }}
                className="text-[1.75rem] font-semibold tracking-[-0.05em] text-label"
              >
                {panelCopy.title}
              </motion.h1>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.36 }}
              className="space-y-4"
            >
              <label className="auth-field block">
                <span className="mb-2 block text-sm font-medium text-label-secondary">
                  {t('loginEmailLabel')}
                </span>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-label-tertiary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t('loginEmailPlaceholder')}
                    autoComplete="email"
                    className="glass-input w-full rounded-[20px] border border-separator px-12 py-3.5 text-sm text-label outline-none transition placeholder:text-label-tertiary focus:border-primary focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="auth-field block">
                  <span className="mb-2 block text-sm font-medium text-label-secondary">
                    {t('loginCodeLabel')}
                  </span>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    inputMode="numeric"
                    placeholder={t('loginCodePlaceholder')}
                    className="glass-input w-full rounded-[20px] border border-separator px-4 py-3.5 text-sm tracking-[0.32em] text-label outline-none transition placeholder:tracking-normal placeholder:text-label-tertiary focus:border-primary focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <button
                  onClick={codeRequested ? handleResendCode : handleSendCode}
                  disabled={!canSendCode || sending || countdown > 0}
                  className="self-end rounded-[20px] bg-[var(--color-primary-soft)] px-4 py-3.5 text-sm font-medium text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {countdown > 0
                    ? `${countdown}s`
                    : codeRequested
                      ? t('loginResendCode')
                      : t('loginSendCode')}
                </button>
              </div>

              <button
                onClick={handleVerify}
                disabled={!canVerify || sending}
                className="auth-submit w-full rounded-[22px] bg-primary px-4 py-3.5 text-sm font-medium text-white shadow-[0_18px_40px_rgba(22,120,255,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {panelCopy.action}
              </button>

              {status ? (
                <div className="pt-1 text-center text-sm text-label-secondary">
                  {status}
                </div>
              ) : null}
            </motion.div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
