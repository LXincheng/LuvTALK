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
  const { locale } = useLocale();
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
      setStatus(locale === 'zh' ? '请填写正确手机号' : 'Enter a valid phone number');
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await requestPhoneOtp(phoneNumber);
      startCountdown();
      setStatus(locale === 'zh' ? '验证码已发送' : 'OTP sent');
    } catch (error) {
      setStatus(
        (error as Error).message ||
          (locale === 'zh' ? '发送验证码失败' : 'Failed to send OTP'),
      );
    } finally {
      setSending(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!phoneNumber || verificationCode.length !== 6) {
      setStatus(locale === 'zh' ? '请输入 6 位验证码' : 'Enter the 6-digit code');
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await verifyPhoneOtp(phoneNumber, verificationCode);
      navigate('/profile');
    } catch (error) {
      setStatus(
        (error as Error).message ||
          (locale === 'zh' ? '验证码校验失败' : 'OTP verification failed'),
      );
    } finally {
      setSending(false);
    }
  };

  const handleGuestLogin = async () => {
    if (!enabled) {
      setStatus(locale === 'zh' ? 'Supabase 未配置' : 'Supabase not configured');
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await signInAnonymously();
      navigate('/chat');
    } catch (error) {
      setStatus(
        (error as Error).message ||
          (locale === 'zh' ? '游客登录失败' : 'Guest login failed'),
      );
    } finally {
      setSending(false);
    }
  };

  const handleGoogleLogin = () => {
    setStatus(locale === 'zh' ? 'Google 登录稍后上线' : 'Google login coming soon');
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="min-h-full flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{locale === 'zh' ? '返回' : 'Back'}</span>
          </button>

          <div className="glass-card rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-10">
            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                {locale === 'zh' ? '欢迎回来' : 'Welcome Back'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {locale === 'zh' ? '登录继续学习' : 'Sign in to continue learning'}
              </p>
              {user && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                  {locale === 'zh' ? '当前已有登录' : 'Already signed in'}
                </p>
              )}
              {status && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{status}</p>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {locale === 'zh' ? '手机号' : 'Phone Number'}
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) =>
                      setPhoneNumber(e.target.value.replace(/[^\d+]/g, '').slice(0, 16))
                    }
                    placeholder={locale === 'zh' ? '输入手机号（含区号）' : 'Enter your phone number'}
                    className="w-full pl-12 pr-4 py-3.5 glass-input border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {locale === 'zh' ? '验证码' : 'Verification Code'}
                  </label>
                  <button
                    onClick={handleSendCode}
                    disabled={phoneNumber.length < 6 || countdown > 0 || sending}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {countdown > 0 ? `${countdown}s` : locale === 'zh' ? '发送验证码' : 'Send Code'}
                  </button>
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder={locale === 'zh' ? '输入 6 位验证码' : 'Enter 6-digit code'}
                    className="w-full pl-12 pr-4 py-3.5 glass-input border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
              </div>

              <button
                onClick={handlePhoneLogin}
                disabled={!phoneNumber || verificationCode.length !== 6 || sending}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
              >
                {locale === 'zh' ? '手机号登录' : 'Sign In'}
              </button>
            </div>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                  {locale === 'zh' ? '或使用以下方式' : 'Or continue with'}
                </span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-all flex items-center justify-center gap-3 mb-4"
            >
              <Chrome className="w-5 h-5" />
              {locale === 'zh' ? '使用 Google 登录' : 'Continue with Google'}
            </button>

            <button
              onClick={handleGuestLogin}
              className="w-full text-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
              disabled={sending}
            >
              {locale === 'zh' ? '游客体验 →' : 'Continue as Guest →'}
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-6">
            {locale === 'zh'
              ? '继续即表示你同意服务条款与隐私政策'
              : 'By continuing, you agree to our Terms and Privacy Policy'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
