import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CandlestickChart,
  Clock,
  Cpu,
  CreditCard,
  Database,
  Globe,
  HelpCircle,
  Home,
  Keyboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TrendingUp,
  User,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useMarketSocket } from './hooks/useMarketSocket';
import { AuthScreen } from './components/AuthScreen';
import { BrandMark } from './components/BrandMark';
import { HomePortfolioView } from './components/HomePortfolioView';
import { MarketChart } from './components/MarketChart';
import { OrderBookPanel } from './components/OrderBookPanel';
import { OrderTicket } from './components/OrderTicket';
import { OverviewSignalsView } from './components/OverviewSignalsView';
import { PortfolioAnalyticsView } from './components/PortfolioAnalyticsView';
import {
  AurexCardView,
  ExchangeActivityView,
  PredictMarketsView,
} from './components/PredictCardActivityViews';
import { ScreenerView } from './components/ScreenerView';
import { NewsSentimentView } from './components/NewsSentimentView';
import { MarketGuideView } from './components/MarketGuideView';
import { AgentsCommandView } from './components/AgentsCommandView';
import { SmartBotsView } from './components/SmartBotsView';
import { GlobalMonitorView } from './components/GlobalMonitorView';
import { SecurityVaultView } from './components/SecurityVaultView';
import { AdminConsoleView } from './components/AdminConsoleView';
import { InvestorProfilesView } from './components/InvestorProfilesView';
import { UserProfileView } from './components/UserProfileView';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { LegalModal } from './components/LegalModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import {
  formatCompactNumber,
  formatCurrency,
  formatPrice,
  formatTimeShort,
} from './utils/format';
import type { ChartTimeframe, Position } from './types/market';

type WorkspaceView =
  | 'home'
  | 'screener'
  | 'terminal'
  | 'analytics'
  | 'predict'
  | 'card'
  | 'activity'
  | 'agents'
  | 'bots'
  | 'monitor'
  | 'overview'
  | 'investors'
  | 'profile'
  | 'vault'
  | 'guide'
  | 'admin';

const FOUNDER_EMAIL = 'vemulavankeswararao@gmail.com';
const WATCHLIST_STORAGE_KEY = 'aurex_watchlist_v1';

const WATCHLIST_SYMBOLS = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'XRP-USD',
  'NVDA',
  'RELIANCE.NS',
  'USD-INR',
  'XAU-USD',
];

export default function App() {
  const {
    connected,
    loading,
    authChecking,
    authUser,
    authSessions,
    passkeys,
    oauthProviders,
    oauthDiagnostics,
    authServerStatus,
    skills,
    pendingMfa,
    engineMetrics,
    instruments,
    predictions,
    patterns,
    insights,
    news,
    activeSymbol,
    activeTimeframe,
    candles,
    orderBook,
    recentTrades,
    accountMode,
    cashBalance,
    demoCashBalance,
    realCashBalance,
    vaultBalanceUsd,
    orders,
    positions,
    alerts,
    nexusReport,
    agentLeaderboard,
    globalMonitor,
    promoProfile,
    bankAccounts,
    vaultTransfers,
    firewallIncidents,
    securityStatus,
    toasts,
    dismissToast,
    selectSymbol,
    selectTimeframe,
    placeOrder,
    cancelOrder,
    createAlert,
    deleteAlert,
    resetPortfolio,
    evaluateNexusAgents,
    executeNexusTrade,
    switchAccountMode,
    transferVaultShield,
    toggleLockdown,
    verifyVaultChain,
    requestVaultChallenge,
    linkBankAccount,
    submitVaultTransfer,
    runWafProbe,
    loginAccount,
    verifyMfaCode,
    clearPendingMfa,
    registerNewAccount,
    logoutAccount,
    revokeOtherSessions,
    updateUserPrefs,
    setupTotp,
    confirmTotp,
    disableTotp,
    enrollPasskey,
    removePasskey,
    loginWithPasskey,
    startOAuthLogin,
    checkAuthServerHealth,
    loginWithPrivateGitHubServer,
    runPlatformSkill,
    toggleRealMoneyMode,
    adminOverview,
    adminUsers,
    adminAuthEvents,
    fetchAdminTelemetry,
    revokeAdminUserSessions,
    askAiAssistant,
    fetchAgentLeaderboard,
    fetchGlobalMonitor,
    connectors,
    refreshConnectors,
    redeemPromoCode,
    recordPromoShare,
    kycRecord,
    submitKyc,
    investorProfiles,
    followInvestorProfile,
    publishInvestorProfile,
    scamReports,
    submitScamReport,
    countryGuidelines,
    bankDirectory,
    nextMoveRadar,
    refreshNewsRadar,
    networkTelemetry,
    fetchNetworkTelemetry,
    verifyNetworkEnvelope,
    diagnosticsReport,
    fetchDiagnostics,
    solveDiagnosticIssue,
    defenseAgents,
    fetchDefenseAgents,
    bots,
    fetchBots,
    createBot,
    toggleBot,
    deleteBot,
    rewardsState,
    socialGraph,
    fetchRewardsAndSocial,
    claimQuestReward,
    founderAiTeam,
    runFounderAiReview,
    applyFounderAiProposal,
    adminRewards,
    createAdminRewardCampaign,
    toggleAdminRewardCampaign,
    grantAdminReward,
    enterpriseSecurity,
    trustDevice,
    revokeDevice,
    signHsmAttestation,
    rotateHsmSlot,
    submitBugBounty,
    runAutomatedPentest,
    downloadSanitizedPolicyBundle,
    exchangeFeatures,
    fetchServerPortfolioAnalytics,
    stakeAsset,
    unstakeAsset,
    placePrediction,
    settlePrediction,
    toggleCardFreeze,
    updateCardConfig,
    spendWithCard,
  } = useMarketSocket();

  const [view, setView] = useState<WorkspaceView>('home');
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((s): s is string => typeof s === 'string');
        }
      }
    } catch {
      // ignore storage failure
    }
    return WATCHLIST_SYMBOLS;
  });
  const toggleWatchlistSymbol = (sym: string) => {
    setWatchlistSymbols((prev) => {
      const next = prev.includes(sym) ? prev.filter((s) => s !== sym) : [sym, ...prev].slice(0, 24);
      try {
        window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
  const [signalsSubTab, setSignalsSubTab] = useState<'signals' | 'agents' | 'news'>('signals');
  const [darkMode, setDarkMode] = useState(true);
  const [guideMode, setGuideMode] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'disclosure' | null>(null);
  const [mobileTerminalTab, setMobileTerminalTab] = useState<'ticket' | 'book'>('ticket');
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const isFounderAdmin =
    Boolean(authUser?.isAdmin) &&
    authUser?.email.trim().toLowerCase() === FOUNDER_EMAIL;

  useEffect(() => {
    if (authUser) {
      setGuideMode(authUser.experienceMode === 'newbie');
      if (view === 'admin' && !isFounderAdmin) {
        setView('terminal');
      }
    }
  }, [authUser, isFounderAdmin, view]);

  const [selectedBookPrice, setSelectedBookPrice] = useState<number | null>(null);
  const [orderShortcutTrigger, setOrderShortcutTrigger] = useState<{
    side: 'buy' | 'sell';
    nonce: number;
  } | null>(null);
  const [aiTargetTrigger, setAiTargetTrigger] = useState<{
    takeProfit: number;
    stopLoss: number;
    nonce: number;
  } | null>(null);
  const [blotterTab, setBlotterTab] = useState<'positions' | 'orders' | 'history' | 'alerts'>(
    'positions'
  );

  // Quick Alert Modal state
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [modalAlertSymbol, setModalAlertSymbol] = useState('NVDA');
  const [modalAlertCondition, setModalAlertCondition] = useState<'above' | 'below'>('above');
  const [modalAlertPrice, setModalAlertPrice] = useState('');
  const [modalAlertNote, setModalAlertNote] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChartFullscreen(false);
        setShortcutsOpen(false);
        setAlertModalOpen(false);
        setMobileNavOpen(false);
        setAiAssistantOpen(false);
        setLegalTab(null);
        setSelectedBookPrice(null);
        window.getSelection()?.removeAllRanges();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (alertModalOpen || aiAssistantOpen || legalTab || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTypingTarget) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (shortcutsOpen) {
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === 'f') {
        e.preventDefault();
        setView('terminal');
        setChartFullscreen((prev) => !prev);
        return;
      }

      const quickTfMap: Record<string, ChartTimeframe> = {
        '1': '1m',
        '2': '5m',
        '3': '15m',
        '4': '1h',
        '5': '1D',
      };
      if (quickTfMap[e.key]) {
        e.preventDefault();
        setView('terminal');
        void selectTimeframe(quickTfMap[e.key]);
        return;
      }

      if (lower === 'b' || lower === 's') {
        e.preventDefault();
        setChartFullscreen(false);
        setView('terminal');
        setMobileTerminalTab('ticket');
        setMobileNavOpen(false);
        setOrderShortcutTrigger({
          side: lower === 'b' ? 'buy' : 'sell',
          nonce: Date.now() + Math.random(),
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [alertModalOpen, aiAssistantOpen, legalTab, shortcutsOpen, selectTimeframe]);

  const activeInstrument = useMemo(
    () => instruments.find((i) => i.symbol === activeSymbol) ?? instruments[0],
    [activeSymbol, instruments]
  );

  const activePrediction = predictions[activeSymbol];
  const activePosition = positions.find((p) => p.symbol === activeSymbol);

  const telemetryVolatility = useMemo(() => {
    const predAtr = activePrediction?.atr24h;
    const predAtrPct = activePrediction?.atrPct;
    const predVol = activePrediction?.realizedVol24hPct;
    if (typeof predAtr === 'number' && typeof predVol === 'number') {
      return {
        atr24h: predAtr,
        atrPct: predAtrPct ?? (activeInstrument ? (predAtr / Math.max(activeInstrument.price, 1e-8)) * 100 : 0),
        realizedVolPct: predVol,
      };
    }
    if (candles.length < 3 || !activeInstrument) {
      return null;
    }
    const trs: number[] = [];
    const rets: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prevClose = candles[i - 1].close;
      trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
      if (prevClose > 0 && c.close > 0) rets.push(Math.log(c.close / prevClose));
    }
    const atrSlice = trs.slice(-14);
    const atr24h = atrSlice.length ? atrSlice.reduce((a, b) => a + b, 0) / atrSlice.length : 0;
    const atrPct = activeInstrument.price > 0 ? (atr24h / activeInstrument.price) * 100 : 0;
    const meanRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
    const variance = rets.length > 1 ? rets.reduce((a, r) => a + (r - meanRet) ** 2, 0) / (rets.length - 1) : 0;
    const realizedVolPct = Math.sqrt(variance) * Math.sqrt(1440) * 100;
    return { atr24h, atrPct, realizedVolPct };
  }, [activeInstrument, activePrediction, candles]);

  const openTerminalForSymbol = (symbol: string) => {
    selectSymbol(symbol);
    setSelectedBookPrice(null);
    setView('terminal');
    setMobileNavOpen(false);
  };

  const openAlertModal = (symbol: string, targetPrice?: number) => {
    const inst = instruments.find((i) => i.symbol === symbol);
    const base = targetPrice ?? inst?.price ?? 100;
    setModalAlertSymbol(symbol);
    setModalAlertPrice(String(base));
    setModalAlertCondition('above');
    setModalAlertNote('');
    setAlertModalOpen(true);
  };

  const submitAlertModal = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseFloat(modalAlertPrice);
    if (!Number.isFinite(num) || num <= 0) return;
    createAlert({
      symbol: modalAlertSymbol,
      condition: modalAlertCondition,
      targetPrice: num,
      note: modalAlertNote.trim() || undefined,
    });
    setAlertModalOpen(false);
  };

  const handleClosePosition = (pos: Position) => {
    if (Math.abs(pos.size) < 1e-6) return;
    placeOrder({
      symbol: pos.symbol,
      side: pos.size > 0 ? 'sell' : 'buy',
      type: 'market',
      size: Math.abs(pos.size),
    });
  };

  const navItems: Array<{ id: WorkspaceView; label: string; icon: typeof Activity }> = [
    { id: 'home', label: 'Portfolio Home', icon: Home },
    { id: 'screener', label: 'Markets & Heatmap', icon: SlidersHorizontal },
    { id: 'terminal', label: 'Trade Terminal', icon: CandlestickChart },
    { id: 'analytics', label: 'Portfolio Analytics', icon: BarChart3 },
    { id: 'predict', label: 'Predict & Stake', icon: Sparkles },
    { id: 'card', label: 'Aurex Card', icon: CreditCard },
    { id: 'activity', label: 'Activity Ledger', icon: Clock },
    { id: 'agents', label: 'AI Agents', icon: Bot },
    { id: 'bots', label: 'Smart Bots', icon: Cpu },
    { id: 'monitor', label: 'Global Monitor', icon: Globe },
    { id: 'overview', label: 'AI Signals & News', icon: Activity },
    { id: 'investors', label: 'Investors & KYC', icon: UserCheck },
    { id: 'profile', label: 'Profile & Verify', icon: User },
    { id: 'vault', label: 'Wallet & Vault', icon: Wallet },
    { id: 'guide', label: 'Help & Rules', icon: HelpCircle },
    ...(isFounderAdmin
      ? [{ id: 'admin' as WorkspaceView, label: 'Founder Admin', icon: Database }]
      : []),
  ];

  const activeViewTitle = navItems.find((n) => n.id === view)?.label ?? 'Portfolio Home';

  const openOrders = orders.filter((o) => o.status === 'open');
  const filledOrders = orders.filter((o) => o.status !== 'open');

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0E11] text-slate-600 dark:text-[#EAECEF] text-xs font-mono">
        Verifying encrypted session &amp; warming exchange feed…
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        <AuthScreen
          instruments={instruments}
          engineMetrics={engineMetrics}
          darkMode={darkMode}
          oauthProviders={oauthProviders}
          oauthDiagnostics={oauthDiagnostics}
          authServerStatus={authServerStatus}
          pendingMfa={pendingMfa}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onCheckAuthServer={checkAuthServerHealth}
          onPrivateGitHubSignIn={loginWithPrivateGitHubServer}
          onLogin={loginAccount}
          onVerifyMfa={verifyMfaCode}
          onClearPendingMfa={clearPendingMfa}
          onPasskeyLogin={loginWithPasskey}
          onStartOAuth={startOAuthLogin}
          onRegister={registerNewAccount}
        />
        {toasts.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] shadow-lg text-xs"
              >
                <div>
                  <div
                    className={`font-semibold ${
                      toast.tone === 'positive'
                        ? 'text-[#0ECB81]'
                        : toast.tone === 'negative'
                        ? 'text-[#F6465D]'
                        : 'text-[#F0B90B]'
                    }`}
                  >
                    {toast.title}
                  </div>
                  <div className="mt-0.5 text-slate-600 dark:text-[#B7BDC6]">
                    {toast.detail}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0e0e0e] text-slate-900 dark:text-[#EAECEF]">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[232px] shrink-0 flex flex-col bg-white dark:bg-[#090A0D] border-r border-slate-200 dark:border-[#24262C] transition-transform duration-200 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Zone */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 dark:border-[#24262C] shrink-0">
          <button
            type="button"
            onClick={() => setView('home')}
            className="text-left whitespace-nowrap shrink-0"
            aria-label="Aurex Global Exchange Home"
          >
            <BrandMark size="sm" showWordmark />
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[56vh]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#F59E0B] text-[#090A0C]'
                    : 'text-slate-600 dark:text-[#8B919E] hover:bg-slate-100 dark:hover:bg-[#191B22] hover:text-slate-900 dark:hover:text-[#EAECEF]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live Watchlist Quick-Switch */}
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-slate-200 dark:border-[#24262C]">
          <div className="px-2 py-1.5 text-[11px] font-medium text-slate-500 dark:text-[#848E9C]">
            Quick Markets
          </div>
          <div className="space-y-0.5">
            {watchlistSymbols.map((sym) => {
              const inst = instruments.find((i) => i.symbol === sym);
              const isSelected = activeSymbol === sym;
              const isPos = (inst?.changePct ?? 0) >= 0;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => openTerminalForSymbol(sym)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                      : 'hover:bg-slate-50 dark:hover:bg-[#2B3139]/40 text-slate-700 dark:text-[#B7BDC6]'
                  }`}
                >
                  <div className="text-left min-w-0">
                    <div className="font-mono font-semibold truncate">{sym}</div>
                    <div className="text-[10px] text-slate-500 dark:text-[#848E9C] truncate">
                      {inst?.venue ?? '—'}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-medium">
                      {inst ? formatPrice(inst.price, sym) : '—'}
                    </div>
                    <div className={`text-[10px] ${isPos ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                      {inst ? `${isPos ? '+' : ''}${inst.changePct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-[#2B3139] space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => {
                setView('profile');
                setMobileNavOpen(false);
              }}
              className="flex items-center gap-2 min-w-0 text-left hover:opacity-85 transition-opacity"
            >
              <User className="w-3.5 h-3.5 text-[#F0B90B] shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-[#EAECEF] truncate">
                  {authUser.name}
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-[#848E9C] truncate">
                  {authUser.email}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void logoutAccount()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-500 hover:text-[#F6465D] shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#848E9C]">
              <Radio className={`w-3.5 h-3.5 ${connected ? 'text-[#0ECB81]' : 'text-[#F0B90B]'}`} />
              <span>{connected ? 'Live' : 'Syncing'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = !guideMode;
                  setGuideMode(next);
                  void updateUserPrefs({ experienceMode: next ? 'newbie' : 'pro' });
                }}
                className={`px-2 py-1 text-[11px] font-medium rounded-md border whitespace-nowrap transition-colors ${
                  guideMode
                    ? 'border-[#F0B90B]/40 bg-[#F0B90B]/10 text-[#B45309] dark:text-[#F0B90B]'
                    : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                Guide {guideMode ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-1.5 rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#B7BDC6] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 bg-white/95 dark:bg-[#090A0D]/95 backdrop-blur-sm border-b border-slate-200 dark:border-[#24262C]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#B7BDC6]"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0 truncate">
              <span className="font-semibold text-slate-900 dark:text-[#EAECEF] whitespace-nowrap">
                {activeViewTitle}
              </span>
              {activeInstrument && (
                <span className="hidden md:inline text-xs font-mono tabular-nums text-slate-500 dark:text-[#848E9C] truncate">
                  · {activeInstrument.symbol} {formatPrice(activeInstrument.price, activeInstrument.symbol)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden xl:block">
              <PWAInstallButton compact />
            </div>

            {/* Instant Demo vs Real Account Switcher */}
            <div className="flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px] font-mono">
              <button
                type="button"
                onClick={() => void switchAccountMode('demo')}
                className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                  accountMode === 'demo'
                    ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF] font-semibold'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                Demo {formatCurrency(demoCashBalance)}
              </button>
              <button
                type="button"
                onClick={() => void switchAccountMode('real')}
                className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                  accountMode === 'real'
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                Real {formatCurrency(realCashBalance)}
              </button>
            </div>

            {/* Cold Vault Quick Button */}
            <button
              type="button"
              onClick={() => setView('vault')}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors ${
                securityStatus.lockdownMode
                  ? 'border-[#F6465D]/50 bg-[#F6465D]/10 text-[#F6465D]'
                  : 'border-[#0ECB81]/40 bg-[#0ECB81]/10 text-[#059669] dark:text-[#0ECB81]'
              }`}
              title="Open Cold Vault Shield & UPI/Bank Deposits"
            >
              {securityStatus.lockdownMode ? (
                <Lock className="w-3 h-3" />
              ) : (
                <ShieldCheck className="w-3 h-3" />
              )}
              <span>Vault {formatCurrency(vaultBalanceUsd)}</span>
            </button>

            <button
              type="button"
              onClick={() => setView('profile')}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors ${
                kycRecord?.status === 'VERIFIED' && bankAccounts.length > 0
                  ? 'border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#2B3139]'
                  : 'border-[#F0B90B]/50 bg-[#F0B90B]/10 text-[#B45309] dark:text-[#F0B90B]'
              }`}
              title="Open Profile & Onboarding Verification Center"
            >
              <User className="w-3 h-3" />
              <span>
                {kycRecord?.status === 'VERIFIED' && bankAccounts.length > 0 ? 'Profile' : 'Verify Account'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setView('vault')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] whitespace-nowrap shrink-0 transition-colors"
            >
              Deposit
            </button>

            <button
              type="button"
              onClick={() => setAiAssistantOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#2B3139] whitespace-nowrap shrink-0 transition-colors"
              title="Open AI Trading & Vault Assistant"
            >
              <Bot className="w-3.5 h-3.5 text-[#F0B90B]" />
              <span className="hidden sm:inline">AI Coach</span>
            </button>

            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts (?)"
              title="Keyboard Shortcuts (?)"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#B7BDC6] hover:bg-slate-100 dark:hover:bg-[#2B3139] shrink-0"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>?</span>
            </button>

            <button
              type="button"
              onClick={() => openAlertModal(activeSymbol)}
              aria-label="New price alert"
              className="p-2 rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#B7BDC6] hover:bg-slate-100 dark:hover:bg-[#2B3139] shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        <OfflineIndicator />

        {/* Main Workspace Body (Focus Mode #0e0e0e Canvas) */}
        <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6 max-w-[1600px] w-full mx-auto">
          <div className="min-h-full bg-slate-50 dark:bg-[#0e0e0e] rounded-lg space-y-4">
          {!loading && (kycRecord?.status !== 'VERIFIED' || bankAccounts.length === 0) && view !== 'profile' && (
            <div className="bg-white dark:bg-[#181A20] border border-[#F0B90B]/40 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-[#EAECEF]">
                <ShieldCheck className="w-4 h-4 text-[#F0B90B] shrink-0" />
                <span>
                  <strong>Paper Practice ($1M) Open:</strong> Complete Tier 2 KYC Identity ({kycRecord?.status === 'VERIFIED' ? 'Done' : 'Pending'}) &amp; Payment Rail ({bankAccounts.length > 0 ? 'Done' : 'Pending'}) to unlock Real-Money Market Execution.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setView('profile')}
                className="px-3 py-1 text-xs font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] whitespace-nowrap shrink-0"
              >
                Complete Verification
              </button>
            </div>
          )}
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="h-24 rounded-lg bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]"
                  />
                ))}
              </div>
              <div className="h-96 rounded-lg bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]" />
            </div>
          ) : (
            <>
              {view === 'home' && (
                <HomePortfolioView
                  accountMode={accountMode}
                  cashBalance={cashBalance}
                  vaultBalanceUsd={vaultBalanceUsd}
                  positions={positions}
                  instruments={instruments}
                  predictions={predictions}
                  exchangeFeatures={exchangeFeatures}
                  onSwitchAccountMode={switchAccountMode}
                  onOpenTerminal={openTerminalForSymbol}
                  onNavigate={(target) => setView(target)}
                  onStake={stakeAsset}
                  onUnstake={unstakeAsset}
                />
              )}

              {view === 'analytics' && (
                <PortfolioAnalyticsView
                  positions={positions}
                  instruments={instruments}
                  predictions={predictions}
                  cashBalance={cashBalance}
                  vaultBalanceUsd={vaultBalanceUsd}
                  accountMode={accountMode}
                  darkMode={darkMode}
                  onOpenTerminal={openTerminalForSymbol}
                  onFetchServerAnalytics={fetchServerPortfolioAnalytics}
                />
              )}

              {view === 'predict' && (
                <PredictMarketsView
                  cashBalance={cashBalance}
                  instruments={instruments}
                  predictions={predictions}
                  exchangeFeatures={exchangeFeatures}
                  onPlacePrediction={placePrediction}
                  onSettlePrediction={settlePrediction}
                  onStake={stakeAsset}
                  onUnstake={unstakeAsset}
                  onOpenTerminal={openTerminalForSymbol}
                />
              )}

              {view === 'card' && (
                <AurexCardView
                  cashBalance={cashBalance}
                  exchangeFeatures={exchangeFeatures}
                  onToggleFreeze={toggleCardFreeze}
                  onUpdateConfig={updateCardConfig}
                  onSpend={spendWithCard}
                />
              )}

              {view === 'activity' && (
                <ExchangeActivityView
                  orders={orders}
                  vaultTransfers={vaultTransfers}
                  exchangeFeatures={exchangeFeatures}
                  onOpenTerminal={openTerminalForSymbol}
                />
              )}

              {view === 'screener' && (
                <ScreenerView
                  instruments={instruments}
                  predictions={predictions}
                  watchlistSymbols={watchlistSymbols}
                  guideMode={guideMode}
                  onToggleWatchlist={toggleWatchlistSymbol}
                  onOpenTerminal={openTerminalForSymbol}
                  onArmAlert={(sym, cond, price, note) =>
                    createAlert({ symbol: sym, condition: cond, targetPrice: price, note })
                  }
                />
              )}

              {view === 'terminal' && (
                <div className="space-y-4">
                  {/* Asset Telemetry Strip */}
                  {activeInstrument && (
                    <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <select
                            value={activeSymbol}
                            onChange={(e) => selectSymbol(e.target.value)}
                            aria-label="Select trading symbol"
                            className="text-base font-bold font-mono bg-transparent text-slate-900 dark:text-[#EAECEF] focus:outline-none cursor-pointer"
                          >
                            {instruments.map((inst) => (
                              <option
                                key={inst.symbol}
                                value={inst.symbol}
                                className="bg-white dark:bg-[#181A20] text-slate-900 dark:text-[#EAECEF]"
                              >
                                {inst.symbol} — {inst.name}
                              </option>
                            ))}
                          </select>
                          <div className="text-xs text-slate-500 dark:text-[#848E9C]">
                            {activeInstrument.venue} · {activeInstrument.feedStatus}
                            {activeInstrument.instrumentType && activeInstrument.instrumentType !== 'spot'
                              ? ` · ${activeInstrument.instrumentType.toUpperCase()}`
                              : ''}
                            {activeInstrument.contractSpec?.maxLeverage
                              ? ` ${activeInstrument.contractSpec.maxLeverage}x`
                              : ''}
                            {activeInstrument.contractSpec?.optionRight
                              ? ` ${activeInstrument.contractSpec.optionRight} ${activeInstrument.contractSpec.strike}`
                              : ''}
                          </div>
                        </div>

                        <div className="h-8 w-px bg-slate-200 dark:bg-[#2B3139] hidden sm:block" />

                        <div className="font-mono tabular-nums">
                          <div className="text-lg font-semibold text-slate-900 dark:text-[#EAECEF]">
                            {formatPrice(activeInstrument.price, activeInstrument.symbol)}
                          </div>
                          <div
                            className={`text-xs font-medium ${
                              activeInstrument.changePct >= 0
                                ? 'text-[#0ECB81]'
                                : 'text-[#F6465D]'
                            }`}
                          >
                            {activeInstrument.changePct >= 0 ? '+' : ''}
                            {activeInstrument.changePct.toFixed(2)}% (24h)
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-xs font-mono tabular-nums">
                        <div>
                          <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">
                            24h Range
                          </div>
                          <div className="text-slate-800 dark:text-[#EAECEF]">
                            {formatPrice(activeInstrument.low24h, activeInstrument.symbol)} –{' '}
                            {formatPrice(activeInstrument.high24h, activeInstrument.symbol)}
                          </div>
                        </div>
                        <div>
                          <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">
                            Volume
                          </div>
                          <div className="text-slate-800 dark:text-[#EAECEF]">
                            {formatCompactNumber(activeInstrument.volume24h)}
                          </div>
                        </div>
                        {telemetryVolatility && (
                          <div>
                            <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">
                              Volatility (24h ATR / Realized)
                            </div>
                            <div className="text-slate-800 dark:text-[#EAECEF]">
                              {formatPrice(telemetryVolatility.atr24h, activeSymbol)} (
                              {telemetryVolatility.atrPct.toFixed(2)}%) ·{' '}
                              <span className="text-[#F0B90B]">
                                {telemetryVolatility.realizedVolPct.toFixed(1)}% RV
                              </span>
                            </div>
                          </div>
                        )}
                        {activePrediction && (
                          <div>
                            <div className="font-sans text-[11px] text-slate-500 dark:text-[#848E9C]">
                              AI 15m Forecast
                            </div>
                            <div
                              className={
                                activePrediction.predictedReturnPct >= 0
                                  ? 'text-[#0ECB81] font-semibold'
                                  : 'text-[#F6465D] font-semibold'
                              }
                            >
                              {formatPrice(activePrediction.predictedPrice, activeSymbol)} (
                              {activePrediction.predictedReturnPct >= 0 ? '+' : ''}
                              {activePrediction.predictedReturnPct.toFixed(2)}%)
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 12-Col Terminal Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    <div
                      className={
                        chartFullscreen
                          ? 'lg:col-span-6'
                          : 'sticky top-14 z-10 lg:static lg:z-auto lg:col-span-6 bg-slate-50 dark:bg-[#0B0E11] pb-2 lg:pb-0 shadow-sm lg:shadow-none min-h-[270px] sm:min-h-[340px] lg:min-h-[440px]'
                      }
                    >
                      <MarketChart
                        symbol={activeSymbol}
                        instrument={activeInstrument}
                        candles={candles}
                        timeframe={activeTimeframe}
                        onChangeTimeframe={(tf) => void selectTimeframe(tf)}
                        fullscreen={chartFullscreen}
                        onToggleFullscreen={() => setChartFullscreen((f) => !f)}
                        prediction={activePrediction}
                        darkMode={darkMode}
                        guideMode={guideMode}
                        onApplyAiTargets={(takeProfit, stopLoss) => {
                          setAiTargetTrigger({ takeProfit, stopLoss, nonce: Date.now() });
                          setMobileTerminalTab('ticket');
                        }}
                      />
                    </div>

                    <div className="hidden lg:block lg:col-span-3 min-h-[440px]">
                      <OrderBookPanel
                        symbol={activeSymbol}
                        orderBook={orderBook}
                        recentTrades={recentTrades}
                        guideMode={guideMode}
                        onSelectPrice={(p) => setSelectedBookPrice(p)}
                      />
                    </div>
                    <div className="hidden lg:block lg:col-span-3 min-h-[440px]">
                      <OrderTicket
                        instrument={activeInstrument}
                        cashBalance={cashBalance}
                        accountMode={accountMode}
                        realMoneyEnabled={authUser.realMoneyEnabled}
                        prediction={activePrediction}
                        position={activePosition}
                        selectedBookPrice={selectedBookPrice}
                        shortcutTrigger={orderShortcutTrigger}
                        aiTargetTrigger={aiTargetTrigger}
                        guideMode={guideMode}
                        onSwitchAccountMode={switchAccountMode}
                        onOpenVault={() => setView('vault')}
                        onPlaceOrder={placeOrder}
                        onQuickAlert={(sym, p) => openAlertModal(sym, p)}
                      />
                    </div>

                    {/* Mobile Tabbed Switcher */}
                    <div className="lg:hidden space-y-2.5">
                      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]">
                        <button
                          type="button"
                          onClick={() => setMobileTerminalTab('ticket')}
                          className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                            mobileTerminalTab === 'ticket'
                              ? 'bg-[#F0B90B] text-[#0B0E11]'
                              : 'text-slate-600 dark:text-[#848E9C]'
                          }`}
                        >
                          Order Ticket
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileTerminalTab('book')}
                          className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                            mobileTerminalTab === 'book'
                              ? 'bg-[#F0B90B] text-[#0B0E11]'
                              : 'text-slate-600 dark:text-[#848E9C]'
                          }`}
                        >
                          Order Book
                        </button>
                      </div>

                      {mobileTerminalTab === 'ticket' ? (
                        <OrderTicket
                          instrument={activeInstrument}
                          cashBalance={cashBalance}
                          accountMode={accountMode}
                          realMoneyEnabled={authUser.realMoneyEnabled}
                          prediction={activePrediction}
                          position={activePosition}
                          selectedBookPrice={selectedBookPrice}
                          shortcutTrigger={orderShortcutTrigger}
                          aiTargetTrigger={aiTargetTrigger}
                          guideMode={guideMode}
                          onSwitchAccountMode={switchAccountMode}
                          onOpenVault={() => setView('vault')}
                          onPlaceOrder={placeOrder}
                          onQuickAlert={(sym, p) => openAlertModal(sym, p)}
                        />
                      ) : (
                        <OrderBookPanel
                          symbol={activeSymbol}
                          orderBook={orderBook}
                          recentTrades={recentTrades}
                          guideMode={guideMode}
                          onSelectPrice={(p) => {
                            setSelectedBookPrice(p);
                            setMobileTerminalTab('ticket');
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Terminal Bottom Blotter */}
                  <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-[#2B3139]">
                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-[#0B0E11] rounded-md">
                        {(
                          [
                            { id: 'positions', label: `Positions (${positions.length})` },
                            { id: 'orders', label: `Open Orders (${openOrders.length})` },
                            { id: 'history', label: `History (${filledOrders.length})` },
                            { id: 'alerts', label: `Alerts (${alerts.filter((a) => a.active).length})` },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setBlotterTab(t.id)}
                            className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                              blotterTab === t.id
                                ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                                : 'text-slate-600 dark:text-[#848E9C]'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {accountMode === 'demo' && (
                        <button
                          type="button"
                          onClick={resetPortfolio}
                          className="text-[11px] font-medium text-slate-500 hover:text-[#F0B90B] whitespace-nowrap"
                        >
                          Reset Demo ($1M)
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      {blotterTab === 'positions' && (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C]">
                              <th className="py-2 px-4">Symbol</th>
                              <th className="py-2 px-3 text-right">Size</th>
                              <th className="py-2 px-3 text-right">Avg Entry</th>
                              <th className="py-2 px-3 text-right">Value</th>
                              <th className="py-2 px-3 text-right">Unrealized P&amp;L</th>
                              <th className="py-2 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139] font-mono tabular-nums">
                            {positions.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-6 text-center font-sans text-slate-500">
                                  No open {accountMode} positions yet.
                                </td>
                              </tr>
                            ) : (
                              positions.map((pos) => (
                                <tr key={pos.symbol}>
                                  <td className="py-2 px-4 font-semibold">
                                    <button
                                      type="button"
                                      onClick={() => selectSymbol(pos.symbol)}
                                      className="hover:underline"
                                    >
                                      {pos.symbol}
                                    </button>
                                  </td>
                                  <td className="py-2 px-3 text-right">{pos.size}</td>
                                  <td className="py-2 px-3 text-right">
                                    {formatPrice(pos.avgEntry, pos.symbol)}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {formatCurrency(pos.marketValue)}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-right font-medium ${
                                      pos.unrealizedPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                                    }`}
                                  >
                                    {pos.unrealizedPnl >= 0 ? '+' : ''}
                                    {formatCurrency(pos.unrealizedPnl)}
                                  </td>
                                  <td className="py-2 px-4 text-right font-sans">
                                    {Math.abs(pos.size) > 1e-6 && (
                                      <button
                                        type="button"
                                        onClick={() => handleClosePosition(pos)}
                                        className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
                                      >
                                        Close
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {blotterTab === 'orders' && (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C]">
                              <th className="py-2 px-4">Time</th>
                              <th className="py-2 px-3">Symbol</th>
                              <th className="py-2 px-3">Side / Type</th>
                              <th className="py-2 px-3 text-right">Qty</th>
                              <th className="py-2 px-3 text-right">Target Price</th>
                              <th className="py-2 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139] font-mono tabular-nums">
                            {openOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-6 text-center font-sans text-slate-500">
                                  No open Limit or Stop orders.
                                </td>
                              </tr>
                            ) : (
                              openOrders.map((ord) => (
                                <tr key={ord.id}>
                                  <td className="py-2 px-4 text-slate-500">
                                    {formatTimeShort(ord.createdAt)}
                                  </td>
                                  <td className="py-2 px-3 font-semibold">{ord.symbol}</td>
                                  <td className="py-2 px-3 font-sans">
                                    {ord.side.toUpperCase()} · {ord.type}
                                  </td>
                                  <td className="py-2 px-3 text-right">{ord.size}</td>
                                  <td className="py-2 px-3 text-right">
                                    {formatPrice(ord.stopPrice ?? ord.price, ord.symbol)}
                                  </td>
                                  <td className="py-2 px-4 text-right font-sans">
                                    <button
                                      type="button"
                                      onClick={() => cancelOrder(ord.id)}
                                      className="text-[#F6465D] hover:underline"
                                    >
                                      Cancel
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {blotterTab === 'history' && (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C]">
                              <th className="py-2 px-4">Time</th>
                              <th className="py-2 px-3">Symbol</th>
                              <th className="py-2 px-3">Side</th>
                              <th className="py-2 px-3 text-right">Qty</th>
                              <th className="py-2 px-3 text-right">Fill Price</th>
                              <th className="py-2 px-4 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139] font-mono tabular-nums">
                            {filledOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-6 text-center font-sans text-slate-500">
                                  No executed trades yet.
                                </td>
                              </tr>
                            ) : (
                              filledOrders.slice(0, 15).map((ord) => (
                                <tr key={ord.id}>
                                  <td className="py-2 px-4 text-slate-500">
                                    {formatTimeShort(ord.updatedAt)}
                                  </td>
                                  <td className="py-2 px-3 font-semibold">{ord.symbol}</td>
                                  <td
                                    className={`py-2 px-3 font-sans font-semibold ${
                                      ord.side === 'buy' ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                                    }`}
                                  >
                                    {ord.side.toUpperCase()}
                                  </td>
                                  <td className="py-2 px-3 text-right">{ord.size}</td>
                                  <td className="py-2 px-3 text-right">
                                    {formatPrice(ord.price, ord.symbol)}
                                  </td>
                                  <td className="py-2 px-4 text-right font-sans text-slate-500">
                                    {ord.status}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {blotterTab === 'alerts' && (
                        <div className="divide-y divide-slate-200 dark:divide-[#2B3139] text-xs">
                          {alerts.length === 0 ? (
                            <div className="py-6 text-center text-slate-500">
                              No price alerts armed.
                            </div>
                          ) : (
                            alerts.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between px-4 py-2.5"
                              >
                                <div>
                                  <span className="font-mono font-semibold">{a.symbol}</span>{' '}
                                  <span className="text-slate-500 dark:text-[#848E9C]">
                                    {a.condition} {formatPrice(a.targetPrice, a.symbol)}
                                  </span>
                                  {a.note && (
                                    <span className="text-slate-500 dark:text-[#848E9C]">
                                      {' '}
                                      · {a.note}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={a.active ? 'text-[#F0B90B]' : 'text-[#0ECB81]'}>
                                    {a.active ? 'Armed' : 'Triggered'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => deleteAlert(a.id)}
                                    className="text-[#F6465D] hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {view === 'agents' && (
                <AgentsCommandView
                  instruments={instruments}
                  activeSymbol={activeSymbol}
                  nexusReport={nexusReport}
                  agentLeaderboard={agentLeaderboard}
                  skills={skills}
                  guideMode={guideMode}
                  onSelectSymbol={selectSymbol}
                  onEvaluate={evaluateNexusAgents}
                  onExecute={(sym) => executeNexusTrade(sym)}
                  onRunSkill={runPlatformSkill}
                  onRefreshLeaderboard={() => void fetchAgentLeaderboard()}
                  onOpenTerminal={openTerminalForSymbol}
                  onOpenRiskAudit={() => setView('monitor')}
                />
              )}

              {view === 'bots' && (
                <SmartBotsView
                  accountMode={accountMode}
                  cashBalance={cashBalance}
                  instruments={instruments}
                  activeSymbol={activeSymbol}
                  bots={bots}
                  onRefreshBots={fetchBots}
                  onCreateBot={createBot}
                  onToggleBot={toggleBot}
                  onDeleteBot={deleteBot}
                  onSelectSymbol={openTerminalForSymbol}
                />
              )}

              {view === 'monitor' && (
                <GlobalMonitorView
                  monitor={globalMonitor}
                  connectors={connectors}
                  securityStatus={securityStatus}
                  firewallIncidents={firewallIncidents}
                  onRefresh={() => {
                    void fetchGlobalMonitor();
                    void refreshConnectors();
                  }}
                  onSelectSymbol={openTerminalForSymbol}
                />
              )}

              {view === 'overview' && (
                <div className="space-y-4">
                  {/* Streamlined Sub-Tabs inside AI Signals */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg px-4 py-2.5">
                    <div className="text-xs font-semibold text-slate-900 dark:text-[#EAECEF]">
                      AI Signals, 24-Agent Research &amp; News
                    </div>
                    <div className="flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-xs">
                      {(
                        [
                          { id: 'signals', label: 'Top AI Signals' },
                          { id: 'agents', label: '24-Agent Command' },
                          { id: 'news', label: 'Market News' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSignalsSubTab(t.id)}
                          className={`px-3 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                            signalsSubTab === t.id
                              ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                              : 'text-slate-600 dark:text-[#848E9C]'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {signalsSubTab === 'signals' && (
                    <OverviewSignalsView
                      instruments={instruments}
                      predictions={predictions}
                      insights={insights}
                      patterns={patterns}
                      news={news}
                      positions={positions}
                      cashBalance={cashBalance}
                      activeSymbol={activeSymbol}
                      guideMode={guideMode}
                      onOpenTerminal={openTerminalForSymbol}
                      onOpenGuide={() => setView('guide')}
                      onArmAlert={(sym, cond, price, note) =>
                        createAlert({ symbol: sym, condition: cond, targetPrice: price, note })
                      }
                    />
                  )}

                  {signalsSubTab === 'agents' && (
                    <AgentsCommandView
                      instruments={instruments}
                      activeSymbol={activeSymbol}
                      nexusReport={nexusReport}
                      agentLeaderboard={agentLeaderboard}
                      skills={skills}
                      guideMode={guideMode}
                      onSelectSymbol={selectSymbol}
                      onEvaluate={evaluateNexusAgents}
                      onExecute={(sym) => executeNexusTrade(sym)}
                      onRunSkill={runPlatformSkill}
                      onRefreshLeaderboard={() => void fetchAgentLeaderboard()}
                      onOpenTerminal={openTerminalForSymbol}
                      onOpenRiskAudit={() => setSignalsSubTab('signals')}
                    />
                  )}

                  {signalsSubTab === 'news' && (
                    <NewsSentimentView
                      news={news}
                      instruments={instruments}
                      nextMoveRadar={nextMoveRadar}
                      onRefreshRadar={() => void refreshNewsRadar()}
                      onOpenTerminal={openTerminalForSymbol}
                    />
                  )}
                </div>
              )}

              {view === 'investors' && (
                <InvestorProfilesView
                  authUser={authUser}
                  kycRecord={kycRecord}
                  profiles={investorProfiles}
                  scamReports={scamReports}
                  rewardsState={rewardsState}
                  socialGraph={socialGraph}
                  onClaimQuest={claimQuestReward}
                  onRefreshRewardsAndSocial={fetchRewardsAndSocial}
                  onSubmitKyc={submitKyc}
                  onFollowProfile={followInvestorProfile}
                  onPublishProfile={publishInvestorProfile}
                  onSubmitScamReport={submitScamReport}
                  onOpenTerminal={openTerminalForSymbol}
                />
              )}

              {view === 'profile' && (
                <UserProfileView
                  authUser={authUser}
                  kycRecord={kycRecord}
                  bankAccounts={bankAccounts}
                  accountMode={accountMode}
                  demoCashBalance={demoCashBalance}
                  realCashBalance={realCashBalance}
                  vaultBalanceUsd={vaultBalanceUsd}
                  positions={positions}
                  orders={orders}
                  bots={bots}
                  authSessions={authSessions}
                  promoProfile={promoProfile}
                  rewardsState={rewardsState}
                  socialGraph={socialGraph}
                  enterpriseSecurity={enterpriseSecurity}
                  onSubmitKyc={submitKyc}
                  onSwitchAccountMode={switchAccountMode}
                  onNavigate={(target) => setView(target)}
                  onDownloadPolicyBundle={downloadSanitizedPolicyBundle}
                />
              )}

              {view === 'vault' && (
                <SecurityVaultView
                  accountMode={accountMode}
                  cashBalance={cashBalance}
                  demoCashBalance={demoCashBalance}
                  realCashBalance={realCashBalance}
                  vaultBalanceUsd={vaultBalanceUsd}
                  bankAccounts={bankAccounts}
                  vaultTransfers={vaultTransfers}
                  firewallIncidents={firewallIncidents}
                  securityStatus={securityStatus}
                  authUser={authUser}
                  authSessions={authSessions}
                  passkeys={passkeys}
                  promoProfile={promoProfile}
                  bankDirectory={bankDirectory}
                  kycVerified={kycRecord?.status === 'VERIFIED'}
                  onOpenKyc={() => setView('profile')}
                  guideMode={guideMode}
                  onSwitchAccountMode={switchAccountMode}
                  onTransferVaultShield={transferVaultShield}
                  onToggleLockdown={toggleLockdown}
                  onVerifyChain={verifyVaultChain}
                  onRequestChallenge={requestVaultChallenge}
                  onLinkBank={linkBankAccount}
                  onSubmitTransfer={submitVaultTransfer}
                  onRunWafProbe={runWafProbe}
                  onRevokeOtherSessions={revokeOtherSessions}
                  onSetupTotp={setupTotp}
                  onConfirmTotp={confirmTotp}
                  onDisableTotp={disableTotp}
                  onEnrollPasskey={enrollPasskey}
                  onRemovePasskey={removePasskey}
                  onToggleRealMoneyMode={toggleRealMoneyMode}
                  onRedeemPromo={redeemPromoCode}
                  onRecordShare={recordPromoShare}
                  networkTelemetry={networkTelemetry}
                  diagnosticsReport={diagnosticsReport}
                  defenseAgents={defenseAgents}
                  enterpriseSecurity={enterpriseSecurity}
                  onTrustDevice={trustDevice}
                  onRevokeDevice={revokeDevice}
                  onSignHsmAttestation={signHsmAttestation}
                  onRotateHsmSlot={rotateHsmSlot}
                  onSubmitBugBounty={submitBugBounty}
                  onRunAutomatedPentest={runAutomatedPentest}
                  onDownloadPolicyBundle={downloadSanitizedPolicyBundle}
                  onVerifyNetworkEnvelope={verifyNetworkEnvelope}
                  onRefreshNetwork={fetchNetworkTelemetry}
                  onRefreshDiagnostics={fetchDiagnostics}
                  onSolveDiagnostic={solveDiagnosticIssue}
                  onRefreshDefenseAgents={fetchDefenseAgents}
                />
              )}

              {view === 'guide' && (
                <MarketGuideView
                  countryGuidelines={countryGuidelines}
                  onNavigate={(target) => setView(target)}
                  onOpenSampleTrade={openTerminalForSymbol}
                  onDownloadPolicyBundle={downloadSanitizedPolicyBundle}
                />
              )}

              {view === 'admin' && isFounderAdmin && (
                <AdminConsoleView
                  overview={adminOverview}
                  users={adminUsers}
                  authEvents={adminAuthEvents}
                  founderAiTeam={founderAiTeam}
                  adminRewards={adminRewards}
                  diagnosticsReport={diagnosticsReport}
                  defenseAgents={defenseAgents}
                  onRefresh={fetchAdminTelemetry}
                  onRevokeUserSessions={revokeAdminUserSessions}
                  onRunFounderAiReview={runFounderAiReview}
                  onApplyFounderProposal={applyFounderAiProposal}
                  onCreateRewardCampaign={createAdminRewardCampaign}
                  onToggleRewardCampaign={toggleAdminRewardCampaign}
                  onGrantReward={grantAdminReward}
                  onSolveDiagnostics={solveDiagnosticIssue}
                />
              )}
            </>
          )}
          </div>
        </main>

        {/* Clean Footer with Legal Policies */}
        <footer className="hidden lg:flex px-6 py-3 border-t border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] items-center justify-between text-[11px] text-slate-500 dark:text-[#848E9C]">
          <span>
            Aurex Global Exchange · Demo ($1M Virtual) &amp; Isolated Real Trading + 2FA Cold Vault Custody (Non-Advisory Tooling)
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="hover:text-slate-900 dark:hover:text-[#EAECEF] hover:underline"
            >
              Shortcuts (?)
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-slate-900 dark:hover:text-[#EAECEF] hover:underline"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-slate-900 dark:hover:text-[#EAECEF] hover:underline"
            >
              Terms &amp; Conditions
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('disclosure')}
              className="hover:text-slate-900 dark:hover:text-[#EAECEF] hover:underline"
            >
              Security &amp; Disclosure
            </button>
            <button
              type="button"
              onClick={() => setView('guide')}
              className="hover:text-slate-900 dark:hover:text-[#EAECEF] hover:underline"
            >
              Country Rules &amp; Help
            </button>
          </div>
        </footer>
      </div>

      {/* Mobile Compact Bottom Quick-Nav Bar (Screenshot 5-Tab Layout) */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white/95 dark:bg-[#090A0D]/95 backdrop-blur-sm border-t border-slate-200 dark:border-[#24262C] grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]"
      >
        {(
          [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'predict', label: 'Predict', icon: Sparkles },
            { id: 'terminal', label: 'Invest', icon: TrendingUp },
            { id: 'card', label: 'Card', icon: CreditCard },
            { id: 'activity', label: 'Activity', icon: Clock },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[10px] font-medium transition-colors ${
                active ? 'text-[#F59E0B]' : 'text-slate-500 dark:text-[#8B919E]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* AI Trading & Vault Assistant Drawer */}
      <AiAssistantDrawer
        open={aiAssistantOpen}
        activeSymbol={activeSymbol}
        guideMode={guideMode}
        onClose={() => setAiAssistantOpen(false)}
        onAsk={askAiAssistant}
      />

      {/* Keyboard Shortcuts Overlay Modal */}
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Privacy Policy & Terms Modal */}
      <LegalModal
        open={legalTab !== null}
        initialTab={legalTab ?? 'privacy'}
        onClose={() => setLegalTab(null)}
        onDownloadPolicyBundle={downloadSanitizedPolicyBundle}
      />

      {/* Quick Alert Modal */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <form
            onSubmit={submitAlertModal}
            className="w-full max-w-md bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Create Real-Time Price Alert
              </h3>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-[#848E9C] mb-1">
                  Instrument
                </label>
                <select
                  value={modalAlertSymbol}
                  onChange={(e) => {
                    const sym = e.target.value;
                    setModalAlertSymbol(sym);
                    const found = instruments.find((i) => i.symbol === sym);
                    if (found) setModalAlertPrice(String(found.price));
                  }}
                  className="w-full px-3 py-2 text-xs font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                >
                  {instruments.map((inst) => (
                    <option key={inst.symbol} value={inst.symbol}>
                      {inst.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-[#848E9C] mb-1">
                  Condition
                </label>
                <select
                  value={modalAlertCondition}
                  onChange={(e) =>
                    setModalAlertCondition(e.target.value as 'above' | 'below')
                  }
                  className="w-full px-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                >
                  <option value="above">Crosses Above</option>
                  <option value="below">Crosses Below</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-[#848E9C] mb-1">
                Target Price
              </label>
              <input
                type="number"
                step="any"
                required
                value={modalAlertPrice}
                onChange={(e) => setModalAlertPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-[#848E9C] mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={modalAlertNote}
                onChange={(e) => setModalAlertNote(e.target.value)}
                placeholder="e.g., Breakout level or stop watch"
                className="w-full px-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#B7BDC6]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
              >
                Arm Alert
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Real-Time Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] shadow-lg text-xs"
            >
              <div>
                <div
                  className={`font-semibold ${
                    toast.tone === 'positive'
                      ? 'text-[#0ECB81]'
                      : toast.tone === 'negative'
                      ? 'text-[#F6465D]'
                      : 'text-[#F0B90B]'
                  }`}
                >
                  {toast.title}
                </div>
                <div className="mt-0.5 text-slate-600 dark:text-[#B7BDC6]">
                  {toast.detail}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
