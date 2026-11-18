import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  Moon,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Sun,
} from 'lucide-react';
import type {
  EngineMetrics,
  Instrument,
  MfaChallengePayload,
  OAuthProviderInfo,
} from '../types/market';
import type { AuthServerStatus, OAuthDiagnostics } from '../hooks/useMarketSocket';
import { BrandMark } from './BrandMark';
import { PWAInstallButton } from './PWAInstallButton';
import { LegalModal } from './LegalModal';
import { formatPrice } from '../utils/format';

interface AuthScreenProps {
  instruments: Instrument[];
  engineMetrics: EngineMetrics | null;
  darkMode: boolean;
  oauthProviders: OAuthProviderInfo[];
  oauthDiagnostics?: OAuthDiagnostics | null;
  authServerStatus?: AuthServerStatus;
  pendingMfa: MfaChallengePayload | null;
  onToggleDarkMode: () => void;
  onCheckAuthServer?: () => Promise<AuthServerStatus>;
  onPrivateGitHubSignIn?: () => Promise<{ ok: boolean; error?: string; mfaRequired?: boolean }>;
  onLogin: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; mfaRequired?: boolean }>;
  onVerifyMfa: (mfaToken: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  onClearPendingMfa: () => void;
  onPasskeyLogin: (email?: string, mfaToken?: string) => Promise<{ ok: boolean; error?: string }>;
  onStartOAuth: (provider: 'google' | 'github') => Promise<{
    ok: boolean;
    configured?: boolean;
    error?: string;
    callbackUrl?: string;
    devCallbackUrl?: string;
    sharedCallbackUrl?: string;
    missingEnvVars?: string[];
  }>;
  onRegister: (payload: {
    email: string;
    password: string;
    name: string;
    role?: string;
    experienceMode?: 'newbie' | 'pro';
    marketFocus?: string;
    contactPhone?: string;
    termsAccepted?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRequestPasswordReset?: (
    email: string
  ) => Promise<{ ok: boolean; message: string; sandboxResetCode?: string; mfaRequired?: boolean }>;
  onConfirmPasswordReset?: (payload: {
    email: string;
    code: string;
    newPassword: string;
    totpCode?: string;
  }) => Promise<{ ok: boolean; error?: string; revokedSessions?: number }>;
}

const PREVIEW_TICKERS = ['NVDA', 'RELIANCE.NS', 'BTC-USD', 'SPY', 'USD-INR', 'XAU-USD'];

function GoogleMark() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.68-.22-2.48H12v4.69h6.46a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.85Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.1C6.23 6.87 8.88 4.76 12 4.76Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

export function AuthScreen({
  instruments,
  engineMetrics,
  darkMode,
  oauthProviders,
  authServerStatus,
  pendingMfa,
  onToggleDarkMode,
  onCheckAuthServer,
  onPrivateGitHubSignIn,
  onLogin,
  onVerifyMfa,
  onClearPendingMfa,
  onPasskeyLogin,
  onStartOAuth,
  onRegister,
  onRequestPasswordReset,
  onConfirmPasswordReset,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Multi-Market Investor');
  const [marketFocus, setMarketFocus] = useState('Global Multi-Asset');
  const [contactPhone, setContactPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [experienceMode, setExperienceMode] = useState<'newbie' | 'pro'>('newbie');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | null>(null);

  // Forgot Password 3-Step Self-Service Recovery State
  const [recoveryStep, setRecoveryStep] = useState<'none' | 'request' | 'verify' | 'done'>('none');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryTotp, setRecoveryTotp] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [recoverySandboxCode, setRecoverySandboxCode] = useState<string | null>(null);
  const [recoveryMfaNeeded, setRecoveryMfaNeeded] = useState(false);

  const previewAssets = PREVIEW_TICKERS.map((sym) =>
    instruments.find((i) => i.symbol === sym)
  ).filter((i): i is Instrument => Boolean(i));

  const passwordStrength =
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
      ? 'Strong'
      : password.length >= 8
      ? 'Fair'
      : 'Too Short (8+ chars)';

  const googleProvider = oauthProviders.find((p) => p.id === 'google');
  const githubProvider = oauthProviders.find((p) => p.id === 'github');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    if (mode === 'register' && !termsAccepted) {
      setError('Please accept the Terms & Conditions, Binding Arbitration Clause, and Privacy Policy.');
      return;
    }
    setBusy(true);
    const res =
      mode === 'login'
        ? await onLogin(email, password)
        : await onRegister({
            email,
            password,
            name,
            role,
            experienceMode,
            marketFocus,
            contactPhone: contactPhone.trim() || undefined,
            termsAccepted,
          });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Authentication failed.');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingMfa) return;
    setError(null);
    setBusy(true);
    const res = await onVerifyMfa(pendingMfa.mfaToken, mfaCode);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'MFA verification failed.');
    }
  };

  const handlePasskeyAuth = async (mfaToken?: string) => {
    setError(null);
    setBusy(true);
    const res = await onPasskeyLogin(mode === 'login' ? email : undefined, mfaToken);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Hardware security key verification failed.');
    }
  };

  const handleOAuthClick = async (provider: 'google' | 'github') => {
    setError(null);
    setBusy(true);
    const res = await onStartOAuth(provider);
    setBusy(false);
    if (!res.ok && res.error) {
      setError(res.error);
    }
  };

  const handlePrivateGitHubSignIn = async () => {
    if (!onPrivateGitHubSignIn) return;
    setError(null);
    setBusy(true);
    const res = await onPrivateGitHubSignIn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Private GitHub server authentication failed.');
    }
  };

  const quickSignIn = async (presetEmail: string, presetPassword: string) => {
    setError(null);
    setBusy(true);
    const res = await onLogin(presetEmail, presetPassword);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Quick sign-in failed.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0E11] text-slate-900 dark:text-[#EAECEF]">
      {/* Clean Top Bar */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20]">
        <BrandMark size="md" subtitle="Global Exchange" />

        <div className="hidden md:flex items-center gap-6 text-xs text-slate-500 dark:text-[#848E9C]">
          <span>Crypto, India NSE, Global Stocks &amp; FX</span>
          <span>Demo &amp; Real Accounts</span>
          <span>Cold Vault Shield</span>
          <span>UPI &amp; Global Banking</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#B7BDC6] hover:bg-slate-100 dark:hover:bg-[#2B3139] shrink-0 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Centered Auth Workspace */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[1180px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left 7 Cols: Platform Overview + Live Pre-Auth Market Feed */}
          <div className="lg:col-span-7 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="text-xs font-mono text-[#D9A70A] dark:text-[#F0B90B]">
                Nuvra Zero-Trust Vault · REA Custody Ledger · Global Market Rails
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#EAECEF] text-balance">
                Trade Global Markets, Protect Funds in Cold Vault &amp; Practice Risk-Free
              </h1>
              <p className="text-sm text-slate-600 dark:text-[#B7BDC6] leading-relaxed max-w-2xl">
                Start with a free $1,000,000 Demo Practice account, or fund your Real Trading &amp; Hacker-Proof Cold Vault across 10 currencies via India &amp; Global UPI Corridors—protected by 2FA, FIDO2 Passkeys, and AI support/resistance forecasts.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-[#2B3139] text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-[#EAECEF]">
                    <Fingerprint className="w-4 h-4 text-[#0ECB81] shrink-0" />
                    Cold Vault + 2FA
                  </div>
                  <p className="text-slate-500 dark:text-[#848E9C] leading-relaxed">
                    Isolate idle capital from trading &amp; hackers; unlock requires 2FA OTP verification and emergency freeze protection.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-[#EAECEF]">
                    <Smartphone className="w-4 h-4 text-[#F0B90B] shrink-0" />
                    UPI &amp; Global Rails
                  </div>
                  <p className="text-slate-500 dark:text-[#848E9C] leading-relaxed">
                    Instant India UPI/IMPS/NEFT plus international ACH, SEPA, FPS, SWIFT, and card rails encrypted via AES-256-GCM.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-[#EAECEF]">
                    <Cpu className="w-4 h-4 text-[#0ECB81] shrink-0" />
                    AI Chart Predictions
                  </div>
                  <p className="text-slate-500 dark:text-[#848E9C] leading-relaxed">
                    Live 15m/1h/4h projections, support &amp; resistance lines, and a plain-English AI coach on every symbol.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Pre-Login Market Strip */}
            <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Live Market Stream Preview</span>
                {engineMetrics && (
                  <span className="font-mono tabular-nums">
                    {engineMetrics.activeConnections} live socket(s) ·{' '}
                    {engineMetrics.avgBroadcastLatencyMs} ms dispatch
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono tabular-nums text-xs">
                {previewAssets.length === 0 ? (
                  <div className="col-span-3 py-4 text-slate-400 font-sans">
                    Connecting to market feed...
                  </div>
                ) : (
                  previewAssets.map((asset) => {
                    const pos = asset.changePct >= 0;
                    return (
                      <div
                        key={asset.symbol}
                        className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {asset.symbol}
                          </span>
                          <span className="text-[10px] font-sans text-slate-400">
                            {asset.venue}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatPrice(asset.price, asset.symbol)}
                          </span>
                          <span
                            className={
                              pos
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {pos ? '+' : ''}
                            {asset.changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: MFA Challenge OR Sign In / Create Account Card */}
          <div className="lg:col-span-5 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-6 sm:p-8 flex flex-col justify-between gap-5">
            {pendingMfa ? (
              /* 2nd-Factor MFA Challenge Screen */
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      2nd-Factor MFA Verification
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMfaCode('');
                      onClearPendingMfa();
                    }}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                </div>

                <div className="p-3 rounded-md border border-blue-500/30 bg-blue-500/5 text-xs space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Identity Pre-Verified: <span className="font-mono">{pendingMfa.emailHint}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    Enter the 6-digit code from your Authenticator App, use a recovery backup code, or verify with your enrolled hardware security key.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleMfaSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      6-Digit Authenticator Code or Recovery Code
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="123456 or A1B2-C3D4"
                      className="w-full px-3 py-2.5 font-mono text-sm tracking-wider rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !mfaCode.trim()}
                    className="w-full py-2.5 px-4 font-semibold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>{busy ? 'Verifying Factor...' : 'Verify MFA & Unlock Desk'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {pendingMfa.methods.includes('webauthn') && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Hardware Security Key Available
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePasskeyAuth(pendingMfa.mfaToken)}
                      className="w-full py-2.5 px-4 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Tap Enrolled Hardware Key / Passkey</span>
                    </button>
                  </div>
                )}
              </div>
            ) : recoveryStep !== 'none' ? (
              /* 3-Step Self-Service Forgot Password Recovery */
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#F0B90B]" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Account Password Recovery
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryStep('none');
                      setError(null);
                      setRecoveryNotice(null);
                      setRecoverySandboxCode(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Sign In
                  </button>
                </div>

                {/* Step indicator */}
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className={`px-2.5 py-1.5 rounded border text-center ${recoveryStep === 'request' ? 'border-[#F0B90B] text-[#D9A70A] dark:text-[#F0B90B] bg-[#F0B90B]/10 font-semibold' : 'border-slate-200 dark:border-[#2B3139] text-slate-500'}`}>
                    1. Request
                  </div>
                  <div className={`px-2.5 py-1.5 rounded border text-center ${recoveryStep === 'verify' ? 'border-[#F0B90B] text-[#D9A70A] dark:text-[#F0B90B] bg-[#F0B90B]/10 font-semibold' : 'border-slate-200 dark:border-[#2B3139] text-slate-500'}`}>
                    2. Reset
                  </div>
                  <div className={`px-2.5 py-1.5 rounded border text-center ${recoveryStep === 'done' ? 'border-[#0ECB81] text-[#0ECB81] bg-[#0ECB81]/10 font-semibold' : 'border-slate-200 dark:border-[#2B3139] text-slate-500'}`}>
                    3. Secured
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                {recoveryNotice && (
                  <div className="p-3 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] text-xs text-slate-700 dark:text-slate-200 space-y-1.5">
                    <div>{recoveryNotice}</div>
                    {recoverySandboxCode && (
                      <div className="font-mono text-[11px] text-[#059669] dark:text-[#0ECB81]">
                        Dev Sandbox Recovery Code: <strong className="select-all">{recoverySandboxCode}</strong>
                      </div>
                    )}
                  </div>
                )}

                {recoveryStep === 'request' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!onRequestPasswordReset) return;
                      setError(null);
                      setBusy(true);
                      const res = await onRequestPasswordReset(recoveryEmail.trim());
                      setBusy(false);
                      if (!res.ok) {
                        setError(res.message);
                        return;
                      }
                      setRecoveryNotice(res.message);
                      setRecoverySandboxCode(res.sandboxResetCode ?? null);
                      setRecoveryMfaNeeded(Boolean(res.mfaRequired));
                      setRecoveryStep('verify');
                    }}
                    className="space-y-3.5 text-xs"
                  >
                    <p className="text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
                      Enter your account email. Zero-enumeration recovery issues a short-lived SHA-256 verification code (10 min TTL) and invalidates prior active sessions upon reset.
                    </p>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Registered Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full px-3 py-2.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F0B90B]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !recoveryEmail.trim()}
                      className="w-full py-2.5 px-4 font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] disabled:opacity-50 text-[#0B0E11] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>{busy ? 'Issuing Recovery Ticket...' : 'Send Recovery Code'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {recoveryStep === 'verify' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!onConfirmPasswordReset) return;
                      setError(null);
                      setBusy(true);
                      const res = await onConfirmPasswordReset({
                        email: recoveryEmail.trim(),
                        code: recoveryCode.trim(),
                        newPassword: recoveryNewPassword,
                        totpCode: recoveryTotp.trim() || undefined,
                      });
                      setBusy(false);
                      if (!res.ok) {
                        setError(res.error ?? 'Unable to reset password.');
                        return;
                      }
                      setEmail(recoveryEmail.trim());
                      setPassword('');
                      setRecoveryStep('done');
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        placeholder="Enter 6-digit recovery code"
                        className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>

                    {recoveryMfaNeeded && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Authenticator TOTP Code (MFA Enabled Account)
                        </label>
                        <input
                          type="text"
                          value={recoveryTotp}
                          onChange={(e) => setRecoveryTotp(e.target.value)}
                          placeholder="123456"
                          className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        New Strong Password (Min 8 chars)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={recoveryNewPassword}
                        onChange={(e) => setRecoveryNewPassword(e.target.value)}
                        placeholder="Create new Scrypt-hashed password"
                        className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={busy || !recoveryCode.trim() || recoveryNewPassword.length < 8}
                      className="w-full py-2.5 px-4 font-semibold rounded-md bg-[#0ECB81] hover:bg-[#0bb572] disabled:opacity-50 text-[#0B0E11] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>{busy ? 'Rotating Credentials...' : 'Reset Password & Revoke Old Sessions'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {recoveryStep === 'done' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-md border border-[#0ECB81]/40 bg-[#0ECB81]/10 space-y-1.5">
                      <div className="flex items-center gap-2 font-semibold text-[#059669] dark:text-[#0ECB81]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Password Reset Complete</span>
                      </div>
                      <p className="text-slate-600 dark:text-[#B7BDC6]">
                        Your Scrypt credentials have been updated and all previous sessions were invalidated.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryStep('none');
                        setMode('login');
                        setRecoveryCode('');
                        setRecoveryNewPassword('');
                        setRecoveryTotp('');
                        setRecoverySandboxCode(null);
                      }}
                      className="w-full py-2.5 px-4 font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] whitespace-nowrap shrink-0"
                    >
                      Return to Sign In
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Standard Sign In / Create Account View */
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      {mode === 'login' ? 'Secure Desk Sign In' : 'Create Investor Account'}
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className={`py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                      mode === 'login'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setEmail('');
                      setPassword('');
                      setConfirmPassword('');
                      setTermsAccepted(false);
                    }}
                    className={`py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                      mode === 'register'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Federated Social OAuth + Hardware Key Bar */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleOAuthClick('google')}
                      className="py-2 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-medium text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                    >
                      <GoogleMark />
                      <span>Google</span>
                      <span
                        className={`text-[10px] font-mono ${
                          googleProvider?.configured
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {googleProvider?.configured ? 'Ready' : 'Setup'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleOAuthClick('github')}
                      className="py-2 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-medium text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                    >
                      <GitHubMark />
                      <span>GitHub</span>
                      <span
                        className={`text-[10px] font-mono ${
                          githubProvider?.configured
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {githubProvider?.configured ? 'Ready' : 'Setup'}
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePasskeyAuth()}
                    className="w-full py-2 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-medium text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Sign In with Hardware Security Key / Passkey (FIDO2)</span>
                  </button>

                  {(authServerStatus?.privateGitHubSignInAvailable ||
                    authServerStatus?.githubPrivateServer?.privateTokenConfigured) &&
                    onPrivateGitHubSignIn && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePrivateGitHubSignIn()}
                        className="w-full py-2 px-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                      >
                        <GitHubMark />
                        <span>Sign In via Private GitHub Server</span>
                      </button>
                    )}

                  {/* Clean Security Gateway Ping Strip */}
                  <div className="rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11] px-3 py-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium min-w-0">
                        {authServerStatus?.online ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0ECB81] shrink-0" />
                        ) : (
                          <Server className="w-3.5 h-3.5 text-[#F0B90B] shrink-0" />
                        )}
                        <span className="truncate font-mono text-[10px]">
                          {authServerStatus?.checking
                            ? 'Verifying Zero-Trust Auth Gateway...'
                            : authServerStatus?.online
                            ? `Nuvra Security Gateway Online (${authServerStatus.latencyMs ?? 1}ms)`
                            : `Auth Gateway Offline${authServerStatus?.error ? `: ${authServerStatus.error}` : ''}`}
                        </span>
                      </div>
                      {onCheckAuthServer && (
                        <button
                          type="button"
                          disabled={authServerStatus?.checking}
                          onClick={() => void onCheckAuthServer()}
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-[#0ECB81] hover:underline disabled:opacity-50 shrink-0"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${authServerStatus?.checking ? 'animate-spin' : ''}`}
                          />
                          <span>Verify</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <span>or continue with email &amp; Scrypt password</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                  {mode === 'register' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., Arjun Sharma"
                          className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Experience Mode
                          </label>
                          <select
                            value={experienceMode}
                            onChange={(e) =>
                              setExperienceMode(e.target.value === 'pro' ? 'pro' : 'newbie')
                            }
                            className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="newbie">Beginner (Guide On)</option>
                            <option value="pro">Expert (Pro Quant)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Primary Market Focus
                          </label>
                          <select
                            value={marketFocus}
                            onChange={(e) => setMarketFocus(e.target.value)}
                            className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="Global Multi-Asset">Global Multi-Asset</option>
                            <option value="India NSE/BSE + INR">India NSE/BSE + INR</option>
                            <option value="US Equities & Tech">US Equities &amp; Tech</option>
                            <option value="Crypto & FX Prime">Crypto &amp; FX Prime</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Desk Profile
                          </label>
                          <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="Retail / Quant"
                            className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Contact Phone (Optional)
                          </label>
                          <input
                            type="tel"
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            placeholder="+91 / +1 ..."
                            className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Password
                      </label>
                      {mode === 'register' ? (
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          Strength: {passwordStrength}
                        </span>
                      ) : (
                        onRequestPasswordReset && (
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setRecoveryNotice(null);
                              setRecoveryEmail(email);
                              setRecoveryStep('request');
                            }}
                            className="text-[11px] font-medium text-[#D9A70A] dark:text-[#F0B90B] hover:underline whitespace-nowrap"
                          >
                            Forgot password?
                          </button>
                        )
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full pl-3 pr-9 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === 'register' && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="mt-2.5 flex items-start gap-2 text-[11px] text-slate-600 dark:text-[#B7BDC6] cursor-pointer">
                        <input
                          type="checkbox"
                          required
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 dark:border-[#2B3139] text-[#F0B90B] focus:ring-[#F0B90B]"
                        />
                        <span>
                          I accept the strict{' '}
                          <button
                            type="button"
                            onClick={() => setLegalTab('terms')}
                            className="underline text-[#D9A70A] dark:text-[#F0B90B] hover:opacity-80"
                          >
                            Terms &amp; Conditions, Binding Arbitration Clause, Liability Cap
                          </button>{' '}
                          and{' '}
                          <button
                            type="button"
                            onClick={() => setLegalTab('privacy')}
                            className="underline text-[#D9A70A] dark:text-[#F0B90B] hover:opacity-80"
                          >
                            Privacy Policy
                          </button>
                          .
                        </span>
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 px-4 font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] disabled:opacity-50 text-[#0B0E11] inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>
                      {busy
                        ? 'Verifying Credentials...'
                        : mode === 'login'
                        ? 'Sign In to Workspace'
                        : 'Create Isolated Account'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Demo Practice Quick Sign-In & Legal Links */}
            {!pendingMfa && (
              <div className="pt-4 border-t border-slate-200 dark:border-[#2B3139] space-y-3 text-xs">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void quickSignIn('demo@meridianmarkets.ai', 'DemoDesk#2026')}
                  className="w-full px-3.5 py-2.5 text-left rounded-md border border-slate-200 dark:border-[#2B3139] hover:border-[#F0B90B]/60 hover:bg-slate-50 dark:hover:bg-[#0B0E11] transition-colors flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                      Try Demo Practice Account Instantly
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-[#848E9C]">
                      $1,000,000 Virtual Practice Funds · Beginner Guide On
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#F0B90B] shrink-0" />
                </button>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#848E9C]">
                  <button
                    type="button"
                    onClick={() => setLegalTab('privacy')}
                    className="hover:underline"
                  >
                    Privacy Policy
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegalTab('terms')}
                    className="hover:underline"
                  >
                    Terms &amp; Conditions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <LegalModal
        open={legalTab !== null}
        initialTab={legalTab ?? 'privacy'}
        onClose={() => setLegalTab(null)}
      />
    </div>
  );
}
