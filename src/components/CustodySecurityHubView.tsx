import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Database,
  Fuel,
  Globe,
  Landmark,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type {
  BinLookupResult,
  ChainGasEstimate,
  CoinGeckoCoinTelemetry,
  CoinLaunchSubmission,
  CustodyWalletSnapshot,
  CustodyWithdrawalRecord,
  FrankfurterFxBundle,
  FxSwapQuote,
  FxSwapRecord,
  GeminiEnterpriseAnalysisResult,
  IpIntelLookupResult,
  KycDocumentType,
  MarketSessionCalendarItem,
  ReaLedgerSnapshot,
  ThreatCheckResult,
  TopTierVerificationBundle,
  UserFeatureGrants,
  UserLimitRecord,
  VibeSecurityAuditReport,
  VibeSecurityDomain,
  WalletVelocityPolicy,
  WithdrawalAllowlistEntry,
} from '../types/market';
import { formatCompactNumber, formatCurrency, formatTimeShort } from '../utils/format';

type CustodyHubTab =
  | 'deposit'
  | 'verification'
  | 'fx-swap'
  | 'allowlist'
  | 'rea-launchpad'
  | 'threat-bin'
  | 'auditor';

interface CustodySecurityHubViewProps {
  custodyWallet: CustodyWalletSnapshot | null;
  coingeckoCoins: CoinGeckoCoinTelemetry[];
  fxBundle: FrankfurterFxBundle | null;
  gasEstimates: ChainGasEstimate[];
  vibeAudit: VibeSecurityAuditReport | null;
  userLimits?: UserLimitRecord | null;
  userGrants?: UserFeatureGrants | null;
  reaLedger?: ReaLedgerSnapshot | null;
  topTierVerification?: TopTierVerificationBundle | null;
  coinLaunches?: CoinLaunchSubmission[];
  ipIntel?: IpIntelLookupResult | null;
  marketSessions?: MarketSessionCalendarItem[];
  guideMode?: boolean;
  initialTab?: CustodyHubTab;
  onToggleGuideMode?: (next: boolean) => void;
  onRefreshPublicApis: () => Promise<void>;
  onRefreshCustody: () => Promise<void>;
  onRefreshReaLedger?: () => Promise<void>;
  onQuoteFxSwap: (
    fromCurrency: string,
    toCurrency: string,
    fromAmount: number
  ) => Promise<{ ok: boolean; quote?: FxSwapQuote; error?: string }>;
  onExecuteFxSwap: (
    fromCurrency: string,
    toCurrency: string,
    fromAmount: number
  ) => Promise<{ ok: boolean; swap?: FxSwapRecord; error?: string }>;
  onAddAllowlist: (
    label: string,
    chain: 'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX',
    address: string
  ) => Promise<{ ok: boolean; entry?: WithdrawalAllowlistEntry; error?: string }>;
  onToggleAllowlist: (entryId: string, enabled: boolean) => Promise<boolean>;
  onRemoveAllowlist: (entryId: string) => Promise<boolean>;
  onUpdateVelocityPolicy: (patch: Partial<WalletVelocityPolicy>) => Promise<boolean>;
  onExecuteWithdrawal: (
    chain: 'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX',
    toAddress: string,
    amountNative: number
  ) => Promise<{ ok: boolean; withdrawal?: CustodyWithdrawalRecord; error?: string }>;
  onLookupBin: (bin: string) => Promise<BinLookupResult | null>;
  onCheckThreat: (target: string) => Promise<ThreatCheckResult | null>;
  onLookupIpIntel?: (ip?: string) => Promise<IpIntelLookupResult | null>;
  onRunVibeAudit: () => Promise<VibeSecurityAuditReport | null>;
  onRunGeminiAnalysis: (
    mode: GeminiEnterpriseAnalysisResult['mode'],
    payload?: Record<string, unknown>
  ) => Promise<{ ok: boolean; analysis?: GeminiEnterpriseAnalysisResult; error?: string }>;
  onSubmitProfileStep?: (payload: {
    fullName: string;
    country: string;
  }) => Promise<{ ok: boolean; bundle?: TopTierVerificationBundle; error?: string }>;
  onSubmitDocumentStep?: (payload: {
    docType: KycDocumentType;
    docNumber: string;
    livenessSelfieConfirmed: boolean;
  }) => Promise<{ ok: boolean; bundle?: TopTierVerificationBundle; error?: string }>;
  onInitiateBankStep?: (payload: {
    bankName: string;
    accountNumber: string;
  }) => Promise<{ ok: boolean; bundle?: TopTierVerificationBundle; error?: string }>;
  onVerifyBankStep?: (payload: {
    deposit1Cents: number;
    deposit2Cents: number;
  }) => Promise<{ ok: boolean; bundle?: TopTierVerificationBundle; error?: string }>;
  onSubmitCoinLaunch?: (payload: {
    name: string;
    symbol: string;
    chain: CoinLaunchSubmission['chain'];
    contractAddress: string;
    initialPriceUsd: number;
    totalSupply: number;
    whitepaperSummary: string;
  }) => Promise<{ ok: boolean; submission?: CoinLaunchSubmission; error?: string }>;
}

const SWAP_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'SGD', 'AED', 'JPY', 'BTC', 'ETH', 'SOL'];

export function CustodySecurityHubView({
  custodyWallet,
  coingeckoCoins,
  fxBundle,
  gasEstimates,
  vibeAudit,
  userLimits = null,
  userGrants = null,
  reaLedger = null,
  topTierVerification = null,
  coinLaunches = [],
  ipIntel = null,
  marketSessions = [],
  guideMode = false,
  initialTab,
  onToggleGuideMode,
  onRefreshPublicApis,
  onRefreshCustody,
  onRefreshReaLedger,
  onQuoteFxSwap,
  onExecuteFxSwap,
  onAddAllowlist,
  onToggleAllowlist,
  onRemoveAllowlist,
  onUpdateVelocityPolicy,
  onExecuteWithdrawal,
  onLookupBin,
  onCheckThreat,
  onLookupIpIntel,
  onRunVibeAudit,
  onRunGeminiAnalysis,
  onSubmitProfileStep,
  onSubmitDocumentStep,
  onInitiateBankStep,
  onVerifyBankStep,
  onSubmitCoinLaunch,
}: CustodySecurityHubViewProps) {
  const [activeTab, setActiveTab] = useState<CustodyHubTab>(initialTab ?? 'deposit');
  const [localBeginnerMode, setLocalBeginnerMode] = useState(guideMode);
  const isBeginnerGuided = onToggleGuideMode ? guideMode : localBeginnerMode;
  const [selectedChain, setSelectedChain] = useState<'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX'>('BTC');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedAddr, setCopiedAddr] = useState(false);

  // FX Swap state
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [fromAmount, setFromAmount] = useState('1000');
  const [fxQuote, setFxQuote] = useState<FxSwapQuote | null>(null);
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxBusy, setFxBusy] = useState(false);

  // Allowlist & Velocity state
  const [alLabel, setAlLabel] = useState('');
  const [alChain, setAlChain] = useState<'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX'>('ETH');
  const [alAddress, setAlAddress] = useState('');
  const [alBusy, setAlBusy] = useState(false);
  const [dailyCapInput, setDailyCapInput] = useState('50000');
  const [singleCapInput, setSingleCapInput] = useState('15000');
  const [strictAllowlist, setStrictAllowlist] = useState(true);
  const [wdChain, setWdChain] = useState<'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX'>('ETH');
  const [wdAddress, setWdAddress] = useState('');
  const [wdAmount, setWdAmount] = useState('0.25');
  const [wdBusy, setWdBusy] = useState(false);

  // Threat & BIN scanner state
  const [threatInput, setThreatInput] = useState('1.1.1.1');
  const [threatResult, setThreatResult] = useState<ThreatCheckResult | null>(null);
  const [threatHistory, setThreatHistory] = useState<ThreatCheckResult[]>([]);
  const [threatBusy, setThreatBusy] = useState(false);
  const [binInput, setBinInput] = useState('411111');
  const [binResult, setBinResult] = useState<BinLookupResult | null>(null);
  const [binBusy, setBinBusy] = useState(false);

  // Auditor + Gemini console state
  const [domainFilter, setDomainFilter] = useState<'ALL' | VibeSecurityDomain>('ALL');
  const [auditBusy, setAuditBusy] = useState(false);
  const [aiMode, setAiMode] = useState<GeminiEnterpriseAnalysisResult['mode']>('wallet_risk');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<GeminiEnterpriseAnalysisResult | null>(null);

  // 3-Stage Top-Tier Verification state
  const [verFullName, setVerFullName] = useState(topTierVerification?.profileFullName ?? '');
  const [verCountry, setVerCountry] = useState(topTierVerification?.profileCountry ?? 'IN');
  const [verDocType, setVerDocType] = useState<KycDocumentType>(topTierVerification?.documentType ?? 'Passport');
  const [verDocNumber, setVerDocNumber] = useState('');
  const [verLivenessOk, setVerLivenessOk] = useState(true);
  const [verBankName, setVerBankName] = useState(topTierVerification?.bankName ?? 'HDFC Bank Institutional');
  const [verBankAcct, setVerBankAcct] = useState('');
  const [verDep1, setVerDep1] = useState('');
  const [verDep2, setVerDep2] = useState('');
  const [verBusy, setVerBusy] = useState(false);
  const [verError, setVerError] = useState<string | null>(null);

  // Coin Launchpad state
  const [launchName, setLaunchName] = useState('');
  const [launchSymbol, setLaunchSymbol] = useState('');
  const [launchChain, setLaunchChain] = useState<CoinLaunchSubmission['chain']>('BASE');
  const [launchContract, setLaunchContract] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  const [launchPrice, setLaunchPrice] = useState('1.25');
  const [launchSupply, setLaunchSupply] = useState('10000000');
  const [launchSummary, setLaunchSummary] = useState('');
  const [launchBusy, setLaunchBusy] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // IP Intel lookup
  const [ipLookupInput, setIpLookupInput] = useState('8.8.8.8');
  const [ipLookupBusy, setIpLookupBusy] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const activeChainObj =
    custodyWallet?.chains.find((c) => c.chain === selectedChain) ?? custodyWallet?.chains[0] ?? null;

  useEffect(() => {
    if (custodyWallet?.velocityPolicy) {
      setDailyCapInput(String(custodyWallet.velocityPolicy.dailyLimitUsd));
      setSingleCapInput(String(custodyWallet.velocityPolicy.singleTxLimitUsd));
      setStrictAllowlist(custodyWallet.velocityPolicy.strictAllowlistOnly);
    }
  }, [custodyWallet?.velocityPolicy]);

  useEffect(() => {
    if (!activeChainObj?.address) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(activeChainObj.address, {
      width: 196,
      margin: 2,
      color: { dark: '#090A0D', light: '#F8FAFC' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [activeChainObj?.address]);

  const handleCopyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 1800);
    } catch {
      // clipboard fallback ignored cleanly
    }
  };

  const handleQuoteSwap = async () => {
    const amt = Number.parseFloat(fromAmount);
    setFxError(null);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFxError('Enter a valid amount greater than 0.');
      return;
    }
    setFxBusy(true);
    const res = await onQuoteFxSwap(fromCurrency, toCurrency, amt);
    setFxBusy(false);
    if (!res.ok || !res.quote) {
      setFxError(res.error ?? 'Unable to calculate quote.');
      setFxQuote(null);
      return;
    }
    setFxQuote(res.quote);
  };

  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number.parseFloat(fromAmount);
    setFxError(null);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFxError('Enter a valid swap amount.');
      return;
    }
    setFxBusy(true);
    const res = await onExecuteFxSwap(fromCurrency, toCurrency, amt);
    setFxBusy(false);
    if (!res.ok) {
      setFxError(res.error ?? 'Swap failed.');
      return;
    }
    setFxQuote(null);
  };

  const handleAddAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alLabel.trim() || !alAddress.trim()) return;
    setAlBusy(true);
    const res = await onAddAllowlist(alLabel.trim(), alChain, alAddress.trim());
    setAlBusy(false);
    if (res.ok) {
      setAlLabel('');
      setAlAddress('');
    }
  };

  const handleSaveVelocity = async (e: React.FormEvent) => {
    e.preventDefault();
    const daily = Number.parseFloat(dailyCapInput);
    const single = Number.parseFloat(singleCapInput);
    if (!Number.isFinite(daily) || !Number.isFinite(single)) return;
    await onUpdateVelocityPolicy({
      dailyLimitUsd: daily,
      singleTxLimitUsd: single,
      strictAllowlistOnly: strictAllowlist,
    });
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number.parseFloat(wdAmount);
    if (!wdAddress.trim() || !Number.isFinite(amt) || amt <= 0) return;
    setWdBusy(true);
    await onExecuteWithdrawal(wdChain, wdAddress.trim(), amt);
    setWdBusy(false);
  };

  const handleThreatScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threatInput.trim()) return;
    setThreatBusy(true);
    const res = await onCheckThreat(threatInput.trim());
    setThreatBusy(false);
    if (res) {
      setThreatResult(res);
      setThreatHistory((prev) => [res, ...prev.filter((i) => i.id !== res.id)].slice(0, 8));
    }
  };

  const handleBinScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setBinBusy(true);
    const res = await onLookupBin(binInput.trim());
    setBinBusy(false);
    if (res) setBinResult(res);
  };

  const handleRunGemini = async (mode: GeminiEnterpriseAnalysisResult['mode']) => {
    setAiMode(mode);
    setAiBusy(true);
    setAiError(null);
    const payload: Record<string, unknown> | undefined =
      mode === 'threat_triage'
        ? {
            latestThreatCheck: threatResult,
            threatHistory: threatHistory.slice(0, 4),
            latestBinCheck: binResult,
          }
        : undefined;
    const res = await onRunGeminiAnalysis(mode, payload);
    setAiBusy(false);
    if (!res.ok || !res.analysis) {
      setAiError(res.error ?? 'Gemini Enterprise Analysis unavailable.');
      return;
    }
    setAiResult(res.analysis);
  };

  const filteredChecks =
    vibeAudit?.checks.filter((c) => domainFilter === 'ALL' || c.domain === domainFilter) ?? [];

  return (
    <div className="space-y-6">
      {/* Header Summary Strip */}
      <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#F59E0B]" />
            <h1 className="text-lg font-bold tracking-tight text-white">
              Multi-Chain Custody, Public Intelligence &amp; Vibe Security Hub
            </h1>
          </div>
          <p className="text-xs text-[#8B919E]">
            Live CoinGecko &amp; ECB FX feeds, 7-network deposit QR vaults, spend velocity limits, anti-phishing &amp; BIN screening, and strict anti-IDOR auditing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Beginner Guided vs Expert Pro Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#14161B] border border-[#24262C] text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setLocalBeginnerMode(true);
                onToggleGuideMode?.(true);
              }}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                isBeginnerGuided
                  ? 'bg-[#F59E0B] text-[#090A0C]'
                  : 'text-[#8B919E] hover:text-white'
              }`}
            >
              Beginner Guided
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalBeginnerMode(false);
                onToggleGuideMode?.(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                !isBeginnerGuided
                  ? 'bg-[#23262F] text-white'
                  : 'text-[#8B919E] hover:text-white'
              }`}
            >
              Expert Pro
            </button>
          </div>

          <div className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono tabular-nums">
            <div className="text-[10px] text-[#8B919E] uppercase">Verification Tier</div>
            <div className="font-bold text-[#F59E0B]">
              {topTierVerification?.overallTier ?? 'Unverified'}
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono tabular-nums">
            <div className="text-[10px] text-[#8B919E] uppercase">Audit Score</div>
            <div className="font-bold text-[#0ECB81]">
              {vibeAudit ? `${vibeAudit.overallScorePct}% (${vibeAudit.passedCount}/${vibeAudit.checks.length})` : 'Pending'}
            </div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono tabular-nums">
            <div className="text-[10px] text-[#8B919E] uppercase">24h Remaining</div>
            <div className="font-bold text-white">
              {custodyWallet ? formatCurrency(custodyWallet.velocityPolicy.remaining24hUsd) : '$50,000'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void onRefreshPublicApis();
              void onRefreshCustody();
              void onRefreshReaLedger?.();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14161B] hover:bg-[#1D2028] border border-[#24262C] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Sync Feeds</span>
          </button>
        </div>
      </div>

      {/* Beginner Guided 3-Step Strip OR Expert Separated Governance Limits Banner */}
      {isBeginnerGuided ? (
        <div className="bg-[#090A0D] border border-[#F59E0B]/40 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            className="p-3 rounded-xl bg-[#14161B] hover:bg-[#1A1D24] border border-[#24262C] text-left space-y-1 transition-colors"
          >
            <div className="font-mono text-[10px] text-[#F59E0B] uppercase">Step 1 · Identity &amp; Bank</div>
            <div className="font-semibold text-white">Complete 3-Stage Verification</div>
            <div className="text-[11px] text-[#8B919E]">
              Verify Profile, ID + Liveness, and Bank Penny-Drop micro-deposits to unlock real rails.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className="p-3 rounded-xl bg-[#14161B] hover:bg-[#1A1D24] border border-[#24262C] text-left space-y-1 transition-colors"
          >
            <div className="font-mono text-[10px] text-[#0ECB81] uppercase">Step 2 · Wallet &amp; FX</div>
            <div className="font-semibold text-white">Deposit QR &amp; Instant ECB FX</div>
            <div className="text-[11px] text-[#8B919E]">
              Pick your blockchain network or convert USD/EUR/INR/GBP cleanly with live ECB rates.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('allowlist')}
            className="p-3 rounded-xl bg-[#14161B] hover:bg-[#1A1D24] border border-[#24262C] text-left space-y-1 transition-colors"
          >
            <div className="font-mono text-[10px] text-[#F59E0B] uppercase">Step 3 · Safety Lock</div>
            <div className="font-semibold text-white">Allowlist &amp; Spend Caps</div>
            <div className="text-[11px] text-[#8B919E]">
              Restrict withdrawals strictly to trusted addresses and enforce daily spend limits.
            </div>
          </button>
        </div>
      ) : (
        userLimits && (
          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[#F59E0B] font-bold">
                TIER {userLimits.tierCode} LIMITS
              </span>
              <span className="text-[#8B919E]">
                Deposit/24h: <strong className="text-white">{formatCurrency(userLimits.dailyDepositLimitUsd)}</strong>
              </span>
              <span className="text-[#8B919E]">
                Withdraw/24h: <strong className="text-white">{formatCurrency(userLimits.dailyWithdrawalLimitUsd)}</strong>
              </span>
              <span className="text-[#8B919E]">
                Max Order: <strong className="text-white">{formatCurrency(userLimits.singleOrderMaxUsd)}</strong>
              </span>
              <span className="text-[#8B919E]">
                API RPM: <strong className="text-white">{userLimits.apiCallsPerMin}</strong>
              </span>
            </div>
            {userGrants && (
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className={userGrants.canTradeRealMoney ? 'text-[#0ECB81]' : 'text-[#8B919E]'}>
                  Real Trade: {userGrants.canTradeRealMoney ? 'GRANTED' : 'LOCKED'}
                </span>
                <span className={userGrants.canLaunchTokens ? 'text-[#0ECB81]' : 'text-[#8B919E]'}>
                  Launchpad: {userGrants.canLaunchTokens ? 'GRANTED' : 'ADMIN APPROVAL'}
                </span>
              </div>
            )}
          </div>
        )
      )}

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#24262C] pb-3">
        {(
          [
            { id: 'deposit', label: 'Multi-Chain QR & Gas', icon: QrCode },
            { id: 'verification', label: '3-Stage Verification', icon: UserCheck },
            { id: 'fx-swap', label: 'Instant FX Swap (ECB)', icon: ArrowLeftRight },
            { id: 'allowlist', label: 'Allowlist & Velocity Guard', icon: Lock },
            { id: 'rea-launchpad', label: 'REA Ledger & Launchpad', icon: Rocket },
            { id: 'threat-bin', label: 'Threat IP, BIN & Sessions', icon: ShieldAlert },
            { id: 'auditor', label: 'Vibe Security & Gemini AI', icon: Bot },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-[#F59E0B] text-[#090A0C]'
                  : 'bg-[#090A0D] text-[#8B919E] border border-[#24262C] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MULTI-CHAIN DEPOSIT QR & GAS FEE ESTIMATOR */}
      {activeTab === 'deposit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Multi-Chain Deposit Vault</h2>
              <span className="text-[11px] font-mono text-[#F59E0B]">7 Networks Live</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 gap-1.5">
              {(['BTC', 'ETH', 'SOL', 'ARB', 'BASE', 'MATIC', 'TRX'] as const).map((chain) => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => setSelectedChain(chain)}
                  className={`py-2 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                    selectedChain === chain
                      ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-[#F59E0B]'
                      : 'bg-[#14161B] border-[#24262C] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {chain}
                </button>
              ))}
            </div>

            {activeChainObj ? (
              <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] flex flex-col items-center text-center space-y-3">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`${activeChainObj.chain} deposit QR`}
                    className="w-44 h-44 rounded-xl border border-[#24262C]"
                  />
                ) : (
                  <div className="w-44 h-44 rounded-xl bg-[#090A0D] border border-[#24262C] flex items-center justify-center text-xs text-[#8B919E]">
                    Rendering QR…
                  </div>
                )}

                <div className="w-full space-y-1.5">
                  <div className="text-[11px] text-[#8B919E]">
                    {activeChainObj.chainName} ({activeChainObj.assetSymbol}) Address
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#090A0D] border border-[#24262C]">
                    <code className="flex-1 text-[11px] font-mono text-white break-all text-left">
                      {activeChainObj.address}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyAddress(activeChainObj.address)}
                      className="p-1.5 rounded-md bg-[#1D2028] hover:bg-[#272B35] text-[#F59E0B] shrink-0"
                      title="Copy deposit address"
                    >
                      {copiedAddr ? <CheckCircle2 className="w-3.5 h-3.5 text-[#0ECB81]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="w-full grid grid-cols-3 gap-2 text-left text-[11px] pt-1">
                  <div className="p-2 rounded-lg bg-[#090A0D] border border-[#24262C]">
                    <div className="text-[#8B919E]">Holdings</div>
                    <div className="font-mono font-semibold text-white tabular-nums">
                      {activeChainObj.balanceNative} {activeChainObj.assetSymbol}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#090A0D] border border-[#24262C]">
                    <div className="text-[#8B919E]">Min Deposit</div>
                    <div className="font-mono font-semibold text-white tabular-nums">
                      {activeChainObj.minDepositNative}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#090A0D] border border-[#24262C]">
                    <div className="text-[#8B919E]">Finality</div>
                    <div className="font-mono font-semibold text-[#0ECB81] tabular-nums">
                      {activeChainObj.confirmationsRequired} conf
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] text-xs text-[#8B919E]">
                Loading multi-chain deposit addresses…
              </div>
            )}
          </div>

          {/* Gas & Mempool Estimator + CoinGecko Top Snapshot */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-[#F59E0B]" />
                  <h2 className="text-sm font-semibold text-white">Live On-Chain Gas &amp; Mempool Estimator</h2>
                </div>
                <span className="text-[11px] text-[#8B919E]">
                  {gasEstimates[0]?.source ?? 'Real-Time Network Oracles'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#24262C] text-[#8B919E] text-left">
                      <th className="py-2 pr-3">Chain</th>
                      <th className="py-2 px-3">Base Unit</th>
                      <th className="py-2 px-3 text-right">Slow</th>
                      <th className="py-2 px-3 text-right">Standard</th>
                      <th className="py-2 px-3 text-right">Fast</th>
                      <th className="py-2 pl-3 text-right">Mempool</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181A20]">
                    {gasEstimates.map((g) => (
                      <tr key={g.chain} className="hover:bg-[#14161B]/60">
                        <td className="py-2.5 pr-3 font-semibold text-white">
                          <div>{g.chain}</div>
                          <div className="text-[10px] text-[#8B919E] font-normal">{g.chainName}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#D1D5DB] tabular-nums">{g.unitLabel}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <div className="text-white">${g.slowFeeUsd}</div>
                          <div className="text-[10px] text-[#8B919E]">{g.slowEta}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <div className="text-[#F59E0B] font-semibold">${g.standardFeeUsd}</div>
                          <div className="text-[10px] text-[#8B919E]">{g.standardEta}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <div className="text-[#0ECB81] font-semibold">${g.fastFeeUsd}</div>
                          <div className="text-[10px] text-[#8B919E]">{g.fastEta}</div>
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums">
                          <div className="text-white">{g.mempoolPendingTx.toLocaleString()}</div>
                          <div
                            className={`text-[10px] ${
                              g.congestion === 'CONGESTED'
                                ? 'text-[#F6465D]'
                                : g.congestion === 'MODERATE'
                                ? 'text-[#F59E0B]'
                                : 'text-[#0ECB81]'
                            }`}
                          >
                            {g.congestion}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {coingeckoCoins.length > 0 && (
              <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0ECB81]" />
                    <h3 className="text-sm font-semibold text-white">CoinGecko Top Market Cap Feeds</h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#8B919E]">{coingeckoCoins[0]?.source}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {coingeckoCoins.slice(0, 6).map((c) => {
                    const pos = c.change24hPct >= 0;
                    return (
                      <div key={c.id} className="p-3 rounded-xl bg-[#14161B] border border-[#24262C] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-white">{c.symbol}</span>
                          <span className={`font-mono text-[11px] tabular-nums ${pos ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                            {pos ? '+' : ''}
                            {c.change24hPct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-sm font-semibold text-white tabular-nums">
                          {formatCurrency(c.priceUsd)}
                        </div>
                        <div className="text-[10px] text-[#8B919E] font-mono tabular-nums mt-0.5">
                          MCap ${formatCompactNumber(c.marketCapUsd)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INSTANT CROSS-CURRENCY FX SWAP */}
      {activeTab === 'fx-swap' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Instant Cross-Currency FX Swap</h2>
              <span className="text-[11px] font-mono text-[#F59E0B]">
                {fxBundle?.source ?? 'Frankfurter ECB Rates'}
              </span>
            </div>

            <form onSubmit={handleExecuteSwap} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8B919E] mb-1">From Currency</label>
                  <select
                    value={fromCurrency}
                    onChange={(e) => {
                      setFromCurrency(e.target.value);
                      setFxQuote(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                  >
                    {SWAP_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#8B919E] mb-1">To Currency</label>
                  <select
                    value={toCurrency}
                    onChange={(e) => {
                      setToCurrency(e.target.value);
                      setFxQuote(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                  >
                    {SWAP_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#8B919E] mb-1">Amount ({fromCurrency})</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={fromAmount}
                  onChange={(e) => {
                    setFromAmount(e.target.value);
                    setFxQuote(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-sm font-mono text-white tabular-nums"
                />
              </div>

              {fxError && (
                <div className="p-3 rounded-xl bg-[#F6465D]/10 border border-[#F6465D]/40 text-xs text-[#F6465D]">
                  {fxError}
                </div>
              )}

              {fxQuote && (
                <div className="p-3.5 rounded-xl bg-[#14161B] border border-[#F59E0B]/40 space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-[#8B919E]">Live FX Rate</span>
                    <span className="text-white">
                      1 {fxQuote.fromCurrency} = {fxQuote.rate} {fxQuote.toCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8B919E]">Fee ({fxQuote.spreadBps} bps)</span>
                    <span className="text-[#D1D5DB]">${fxQuote.feeUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#24262C]">
                    <span className="text-[#8B919E]">Net Receive</span>
                    <span className="text-[#0ECB81] font-bold">
                      {fxQuote.toAmount} {fxQuote.toCurrency}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={fxBusy}
                  onClick={() => void handleQuoteSwap()}
                  className="py-2.5 rounded-xl bg-[#14161B] hover:bg-[#1D2028] border border-[#24262C] text-xs font-semibold text-white"
                >
                  Preview Live Quote
                </button>
                <button
                  type="submit"
                  disabled={fxBusy}
                  className="py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-xs font-semibold text-[#090A0C]"
                >
                  {fxBusy ? 'Settling…' : 'Execute Atomic Swap'}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Multi-Currency Wallet Ledger</h3>
                <span className="text-[11px] font-mono text-[#8B919E]">
                  ECB Ref Date: {fxBundle?.date ?? 'Live'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {(custodyWallet?.balances ?? []).map((b) => (
                  <div key={b.currency} className="p-3 rounded-xl bg-[#14161B] border border-[#24262C] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white">{b.currency}</span>
                      <span className="text-[10px] text-[#8B919E] uppercase">{b.kind}</span>
                    </div>
                    <div className="mt-1 font-mono font-semibold text-white tabular-nums">
                      {b.balance.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-[#0ECB81] tabular-nums">
                      ≈ {formatCurrency(b.usdValue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Recent Settled FX Swaps</h3>
              {!custodyWallet?.fxSwaps.length ? (
                <p className="text-xs text-[#8B919E]">
                  No currency conversions executed yet. Preview a quote and execute an instant swap on the left.
                </p>
              ) : (
                <div className="divide-y divide-[#181A20]">
                  {custodyWallet.fxSwaps.map((sw) => (
                    <div key={sw.id} className="py-2.5 flex items-center justify-between text-xs font-mono tabular-nums">
                      <div>
                        <span className="font-semibold text-white">
                          {sw.fromAmount} {sw.fromCurrency} → {sw.toAmount} {sw.toCurrency}
                        </span>
                        <div className="text-[10px] font-sans text-[#8B919E]">
                          Rate {sw.rate} · {sw.rateSource} · {formatTimeShort(sw.createdAt)}
                        </div>
                      </div>
                      <span className="text-[#0ECB81] font-semibold">SETTLED</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WITHDRAWAL ALLOWLIST & SPEND VELOCITY LIMITS */}
      {activeTab === 'allowlist' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSaveVelocity}
              className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Spend Velocity &amp; Allowlist Policy</h2>
                <Lock className="w-4 h-4 text-[#F59E0B]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8B919E] mb-1">24h Daily Cap (USD)</label>
                  <input
                    type="number"
                    min="100"
                    value={dailyCapInput}
                    onChange={(e) => setDailyCapInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8B919E] mb-1">Single Tx Max (USD)</label>
                  <input
                    type="number"
                    min="50"
                    value={singleCapInput}
                    onChange={(e) => setSingleCapInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl bg-[#14161B] border border-[#24262C] text-xs cursor-pointer">
                <span className="text-white font-medium">
                  Enforce Strict Allowlist-Only Withdrawals
                </span>
                <input
                  type="checkbox"
                  checked={strictAllowlist}
                  onChange={(e) => setStrictAllowlist(e.target.checked)}
                  className="accent-[#F59E0B] w-4 h-4"
                />
              </label>

              {custodyWallet && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#8B919E]">
                    <span>24h Spent: {formatCurrency(custodyWallet.velocityPolicy.spentLast24hUsd)}</span>
                    <span>Cap: {formatCurrency(custodyWallet.velocityPolicy.dailyLimitUsd)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#14161B] overflow-hidden">
                    <div
                      className="h-full bg-[#F59E0B]"
                      style={{
                        width: `${Math.min(
                          100,
                          (custodyWallet.velocityPolicy.spentLast24hUsd /
                            Math.max(1, custodyWallet.velocityPolicy.dailyLimitUsd)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold"
              >
                Save Velocity Limits
              </button>
            </form>

            {/* Guarded Withdrawal Test / Execute */}
            <form
              onSubmit={handleWithdraw}
              className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3"
            >
              <h3 className="text-sm font-semibold text-white">Guarded On-Chain Withdrawal</h3>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={wdChain}
                  onChange={(e) => setWdChain(e.target.value as typeof wdChain)}
                  className="px-2.5 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                >
                  {(['BTC', 'ETH', 'SOL', 'ARB', 'BASE', 'MATIC', 'TRX'] as const).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  placeholder="Amount"
                  className="col-span-2 px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white tabular-nums"
                />
              </div>
              <input
                type="text"
                value={wdAddress}
                onChange={(e) => setWdAddress(e.target.value)}
                placeholder="Destination address (must match allowlist if strict mode enabled)"
                className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
              />
              <button
                type="submit"
                disabled={wdBusy}
                className="w-full py-2 rounded-xl bg-[#14161B] hover:bg-[#1D2028] border border-[#F59E0B]/50 text-[#F59E0B] text-xs font-semibold"
              >
                {wdBusy ? 'Verifying Allowlist & Velocity…' : 'Submit Guarded Withdrawal'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <form
              onSubmit={handleAddAllowlist}
              className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3"
            >
              <h3 className="text-sm font-semibold text-white">Register Verified Withdrawal Destination</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  value={alLabel}
                  onChange={(e) => setAlLabel(e.target.value)}
                  placeholder="Label (e.g. Trezor Safe)"
                  className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs text-white"
                />
                <select
                  value={alChain}
                  onChange={(e) => setAlChain(e.target.value as typeof alChain)}
                  className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                >
                  {(['BTC', 'ETH', 'SOL', 'ARB', 'BASE', 'MATIC', 'TRX'] as const).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={alAddress}
                  onChange={(e) => setAlAddress(e.target.value)}
                  placeholder="0x... or bc1q... address"
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                />
              </div>
              <button
                type="submit"
                disabled={alBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{alBusy ? 'Screening Threat & Checksum…' : 'Add to Allowlist'}</span>
              </button>
            </form>

            <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Owner-Locked Withdrawal Allowlist</h3>
              <div className="divide-y divide-[#181A20]">
                {(custodyWallet?.allowlist ?? []).map((entry) => (
                  <div key={entry.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#F59E0B]">{entry.chain}</span>
                        <span className="font-semibold text-white">{entry.label}</span>
                        <span className="text-[10px] font-mono text-[#0ECB81]">{entry.threatStatus}</span>
                      </div>
                      <div className="font-mono text-[11px] text-[#8B919E] truncate max-w-md">
                        {entry.address}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setWdAddress(entry.address)}
                        className="px-2.5 py-1 rounded-lg bg-[#14161B] border border-[#24262C] text-[11px] text-[#D1D5DB] hover:text-white"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleAllowlist(entry.id, !entry.enabled)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                          entry.enabled
                            ? 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/40'
                            : 'bg-[#14161B] text-[#8B919E] border border-[#24262C]'
                        }`}
                      >
                        {entry.enabled ? 'Enabled' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRemoveAllowlist(entry.id)}
                        className="p-1.5 rounded-lg text-[#8B919E] hover:text-[#F6465D]"
                        aria-label={`Remove ${entry.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: THREAT IP / ANTI-PHISHING & BIN LOOKUP */}
      {activeTab === 'threat-bin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Threat Scanner */}
          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
                <h2 className="text-sm font-semibold text-white">Threat IP, Phishing Domain &amp; Wallet Scanner</h2>
              </div>
              <span className="text-[11px] text-[#8B919E]">public-apis Intel</span>
            </div>

            <form onSubmit={handleThreatScan} className="flex gap-2">
              <input
                type="text"
                value={threatInput}
                onChange={(e) => setThreatInput(e.target.value)}
                placeholder="Enter IP (1.1.1.1), domain, URL, or 0x wallet"
                className="flex-1 px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
              />
              <button
                type="submit"
                disabled={threatBusy}
                className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold whitespace-nowrap"
              >
                {threatBusy ? 'Scanning…' : 'Scan Target'}
              </button>
            </form>

            {threatResult && (
              <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white">{threatResult.target}</span>
                  <span
                    className={`font-mono font-bold ${
                      threatResult.verdict === 'BLOCKED'
                        ? 'text-[#F6465D]'
                        : threatResult.verdict === 'SUSPICIOUS'
                        ? 'text-[#F59E0B]'
                        : 'text-[#0ECB81]'
                    }`}
                  >
                    {threatResult.verdict} (Risk {threatResult.riskScore}/100)
                  </span>
                </div>
                <div className="text-[11px] text-[#8B919E]">
                  Type: {threatResult.targetType.toUpperCase()} · {threatResult.asnOrRegistrar} · {threatResult.country}
                </div>
                <ul className="space-y-1 text-[#D1D5DB] list-disc list-inside">
                  {threatResult.indicators.map((ind, i) => (
                    <li key={i}>{ind}</li>
                  ))}
                </ul>
                <div className="text-[11px] text-[#F59E0B] pt-1 border-t border-[#24262C]">
                  {threatResult.recommendation}
                </div>
              </div>
            )}

            {threatHistory.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-[#8B919E]">Recent Scans</div>
                {threatHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#14161B] border border-[#24262C]">
                    <span className="font-mono text-white truncate max-w-[65%]">{item.target}</span>
                    <span
                      className={`font-mono font-semibold ${
                        item.verdict === 'BLOCKED'
                          ? 'text-[#F6465D]'
                          : item.verdict === 'SUSPICIOUS'
                          ? 'text-[#F59E0B]'
                          : 'text-[#0ECB81]'
                      }`}
                    >
                      {item.verdict} ({item.riskScore})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BIN Issuer Validation */}
          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#F59E0B]" />
                <h2 className="text-sm font-semibold text-white">Bank Card BIN / IIN Verification</h2>
              </div>
              <span className="text-[11px] text-[#8B919E]">6-8 Digit Prefix Only</span>
            </div>

            <form onSubmit={handleBinScan} className="flex gap-2">
              <input
                type="text"
                maxLength={8}
                value={binInput}
                onChange={(e) => setBinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="First 6-8 digits (e.g. 411111)"
                className="flex-1 px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white tabular-nums"
              />
              <button
                type="submit"
                disabled={binBusy}
                className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold whitespace-nowrap"
              >
                {binBusy ? 'Checking…' : 'Verify BIN'}
              </button>
            </form>

            {binResult && (
              <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white">
                    IIN {binResult.bin} · {binResult.scheme}
                  </span>
                  <span className={binResult.valid ? 'text-[#0ECB81] font-semibold' : 'text-[#F6465D] font-semibold'}>
                    {binResult.valid ? 'VALID ISSUER' : 'UNRECOGNIZED'} · {binResult.riskTier} RISK
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-[#090A0D] border border-[#24262C]">
                    <div className="text-[#8B919E]">Issuing Bank</div>
                    <div className="font-semibold text-white mt-0.5">{binResult.bankName}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#090A0D] border border-[#24262C]">
                    <div className="text-[#8B919E]">Country &amp; Currency</div>
                    <div className="font-semibold text-white mt-0.5">
                      {binResult.bankCountry} ({binResult.currency})
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  Type: {binResult.type.toUpperCase()} · Brand: {binResult.brand} · Source: {binResult.source}
                </div>
                <div className="text-[11px] text-[#0ECB81]">{binResult.notes}</div>
              </div>
            )}
          </div>

          {/* Public-APIs IP Intelligence & Geolocation */}
          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#0ECB81]" />
                <h2 className="text-sm font-semibold text-white">Public-APIs IP Geo, ASN &amp; VPN Intel</h2>
              </div>
              <span className="text-[11px] text-[#8B919E]">Edge Screening</span>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onLookupIpIntel) return;
                setIpLookupBusy(true);
                await onLookupIpIntel(ipLookupInput.trim());
                setIpLookupBusy(false);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={ipLookupInput}
                onChange={(e) => setIpLookupInput(e.target.value)}
                placeholder="IPv4/IPv6 address (e.g. 8.8.8.8)"
                className="flex-1 px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
              />
              <button
                type="submit"
                disabled={ipLookupBusy || !onLookupIpIntel}
                className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold whitespace-nowrap"
              >
                {ipLookupBusy ? 'Checking…' : 'Inspect IP'}
              </button>
            </form>
            {ipIntel && (
              <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-white">{ipIntel.ip}</span>
                  <span className={ipIntel.proxyOrVpnSuspected ? 'text-[#F6465D] font-semibold' : 'text-[#0ECB81] font-semibold'}>
                    Risk {ipIntel.riskScore}/100 · {ipIntel.proxyOrVpnSuspected ? 'PROXY/VPN' : 'CLEAN RESIDENTIAL'}
                  </span>
                </div>
                <div className="text-[11px] text-[#D1D5DB]">
                  {ipIntel.city}, {ipIntel.region}, {ipIntel.country} · {ipIntel.asn} ({ipIntel.isp})
                </div>
                <div className="text-[10px] font-mono text-[#8B919E]">Source: {ipIntel.source}</div>
              </div>
            )}
          </div>

          {/* Global Exchange Session Calendar */}
          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#F59E0B]" />
                <h2 className="text-sm font-semibold text-white">Global Market Sessions Calendar</h2>
              </div>
              <span className="text-[11px] text-[#8B919E]">Multi-Venue Status</span>
            </div>
            <div className="divide-y divide-[#181A20] text-xs">
              {marketSessions.length === 0 ? (
                <div className="py-4 text-[#8B919E]">Loading global market hours…</div>
              ) : (
                marketSessions.map((ms) => (
                  <div key={ms.exchange} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">
                        {ms.exchange} ({ms.country})
                      </div>
                      <div className="text-[11px] text-[#8B919E]">
                        {ms.openHoursLocal} · {ms.timezone} · {ms.assetFocus}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[11px] font-bold shrink-0 ${
                        ms.status === 'OPEN'
                          ? 'text-[#0ECB81]'
                          : ms.status === 'PRE_MARKET'
                          ? 'text-[#F59E0B]'
                          : 'text-[#8B919E]'
                      }`}
                    >
                      {ms.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: TOP-TIER 3-STAGE VERIFICATION (PROFILE -> DOCUMENT/LIVENESS -> BANK PENNY-DROP) */}
      {activeTab === 'verification' && (
        <div className="space-y-5">
          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-[#0ECB81]" />
                <h2 className="text-base font-bold text-white">
                  3-Stage Institutional Identity, Document &amp; Bank Verification
                </h2>
              </div>
              <p className="text-xs text-[#8B919E]">
                Current Tier: <strong className="text-[#F59E0B]">{topTierVerification?.overallTier ?? 'Unverified'}</strong>
                {topTierVerification?.reviewNote ? ` · ${topTierVerification.reviewNote}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
              <span className={topTierVerification?.profileVerified ? 'text-[#0ECB81]' : 'text-[#8B919E]'}>
                1. Profile: {topTierVerification?.profileVerified ? 'DONE' : 'PENDING'}
              </span>
              <span className={topTierVerification?.documentStatus === 'VERIFIED' ? 'text-[#0ECB81]' : 'text-[#F59E0B]'}>
                2. Doc/Liveness: {topTierVerification?.documentStatus ?? 'NOT_SUBMITTED'}
              </span>
              <span className={topTierVerification?.bankVerificationStatus === 'VERIFIED' ? 'text-[#0ECB81]' : 'text-[#F59E0B]'}>
                3. Bank Drop: {topTierVerification?.bankVerificationStatus ?? 'NOT_STARTED'}
              </span>
            </div>
          </div>

          {verError && (
            <div className="p-3 rounded-xl bg-[#F6465D]/10 border border-[#F6465D]/40 text-xs text-[#F6465D]">
              {verError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Stage 1: Profile */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onSubmitProfileStep) return;
                setVerError(null);
                setVerBusy(true);
                const res = await onSubmitProfileStep({ fullName: verFullName, country: verCountry });
                setVerBusy(false);
                if (!res.ok) setVerError(res.error ?? 'Profile verification failed.');
              }}
              className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Stage 1 · Profile &amp; Jurisdiction</h3>
                <span className={`text-[11px] font-mono font-bold ${topTierVerification?.profileVerified ? 'text-[#0ECB81]' : 'text-[#F59E0B]'}`}>
                  {topTierVerification?.profileVerified ? 'VERIFIED' : 'REQUIRED'}
                </span>
              </div>
              <div>
                <label className="block text-[11px] text-[#8B919E] mb-1">Legal Full Name / Entity</label>
                <input
                  type="text"
                  required
                  value={verFullName}
                  onChange={(e) => setVerFullName(e.target.value)}
                  placeholder="Full legal name"
                  className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#8B919E] mb-1">Country / Residency (ISO)</label>
                <input
                  type="text"
                  required
                  value={verCountry}
                  onChange={(e) => setVerCountry(e.target.value.toUpperCase())}
                  placeholder="IN, US, SG, AE, GB"
                  className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                />
              </div>
              <button
                type="submit"
                disabled={verBusy || !onSubmitProfileStep}
                className="w-full py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold"
              >
                Save &amp; Verify Stage 1 Profile
              </button>
            </form>

            {/* Stage 2: Document & Liveness */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onSubmitDocumentStep) return;
                setVerError(null);
                setVerBusy(true);
                const res = await onSubmitDocumentStep({
                  docType: verDocType,
                  docNumber: verDocNumber,
                  livenessSelfieConfirmed: verLivenessOk,
                });
                setVerBusy(false);
                if (!res.ok) setVerError(res.error ?? 'Document checksum failed.');
              }}
              className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Stage 2 · Document &amp; Liveness</h3>
                <span className={`text-[11px] font-mono font-bold ${topTierVerification?.documentStatus === 'VERIFIED' ? 'text-[#0ECB81]' : 'text-[#F59E0B]'}`}>
                  {topTierVerification?.documentStatus ?? 'NOT_SUBMITTED'}
                </span>
              </div>
              <div>
                <label className="block text-[11px] text-[#8B919E] mb-1">ID Document Type</label>
                <select
                  value={verDocType}
                  onChange={(e) => setVerDocType(e.target.value as KycDocumentType)}
                  className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs text-white"
                >
                  <option value="PASSPORT">Global Passport</option>
                  <option value="PAN">India PAN Card</option>
                  <option value="AADHAAR">India Aadhaar</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                  <option value="SSN_LAST4">US National ID</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#8B919E] mb-1">Document ID Number</label>
                <input
                  type="text"
                  required
                  value={verDocNumber}
                  onChange={(e) => setVerDocNumber(e.target.value)}
                  placeholder={topTierVerification?.maskedDocument || 'Enter valid ID number'}
                  className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#D1D5DB] cursor-pointer">
                <input
                  type="checkbox"
                  checked={verLivenessOk}
                  onChange={(e) => setVerLivenessOk(e.target.checked)}
                  className="accent-[#0ECB81]"
                />
                <span>Biometric selfie liveness check completed</span>
              </label>
              <button
                type="submit"
                disabled={verBusy || !onSubmitDocumentStep}
                className="w-full py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold"
              >
                Verify Document Checksum
              </button>
            </form>

            {/* Stage 3: Bank Penny-Drop Micro-Deposit */}
            <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Stage 3 · Bank Penny-Drop</h3>
                <span className={`text-[11px] font-mono font-bold ${topTierVerification?.bankVerificationStatus === 'VERIFIED' ? 'text-[#0ECB81]' : 'text-[#F59E0B]'}`}>
                  {topTierVerification?.bankVerificationStatus ?? 'NOT_STARTED'}
                </span>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!onInitiateBankStep) return;
                  setVerError(null);
                  setVerBusy(true);
                  const res = await onInitiateBankStep({ bankName: verBankName, accountNumber: verBankAcct });
                  setVerBusy(false);
                  if (!res.ok) setVerError(res.error ?? 'Failed to initiate penny-drop.');
                }}
                className="space-y-2.5"
              >
                <input
                  type="text"
                  required
                  value={verBankName}
                  onChange={(e) => setVerBankName(e.target.value)}
                  placeholder="Bank Name"
                  className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs text-white"
                />
                <input
                  type="text"
                  required
                  value={verBankAcct}
                  onChange={(e) => setVerBankAcct(e.target.value)}
                  placeholder={topTierVerification?.bankMaskedAcct || 'Account / IBAN number'}
                  className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  disabled={verBusy || !onInitiateBankStep}
                  className="w-full py-2 rounded-xl bg-[#14161B] hover:bg-[#1D2028] border border-[#F59E0B]/50 text-[#F59E0B] text-xs font-semibold"
                >
                  Send 2 Micro-Deposits
                </button>
              </form>

              {topTierVerification?.bankMicroDepositHint && (
                <div className="p-2.5 rounded-lg bg-[#0ECB81]/10 border border-[#0ECB81]/30 text-[11px] font-mono text-[#0ECB81]">
                  Sandbox Bank Statement Notice: {topTierVerification.bankMicroDepositHint}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!onVerifyBankStep) return;
                  setVerError(null);
                  const d1 = Number.parseInt(verDep1, 10);
                  const d2 = Number.parseInt(verDep2, 10);
                  if (!Number.isFinite(d1) || !Number.isFinite(d2)) {
                    setVerError('Enter both micro-deposit cent values.');
                    return;
                  }
                  setVerBusy(true);
                  const res = await onVerifyBankStep({ deposit1Cents: d1, deposit2Cents: d2 });
                  setVerBusy(false);
                  if (!res.ok) setVerError(res.error ?? 'Micro-deposit verification failed.');
                }}
                className="pt-2 border-t border-[#24262C] space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={verDep1}
                    onChange={(e) => setVerDep1(e.target.value)}
                    placeholder="Cents #1"
                    className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={verDep2}
                    onChange={(e) => setVerDep2(e.target.value)}
                    placeholder="Cents #2"
                    className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={verBusy || !onVerifyBankStep}
                  className="w-full py-2 rounded-xl bg-[#0ECB81] hover:bg-[#0bb572] text-[#090A0C] text-xs font-semibold"
                >
                  Confirm Penny-Drop Amounts
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB: REA CRYPTOGRAPHIC LEDGER & NEW COIN LAUNCHPAD */}
      {activeTab === 'rea-launchpad' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 cols: REA Ledger Explorer */}
          <div className="lg:col-span-7 bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0ECB81]" />
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    REA Double-Entry Cryptographic Ledger (Resources · Events · Agents)
                  </h2>
                  <p className="text-[11px] text-[#8B919E]">
                    Balanced dual-agent accounting invariant with SHA-256 hash chaining on every deposit, FX swap, trade &amp; token mint.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className={reaLedger?.chainValid ? 'text-[#0ECB81] font-bold' : 'text-[#F6465D] font-bold'}>
                  {reaLedger?.chainValid ? 'CHAIN VALID' : 'VERIFYING'}
                </span>
                <span className="text-[#8B919E]">
                  {reaLedger?.totalBalancedEvents ?? 0} Balanced
                </span>
              </div>
            </div>

            {/* Resources Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
              {(reaLedger?.resources ?? []).slice(0, 8).map((res) => (
                <div key={res.symbol} className="p-2.5 rounded-xl bg-[#14161B] border border-[#24262C]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{res.symbol}</span>
                    <span className="text-[10px] text-[#F59E0B]">{res.resourceType}</span>
                  </div>
                  <div className="text-[11px] text-[#0ECB81] mt-1">
                    Units: {formatCompactNumber(res.totalLedgerUnits)}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-[11px] font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-[#24262C] text-[#8B919E]">
                    <th className="py-2 pr-2">Event</th>
                    <th className="py-2 px-2">Resource</th>
                    <th className="py-2 px-2">Give → Take Agent</th>
                    <th className="py-2 px-2 text-right">USD Value</th>
                    <th className="py-2 pl-2 text-right">Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181A20]">
                  {(reaLedger?.events ?? []).slice(0, 15).map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2 pr-2 font-semibold text-white">{ev.eventType}</td>
                      <td className="py-2 px-2 text-[#F59E0B]">{ev.resourceSymbol}</td>
                      <td className="py-2 px-2 text-[#D1D5DB]">
                        {ev.giveAgentId} → {ev.takeAgentId}
                      </td>
                      <td className="py-2 px-2 text-right text-[#0ECB81]">
                        {formatCurrency(ev.usdNotional)}
                      </td>
                      <td className="py-2 pl-2 text-right text-[#8B919E]">
                        {ev.entryHash.slice(0, 10)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 5 cols: Verified New Coin Registration & Launchpad */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onSubmitCoinLaunch) return;
                setLaunchError(null);
                const price = Number.parseFloat(launchPrice);
                const supply = Number.parseFloat(launchSupply);
                if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(supply) || supply <= 0) {
                  setLaunchError('Enter valid positive price and supply.');
                  return;
                }
                setLaunchBusy(true);
                const res = await onSubmitCoinLaunch({
                  name: launchName.trim(),
                  symbol: launchSymbol.trim().toUpperCase(),
                  chain: launchChain,
                  contractAddress: launchContract.trim(),
                  initialPriceUsd: price,
                  totalSupply: supply,
                  whitepaperSummary: launchSummary.trim(),
                });
                setLaunchBusy(false);
                if (!res.ok) {
                  setLaunchError(res.error ?? 'Coin launch rejected.');
                } else {
                  setLaunchName('');
                  setLaunchSymbol('');
                  setLaunchSummary('');
                }
              }}
              className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-sm font-semibold text-white">New Coin Registration &amp; Launchpad</h3>
                </div>
                <span className="text-[10px] font-mono text-[#0ECB81]">Admin 1-Click Mint</span>
              </div>

              {launchError && (
                <div className="p-2.5 rounded-xl bg-[#F6465D]/10 border border-[#F6465D]/40 text-xs text-[#F6465D]">
                  {launchError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={launchName}
                  onChange={(e) => setLaunchName(e.target.value)}
                  placeholder="Token Name (e.g. Nuvra AI)"
                  className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs text-white"
                />
                <input
                  type="text"
                  required
                  value={launchSymbol}
                  onChange={(e) => setLaunchSymbol(e.target.value.toUpperCase())}
                  placeholder="Ticker (e.g. NUVX-USD)"
                  className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={launchChain}
                  onChange={(e) => setLaunchChain(e.target.value as CoinLaunchSubmission['chain'])}
                  className="px-2.5 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                >
                  {(['ETH', 'BASE', 'SOL', 'ARB', 'MATIC', 'BTC', 'TRX'] as const).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={launchPrice}
                  onChange={(e) => setLaunchPrice(e.target.value)}
                  placeholder="Init Price USD"
                  className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                />
                <input
                  type="number"
                  step="any"
                  min="100"
                  required
                  value={launchSupply}
                  onChange={(e) => setLaunchSupply(e.target.value)}
                  placeholder="Total Supply"
                  className="px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
                />
              </div>

              <input
                type="text"
                required
                value={launchContract}
                onChange={(e) => setLaunchContract(e.target.value)}
                placeholder="Verified Smart Contract Address (screened against Threat DB)"
                className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-white"
              />

              <textarea
                rows={2}
                required
                value={launchSummary}
                onChange={(e) => setLaunchSummary(e.target.value)}
                placeholder="Tokenomics, reserve backing & audit summary (min 15 chars)..."
                className="w-full px-3 py-2 rounded-xl bg-[#14161B] border border-[#24262C] text-xs text-white"
              />

              <button
                type="submit"
                disabled={launchBusy || !onSubmitCoinLaunch}
                className="w-full py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold"
              >
                {launchBusy ? 'Screening Contract & Ticker…' : 'Submit Verified Coin Proposal'}
              </button>
            </form>

            <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-white">Launchpad Directory ({coinLaunches.length})</h4>
                <Coins className="w-3.5 h-3.5 text-[#F59E0B]" />
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {coinLaunches.length === 0 ? (
                  <div className="text-[#8B919E] py-2">No token proposals submitted yet.</div>
                ) : (
                  coinLaunches.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-[#14161B] border border-[#24262C] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-white truncate">
                          {item.symbol} · {item.name} ({item.chain})
                        </div>
                        <div className="text-[10px] text-[#8B919E] font-mono truncate">
                          Threat: {item.threatVerdict} · ${item.initialPriceUsd} · REA {item.reaReserveMinted ? 'MINTED' : 'PENDING'}
                        </div>
                      </div>
                      <span
                        className={`font-mono text-[10px] font-bold shrink-0 ${
                          item.status === 'APPROVED_LISTED'
                            ? 'text-[#0ECB81]'
                            : item.status === 'REJECTED'
                            ? 'text-[#F6465D]'
                            : 'text-[#F59E0B]'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: VIBE-SECURITY-SKILL LIVE AUDITOR + GEMINI 4 HYDROGEN ANALYSIS */}
      {activeTab === 'auditor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  vibe-security-skill Live Code &amp; Runtime Auditor
                </h2>
                <p className="text-[11px] text-[#8B919E]">
                  Continuous validation across Secrets, Auth, Anti-IDOR, SQL Safety, Rate Limits &amp; HTTP Security Headers.
                </p>
              </div>
              <button
                type="button"
                disabled={auditBusy}
                onClick={async () => {
                  setAuditBusy(true);
                  await onRunVibeAudit();
                  setAuditBusy(false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{auditBusy ? 'Auditing…' : 'Run Live Security Audit'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  'ALL',
                  'Secrets & Env Hygiene',
                  'Auth & Session Hardening',
                  'RBAC & Anti-IDOR Guards',
                  'Input Validation & SQL Safety',
                  'API Auth & Rate Limiting',
                  'Security Headers & Encryption',
                ] as const
              ).map((dom) => (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setDomainFilter(dom)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                    domainFilter === dom
                      ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-[#F59E0B]'
                      : 'bg-[#14161B] border-[#24262C] text-[#8B919E] hover:text-white'
                  }`}
                >
                  {dom}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {filteredChecks.map((chk) => (
                <div key={chk.id} className="p-3.5 rounded-xl bg-[#14161B] border border-[#24262C] space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-white">
                      {chk.status === 'PASS' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#0ECB81] shrink-0" />
                      ) : chk.status === 'WARN' ? (
                        <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#F6465D] shrink-0" />
                      )}
                      <span>{chk.ruleTitle}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#8B919E] shrink-0">
                      {chk.domain} · {chk.severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#D1D5DB]">{chk.evidence}</div>
                  <div className="text-[11px] text-[#8B919E]">Fix: {chk.remediation}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gemini 4 Hydrogen Enterprise Risk & Remediation Console */}
          <div className="lg:col-span-5 bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="text-sm font-semibold text-white">Gemini 4 Hydrogen Risk &amp; Security Engine</h3>
              </div>
              <span className="text-[10px] font-mono text-[#8B919E]">Thinking HIGH</span>
            </div>

            <p className="text-xs text-[#8B919E]">
              Server-side structured analysis of your live custody portfolio, threat intelligence scans, or vibe-security audit findings.
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void handleRunGemini('wallet_risk')}
                className={`p-3 rounded-xl border text-left text-xs transition-colors ${
                  aiMode === 'wallet_risk'
                    ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white'
                    : 'bg-[#14161B] border-[#24262C] text-[#D1D5DB]'
                }`}
              >
                <div className="font-semibold">Analyze Custody &amp; Velocity Exposure</div>
                <div className="text-[11px] text-[#8B919E]">Evaluate multi-chain balances, allowlist &amp; 24h cap</div>
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void handleRunGemini('threat_triage')}
                className={`p-3 rounded-xl border text-left text-xs transition-colors ${
                  aiMode === 'threat_triage'
                    ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white'
                    : 'bg-[#14161B] border-[#24262C] text-[#D1D5DB]'
                }`}
              >
                <div className="font-semibold">Triage Threat IP &amp; BIN Intel</div>
                <div className="text-[11px] text-[#8B919E]">Assess phishing indicators &amp; card issuer risk</div>
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void handleRunGemini('security_remediation')}
                className={`p-3 rounded-xl border text-left text-xs transition-colors ${
                  aiMode === 'security_remediation'
                    ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white'
                    : 'bg-[#14161B] border-[#24262C] text-[#D1D5DB]'
                }`}
              >
                <div className="font-semibold">Generate Security Remediation Plan</div>
                <div className="text-[11px] text-[#8B919E]">Prioritize fixes from live vibe-security audit</div>
              </button>
            </div>

            {aiBusy && (
              <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] text-xs font-mono text-[#F59E0B]">
                Executing Gemini 4 Hydrogen Deep Reasoning…
              </div>
            )}

            {aiError && (
              <div className="p-4 rounded-xl bg-[#F6465D]/10 border border-[#F6465D]/40 text-xs text-[#F6465D]">
                {aiError}
              </div>
            )}

            {aiResult && !aiBusy && (
              <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">{aiResult.verdict}</span>
                  <span
                    className={`font-mono font-bold ${
                      aiResult.riskLevel === 'CRITICAL' || aiResult.riskLevel === 'HIGH'
                        ? 'text-[#F6465D]'
                        : aiResult.riskLevel === 'MODERATE'
                        ? 'text-[#F59E0B]'
                        : 'text-[#0ECB81]'
                    }`}
                  >
                    {aiResult.riskLevel}
                  </span>
                </div>
                <p className="text-[#D1D5DB] leading-relaxed">{aiResult.summary}</p>
                {aiResult.keyFindings.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-white mb-1">Key Findings</div>
                    <ul className="space-y-1 text-[11px] text-[#9CA3AF] list-disc list-inside">
                      {aiResult.keyFindings.map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiResult.actionPlan.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[#F59E0B] mb-1">Action Plan</div>
                    <ul className="space-y-1 text-[11px] text-[#D1D5DB] list-decimal list-inside">
                      {aiResult.actionPlan.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
