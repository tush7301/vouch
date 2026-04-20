import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import VouchLogo from '../components/ui/VouchLogo';
import { trackLoginPageViewed, trackSignupStarted, trackLoginCompleted, trackSignupCompleted } from '../lib/analytics';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * Login — Liquid glass auth page with floating blobs and translucent form.
 */
export default function Login() {
  const { login, register, loginGoogle, loginInstagram } = useAuth();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const googleInitialized = useRef(false);

  const initialMode = routeLocation.state?.mode === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Track login page view
  useEffect(() => { trackLoginPageViewed(); }, []);

  // Typewriter effect for the tagline.
  const TAGLINE_PREFIX = 'Your social life, ';
  const TAGLINE_SUFFIX = 'ranked.';
  const FULL_LEN = TAGLINE_PREFIX.length + TAGLINE_SUFFIX.length;
  const [typedLen, setTypedLen] = useState(0);
  useEffect(() => {
    setTypedLen(0);
    const startDelay = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i += 1;
        setTypedLen(i);
        if (i >= FULL_LEN) clearInterval(interval);
      }, 55);
      // Stash on window so the next-layer cleanup can clear it even after unmount.
      return () => clearInterval(interval);
    }, 350);
    return () => clearTimeout(startDelay);
  }, [FULL_LEN]);

  const typedPrefix = TAGLINE_PREFIX.slice(0, Math.min(typedLen, TAGLINE_PREFIX.length));
  const typedSuffix = typedLen > TAGLINE_PREFIX.length
    ? TAGLINE_SUFFIX.slice(0, typedLen - TAGLINE_PREFIX.length)
    : '';
  const typingDone = typedLen >= FULL_LEN;

  useEffect(() => {
    if (googleInitialized.current) return;

    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In is not configured. Set VITE_GOOGLE_CLIENT_ID.');
      return;
    }

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      googleInitialized.current = true;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setError('');
          try {
            const user = await loginGoogle(response.credential);
            trackLoginCompleted(user, 'google');
            navigate(user.onboarding_complete ? '/' : '/onboarding');
          } catch (err) {
            setError(err.message || 'Google login failed');
          }
        },
      });
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loginGoogle, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        trackSignupStarted('email');
        const user = await register({ email, username, display_name: displayName, password });
        trackSignupCompleted(user);
        navigate(user.onboarding_complete ? '/' : '/onboarding');
      } else {
        const user = await login({ email, password });
        trackLoginCompleted(user, 'email');
        navigate(user.onboarding_complete ? '/' : '/onboarding');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    setError('');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          window.google.accounts.id.renderButton(
            document.createElement('div'),
            { type: 'standard' },
          );
          window.google.accounts.oauth2?.initCodeClient?.({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile',
          });
          setError('Pop-up was blocked. Please allow pop-ups and try again.');
        }
      });
    } else {
      setError('Google Sign-In is loading, please try again in a moment.');
    }
  };

  const handleInstagram = async () => {
    setError('Instagram login is not available yet.');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-cream relative overflow-hidden">
      {/* Floating decorative blobs */}
      <div className="blob w-72 h-72 bg-terracotta/20 top-[-5%] right-[-10%]" style={{ animationDelay: '0s' }} />
      <div className="blob w-96 h-96 bg-amber/15 bottom-[-10%] left-[-15%]" style={{ animationDelay: '-4s' }} />
      <div className="blob w-48 h-48 bg-sage/15 top-[30%] left-[5%]" style={{ animationDelay: '-8s' }} />

      {/* Logo / wordmark */}
      <div className="mb-8 text-center relative z-10">
        <div className="animate-fade-up">
          <VouchLogo size="lg" />
        </div>
        <p className="mt-3 text-text-muted text-sm lg:text-base max-w-[260px] lg:max-w-md mx-auto min-h-[1.4em]">
          {typedPrefix}
          <em className="italic text-terracotta not-italic-placeholder" style={{ fontStyle: 'italic' }}>{typedSuffix}</em>
          <span
            aria-hidden="true"
            className={`inline-block w-[2px] h-[1em] align-[-2px] ml-0.5 bg-terracotta ${typingDone ? 'animate-pulse' : ''}`}
          />
        </p>
      </div>

      {/* Auth form — glass card */}
      <div className="w-full max-w-xs lg:max-w-sm flex flex-col gap-3 relative z-10">
        <div className="glass-solid rounded-2xl p-6 space-y-3">
          {/* OAuth */}
          <button
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-full glass-input font-semibold text-sm hover:bg-white/60 transition-fluid"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-1">
            <span className="flex-1 h-px bg-white/40" />
            <span className="text-xs text-text-muted">or</span>
            <span className="flex-1 h-px bg-white/40" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'register' && (
              <>
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-full glass-input text-sm focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-full glass-input text-sm focus:outline-none"
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-full glass-input text-sm focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-full glass-input text-sm focus:outline-none"
            />

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            <Button variant="primary" size="lg" className="w-full" disabled={submitting} type="submit">
              {submitting ? 'Please wait...' : mode === 'register' ? 'Sign up' : 'Log in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-secondary-text mt-1">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className="text-terracotta font-semibold hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="text-terracotta font-semibold hover:underline"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>

      {/* Footer */}
      <p className="mt-10 text-[10px] text-secondary-text/50 relative z-10">
        By continuing you agree to our Terms &amp; Privacy Policy
      </p>
    </div>
  );
}
