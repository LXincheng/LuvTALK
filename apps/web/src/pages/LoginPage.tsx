import { useState } from 'react';
import { ArrowLeft, Phone, Mail, Chrome, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { requestPhoneOtp, signInAnonymously, verifyPhoneOtp } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../providers/LocaleContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, enabled } = useAuth();
  const { t } = useLocale();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (phoneNumber.length < 6 || !enabled) {
      setStatus(t('loginPhoneInvalid'));
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await requestPhoneOtp(phoneNumber);
      startCountdown();
      setStatus(t('loginOtpSent'));
    } catch (error) {
      setStatus((error as Error).message || t('loginOtpFailed'));
    } finally {
      setSending(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!phoneNumber || verificationCode.length !== 6) {
      setStatus(t('loginCodeInvalid'));
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await verifyPhoneOtp(phoneNumber, verificationCode);
      navigate('/profile');
    } catch (error) {
      setStatus((error as Error).message || t('loginCodeFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleGuestLogin = async () => {
    if (!enabled) {
      setStatus(t('loginSupabaseNotConfigured'));
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await signInAnonymously();
      navigate('/chat');
    } catch (error) {
      setStatus((error as Error).message || t('loginGuestFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleGoogleLogin = () => {
    setStatus(t('loginGoogleSoon'));
  };

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="min-h-full flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-label-secondary hover:text-label transition-colors mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('loginBack')}</span>
          </button>

          <div className="glass-card rounded-2xl p-8 md:p-10">
            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[#5856D6] flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-label mb-2">
                {t('loginWelcome')}
              </h1>
              <p className="text-label-secondary">
                {t('loginSubtitle')}
              </p>
              {user && (
                <p className="text-xs text-success mt-2">
                  {t('loginAlreadySignedIn')}
                </p>
              )}
              {status && (
                <p className="text-xs text-label-secondary mt-2">{status}</p>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-label-secondary mb-2">
                  {t('loginPhoneLabel')}
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-label-tertiary" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) =>
                      setPhoneNumber(e.target.value.replace(/[^\d+]/g, '').slice(0, 16))
                    }
                    placeholder={t('loginPhonePlaceholder')}
                    className="w-full pl-12 pr-4 py-3.5 glass-input border border-separator rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-label placeholder:text-label-tertiary"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-label-secondary">
                    {t('loginCodeLabel')}
                  </label>
                  <button
                    onClick={handleSendCode}
                    disabled={phoneNumber.length < 6 || countdown > 0 || sending}
                    className="text-sm font-medium text-primary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {countdown > 0 ? `${countdown}s` : t('loginSendCode')}
                  </button>
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-label-tertiary" />
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder={t('loginCodePlaceholder')}
                    className="w-full pl-12 pr-4 py-3.5 glass-input border border-separator rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-label placeholder:text-label-tertiary"
                  />
                </div>
              </div>

              <button
                onClick={handlePhoneLogin}
                disabled={!phoneNumber || verificationCode.length !== 6 || sending}
                className="w-full py-3.5 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
              >
                {t('loginSignIn')}
              </button>
            </div>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-separator" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface-elevated text-label-secondary">
                  {t('loginOrContinue')}
                </span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-3.5 px-4 glass-card hover:opacity-90 text-label rounded-xl font-medium transition-all flex items-center justify-center gap-3 mb-4"
            >
              <Chrome className="w-5 h-5" />
              {t('loginGoogle')}
            </button>

            <button
              onClick={handleGuestLogin}
              className="w-full text-center text-sm text-label-secondary hover:text-primary font-medium transition-colors"
              disabled={sending}
            >
              {t('loginGuest')}
            </button>
          </div>

          <p className="text-xs text-label-tertiary text-center mt-6">
            {t('loginTerms')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}