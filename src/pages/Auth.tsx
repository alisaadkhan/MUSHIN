'use client';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { MushInLogo } from '@/components/ui/MushInLogo';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { authRememberMe } from '@/integrations/supabase/client';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_DISABLE_CAPTCHA === 'true'
  ? ''
  : (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '');

/* ── Google Icon ──────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

/* ── Shared input component ───────────────────────────────── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  right?: React.ReactNode;
}
const AuthInput = ({ icon, right, className, ...props }: InputProps) => (
  <div className="relative">
    {icon && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
        {icon}
      </span>
    )}
    <input
      className={`auth-input ${icon ? 'pl-9' : ''} ${right ? 'pr-9' : ''} ${className ?? ''}`}
      {...props}
    />
    {right && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {right}
      </span>
    )}
  </div>
);

/* ── Divider ──────────────────────────────────────────────── */
const OrDivider = () => (
  <div className="flex items-center gap-3 my-5">
    <div className="flex-1 h-px bg-white/8" />
    <span className="text-[11px] text-white/25 font-medium uppercase tracking-wider">or</span>
    <div className="flex-1 h-px bg-white/8" />
  </div>
);

/* ── Main Auth Component ──────────────────────────────────── */
export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => authRememberMe.get());
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Reset CAPTCHA when switching between modes (tokens are not safe to reuse).
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    turnstileRef.current?.reset();
    setCaptchaToken('');
    setCaptchaError('');
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      authRememberMe.set(rememberMe);

      if (TURNSTILE_SITE_KEY && !captchaToken) {
        throw new Error('Please complete the security check.');
      }

      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast({ title: 'Check your email', description: 'Reset link sent if the account exists.' });
        setMode('signin');
        return;
      }

      if (mode === 'signup') {
        const { error } = await signUp(email, password, captchaToken || undefined);
        if (error) throw error;
        toast({ title: 'Account created', description: 'Verify your email to continue.' });
        return;
      }

      const { error } = await signIn(email, password, captchaToken || undefined);
      if (error) throw error;
      navigate('/dashboard');
    } catch (err: any) {
      toast({
        title: mode === 'signin' ? 'Sign in failed' : mode === 'signup' ? 'Sign up failed' : 'Error',
        description: err?.message ?? 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      if (TURNSTILE_SITE_KEY) {
        turnstileRef.current?.reset();
        setCaptchaToken('');
      }
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    await signInWithGoogle();
    setLoading(false);
  };

  const headings = {
    signin: { title: 'Sign in', sub: 'Welcome back to MUSHIN' },
    signup: { title: 'Create account', sub: 'Create your account to subscribe' },
    forgot: { title: 'Reset password', sub: "We'll send a link to your email" },
  };

  return (
    /* No backdrop-blur on any element. Single radial gradient via ::before pseudo. */
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden theme-auth">

      {/* Background: single static gradient — no animated blobs, no blur filters */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 900px 600px at 50% -100px, rgba(139,92,246,0.3) 0%, rgba(109,40,217,0.1) 50%, transparent 75%)',
        }}
      />

      {/* Card */}
      <div className="auth-card">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <MushInLogo height={32} />
        </div>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white tracking-tight">
            {headings[mode].title}
          </h1>
          <p className="text-sm text-white/40 mt-1">{headings[mode].sub}</p>
        </div>

        {/* Google button — only for signin/signup */}
        {mode !== 'forgot' && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="auth-btn-google mb-0"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
        )}

        {mode !== 'forgot' && <OrDivider />}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <AuthInput
            type="email"
            name="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            icon={<Mail size={14} />}
          />

          {mode !== 'forgot' && (
            <AuthInput
              type={showPw ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              icon={<Lock size={14} />}
              right={
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
          )}

          {/* Cloudflare Turnstile */}
          {!!TURNSTILE_SITE_KEY && (
            <div className="pt-2 space-y-2">
              {!captchaToken && !captchaError && (
                <div className="h-[65px] rounded-md border border-white/10 bg-white/[0.03]" />
              )}
              <div
                aria-hidden={!!captchaToken}
                style={
                  captchaToken
                    ? { position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }
                    : undefined
                }
              >
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError('');
                  }}
                  onExpire={() => {
                    setCaptchaToken('');
                  }}
                  onError={(code) => {
                    setCaptchaToken('');
                    setCaptchaError(code ? `Security check failed (${code}). Try again.` : 'Security check failed. Try again.');
                  }}
                  onUnsupported={() => {
                    setCaptchaToken('');
                    setCaptchaError('Security check is not supported in this browser.');
                  }}
                  options={{ theme: 'dark', size: 'normal' }}
                />
              </div>
              {captchaError && (
                <div className="text-[11px] text-red-400 leading-relaxed">{captchaError}</div>
              )}
            </div>
          )}

          {mode === 'signin' && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] text-white/35 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border border-white/15 bg-white/5 checked:bg-purple-500 checked:border-purple-500"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[12px] text-white/35 hover:text-white/60 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <div className="flex items-center justify-start">
              <label className="flex items-center gap-2 text-[12px] text-white/35 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border border-white/15 bg-white/5 checked:bg-purple-500 checked:border-purple-500"
                />
                Remember me
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-btn mt-2"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : mode === 'signin' ? (
              'Sign in'
            ) : mode === 'signup' ? (
              'Create account'
            ) : (
              'Send reset link'
            )}
          </button>
        </form>

        {/* Mode switch */}
        <div className="mt-6 text-center text-[13px] text-white/35">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
              >
                Sign up
              </button>
            </>
          ) : mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => setMode('signin')}
                className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
              >
                Sign in
              </button>
            </>
          ) : (
            <button
              onClick={() => setMode('signin')}
              className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              ← Back to sign in
            </button>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-8 pt-6 border-t border-white/6 flex items-center justify-center gap-4">
          {[
            { to: '/terms', label: 'Terms' },
            { to: '/privacy', label: 'Privacy' },
            { to: '/aup', label: 'AUP' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
