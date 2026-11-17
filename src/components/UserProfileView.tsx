import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  CreditCard,
  Download,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type {
  AuthSessionInfo,
  AuthUser,
  BankAccountRecord,
  EnterpriseSecuritySnapshot,
  KycDocumentType,
  KycVerificationRecord,
  Order,
  Position,
  ReferralPromoProfile,
  SocialGraphState,
  TradingBotRecord,
  UserRewardsState,
} from '../types/market';
import { formatCurrency } from '../utils/format';

interface UserProfileViewProps {
  authUser: AuthUser;
  kycRecord: KycVerificationRecord | null;
  bankAccounts: BankAccountRecord[];
  accountMode: 'demo' | 'real';
  demoCashBalance: number;
  realCashBalance: number;
  vaultBalanceUsd: number;
  positions: Position[];
  orders: Order[];
  bots: TradingBotRecord[];
  authSessions: AuthSessionInfo[];
  promoProfile?: ReferralPromoProfile | null;
  rewardsState?: UserRewardsState | null;
  socialGraph?: SocialGraphState | null;
  enterpriseSecurity?: EnterpriseSecuritySnapshot | null;
  onSubmitKyc: (payload: {
    country: string;
    fullName: string;
    docType: KycDocumentType;
    docNumber: string;
    proofOfAddressType: string;
    selfieLivenessToken: string;
    antiScamPledge: boolean;
  }) => Promise<{ ok: boolean; error?: string; kyc?: KycVerificationRecord }>;
  onSwitchAccountMode: (mode: 'demo' | 'real') => Promise<{ ok: boolean; error?: string }>;
  onNavigate: (view: 'terminal' | 'vault' | 'investors' | 'bots' | 'guide') => void;
  onDownloadPolicyBundle: () => Promise<boolean>;
}

export function UserProfileView({
  authUser,
  kycRecord,
  bankAccounts,
  accountMode,
  demoCashBalance,
  realCashBalance,
  vaultBalanceUsd,
  positions,
  orders,
  bots,
  authSessions,
  promoProfile,
  rewardsState,
  socialGraph,
  enterpriseSecurity,
  onSubmitKyc,
  onSwitchAccountMode,
  onNavigate,
  onDownloadPolicyBundle,
}: UserProfileViewProps) {
  const [country, setCountry] = useState(kycRecord?.country || 'India');
  const [fullName, setFullName] = useState(kycRecord?.fullName || authUser.name);
  const [docType, setDocType] = useState<KycDocumentType>(kycRecord?.docType || 'Passport');
  const [docNumber, setDocNumber] = useState('');
  const [addressProof, setAddressProof] = useState('Bank Statement / Utility Bill');
  const [livenessToken, setLivenessToken] = useState('LIVENESS-OK-VERIFIED');
  const [antiScamPledge, setAntiScamPledge] = useState(true);
  const [kycBusy, setKycBusy] = useState(false);
  const [kycError, setKycError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  const kycVerified = kycRecord?.status === 'VERIFIED';
  const paymentVerified = bankAccounts.length > 0;
  const dualMfaReady = Boolean(authUser.totpEnabled) || (authUser.passkeysCount ?? 0) > 0;
  const realTradingUnlocked = kycVerified && paymentVerified;

  const maskedUid = useMemo(() => {
    const raw = authUser.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `AX-${raw.slice(-8).padStart(8, '0')}`;
  }, [authUser.id]);

  const filledOrders = useMemo(() => orders.filter((o) => o.status === 'filled'), [orders]);
  const totalPnl = useMemo(
    () => positions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0),
    [positions]
  );

  const handleQuickKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycError('');
    if (docNumber.trim().length < 5) {
      setKycError('Enter a valid government document ID (minimum 5 characters).');
      return;
    }
    setKycBusy(true);
    const res = await onSubmitKyc({
      country,
      fullName: fullName.trim() || authUser.name,
      docType,
      docNumber: docNumber.trim(),
      proofOfAddressType: addressProof,
      selfieLivenessToken: livenessToken.trim() || 'LIVENESS-OK-VERIFIED',
      antiScamPledge,
    });
    setKycBusy(false);
    if (!res.ok) {
      setKycError(res.error ?? 'Unable to verify KYC document.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Binance-Style Identity & Tier Header */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-[#F0B90B] text-[#0B0E11] flex items-center justify-center font-bold text-lg shrink-0">
            {authUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-base font-bold text-slate-900 dark:text-[#EAECEF] truncate">
                {authUser.name}
              </h1>
              <span className="font-mono text-[11px] text-slate-500 dark:text-[#848E9C]">
                UID: {maskedUid}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold ${
                  realTradingUnlocked ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
                }`}
              >
                {realTradingUnlocked ? 'Verified Trader · Real Unlocked' : 'Paper Practice Active · Verification Pending'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-[#848E9C]">
              <span className="font-mono">{authUser.email}</span>
              <span>Role: {authUser.role}</span>
              <span>Tier: {promoProfile?.tierLabel ?? 'VIP Standard'}</span>
              <span>Fee Discount: {promoProfile?.feeDiscountPct ?? 0}%</span>
              <span>
                Following {socialGraph?.followingIds.length ?? 0} · Followers {socialGraph?.followersCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exportBusy}
            onClick={async () => {
              setExportBusy(true);
              await onDownloadPolicyBundle();
              setExportBusy(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#2B3139] whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#F0B90B]" />
            {exportBusy ? 'Generating…' : 'Export Policy & Architecture'}
          </button>
          <button
            type="button"
            onClick={() => void onSwitchAccountMode(accountMode === 'demo' ? 'real' : 'demo')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] whitespace-nowrap shrink-0"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {accountMode === 'demo' ? 'Activate Real Account' : 'Switch to $1M Demo'}
          </button>
        </div>
      </div>

      {/* Onboarding Mandatory Verification Gate (Identity + Payment Rail -> Live Trading) */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
          <div className="flex items-center gap-2">
            {realTradingUnlocked ? (
              <ShieldCheck className="w-4 h-4 text-[#0ECB81]" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-[#F0B90B]" />
            )}
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Account Onboarding &amp; Real-Money Market Unlock Progress
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#848E9C]">
                New accounts start immediately with $1,000,000 Paper Trading. Complete Tier 2 KYC and Payment Rail Verification to unlock Live Market Execution.
              </p>
            </div>
          </div>
          <span
            className={`font-mono text-xs font-semibold ${
              realTradingUnlocked ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
            }`}
          >
            {(kycVerified ? 1 : 0) + (paymentVerified ? 1 : 0) + 1} / 3 Core Steps Complete
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Step 1 */}
          <div className="p-4 rounded-md border border-[#0ECB81]/40 bg-[#0ECB81]/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold text-[#0ECB81]">STEP 01 · COMPLETE</span>
              <CheckCircle2 className="w-4 h-4 text-[#0ECB81]" />
            </div>
            <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
              Zero-Trust Account Created
            </div>
            <p className="text-slate-600 dark:text-[#B7BDC6]">
              Scrypt identity active with $1,000,000 Demo Paper Capital and X25519 encrypted transport.
            </p>
          </div>

          {/* Step 2: KYC */}
          <div
            className={`p-4 rounded-md border space-y-2 ${
              kycVerified
                ? 'border-[#0ECB81]/40 bg-[#0ECB81]/5'
                : 'border-[#F0B90B]/50 bg-[#F0B90B]/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-mono text-[11px] font-semibold ${
                  kycVerified ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
                }`}
              >
                STEP 02 · {kycVerified ? 'VERIFIED' : 'REQUIRED'}
              </span>
              {kycVerified ? (
                <CheckCircle2 className="w-4 h-4 text-[#0ECB81]" />
              ) : (
                <UserCheck className="w-4 h-4 text-[#F0B90B]" />
              )}
            </div>
            <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
              Tier 2 Identity (KYC)
            </div>
            <p className="text-slate-600 dark:text-[#B7BDC6]">
              {kycVerified
                ? `Verified (${kycRecord?.docType} · ${kycRecord?.badgeCode}). Anti-impersonation cleared.`
                : 'Submit Government ID, country jurisdiction & anti-scam attestation below.'}
            </p>
          </div>

          {/* Step 3: Payment Rail */}
          <div
            className={`p-4 rounded-md border space-y-2 ${
              paymentVerified
                ? 'border-[#0ECB81]/40 bg-[#0ECB81]/5'
                : 'border-[#F0B90B]/50 bg-[#F0B90B]/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-mono text-[11px] font-semibold ${
                  paymentVerified ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
                }`}
              >
                STEP 03 · {paymentVerified ? 'VERIFIED' : 'REQUIRED'}
              </span>
              {paymentVerified ? (
                <CheckCircle2 className="w-4 h-4 text-[#0ECB81]" />
              ) : (
                <CreditCard className="w-4 h-4 text-[#F0B90B]" />
              )}
            </div>
            <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
              Payment Rail Verification
            </div>
            <p className="text-slate-600 dark:text-[#B7BDC6]">
              {paymentVerified
                ? `${bankAccounts.length} AES-256-GCM encrypted rail(s) linked & ready for settlement.`
                : 'Link at least 1 Global UPI, IMPS, SEPA, ACH, FPS, or SWIFT rail in Vault.'}
            </p>
            {!paymentVerified && (
              <button
                type="button"
                onClick={() => onNavigate('vault')}
                className="inline-flex items-center gap-1 font-semibold text-[#D9A70A] dark:text-[#F0B90B] hover:underline"
              >
                Link Payment Rail <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Step 4: MFA & Real Custody */}
          <div
            className={`p-4 rounded-md border space-y-2 ${
              dualMfaReady
                ? 'border-[#0ECB81]/40 bg-[#0ECB81]/5'
                : 'border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11]/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-mono text-[11px] font-semibold ${
                  dualMfaReady ? 'text-[#0ECB81]' : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                MFA SHIELD · {dualMfaReady ? 'ACTIVE' : 'RECOMMENDED'}
              </span>
              <KeyRound className={`w-4 h-4 ${dualMfaReady ? 'text-[#0ECB81]' : 'text-slate-400'}`} />
            </div>
            <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
              2FA TOTP &amp; FIDO2 Passkeys
            </div>
            <p className="text-slate-600 dark:text-[#B7BDC6]">
              TOTP: {authUser.totpEnabled ? 'Active' : 'Off'} · Passkeys: {authUser.passkeysCount ?? 0} · Wallet Risk: {enterpriseSecurity?.walletRisk.score ?? '—'}/100
            </p>
            {!dualMfaReady && (
              <button
                type="button"
                onClick={() => onNavigate('vault')}
                className="inline-flex items-center gap-1 font-semibold text-[#D9A70A] dark:text-[#F0B90B] hover:underline"
              >
                Enable 2FA Security <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Balances, Day-Trading Desk Telemetry & Inline KYC Form */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Balances & Day-Trading Telemetry */}
        <div className="xl:col-span-6 space-y-6">
          <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2B3139]">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#F0B90B]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Account Custody Balances &amp; Desk Summary
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500 dark:text-[#848E9C]">
                Mode: {accountMode.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 font-mono tabular-nums">
              <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]">
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">
                  Paper Demo Capital
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-[#EAECEF]">
                  {formatCurrency(demoCashBalance)}
                </div>
              </div>
              <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]">
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">
                  Real Trading Balance
                </div>
                <div className="mt-1 text-sm font-bold text-[#0ECB81]">
                  {formatCurrency(realCashBalance)}
                </div>
              </div>
              <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]">
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">
                  2FA Cold Vault Shield
                </div>
                <div className="mt-1 text-sm font-bold text-[#F0B90B]">
                  {formatCurrency(vaultBalanceUsd)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs font-mono tabular-nums">
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Filled Trades</div>
                <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">{filledOrders.length}</div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Open Positions</div>
                <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">{positions.length}</div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Active Bots</div>
                <div className="font-semibold text-[#0ECB81]">{bots.filter((b) => b.status === 'RUNNING').length}</div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Desk Net P&amp;L</div>
                <div className={`font-semibold ${totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                  {totalPnl >= 0 ? '+' : ''}
                  {formatCurrency(totalPnl)}
                </div>
              </div>
            </div>
          </div>

          {/* Rewards & Device Posture Summary */}
          <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-[#2B3139]">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#F0B90B]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Loyalty Rank &amp; Hardware Device Trust
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('guide')}
                className="text-xs font-semibold text-[#D9A70A] dark:text-[#F0B90B] hover:underline"
              >
                Day-Trading Playbook →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Trader XP &amp; Streak</div>
                <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                  {rewardsState?.xpPoints ?? 0} XP ({rewardsState?.streakDays ?? 0}d)
                </div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Rank Tier</div>
                <div className="font-semibold text-[#F0B90B]">{rewardsState?.tierName ?? 'Bronze'}</div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Active Sessions</div>
                <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">{authSessions.length}</div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">Trusted Devices</div>
                <div className="font-semibold text-[#0ECB81]">
                  {enterpriseSecurity?.trustedDevices.filter((d) => d.trustStatus === 'TRUSTED').length ?? 1}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Identity KYC Verification Form */}
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2B3139]">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-[#0ECB81]" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Tier 2 Identity KYC &amp; Anti-Scam Attestation
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                  Encrypted via X25519 envelope proof; document numbers are SHA-256 hashed server-side.
                </p>
              </div>
            </div>
            <span
              className={`font-mono text-xs font-semibold ${
                kycVerified ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
              }`}
            >
              {kycVerified ? kycRecord?.badgeCode : 'UNVERIFIED'}
            </span>
          </div>

          {kycVerified && kycRecord ? (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-md border border-[#0ECB81]/40 bg-[#0ECB81]/5 space-y-1.5">
                <div className="font-semibold text-[#0ECB81] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Identity Verification Complete ({kycRecord.badgeCode})
                </div>
                <div className="text-slate-700 dark:text-[#EAECEF]">
                  Holder: <span className="font-semibold">{kycRecord.fullName}</span> · Jurisdiction: {kycRecord.country}
                </div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-[#848E9C]">
                  Document: {kycRecord.docType} ({kycRecord.maskedDocNumber}) · SHA-256: {kycRecord.docHash.slice(0, 20)}…
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('vault')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {paymentVerified ? 'Manage Payment Rails & Cold Vault' : 'Step 3: Verify Payment Rail Now'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('terminal')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
                >
                  <Activity className="w-3.5 h-3.5 text-[#0ECB81]" />
                  Open Trading Terminal
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleQuickKyc} className="space-y-3 text-xs">
              {kycError && (
                <div className="p-2.5 rounded border border-[#F6465D]/40 bg-[#F6465D]/10 text-[#F6465D]">
                  {kycError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Country / Jurisdiction
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as KycDocumentType)}
                    className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  >
                    <option value="Passport">Passport</option>
                    <option value="Aadhaar">Aadhaar ID</option>
                    <option value="PAN">PAN Card</option>
                    <option value="National ID">National ID</option>
                    <option value="Drivers License">Drivers License</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Government ID Number
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="e.g., PASS9823410"
                    required
                    className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Address Proof Type
                  </label>
                  <input
                    type="text"
                    value={addressProof}
                    onChange={(e) => setAddressProof(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Liveness Check Token
                  </label>
                  <input
                    type="text"
                    value={livenessToken}
                    onChange={(e) => setLivenessToken(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 pt-1 cursor-pointer text-slate-600 dark:text-[#B7BDC6]">
                <input
                  type="checkbox"
                  checked={antiScamPledge}
                  onChange={(e) => setAntiScamPledge(e.target.checked)}
                  className="mt-0.5 accent-[#F0B90B]"
                />
                <span>
                  I attest this account is operated solely by me with zero third-party impersonation, wash trading, or sanctioned activity.
                </span>
              </label>

              <button
                type="submit"
                disabled={kycBusy}
                className="w-full py-2.5 text-xs font-semibold rounded-md bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11]"
              >
                {kycBusy ? 'Verifying via Encrypted Mesh…' : 'Verify Tier 2 KYC Identity'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
