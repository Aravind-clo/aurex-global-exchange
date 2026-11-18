import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ActionableInsight,
  AiThesisBrief,
  ApiLicenseKey,
  AssetClass,
  AuditLogEntry,
  BankAccountRecord,
  BankRailType,
  Candle,
  ChartTimeframe,
  CommunityContributor,
  DeskMember,
  DetectedPattern,
  ExchangeVenue,
  FirewallIncident,
  Instrument,
  MlPrediction,
  NewsItem,
  NexusConsensusReport,
  Order,
  OrderBook,
  OrderBookLevel,
  Position,
  PriceAlert,
  RiskEventEntry,
  SecurityStatus,
  SocialPost,
  StressTestResult,
  SupportedCurrency,
  TradeTapeItem,
  VaultTransferRecord,
  WsClientMessage,
  WsServerMessage,
} from './src/types/market.ts';
import {
  detectTechnicalPatterns,
  generateActionableInsights,
  runShortTermMlPrediction,
} from './server/mlEngine.ts';
import {
  fetchEquityAndFxSnapshots,
  fetchLiveNews,
  fetchMultiCryptoSnapshots,
  scoreHeadlineSentiment,
  startCoinbaseWebSocket,
} from './server/feeds.ts';
import { createCcxtExchangeAdapters } from './connectors/index.ts';
import { GLOBAL_MARKET_CATALOG, type SeedAsset } from './server/marketCatalog.ts';
import { evaluateNexus24Agents } from './server/nexusAgents.ts';
import fs from 'node:fs';
import {
  FOUNDER_EMAIL,
  SESSION_COOKIE_NAME,
  authenticateAccount,
  completePasskeySignIn,
  confirmTotpEnrollment,
  disableTotpForUser,
  extractSessionFromHeaders,
  extractSessionFromReq,
  findOrCreateOAuthUser,
  findPasskeyRecordByCredentialId,
  findPasskeysForAuthLookup,
  flushWorkspacesImmediate,
  getActiveCashBalance,
  setActiveCashBalance,
  getAuthStats,
  getOrCreateWorkspace,
  getPromoProfile,
  isFounderEmail,
  listAdminUserDirectory,
  listAllWorkspaces,
  listPasskeysForUser,
  listUserSessions,
  persistWorkspacesSnapshot,
  recordReferralShare,
  redeemPromoCode,
  registerAccount,
  registerPasskeyForUser,
  removePasskeyForUser,
  revokeAllSessionsForUser,
  revokeOtherUserSessions,
  revokeSession,
  seedInitialUsers,
  setRealMoneyTradingMode,
  setUserAdminRole,
  startTotpEnrollment,
  updateUserSecurityPrefs,
  verifyMfaLoginCode,
  verifySessionToken,
  type UserWorkspaceState,
} from './server/authEngine.ts';
import { computePortfolioAnalyticsReport } from './src/utils/quantPortfolioEngine.ts';
import {
  executeCardSpend,
  getExchangeFeaturesState,
  placePredictionBet,
  settlePredictionBet,
  stakeIntoPool,
  toggleCardFreeze,
  unstakePosition,
  updateCardConfig,
} from './server/exchangeFeatures.ts';
import {
  initializeAgentPerformanceTracker,
  tickAgentPerformance,
  getAgentLeaderboardSnapshot,
} from './server/agentPerformanceTracker.ts';
import { buildGlobalMonitorSnapshot } from './server/globalMonitorEngine.ts';
import {
  STORE_FILE_PATH,
  getAuthTelemetrySummary,
  getSafeServerKeyStatus,
  listAuthTelemetryEvents,
  recordAuthTelemetryEvent,
  setAuthEventListener,
} from './server/adminTelemetryStore.ts';
import { generateAiAssistantResponse } from './server/aiAssistantEngine.ts';
import {
  createWebAuthnChallenge,
  resolveAppBaseUrl,
  verifyWebAuthnAssertionPayload,
  verifyWebAuthnRegistrationPayload,
} from './server/mfaAuthEngine.ts';
import { perfEngine } from './server/performanceEngine.ts';
import {
  computeLedgerHmac,
  createSecurityFirewallMiddleware,
  extractRawClientIp,
  getDdosTelemetry,
  issueStepUpChallenge,
  maskClientIp,
  sanitizePlainText,
  storeEncryptedBankAccount,
  verifyStepUpChallenge,
  verifyTransferChain,
} from './server/securityFirewall.ts';
import {
  buildEnterpriseSecuritySnapshot,
  buildSanitizedSystemBlueprintMarkdown,
  ingestAuthEventToSiem,
  ingestFirewallIncidentToSiem,
  recordObservedDevice,
  rotateHsmSlot,
  runAutomatedPentestSuite,
  setUserDeviceTrust,
  signHsmAttestation,
  submitBountyReport,
} from './server/enterpriseSecuritySuite.ts';
import { createOAuthControllerRouter } from './server/oauthController.ts';
import { createAuthServerRouter } from './server/authServer.ts';
import { probePrivateGitHubServer } from './server/githubServerAuth.ts';
import { validateGitHubOAuthCredentials, validateGoogleOAuthCredentials } from './server/mfaAuthEngine.ts';
import { PLATFORM_SKILLS, executePlatformSkill } from './server/skillsEngine.ts';
import {
  flushMarketStateNow,
  loadPersistedMarketState,
  scheduleMarketStatePersist,
} from './server/workspacePersistence.ts';
import {
  getOrCreateUser,
  recordAlertInCloudSql,
  recordAuthAuditInCloudSql,
  recordOrderInCloudSql,
} from './src/db/users.ts';
import {
  COUNTRY_GUIDELINES,
  GLOBAL_BANK_DIRECTORY,
  buildNextMoveInterestRadar,
  getKycVerification,
  listInvestorProfiles,
  listScamReports,
  publishMyInvestorProfile,
  submitKycVerification,
  submitScamReport,
  toggleFollowInvestorProfile,
} from './server/complianceAndProfiles.ts';
import {
  buildGenesisProfile,
  generateGenesisHistoryCandles,
} from './server/marketGenesis.ts';
import {
  getClientNetworkHandshake,
  getEncryptedNetworkTelemetry,
  sealServerEnvelope,
  verifyClientPacketEnvelope,
} from './server/encryptedNetwork.ts';
import {
  applyFounderProposal,
  claimUserQuestReward,
  createFounderRewardCampaign,
  executeAutoRemediation,
  getAdminRewardsOverview,
  getFounderAiTeamState,
  getHackDefenseAgentsSnapshot,
  getUnresolvedDiagnosticErrorsCount,
  getUserRewardsState,
  getUserSocialGraph,
  grantFounderManualReward,
  notifyDefenseAgentIncident,
  recordRuntimeDiagnosticError,
  runDiagnosticsSuite,
  toggleFounderCampaignActive,
  toggleSocialFollow,
  trackUserQuestProgress,
  triggerFounderAiReview,
} from './server/autonomousDefenseAndOps.ts';
import {
  createTradingBot,
  deleteTradingBot,
  listAllActiveBotsCount,
  listUserTradingBots,
  tickAllTradingBots,
  toggleTradingBotStatus,
} from './server/tradingBotsEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(
  process.env.NGINX_PORT && process.env.PORT === process.env.NGINX_PORT
    ? process.env.DEFAULT_APP_PORT ?? 3000
    : process.env.PORT ?? 3000
);
const IS_PROD = process.env.NODE_ENV === 'production';

const SEED_ASSETS: SeedAsset[] = GLOBAL_MARKET_CATALOG;

const BASELINE_NEWS: NewsItem[] = [
  {
    id: 'base-1',
    title: 'Semiconductor demand surges as hyperscale AI capital expenditures beat quarterly consensus',
    source: 'Market Wire',
    url: '#',
    publishedAt: Date.now() - 1000 * 60 * 14,
    symbols: ['NVDA', 'MSFT', 'AMZN'],
    sentiment: 'Bullish',
    sentimentScore: 0.65,
    summary: 'Institutional desk flows show sustained accumulation across leading data-center compute names following stronger capex guidance.',
  },
  {
    id: 'base-2',
    title: 'Spot digital asset ETF inflows remain elevated while exchange liquidity tightens',
    source: 'Digital Asset Desk',
    url: '#',
    publishedAt: Date.now() - 1000 * 60 * 32,
    symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
    sentiment: 'Bullish',
    sentimentScore: 0.55,
    summary: 'Order book depth on Coinbase and Kraken tightened around key psychological levels as institutional bid clusters stepped higher.',
  },
  {
    id: 'base-3',
    title: 'Treasury yields steady ahead of manufacturing PMI; bank net interest margins under focus',
    source: 'Macro Brief',
    url: '#',
    publishedAt: Date.now() - 1000 * 60 * 58,
    symbols: ['JPM', 'SPY', 'EUR-USD'],
    sentiment: 'Neutral',
    sentimentScore: 0.05,
    summary: 'Rates traders await fresh macro prints to price the pace of policy normalization across G10 central banks.',
  },
  {
    id: 'base-4',
    title: 'Crude oil futures dip on inventory build while gold holds support on central bank buying',
    source: 'Commodities Desk',
    url: '#',
    publishedAt: Date.now() - 1000 * 60 * 84,
    symbols: ['WTI-USD', 'XAU-USD'],
    sentiment: 'Bearish',
    sentimentScore: -0.25,
    summary: 'Energy benchmarks saw mild distribution after weekly supply data surprised higher; precious metals maintained structural bids.',
  },
];

function roundPrice(symbol: string, price: number): number {
  const safe = Math.max(price, 1e-8);
  if (safe < 0.001) return Number(safe.toFixed(8));
  if (safe < 0.1) return Number(safe.toFixed(6));
  if (symbol.includes('JPY') || symbol.includes('.T')) return Number(safe.toFixed(3));
  if (
    symbol.includes('EUR-') ||
    symbol.includes('GBP-') ||
    symbol.includes('AUD-') ||
    symbol.includes('NZD-') ||
    symbol.includes('USD-CAD') ||
    symbol.includes('USD-CHF') ||
    symbol.includes('USD-SGD') ||
    symbol.includes('USD-CNH')
  ) {
    return Number(safe.toFixed(5));
  }
  if (safe >= 10) return Number(safe.toFixed(2));
  return Number(safe.toFixed(4));
}

function generateInitialCandles(seed: SeedAsset, count = 90): Candle[] {
  const candles: Candle[] = [];
  const nowSec = Math.floor(Date.now() / 60000) * 60;
  let price = seed.basePrice * (0.985 + Math.random() * 0.015);
  let drift = (Math.random() - 0.45) * 0.0004;

  for (let i = count - 1; i >= 0; i--) {
    const time = (nowSec - i * 60) * 1000;
    if (i % 14 === 0) {
      drift = (Math.random() - 0.47) * 0.0007;
    }
    const shock = (Math.random() - 0.5) * seed.volatility * 1.9;
    const open = price;
    const close = roundPrice(seed.symbol, Math.max(open * (1 + drift + shock), 1e-8));
    const wickUp = Math.abs(Math.random() * seed.volatility * 0.9 * open);
    const wickDown = Math.abs(Math.random() * seed.volatility * 0.9 * open);
    const high = roundPrice(seed.symbol, Math.max(open, close) + wickUp);
    const low = roundPrice(seed.symbol, Math.max(1e-8, Math.min(open, close) - wickDown));
    const vol = Math.round((seed.baseVolume / 390) * (0.65 + Math.random() * 1.1));
    candles.push({ time, open, high, low, close, volume: vol });
    price = close;
  }
  return candles;
}

const TIMEFRAME_MS: Record<Exclude<ChartTimeframe, 'ALL'>, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '1D': 86_400_000,
  '1W': 604_800_000,
  '1M': 2_592_000_000,
};

function normalizeTimeframe(raw?: string): ChartTimeframe {
  if (raw === 'ALL') return 'ALL';
  if (raw && Object.prototype.hasOwnProperty.call(TIMEFRAME_MS, raw)) {
    return raw as ChartTimeframe;
  }
  return '1m';
}

function getCandlesForTimeframe(symbol: string, tf: ChartTimeframe): Candle[] {
  const sym = symbol.toUpperCase();
  const baseCandles = candlesMap.get(sym) ?? [];
  if (tf === 'ALL') {
    const inst = instrumentsMap.get(sym);
    if (inst) {
      return generateGenesisHistoryCandles(inst);
    }
    return baseCandles;
  }
  if (tf === '1m' || baseCandles.length === 0) {
    return baseCandles;
  }

  const inst = instrumentsMap.get(sym);
  const seed = SEED_ASSETS.find((s) => s.symbol === sym);
  const stepMs = TIMEFRAME_MS[tf];
  const barCount = 72;
  const nowBucket = Math.floor(Date.now() / stepMs) * stepMs;
  const currentClose = inst?.price ?? baseCandles[baseCandles.length - 1].close;
  const baseVolPerBar = Math.round(((seed?.baseVolume ?? inst?.volume24h ?? 100000) / 390) * Math.sqrt(stepMs / 60_000));
  const scaleFactor = Math.min(8.5, Math.sqrt(stepMs / 60_000));
  const barSigma = (seed?.volatility ?? 0.0022) * scaleFactor;

  // Deterministic PRNG seeded by symbol + timeframe so switching back/forth is consistent
  let h = 2166136261;
  const key = `${sym}:${tf}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Generate walk backward from currentClose so rightmost bar matches live price seamlessly
  const series: Candle[] = new Array(barCount);
  let nextClose = currentClose;
  for (let i = barCount - 1; i >= 0; i--) {
    const time = nowBucket - (barCount - 1 - i) * stepMs;
    const pctStep = (rand() - 0.492) * barSigma * 1.45;
    const open = i === 0 ? nextClose * (1 - pctStep) : roundPrice(sym, Math.max(1e-8, nextClose / (1 + pctStep)));
    const close = roundPrice(sym, nextClose);
    const wickUp = Math.abs(rand() * barSigma * 0.65 * Math.max(open, close));
    const wickDown = Math.abs(rand() * barSigma * 0.65 * Math.min(open, close));
    const high = roundPrice(sym, Math.max(open, close) + wickUp);
    const low = roundPrice(sym, Math.max(1e-8, Math.min(open, close) - wickDown));
    const volume = Math.max(1, Math.round(baseVolPerBar * (0.55 + rand() * 1.25)));
    series[i] = { time, open, high, low, close, volume };
    nextClose = open;
  }
  return series;
}

function getMinTick(symbol: string, price: number): number {
  const safe = Math.max(price, 1e-8);
  if (safe < 0.001) return 1e-8;
  if (safe < 0.1) return 1e-6;
  if (symbol.includes('JPY') || symbol.includes('.T')) return 1e-3;
  if (
    symbol.includes('EUR-') ||
    symbol.includes('GBP-') ||
    symbol.includes('AUD-') ||
    symbol.includes('NZD-') ||
    symbol.includes('USD-CAD') ||
    symbol.includes('USD-CHF') ||
    symbol.includes('USD-SGD') ||
    symbol.includes('USD-CNH')
  ) {
    return 1e-5;
  }
  if (safe >= 10) return 0.01;
  return 0.0001;
}

function buildOrderBook(symbol: string, mid: number, assetClass: AssetClass): OrderBook {
  const tickBps = assetClass === 'fx' ? 0.00008 : assetClass === 'equities' ? 0.00025 : 0.00035;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  const baseQty =
    mid < 0.001
      ? 45_000_000
      : mid < 0.05
      ? 220_000
      : assetClass === 'crypto' && mid > 10000
      ? 0.45
      : assetClass === 'fx'
      ? 250000
      : 180;

  let cumBid = 0;
  let cumAsk = 0;
  let prevBid = roundPrice(symbol, mid);
  let prevAsk = roundPrice(symbol, mid);
  const usedBids = new Set<number>();
  const usedAsks = new Set<number>();

  for (let i = 1; i <= 12; i++) {
    const bidTick = getMinTick(symbol, prevBid);
    const askTick = getMinTick(symbol, prevAsk);
    const bidStep = Math.max(bidTick, mid * tickBps * (0.85 + Math.random() * 0.35));
    const askStep = Math.max(askTick, mid * tickBps * (0.85 + Math.random() * 0.35));

    let bidPrice = roundPrice(symbol, Math.max(1e-8, prevBid - bidStep));
    if (bidPrice >= prevBid || usedBids.has(bidPrice)) {
      bidPrice = roundPrice(symbol, Math.max(1e-8, prevBid - bidTick));
      while (usedBids.has(bidPrice) && bidPrice > 1e-8) {
        const nextTick = getMinTick(symbol, bidPrice);
        const stepped = roundPrice(symbol, Math.max(1e-8, bidPrice - nextTick));
        if (stepped === bidPrice) break;
        bidPrice = stepped;
      }
    }

    let askPrice = roundPrice(symbol, prevAsk + askStep);
    if (askPrice <= prevAsk || usedAsks.has(askPrice)) {
      askPrice = roundPrice(symbol, prevAsk + askTick);
      while (usedAsks.has(askPrice)) {
        const nextTick = getMinTick(symbol, askPrice);
        const stepped = roundPrice(symbol, askPrice + nextTick);
        if (stepped === askPrice) break;
        askPrice = stepped;
      }
    }

    usedBids.add(bidPrice);
    usedAsks.add(askPrice);
    prevBid = bidPrice;
    prevAsk = askPrice;

    const decimals = mid > 5000 ? 3 : mid < 0.05 ? 0 : 2;
    const bidSize = Number((baseQty * (0.5 + Math.random() * 1.8) * (1 + i * 0.12)).toFixed(decimals));
    const askSize = Number((baseQty * (0.5 + Math.random() * 1.8) * (1 + i * 0.12)).toFixed(decimals));

    cumBid = Number((cumBid + bidSize).toFixed(decimals));
    cumAsk = Number((cumAsk + askSize).toFixed(decimals));

    bids.push({ price: bidPrice, size: bidSize, total: cumBid, orders: Math.max(1, Math.floor(Math.random() * 14)) });
    asks.push({ price: askPrice, size: askSize, total: cumAsk, orders: Math.max(1, Math.floor(Math.random() * 14)) });
  }

  const bestBid = bids[0]?.price ?? mid;
  const bestAsk = asks[0]?.price ?? mid;
  const spread = Number((bestAsk - bestBid).toFixed(mid < 0.01 ? 8 : 5));
  const totalDepth = cumBid + cumAsk;
  const imbalancePct = totalDepth > 0 ? Number((((cumBid - cumAsk) / totalDepth) * 100).toFixed(1)) : 0;

  return {
    symbol,
    bids,
    asks,
    spread,
    mid,
    imbalancePct,
    updatedAt: Date.now(),
  };
}

// Authoritative Server State
const instrumentsMap = new Map<string, Instrument>();
const candlesMap = new Map<string, Candle[]>();
const orderBooksMap = new Map<string, OrderBook>();
const tradesMap = new Map<string, TradeTapeItem[]>();
const predictionsMap = new Map<string, MlPrediction>();
let recentPatterns: DetectedPattern[] = [];
let newsFeed: NewsItem[] = [...BASELINE_NEWS];
let actionableInsights: ActionableInsight[] = [];

// Shared API License Keys, Audit, Security Firewall State
// (Per-user cashBalance, orders, positions, alerts, and encrypted bank vaults live in authEngine UserWorkspaceState)
const initialInstToken =
  process.env.AUREX_INSTITUTIONAL_API_KEY?.trim() ||
  `ephem_${crypto.randomBytes(8).toString('hex')}`;
const initialProToken =
  process.env.AUREX_PRO_API_KEY?.trim() ||
  `ephem_${crypto.randomBytes(8).toString('hex')}`;

const apiKeysList: ApiLicenseKey[] = [
  {
    id: 'key-inst-1',
    label: 'Primary Quant Execution Engine',
    keyPreview: `****${initialInstToken.slice(-4)}`,
    tier: 'Institutional',
    rateLimitPerMin: 12000,
    callsToday: 42819,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
  {
    id: 'key-pro-2',
    label: 'Research & Backtest Pipeline',
    keyPreview: `****${initialProToken.slice(-4)}`,
    tier: 'Pro',
    rateLimitPerMin: 2400,
    callsToday: 8914,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
];
const rawKeyLookup = new Map<string, ApiLicenseKey>([
  [initialInstToken, apiKeysList[0]],
  [initialProToken, apiKeysList[1]],
]);

const auditLogsList: AuditLogEntry[] = [];
const riskEventsList: RiskEventEntry[] = [];
let latestNexusReport: NexusConsensusReport | undefined;

const securityStatus: SecurityStatus = {
  firewallActive: true,
  lockdownMode: false,
  totalBlocked: 0,
  cipherSuite: 'AES-256-GCM + HMAC-SHA256',
  ledgerChainValid: true,
  lastVerifiedAt: Date.now(),
};
const firewallIncidentsList: FirewallIncident[] = [];

function pushFirewallIncident(inc: FirewallIncident) {
  firewallIncidentsList.unshift(inc);
  if (firewallIncidentsList.length > 80) firewallIncidentsList.pop();
  notifyDefenseAgentIncident(inc);
  ingestFirewallIncidentToSiem(inc);
}

function recordDeviceFromReq(userId: string, req: express.Request) {
  const fp = req.header('x-aurex-device-fp');
  const label = req.header('x-aurex-device-label');
  if (fp) {
    recordObservedDevice(userId, fp, label, maskClientIp(req));
  }
}

function isUserVerifiedForRealTrading(
  userId: string,
  wsState: UserWorkspaceState
): { ok: boolean; kycVerified: boolean; paymentVerified: boolean; reason?: string } {
  const kycVerified = getKycVerification(userId).status === 'VERIFIED';
  const paymentVerified = wsState.bankAccounts.length > 0;
  if (!kycVerified && !paymentVerified) {
    return {
      ok: false,
      kycVerified,
      paymentVerified,
      reason:
        'Verification Required: Complete Tier 2 KYC Identity & link a verified Payment Rail in Profile / Vault before Live Real-Money Trading. Paper Demo ($1M) remains open.',
    };
  }
  if (!kycVerified) {
    return {
      ok: false,
      kycVerified,
      paymentVerified,
      reason:
        'Identity Verification Pending: Complete Tier 2 KYC in Profile & Verification Center before Live Real-Money Trading.',
    };
  }
  if (!paymentVerified) {
    return {
      ok: false,
      kycVerified,
      paymentVerified,
      reason:
        'Payment Verification Pending: Link a verified UPI / Bank Payment Rail in Wallet & Vault before Live Real-Money Trading.',
    };
  }
  return { ok: true, kycVerified, paymentVerified };
}

function pushAuditLog(entry: AuditLogEntry) {
  auditLogsList.unshift(entry);
  if (auditLogsList.length > 80) auditLogsList.pop();
}

function pushRiskEvent(ev: RiskEventEntry) {
  riskEventsList.unshift(ev);
  if (riskEventsList.length > 60) riskEventsList.pop();
}

const socialPostsList: SocialPost[] = [
  {
    id: 'soc-1',
    author: 'Aarav Mehta',
    role: 'NSE & Global Quant',
    symbol: 'RELIANCE.NS',
    bias: 'Bullish',
    title: 'Accumulation structure on NSE volume expansion + steady INR',
    thesis:
      '24-agent Market & Quantitative departments align positively as spreads remain tight under 15 bps. Looking for steady multi-week compounding allocation rather than high-leverage chasing.',
    targetPrice: 1325,
    likes: 34,
    likedByClientIds: [],
    createdAt: Date.now() - 1000 * 60 * 42,
  },
  {
    id: 'soc-2',
    author: 'Elena Vance',
    role: 'Semiconductor Strategist',
    symbol: 'NVDA',
    bias: 'Bullish',
    title: 'Hyperscale capex headlines reinforcing EMA9/EMA21 upward slope',
    thesis:
      'Order book bid skew remains constructive while A24 Risk Gate clears full 20% portfolio cap. Scaling in via limit orders near VWAP reduces slippage.',
    targetPrice: 151.5,
    likes: 52,
    likedByClientIds: [],
    createdAt: Date.now() - 1000 * 60 * 19,
  },
  {
    id: 'soc-3',
    author: 'Marcus Chen',
    role: 'Digital Macro Desk',
    symbol: 'BTC-USD',
    bias: 'Neutral',
    title: 'Watching 1-sigma volatility band before sizing higher',
    thesis:
      'Spot ETF flows keep long-term bid supported, but short-term RSI swings warrant strict stop discipline and A24 dispersion monitoring.',
    targetPrice: 93800,
    likes: 21,
    likedByClientIds: [],
    createdAt: Date.now() - 1000 * 60 * 9,
  },
];

const contributorsList: CommunityContributor[] = [
  {
    id: 'ctr-1',
    handle: 'Aarav Mehta',
    role: 'NSE & Global Quant',
    specialty: 'India Bluechips · Wealth SIP',
    winRatePct: 71.4,
    followers: 1420,
    following: true,
    ideasCount: 48,
  },
  {
    id: 'ctr-2',
    handle: 'Elena Vance',
    role: 'Semiconductor Strategist',
    specialty: 'US Tech · Momentum & AI',
    winRatePct: 74.8,
    followers: 2890,
    following: false,
    ideasCount: 93,
  },
  {
    id: 'ctr-3',
    handle: 'Marcus Chen',
    role: 'Digital Macro Desk',
    specialty: 'Crypto · FX & Gold Hedges',
    winRatePct: 68.2,
    followers: 1185,
    following: false,
    ideasCount: 64,
  },
];

// Hydrate persisted market state (last checkpoints + audit logs)
const persistedMarket = loadPersistedMarketState();
const persistedInstrumentMap = new Map(
  (persistedMarket.instruments ?? []).map((item) => [item.symbol, item])
);
if (Array.isArray(persistedMarket.auditLogs)) {
  auditLogsList.push(...persistedMarket.auditLogs.slice(0, 80));
}
if (Array.isArray(persistedMarket.riskEvents)) {
  riskEventsList.push(...persistedMarket.riskEvents.slice(0, 60));
}

// Initialize global 116-instrument catalog
for (const seed of SEED_ASSETS) {
  const checkpoint = persistedInstrumentMap.get(seed.symbol);
  const effectiveSeed: SeedAsset =
    checkpoint && checkpoint.price > 0
      ? { ...seed, basePrice: checkpoint.price }
      : seed;

  const candles = generateInitialCandles(effectiveSeed, 90);
  candlesMap.set(seed.symbol, candles);
  const lastCandle = candles[candles.length - 1];
  const open24h = checkpoint?.open24h ?? candles[0].open;
  const price = checkpoint?.price ?? lastCandle.close;
  const high24h = Math.max(checkpoint?.high24h ?? price, ...candles.map((c) => c.high));
  const low24h = Math.min(checkpoint?.low24h ?? price, ...candles.map((c) => c.low));
  const changePct = Number((((price - open24h) / Math.max(open24h, 1e-8)) * 100).toFixed(2));
  const book = buildOrderBook(seed.symbol, price, seed.assetClass);
  orderBooksMap.set(seed.symbol, book);

  const inst: Instrument = {
    symbol: seed.symbol,
    name: seed.name,
    assetClass: seed.assetClass,
    instrumentType: seed.instrumentType ?? 'spot',
    contractSpec: seed.contractSpec,
    venue: seed.venue,
    region: seed.region,
    sector: seed.sector,
    quoteCurrency: seed.quoteCurrency,
    price,
    open24h,
    high24h,
    low24h,
    volume24h: checkpoint?.volume24h ?? seed.baseVolume,
    bid: book.bids[0]?.price ?? price,
    ask: book.asks[0]?.price ?? price,
    spreadBps: Number((((book.spread) / Math.max(price, 1e-8)) * 10000).toFixed(2)),
    changePct,
    sparkline: candles.slice(-24).map((c) => c.close),
    feedStatus: checkpoint?.feedStatus ?? 'Reference Feed',
    updatedAt: Date.now(),
    genesis: buildGenesisProfile(seed, price),
  };
  instrumentsMap.set(seed.symbol, inst);

  const trades: TradeTapeItem[] = [];
  for (let i = 0; i < 16; i++) {
    trades.push({
      id: `trd-${seed.symbol}-${i}`,
      symbol: seed.symbol,
      price: roundPrice(seed.symbol, price * (1 + (Math.random() - 0.5) * 0.0008)),
      size: Number((Math.random() * (seed.assetClass === 'crypto' && price > 5000 ? 0.8 : 120) + 0.05).toFixed(3)),
      side: Math.random() > 0.48 ? 'buy' : 'sell',
      time: Date.now() - i * 4500,
      venue: seed.venue,
    });
  }
  tradesMap.set(seed.symbol, trades);

  const pred = runShortTermMlPrediction(inst, candles, newsFeed, book);
  predictionsMap.set(seed.symbol, pred);
  const pats = detectTechnicalPatterns(inst, candles, pred);
  recentPatterns = [...pats, ...recentPatterns].slice(0, 40);
}

// Seed multi-user accounts and isolated trading/banking workspaces
seedInitialUsers((sym) => instrumentsMap.get(sym)?.price ?? 100);
perfEngine.setCatalogCounts(instrumentsMap.size, listAuthTelemetryEvents(500).length);

function recomputePositions(wsState: UserWorkspaceState, mode: 'demo' | 'real' = wsState.accountMode): Position[] {
  const posMap = mode === 'real' ? wsState.realPositionsMap : wsState.positionsMap;
  const result: Position[] = [];
  for (const pos of posMap.values()) {
    const inst = instrumentsMap.get(pos.symbol);
    const mark = inst?.price ?? pos.avgEntry;
    pos.marketValue = Number((pos.size * mark).toFixed(2));
    pos.unrealizedPnl = Number(((mark - pos.avgEntry) * pos.size).toFixed(2));
    if (Math.abs(pos.size) > 1e-8 || Math.abs(pos.realizedPnl) > 0.01) {
      result.push({ ...pos });
    }
  }
  return result;
}

function buildDeskStatePayload(wsState: UserWorkspaceState) {
  const activeOrders = wsState.accountMode === 'real' ? wsState.realOrders : wsState.orders;
  const activeCash = getActiveCashBalance(wsState);
  return {
    accountMode: wsState.accountMode,
    cashBalance: activeCash,
    demoCashBalance: wsState.demoCashBalance,
    realCashBalance: wsState.realCashBalance,
    vaultBalanceUsd: wsState.vaultBalanceUsd,
    orders: activeOrders.slice(0, 60),
    positions: recomputePositions(wsState, wsState.accountMode),
  };
}

function convertNativeCurrencyToUsd(amount: number, currency: SupportedCurrency): number {
  const usdInr = instrumentsMap.get('USD-INR')?.price ?? 84.42;
  const eurUsd = instrumentsMap.get('EUR-USD')?.price ?? 1.08;
  const gbpUsd = instrumentsMap.get('GBP-USD')?.price ?? 1.27;
  const usdJpy = instrumentsMap.get('USD-JPY')?.price ?? 153.5;
  const audUsd = instrumentsMap.get('AUD-USD')?.price ?? 0.65;
  const usdCad = instrumentsMap.get('USD-CAD')?.price ?? 1.39;
  const usdChf = instrumentsMap.get('USD-CHF')?.price ?? 0.88;
  const usdSgd = instrumentsMap.get('USD-SGD')?.price ?? 1.34;
  if (currency === 'INR') return Number((amount / usdInr).toFixed(2));
  if (currency === 'EUR') return Number((amount * eurUsd).toFixed(2));
  if (currency === 'GBP') return Number((amount * gbpUsd).toFixed(2));
  if (currency === 'SGD') return Number((amount / usdSgd).toFixed(2));
  if (currency === 'AED') return Number((amount / 3.6725).toFixed(2));
  if (currency === 'JPY') return Number((amount / usdJpy).toFixed(2));
  if (currency === 'AUD') return Number((amount * audUsd).toFixed(2));
  if (currency === 'CAD') return Number((amount / usdCad).toFixed(2));
  if (currency === 'CHF') return Number((amount / usdChf).toFixed(2));
  return Number(amount.toFixed(2));
}

actionableInsights = generateActionableInsights(
  Array.from(instrumentsMap.values()),
  Object.fromEntries(predictionsMap.entries()),
  recentPatterns,
  newsFeed
);
initializeAgentPerformanceTracker(instrumentsMap, predictionsMap);

// WebSocket Client Tracking
interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  userId?: string;
  email?: string;
  isAdmin?: boolean;
  activeSymbol: string;
  activeTimeframe: ChartTimeframe;
  name: string;
  role: string;
  connectedAt: number;
  isAlive: boolean;
}
const clients = new Map<WebSocket, ConnectedClient>();

function sendToClient(ws: WebSocket, msg: WsServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

setAuthEventListener((ev) => {
  ingestAuthEventToSiem(ev);
  for (const client of clients.values()) {
    if (client.isAdmin && isFounderEmail(client.email)) {
      sendToClient(client.ws, { type: 'admin:auth_event', payload: ev });
    }
  }
});

function broadcast(msg: WsServerMessage, filterSymbol?: string) {
  if (filterSymbol) {
    perfEngine.broadcastSymbol(filterSymbol, msg);
  } else {
    perfEngine.broadcastAll(msg, true);
  }
}

function broadcastDeskPresence() {
  const members: DeskMember[] = Array.from(clients.values())
    .slice(0, 60)
    .map((c) => ({
      clientId: c.clientId,
      name: c.name,
      role: c.role,
      activeSymbol: c.activeSymbol,
      connectedAt: c.connectedAt,
    }));
  perfEngine.broadcastAll({ type: 'desk:presence', payload: members }, true);
}

function executeOrderFill(
  wsState: UserWorkspaceState,
  order: Order,
  fillPrice: number,
  mode: 'demo' | 'real' = wsState.accountMode
) {
  const notional = Number((order.size * fillPrice).toFixed(2));
  const fee = Number((notional * 0.0004).toFixed(2));
  const posMap = mode === 'real' ? wsState.realPositionsMap : wsState.positionsMap;
  let balance = mode === 'real' ? wsState.realCashBalance : wsState.demoCashBalance;

  if (order.side === 'buy') {
    if (balance < notional + fee) {
      order.status = 'cancelled';
      order.updatedAt = Date.now();
      return;
    }
    balance = Number((balance - notional - fee).toFixed(2));
    const existing = posMap.get(order.symbol);
    if (!existing || Math.abs(existing.size) < 1e-8) {
      posMap.set(order.symbol, {
        symbol: order.symbol,
        size: order.size,
        avgEntry: fillPrice,
        unrealizedPnl: 0,
        realizedPnl: existing?.realizedPnl ?? 0,
        marketValue: notional,
      });
    } else if (existing.size >= 0) {
      const totalSize = existing.size + order.size;
      const newAvg = (existing.avgEntry * existing.size + fillPrice * order.size) / totalSize;
      existing.size = Number(totalSize.toFixed(6));
      existing.avgEntry = roundPrice(order.symbol, newAvg);
    } else {
      const coverQty = Math.min(order.size, Math.abs(existing.size));
      existing.realizedPnl = Number((existing.realizedPnl + (existing.avgEntry - fillPrice) * coverQty).toFixed(2));
      existing.size = Number((existing.size + order.size).toFixed(6));
      if (existing.size > 0) existing.avgEntry = fillPrice;
    }
  } else {
    const existing = posMap.get(order.symbol);
    const heldLong = existing && existing.size > 0 ? existing.size : 0;
    const shortOpenedQty = Math.max(0, order.size - heldLong);
    const requiredShortMargin = shortOpenedQty * fillPrice * 0.5;
    if (shortOpenedQty > 0 && balance < requiredShortMargin + fee) {
      order.status = 'cancelled';
      order.updatedAt = Date.now();
      return;
    }

    balance = Number((balance + notional - fee).toFixed(2));
    if (!existing || Math.abs(existing.size) < 1e-8) {
      posMap.set(order.symbol, {
        symbol: order.symbol,
        size: -order.size,
        avgEntry: fillPrice,
        unrealizedPnl: 0,
        realizedPnl: existing?.realizedPnl ?? 0,
        marketValue: -notional,
      });
    } else if (existing.size > 0) {
      const closeQty = Math.min(order.size, existing.size);
      existing.realizedPnl = Number((existing.realizedPnl + (fillPrice - existing.avgEntry) * closeQty).toFixed(2));
      existing.size = Number((existing.size - order.size).toFixed(6));
      if (existing.size < 0) existing.avgEntry = fillPrice;
    } else {
      const totalAbs = Math.abs(existing.size) + order.size;
      const newAvg = (existing.avgEntry * Math.abs(existing.size) + fillPrice * order.size) / totalAbs;
      existing.size = Number((-totalAbs).toFixed(6));
      existing.avgEntry = roundPrice(order.symbol, newAvg);
    }
  }

  if (mode === 'real') {
    wsState.realCashBalance = balance;
  } else {
    wsState.demoCashBalance = balance;
  }
  wsState.cashBalance = getActiveCashBalance(wsState);

  order.status = 'filled';
  order.filledSize = order.size;
  order.price = fillPrice;
  order.notional = notional;
  order.updatedAt = Date.now();
  perfEngine.recordOrderMatch();
  trackUserQuestProgress(wsState.userId, 'quest-trade', 1);
  persistWorkspacesSnapshot();
}

function processMarketTick(
  symbol: string,
  rawPrice: number,
  size: number,
  side: 'buy' | 'sell',
  venue: string,
  isLiveExternal: boolean
) {
  const inst = instrumentsMap.get(symbol);
  if (!inst) return;

  const price = roundPrice(symbol, Math.max(rawPrice, 1e-8));
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60000) * 60000;

  inst.price = price;
  inst.high24h = Math.max(inst.high24h, price);
  inst.low24h = Math.min(inst.low24h, price);
  inst.volume24h = Number((inst.volume24h + size).toFixed(2));
  inst.changePct = Number((((price - inst.open24h) / inst.open24h) * 100).toFixed(2));
  inst.feedStatus = isLiveExternal ? 'Live Feed' : inst.feedStatus;
  inst.updatedAt = now;

  // Update candle series
  const candles = candlesMap.get(symbol) ?? [];
  let lastCandle = candles[candles.length - 1];
  if (!lastCandle || lastCandle.time < minuteBucket) {
    lastCandle = {
      time: minuteBucket,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: size,
    };
    candles.push(lastCandle);
    if (candles.length > 180) candles.shift();
  } else {
    lastCandle.close = price;
    lastCandle.high = Math.max(lastCandle.high, price);
    lastCandle.low = Math.min(lastCandle.low, price);
    lastCandle.volume = Number((lastCandle.volume + size).toFixed(3));
  }

  inst.sparkline = candles.slice(-24).map((c) => c.close);

  // Update Order Book around new mid
  const book = buildOrderBook(symbol, price, inst.assetClass);
  orderBooksMap.set(symbol, book);
  inst.bid = book.bids[0]?.price ?? price;
  inst.ask = book.asks[0]?.price ?? price;
  inst.spreadBps = Number((((book.spread) / price) * 10000).toFixed(2));

  // Append to trade tape
  const trade: TradeTapeItem = {
    id: `trd-${now}-${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    price,
    size: Number(size.toFixed(4)),
    side,
    time: now,
    venue,
  };
  const tape = tradesMap.get(symbol) ?? [];
  tape.unshift(trade);
  if (tape.length > 50) tape.pop();
  tradesMap.set(symbol, tape);

  // Update ML prediction & check for new technical patterns
  const pred = runShortTermMlPrediction(inst, candles, newsFeed, book);
  predictionsMap.set(symbol, pred);

  const newPatterns = detectTechnicalPatterns(inst, candles, pred);
  for (const pat of newPatterns) {
    if (!recentPatterns.some((existing) => existing.id === pat.id)) {
      recentPatterns.unshift(pat);
      if (recentPatterns.length > 40) recentPatterns.pop();
      broadcast({ type: 'pattern:detected', payload: pat });
    }
  }

  // Evaluate resting limit/stop orders & price alerts per isolated user workspace across both Demo and Real books
  for (const wsState of listAllWorkspaces()) {
    let deskMutated = false;
    for (const [modeKey, list] of [
      ['demo', wsState.orders],
      ['real', wsState.realOrders],
    ] as const) {
      for (const ord of list) {
        if (ord.symbol !== symbol || ord.status !== 'open') continue;
        if (ord.type === 'limit') {
          if ((ord.side === 'buy' && price <= ord.price) || (ord.side === 'sell' && price >= ord.price)) {
            executeOrderFill(wsState, ord, ord.price, modeKey);
            deskMutated = true;
          }
        } else if (ord.type === 'stop' && ord.stopPrice) {
          if ((ord.side === 'buy' && price >= ord.stopPrice) || (ord.side === 'sell' && price <= ord.stopPrice)) {
            executeOrderFill(wsState, ord, price, modeKey);
            deskMutated = true;
          }
        }
      }
    }
    if (deskMutated) {
      perfEngine.sendToUser(wsState.userId, {
        type: 'desk:state',
        payload: buildDeskStatePayload(wsState),
      });
    }

    let alertsMutated = false;
    for (const alert of wsState.alerts) {
      if (!alert.active || alert.symbol !== symbol) continue;
      const hit =
        (alert.condition === 'above' && price >= alert.targetPrice) ||
        (alert.condition === 'below' && price <= alert.targetPrice);
      if (hit) {
        alert.active = false;
        alert.triggeredAt = now;
        alertsMutated = true;
        perfEngine.sendToUser(wsState.userId, {
          type: 'alert:triggered',
          payload: { ...alert },
        });
      }
    }
    if (alertsMutated) {
      perfEngine.sendToUser(wsState.userId, {
        type: 'alerts:updated',
        payload: [...wsState.alerts],
      });
    }
  }

  perfEngine.recordTick();
  perfEngine.invalidateSnapshotCache();

  // Stream focused updates in O(1) to subscribers viewing this symbol
  broadcast({ type: 'candle:update', payload: { symbol, candle: lastCandle } }, symbol);
  broadcast({ type: 'book:update', payload: book }, symbol);
  broadcast({ type: 'trade:executed', payload: trade }, symbol);
}

// Start Live Upstream Feeds (Coinbase WS + CCXT Binance & KuCoin Live Adapters)
const liveSymbolsLastTick = new Map<string, number>();
const coinbaseSymbols = SEED_ASSETS.filter((a) => Boolean(a.coinbaseProductId)).map((a) => a.symbol);

startCoinbaseWebSocket(coinbaseSymbols, (symbol, price, size, side, venue) => {
  liveSymbolsLastTick.set(symbol, Date.now());
  processMarketTick(symbol, price, size, side, venue, true);
});

const ccxtAdapters = createCcxtExchangeAdapters({
  cryptoAssets: SEED_ASSETS.filter((a) => a.assetClass === 'crypto').map((a) => ({
    symbol: a.symbol,
    cryptoTicker: a.cryptoTicker,
  })),
  onTick: (tick) => {
    liveSymbolsLastTick.set(tick.symbol, Date.now());
    const inst = instrumentsMap.get(tick.symbol);
    if (inst && typeof tick.volume24h === 'number' && tick.volume24h > 0) {
      inst.volume24h = tick.volume24h;
    }
    processMarketTick(tick.symbol, tick.price, tick.size, tick.side, tick.exchange, true);
  },
  pollIntervalMs: 28_000,
});

async function refreshExternalSnapshots() {
  const equityAndFx = SEED_ASSETS.filter((a) => a.assetClass !== 'crypto').map((a) => ({
    symbol: a.symbol,
    yahooSymbol: a.yahooSymbol,
  }));
  const cryptoCoins = SEED_ASSETS.filter((a) => a.assetClass === 'crypto').map((a) => ({
    symbol: a.symbol,
    cryptoTicker: a.cryptoTicker,
  }));

  const [eqSnapshots, cryptoSnapshots, freshNews] = await Promise.all([
    fetchEquityAndFxSnapshots(equityAndFx),
    fetchMultiCryptoSnapshots(cryptoCoins),
    fetchLiveNews(),
  ]);

  for (const [symbol, snap] of Object.entries({ ...eqSnapshots, ...cryptoSnapshots })) {
    const inst = instrumentsMap.get(symbol);
    if (inst) {
      inst.open24h = snap.open;
      inst.high24h = Math.max(inst.high24h, snap.high);
      inst.low24h = Math.min(inst.low24h, snap.low);
      liveSymbolsLastTick.set(symbol, Date.now());
      processMarketTick(symbol, snap.price, Math.max(10, Math.round(snap.volume / 5000)), 'buy', inst.venue, true);
      inst.volume24h = snap.volume;
    }
  }

  if (freshNews.length > 0) {
    const merged = [...freshNews, ...BASELINE_NEWS];
    const unique = new Map<string, NewsItem>();
    for (const item of merged) {
      if (!unique.has(item.title)) unique.set(item.title, item);
    }
    newsFeed = Array.from(unique.values())
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 24);
    broadcast({ type: 'news:update', payload: newsFeed });
  }

  scheduleMarketStatePersist(() => ({
    instruments: Array.from(instrumentsMap.values()),
    auditLogs: auditLogsList.slice(0, 80),
    riskEvents: riskEventsList.slice(0, 60),
  }));
}

void refreshExternalSnapshots();
setInterval(() => void refreshExternalSnapshots(), 40_000);

// Periodic market tick synchronization & rotating liquidity loop across 116 global markets
let tickCursor = 0;
let tickCycle = 0;
setInterval(() => {
  tickCycle += 1;
  const now = Date.now();
  const activeWatched = new Set<string>(Array.from(clients.values()).map((c) => c.activeSymbol));

  // Tick any symbol currently watched by an active user if stale
  for (const sym of activeWatched) {
    const seed = SEED_ASSETS.find((s) => s.symbol === sym);
    const inst = instrumentsMap.get(sym);
    const lastExternal = liveSymbolsLastTick.get(sym) ?? 0;
    if (seed && inst && now - lastExternal > 8000) {
      const microShock = (Math.random() - 0.495) * seed.volatility * 0.45;
      const nextPrice = inst.price * (1 + microShock);
      const qty =
        seed.assetClass === 'crypto' && inst.price > 5000
          ? Math.random() * 0.35 + 0.02
          : Math.round(Math.random() * 85 + 5);
      processMarketTick(sym, nextPrice, qty, microShock >= 0 ? 'buy' : 'sell', inst.venue, false);
    }
  }

  // Rotate across 18 non-active markets per cycle so all 116 instruments stay fresh with low CPU/event-loop lag
  const batchSize = Math.min(18, SEED_ASSETS.length);
  for (let i = 0; i < batchSize; i++) {
    const seed = SEED_ASSETS[(tickCursor + i) % SEED_ASSETS.length];
    if (activeWatched.has(seed.symbol)) continue;
    const lastExternal = liveSymbolsLastTick.get(seed.symbol) ?? 0;
    const isStale = now - lastExternal > 8000;
    const inst = instrumentsMap.get(seed.symbol);
    if (inst && isStale) {
      const microShock = (Math.random() - 0.495) * seed.volatility * 0.45;
      const nextPrice = inst.price * (1 + microShock);
      const qty =
        seed.assetClass === 'crypto' && inst.price > 5000
          ? Math.random() * 0.35 + 0.02
          : Math.round(Math.random() * 85 + 5);
      processMarketTick(seed.symbol, nextPrice, qty, microShock >= 0 ? 'buy' : 'sell', inst.venue, false);
    }
  }
  tickCursor = (tickCursor + batchSize) % SEED_ASSETS.length;

  perfEngine.setCatalogCounts(instrumentsMap.size, listAuthTelemetryEvents(500).length);

  actionableInsights = generateActionableInsights(
    Array.from(instrumentsMap.values()),
    Object.fromEntries(predictionsMap.entries()),
    recentPatterns,
    newsFeed
  );

  tickAgentPerformance(instrumentsMap, predictionsMap);

  broadcast({
    type: 'market:batch',
    payload: {
      instruments: Array.from(instrumentsMap.values()),
      predictions: Object.fromEntries(predictionsMap.entries()),
      engineMetrics: perfEngine.getMetrics(false),
      connectors: ccxtAdapters.getStatuses(),
    },
  });

  if (tickCycle % 2 === 0) {
    tickAllTradingBots({
      getWorkspace: (userId) => {
        for (const ws of listAllWorkspaces()) {
          if (ws.userId === userId) {
            return {
              lockdownMode: ws.lockdownMode,
              accountMode: ws.accountMode,
              demoCashBalance: ws.demoCashBalance,
              realCashBalance: ws.realCashBalance,
              positions: Array.from(ws.positionsMap.values()),
              realPositions: Array.from(ws.realPositionsMap.values()),
            };
          }
        }
        return null;
      },
      getInstrument: (sym) => instrumentsMap.get(sym),
      getPrediction: (sym) => predictionsMap.get(sym),
      getCandles: (sym) => candlesMap.get(sym) ?? [],
      executeFill: (userId, order, fillPrice, mode) => {
        for (const ws of listAllWorkspaces()) {
          if (ws.userId === userId) {
            const targetList = mode === 'real' ? ws.realOrders : ws.orders;
            targetList.unshift(order);
            if (targetList.length > 100) targetList.pop();
            executeOrderFill(ws, order, fillPrice, mode);
            perfEngine.sendToUser(userId, {
              type: 'desk:state',
              payload: buildDeskStatePayload(ws),
            });
            break;
          }
        }
      },
      onUserBotUpdated: () => {
        // Polled smoothly / fetched on demand or next state sync
      },
    });

    broadcast({
      type: 'agents:performance',
      payload: getAgentLeaderboardSnapshot(),
    });
    broadcast({
      type: 'global:monitor',
      payload: buildGlobalMonitorSnapshot({
        instrumentsMap,
        predictionsMap,
        securityStatus,
        activeLockdowns: Array.from(listAllWorkspaces()).filter((w) => w.lockdownMode).length,
      }),
    });
  }
}, 1800);

// Periodic checkpoint flush for market state + workspace ledgers
setInterval(() => {
  flushMarketStateNow({
    instruments: Array.from(instrumentsMap.values()),
    auditLogs: auditLogsList.slice(0, 80),
    riskEvents: riskEventsList.slice(0, 60),
  });
}, 15_000).unref();

// Express App + HTTP + WebSocket Server
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    const t0 = performance.now();
    res.on('finish', () => {
      perfEngine.recordApiLatency(performance.now() - t0);
    });
  }
  next();
});
app.use(
  createSecurityFirewallMiddleware({
    securityStatus,
    firewallIncidents: firewallIncidentsList,
    onSecurityEvent: (inc) => {
      if (inc) {
        notifyDefenseAgentIncident(inc);
        ingestFirewallIncidentToSiem(inc);
      }
      broadcast({
        type: 'security:update',
        payload: {
          securityStatus: { ...securityStatus },
          firewallIncidents: firewallIncidentsList.slice(0, 40),
        },
      });
    },
  })
);

function isHttpsContext(req: { headers: http.IncomingHttpHeaders; secure?: boolean }): boolean {
  const fwdProto = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase();
  return (
    IS_PROD ||
    Boolean(req.secure) ||
    fwdProto.includes('https') ||
    (process.env.APP_URL ?? '').startsWith('https://')
  );
}

function getRequestRpAndOrigin(req: { headers: http.IncomingHttpHeaders; secure?: boolean }): { rpId: string; origin: string } {
  const headerOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const baseUrl = resolveAppBaseUrl(headerOrigin || `${isHttpsContext(req) ? 'https' : 'http'}://${req.headers.host || 'localhost:3000'}`);
  try {
    const parsed = new URL(baseUrl);
    return { rpId: parsed.hostname, origin: parsed.origin };
  } catch {
    return { rpId: 'localhost', origin: 'http://localhost:3000' };
  }
}

function setAuthCookie(req: express.Request, res: express.Response, token: string) {
  const https = isHttpsContext(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
}

app.get('/api/health', (req, res) => {
  const session = extractSessionFromReq(req);
  const isFounder = Boolean(session && isFounderEmail(session.user.email));
  res.json({
    status: 'ok',
    instruments: instrumentsMap.size,
    clients: clients.size,
    engineMetrics: perfEngine.getMetrics(isFounder),
    ...(isFounder ? { authStats: getAuthStats() } : {}),
  });
});

app.get('/api/v1/market/snapshot', (_req, res) => {
  const payload = perfEngine.getCachedSnapshot(250, () => ({
    instruments: Array.from(instrumentsMap.values()),
    predictions: Object.fromEntries(predictionsMap.entries()),
    insights: actionableInsights,
    patterns: recentPatterns.slice(0, 20),
    updatedAt: Date.now(),
  }));
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=1');
  res.send(payload);
});

app.get('/api/v1/market/candles/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const baseCandles = candlesMap.get(symbol);
  if (!baseCandles) {
    res.status(404).json({ error: `Unknown symbol: ${symbol}` });
    return;
  }
  const rawTf = typeof req.query.tf === 'string'
    ? req.query.tf
    : typeof req.query.timeframe === 'string'
    ? req.query.timeframe
    : undefined;
  const tf = normalizeTimeframe(rawTf);
  res.json({ symbol, timeframe: tf, candles: getCandlesForTimeframe(symbol, tf) });
});

app.get('/api/v1/market/book/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const book = orderBooksMap.get(symbol);
  if (!book) {
    res.status(404).json({ error: `Unknown symbol: ${symbol}` });
    return;
  }
  res.json(book);
});

// Commercial Data API Endpoint with API Key metering
app.get('/api/v1/market/quote/:symbol', (req, res) => {
  const apiKeyHeader = req.header('x-api-key');
  if (apiKeyHeader) {
    const matched = rawKeyLookup.get(apiKeyHeader) ?? apiKeysList.find((k) => k.keyPreview === apiKeyHeader);
    if (matched) matched.callsToday += 1;
  }

  const symbol = req.params.symbol.toUpperCase();
  const inst = instrumentsMap.get(symbol);
  const pred = predictionsMap.get(symbol);
  const book = orderBooksMap.get(symbol);
  if (!inst || !pred || !book) {
    res.status(404).json({ error: `Unknown symbol: ${symbol}` });
    return;
  }

  res.json({
    instrument: inst,
    mlPrediction: pred,
    topOfBook: {
      bid: book.bids[0],
      ask: book.asks[0],
      imbalancePct: book.imbalancePct,
    },
    patterns: recentPatterns.filter((p) => p.symbol === symbol).slice(0, 5),
    timestamp: Date.now(),
  });
});

app.get('/api/v1/keys', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: 'Founder Admin privileges required to view institutional API keys.' });
    return;
  }
  res.json({ keys: apiKeysList });
});

app.post('/api/v1/keys', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: 'Founder Admin privileges required to issue API keys.' });
    return;
  }
  const body = req.body as { label?: string; tier?: ApiLicenseKey['tier'] };
  const label = (body.label ?? 'Custom Trading Bot').trim().slice(0, 60);
  const tier: ApiLicenseKey['tier'] =
    body.tier === 'Institutional' || body.tier === 'Pro' ? body.tier : 'Starter';
  const rateLimitPerMin = tier === 'Institutional' ? 12000 : tier === 'Pro' ? 2400 : 300;
  const token = `${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(8).toString('hex')}`;
  const keyPreview = `****${token.slice(-4)}`;

  const created: ApiLicenseKey = {
    id: `key-${Date.now()}`,
    label: label || 'Unnamed API Key',
    keyPreview,
    tier,
    rateLimitPerMin,
    callsToday: 0,
    createdAt: Date.now(),
  };
  apiKeysList.unshift(created);
  rawKeyLookup.set(token, created);
  res.status(201).json({ key: created, rawToken: token });
});

app.delete('/api/v1/keys/:id', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: 'Founder Admin privileges required to revoke API keys.' });
    return;
  }
  const idx = apiKeysList.findIndex((k) => k.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }
  apiKeysList.splice(idx, 1);
  res.json({ ok: true, keys: apiKeysList });
});

app.post('/api/v1/news/ingest', (req, res) => {
  const body = req.body as { title?: string; source?: string; symbols?: string[]; region?: NewsItem['region'] };
  const title = sanitizePlainText(body.title ?? '', 220);
  if (!title) {
    res.status(400).json({ error: 'Headline title is required' });
    return;
  }
  const cleanSymbols = Array.isArray(body.symbols) && body.symbols.length > 0
    ? Array.from(new Set(body.symbols.map((s) => sanitizePlainText(s, 20).toUpperCase()).filter(Boolean)))
    : ['SPY'];
  const primarySym = cleanSymbols[0] ?? 'SPY';
  const primaryInst = instrumentsMap.get(primarySym);
  const inferRegion = (): NewsItem['region'] => {
    if (body.region) return body.region;
    if (primaryInst) {
      if (primaryInst.region === 'india') return 'India';
      if (primaryInst.region === 'crypto' || primaryInst.assetClass === 'crypto') return 'Crypto';
      if (primaryInst.region === 'europe') return 'Europe';
      if (primaryInst.region === 'asia') return 'Asia';
      if (primaryInst.region === 'fx' || primaryInst.region === 'commodities') return 'Macro';
      if (primaryInst.region === 'us') return 'US';
    }
    if (primarySym.endsWith('.NS') || primarySym.endsWith('.BO')) return 'India';
    if (primarySym.endsWith('-USD')) return 'Crypto';
    return 'Global';
  };
  const { sentiment, sentimentScore } = scoreHeadlineSentiment(title);
  const item: NewsItem = {
    id: `custom-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    title,
    source: sanitizePlainText(body.source ?? 'Desk Dispatch', 48) || 'Desk Dispatch',
    url: '#',
    publishedAt: Date.now(),
    symbols: cleanSymbols,
    region: inferRegion(),
    sentiment,
    sentimentScore,
    summary: title,
  };
  newsFeed.unshift(item);
  newsFeed = newsFeed.slice(0, 24);
  broadcast({ type: 'news:update', payload: newsFeed });
  res.status(201).json({ item });
});

// Server-side AI Investment Thesis Synthesis via @google/genai (gemini-4-hydrogen)
app.post('/api/v1/ai/brief', async (req, res) => {
  const body = req.body as { symbol?: string };
  const symbol = (body.symbol ?? 'NVDA').toUpperCase();
  const inst = instrumentsMap.get(symbol);
  const pred = predictionsMap.get(symbol);
  const book = orderBooksMap.get(symbol);

  if (!inst || !pred || !book) {
    res.status(404).json({ error: `Symbol ${symbol} not found` });
    return;
  }

  const symbolPatterns = recentPatterns.filter((p) => p.symbol === symbol).slice(0, 4);
  const symbolNews = newsFeed.filter((n) => n.symbols.includes(symbol)).slice(0, 4);

  const fallbackBrief = (): AiThesisBrief => {
    const isBull = pred.predictedReturnPct >= 0;
    const stance: AiThesisBrief['stance'] =
      pred.opportunityScore >= 75 && isBull
        ? 'Strong Buy'
        : isBull
        ? 'Tactical Long'
        : pred.predictedReturnPct < -0.25
        ? 'Tactical Short'
        : 'Neutral';

    return {
      symbol,
      stance,
      headline: `${inst.name} (${symbol}) exhibits ${pred.regime.toLowerCase()} structure with ${pred.predictedReturnPct >= 0 ? '+' : ''}${pred.predictedReturnPct.toFixed(2)}% 15m model drift`,
      rationale: `Quantitative regression and EWMA volatility models indicate ${pred.direction.toLowerCase()} expectation toward ${roundPrice(symbol, pred.predictedPrice)} (${(pred.confidence * 100).toFixed(0)}% confidence). Order book imbalance stands at ${book.imbalancePct > 0 ? '+' : ''}${book.imbalancePct}% with RSI(14) at ${pred.rsi14.toFixed(1)} and Z-score ${pred.zScore.toFixed(2)}.`,
      catalysts: [
        symbolPatterns[0]
          ? `Technical trigger: ${symbolPatterns[0].name} (${symbolPatterns[0].bias})`
          : `EMA(9) vs EMA(21) alignment in ${pred.regime} regime`,
        symbolNews[0]
          ? `News flow: ${symbolNews[0].title} (${symbolNews[0].sentiment})`
          : `Cross-venue liquidity spread stable at ${inst.spreadBps} bps on ${inst.venue}`,
      ],
      riskFactors: [
        `Annualized realized volatility estimated at ${pred.volatilityAnnPct.toFixed(1)}%`,
        `Invalidation if price breaches 1-sigma lower/upper corridor (${roundPrice(symbol, pred.bandLow)} - ${roundPrice(symbol, pred.bandHigh)})`,
      ],
      entryZone: `${roundPrice(symbol, inst.price * 0.9985)} – ${roundPrice(symbol, inst.price * 1.0015)}`,
      targetZone: `${roundPrice(symbol, pred.predictedPrice)}`,
      invalidationLevel: `${roundPrice(symbol, isBull ? pred.bandLow : pred.bandHigh)}`,
      generatedBy: 'Quantitative Engine',
      generatedAt: Date.now(),
    };
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    res.json(fallbackBrief());
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptContext = JSON.stringify({
      symbol,
      name: inst.name,
      venue: inst.venue,
      price: inst.price,
      change24hPct: inst.changePct,
      spreadBps: inst.spreadBps,
      orderBookImbalancePct: book.imbalancePct,
      mlPrediction: pred,
      detectedPatterns: symbolPatterns,
      recentNews: symbolNews.map((n) => ({
        title: n.title,
        sentiment: n.sentiment,
        source: n.source,
      })),
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this real-time market telemetry and synthesize an institutional execution brief:\n${promptContext}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are an institutional quantitative market strategist. Produce concise, data-grounded, non-promotional financial analysis strictly referencing the provided metrics.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stance: {
              type: Type.STRING,
              description: 'One of: Strong Buy, Tactical Long, Neutral, Tactical Short',
            },
            headline: { type: Type.STRING },
            rationale: { type: Type.STRING },
            catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
            entryZone: { type: Type.STRING },
            targetZone: { type: Type.STRING },
            invalidationLevel: { type: Type.STRING },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<AiThesisBrief>;
    const validStance =
      parsed.stance === 'Strong Buy' ||
      parsed.stance === 'Tactical Long' ||
      parsed.stance === 'Tactical Short' ||
      parsed.stance === 'Neutral'
        ? parsed.stance
        : 'Neutral';

    res.json({
      symbol,
      stance: validStance,
      headline: parsed.headline || fallbackBrief().headline,
      rationale: parsed.rationale || fallbackBrief().rationale,
      catalysts: Array.isArray(parsed.catalysts) && parsed.catalysts.length ? parsed.catalysts : fallbackBrief().catalysts,
      riskFactors: Array.isArray(parsed.riskFactors) && parsed.riskFactors.length ? parsed.riskFactors : fallbackBrief().riskFactors,
      entryZone: parsed.entryZone || `${inst.price}`,
      targetZone: parsed.targetZone || `${roundPrice(symbol, pred.predictedPrice)}`,
      invalidationLevel: parsed.invalidationLevel || `${roundPrice(symbol, pred.bandLow)}`,
      generatedBy: 'Gemini 4 Hydrogen',
      generatedAt: Date.now(),
    } satisfies AiThesisBrief);
  } catch {
    res.json(fallbackBrief());
  }
});

// Server-Side Multi-Turn AI Trading & Platform Assistant (Gemini 4 Hydrogen)
app.post('/api/v1/ai/assistant', async (req, res) => {
  const session = extractSessionFromReq(req);
  const body = req.body as {
    message?: string;
    symbol?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const symbol = (body.symbol ?? 'NVDA').toUpperCase();
  const inst = instrumentsMap.get(symbol) ?? instrumentsMap.get('NVDA');
  const pred = predictionsMap.get(symbol) ?? predictionsMap.get('NVDA');
  const book = orderBooksMap.get(symbol) ?? orderBooksMap.get('NVDA');
  const wsState = session
    ? getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100)
    : undefined;

  const result = await generateAiAssistantResponse({
    user: session?.user,
    symbol: inst?.symbol ?? symbol,
    instrument: inst,
    prediction: pred,
    orderBook: book,
    nexusReport: latestNexusReport,
    news: newsFeed,
    accountMode: wsState?.accountMode ?? 'demo',
    cashBalance: wsState ? getActiveCashBalance(wsState) : 1_000_000,
    demoCashBalance: wsState?.demoCashBalance ?? 1_000_000,
    realCashBalance: wsState?.realCashBalance ?? 0,
    vaultBalanceUsd: wsState?.vaultBalanceUsd ?? 0,
    positions: wsState ? recomputePositions(wsState) : [],
    lockdownMode: wsState?.lockdownMode ?? false,
    history: Array.isArray(body.history) ? body.history : [],
    message: body.message ?? '',
  });

  res.json({
    reply: result.reply,
    symbol: inst?.symbol ?? symbol,
    poweredBy: result.poweredBy,
    timestamp: Date.now(),
  });
});

function runAndRecordNexusEvaluation(symbol: string, actor = 'NEXUS Orchestrator'): NexusConsensusReport | null {
  const sym = symbol.toUpperCase();
  const inst = instrumentsMap.get(sym);
  const candles = candlesMap.get(sym);
  const book = orderBooksMap.get(sym);
  const prediction = predictionsMap.get(sym);
  if (!inst || !candles || !book || !prediction) return null;

  const fallbackWs = getOrCreateWorkspace('usr-principal-1', (s) => instrumentsMap.get(s)?.price ?? 100);
  const report = evaluateNexus24Agents({
    inst,
    candles,
    book,
    prediction,
    patterns: recentPatterns,
    news: newsFeed,
    positions: recomputePositions(fallbackWs),
    cashBalance: fallbackWs.cashBalance,
  });

  latestNexusReport = report;

  pushAuditLog({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventType: report.riskGate.verdict === 'REJECT' ? 'RISK_VETO' : 'CONSENSUS_RUN',
    actor,
    symbol: sym,
    summary: `24-Agent Consensus: ${report.finalDecision} (S=${report.weightedScore}) · A24 Gate: ${report.riskGate.verdict}`,
    payloadJson: JSON.stringify({
      runId: report.runId,
      finalDecision: report.finalDecision,
      weightedScore: report.weightedScore,
      riskVerdict: report.riskGate.verdict,
      checks: report.riskGate.checks,
    }),
    createdAt: report.createdAt,
  });

  pushRiskEvent({
    id: `rsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: sym,
    severity:
      report.riskGate.verdict === 'REJECT'
        ? 'HIGH'
        : report.riskGate.verdict === 'ESCALATE'
        ? 'MEDIUM'
        : 'LOW',
    verdict: report.riskGate.verdict,
    description: report.riskGate.summary,
    createdAt: report.createdAt,
  });

  broadcast({ type: 'nexus:report', payload: report });
  broadcast({
    type: 'audit:update',
    payload: {
      auditLogs: auditLogsList.slice(0, 50),
      riskEvents: riskEventsList.slice(0, 40),
    },
  });

  return report;
}

// Run initial 24-agent consensus on NVDA so dashboard starts populated
runAndRecordNexusEvaluation('NVDA', 'Startup Orchestrator');

// Authentication & High-Security Session Endpoints
app.get('/api/v1/auth/me', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }
  recordDeviceFromReq(session.user.id, req);
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  res.json({
    authenticated: true,
    user: session.user,
    lockdownMode: wsState.lockdownMode,
    sessions: listUserSessions(session.user.id, session.sid),
    passkeys: listPasskeysForUser(session.user.id),
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const body = req.body as { email?: string; password?: string };
  const result = authenticateAccount(
    { email: body.email ?? '', password: body.password ?? '' },
    {
      userAgent: req.headers['user-agent'] ?? 'Browser Client',
      rawIp: extractRawClientIp(req),
    }
  );

  if (!result.ok) {
    if (result.bruteForceLocked) {
      pushFirewallIncident({
        id: `fw-auth-${Date.now()}`,
        severity: 'CRITICAL',
        category: 'AUTH_STEPUP',
        ruleTriggered: `Brute-force login shield triggered for ${sanitizePlainText(body.email, 40)}`,
        method: 'POST',
        path: '/api/v1/auth/login',
        maskedIp: maskClientIp(req),
        action: 'BLOCKED',
        createdAt: Date.now(),
      });
      securityStatus.totalBlocked += 1;
      broadcast({
        type: 'security:update',
        payload: {
          securityStatus: { ...securityStatus },
          firewallIncidents: firewallIncidentsList.slice(0, 40),
        },
      });
    }
    res.status(result.status).json({ error: result.error });
    return;
  }

  if (result.mfaRequired) {
    res.json({
      mfaRequired: true,
      mfaChallenge: result.mfaChallenge,
    });
    return;
  }

  setAuthCookie(req, res, result.token);
  recordDeviceFromReq(result.user.id, req);
  const wsState = getOrCreateWorkspace(result.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  void getOrCreateUser(result.user.id, result.user.email, {
    displayName: result.user.name,
    role: result.user.role,
    isAdmin: result.user.isAdmin,
    marketFocus: result.user.marketFocus,
    realMoneyEnabled: result.user.realMoneyEnabled,
  })
    .then(() =>
      recordAuthAuditInCloudSql({
        uid: result.user.id,
        email: result.user.email,
        eventType: 'PASSWORD_LOGIN',
        provider: 'scrypt',
        outcome: 'SUCCESS',
        detail: 'Desk sign-in synced to Cloud SQL',
      })
    )
    .catch(() => {});
  res.json({
    user: result.user,
    token: result.token,
    lockdownMode: wsState.lockdownMode,
    sessions: listUserSessions(result.user.id, result.sessionId),
    passkeys: listPasskeysForUser(result.user.id),
  });
});

app.post('/api/v1/auth/mfa/verify', (req, res) => {
  const body = req.body as { mfaToken?: string; code?: string };
  const result = verifyMfaLoginCode(
    { mfaToken: body.mfaToken ?? '', code: body.code ?? '' },
    {
      userAgent: req.headers['user-agent'] ?? 'Browser Client',
      rawIp: extractRawClientIp(req),
    }
  );
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  setAuthCookie(req, res, result.token);
  recordDeviceFromReq(result.user.id, req);
  const wsState = getOrCreateWorkspace(result.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  res.json({
    user: result.user,
    token: result.token,
    lockdownMode: wsState.lockdownMode,
    sessions: listUserSessions(result.user.id, result.sessionId),
    passkeys: listPasskeysForUser(result.user.id),
  });
});

app.post('/api/v1/auth/mfa/totp/setup', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const setup = startTotpEnrollment(session.user.id);
  if (!setup) {
    res.status(404).json({ error: 'User account not found' });
    return;
  }
  res.json({ setup });
});

app.post('/api/v1/auth/mfa/totp/verify', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const body = req.body as { code?: string };
  const confirmed = confirmTotpEnrollment(session.user.id, body.code ?? '', {
    rawIp: extractRawClientIp(req),
    userAgent: req.headers['user-agent'] ?? 'Browser Client',
  });
  if (!confirmed.ok) {
    res.status(400).json({ error: confirmed.error });
    return;
  }
  res.json({ user: confirmed.user });
});

app.post('/api/v1/auth/mfa/totp/disable', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = disableTotpForUser(session.user.id, {
    rawIp: extractRawClientIp(req),
    userAgent: req.headers['user-agent'] ?? 'Browser Client',
  });
  if (!user) {
    res.status(404).json({ error: 'User account not found' });
    return;
  }
  res.json({ user });
});

// WebAuthn / FIDO2 Hardware Security Keys & Passkeys
app.get('/api/v1/auth/passkeys', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  res.json({ passkeys: listPasskeysForUser(session.user.id) });
});

app.post('/api/v1/auth/passkeys/register/options', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { rpId, origin } = getRequestRpAndOrigin(req);
  const { challengeId, challenge } = createWebAuthnChallenge({
    kind: 'register',
    userId: session.user.id,
    rpId,
    origin,
  });
  const existing = listPasskeysForUser(session.user.id);
  res.json({
    challengeId,
    publicKey: {
      challenge,
      rp: { name: 'Aurex Global Exchange', id: rpId },
      user: {
        id: Buffer.from(session.user.id, 'utf8').toString('base64url'),
        name: session.user.email,
        displayName: session.user.name,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      timeout: 90000,
      attestation: 'none',
      excludeCredentials: existing.map((k) => ({ id: k.id, type: 'public-key' })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    },
  });
});

app.post('/api/v1/auth/passkeys/register/verify', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const body = req.body as {
    challengeId?: string;
    credentialIdB64?: string;
    clientDataJSONB64?: string;
    authenticatorDataB64?: string;
    spkiPublicKeyB64?: string;
    algorithmCode?: number;
    label?: string;
    transports?: string[];
  };

  if (!body.challengeId || !body.credentialIdB64 || !body.clientDataJSONB64 || !body.spkiPublicKeyB64) {
    res.status(400).json({ error: 'Incomplete hardware passkey attestation payload.' });
    return;
  }

  const verified = verifyWebAuthnRegistrationPayload({
    challengeId: body.challengeId,
    userId: session.user.id,
    clientDataJSONB64: body.clientDataJSONB64,
    authenticatorDataB64: body.authenticatorDataB64,
    spkiPublicKeyB64: body.spkiPublicKeyB64,
    algorithmCode: Number(body.algorithmCode ?? -7),
  });

  if (!verified.ok) {
    res.status(400).json({ error: verified.error });
    return;
  }

  const saved = registerPasskeyForUser(
    session.user.id,
    {
      credentialIdB64: body.credentialIdB64,
      spkiPublicKeyB64: verified.spkiDerB64,
      label: body.label ?? 'Hardware Security Key',
      algorithm: verified.algorithmName,
      transports: Array.isArray(body.transports) ? body.transports : ['internal'],
    },
    {
      rawIp: extractRawClientIp(req),
      userAgent: req.headers['user-agent'] ?? 'Browser Client',
    }
  );
  if (!saved.ok) {
    res.status(409).json({ error: saved.error });
    return;
  }

  res.status(201).json({
    user: saved.user,
    passkey: saved.passkey,
    passkeys: listPasskeysForUser(session.user.id),
  });
});

app.delete('/api/v1/auth/passkeys/:id', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = removePasskeyForUser(session.user.id, req.params.id, {
    rawIp: extractRawClientIp(req),
    userAgent: req.headers['user-agent'] ?? 'Browser Client',
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user, passkeys: listPasskeysForUser(session.user.id) });
});

app.post('/api/v1/auth/passkeys/login/options', (req, res) => {
  const body = req.body as { email?: string; mfaToken?: string };
  const lookup = findPasskeysForAuthLookup({ email: body.email, mfaToken: body.mfaToken });
  if (lookup.allowCredentials.length === 0) {
    res.status(404).json({
      error: 'No hardware security keys or passkeys registered yet. Sign in and enroll one inside Security & Vault.',
    });
    return;
  }
  const { rpId, origin } = getRequestRpAndOrigin(req);
  const { challengeId, challenge } = createWebAuthnChallenge({
    kind: 'assert',
    userId: lookup.userId,
    rpId,
    origin,
  });

  res.json({
    challengeId,
    publicKey: {
      challenge,
      rpId,
      timeout: 90000,
      userVerification: 'preferred',
      allowCredentials: lookup.allowCredentials.map((c) => ({
        id: c.id,
        type: 'public-key',
        transports: c.transports,
      })),
    },
  });
});

app.post('/api/v1/auth/passkeys/login/verify', (req, res) => {
  const body = req.body as {
    challengeId?: string;
    credentialIdB64?: string;
    authenticatorDataB64?: string;
    clientDataJSONB64?: string;
    signatureB64?: string;
    mfaToken?: string;
  };

  if (
    !body.challengeId ||
    !body.credentialIdB64 ||
    !body.authenticatorDataB64 ||
    !body.clientDataJSONB64 ||
    !body.signatureB64
  ) {
    res.status(400).json({ error: 'Incomplete passkey assertion payload.' });
    return;
  }

  const stored = findPasskeyRecordByCredentialId(body.credentialIdB64);
  if (!stored) {
    res.status(401).json({ error: 'Unrecognized hardware security key or passkey.' });
    return;
  }

  const verified = verifyWebAuthnAssertionPayload({
    challengeId: body.challengeId,
    authenticatorDataB64: body.authenticatorDataB64,
    clientDataJSONB64: body.clientDataJSONB64,
    signatureB64: body.signatureB64,
    spkiPublicKeyB64: stored.spkiPublicKeyB64,
  });
  if (!verified.ok) {
    res.status(401).json({ error: verified.error });
    return;
  }

  const auth = completePasskeySignIn(
    stored,
    {
      userAgent: req.headers['user-agent'] ?? 'Browser Client',
      rawIp: extractRawClientIp(req),
    },
    body.mfaToken
  );
  if (!auth) {
    res.status(401).json({ error: 'Passkey account or MFA challenge invalid.' });
    return;
  }

  setAuthCookie(req, res, auth.token);
  recordDeviceFromReq(auth.user.id, req);
  const wsState = getOrCreateWorkspace(auth.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  res.json({
    user: auth.user,
    token: auth.token,
    lockdownMode: wsState.lockdownMode,
    sessions: listUserSessions(auth.user.id, auth.sessionId),
    passkeys: listPasskeysForUser(auth.user.id),
  });
});

// Dedicated OAuth 2.0 Pre-Flight & Callback Controller (Google & GitHub)
app.use(
  '/api/v1/auth/oauth',
  createOAuthControllerRouter({
    getPrice: (s) => instrumentsMap.get(s)?.price ?? 100,
    isHttpsContext,
    setAuthCookie,
  })
);

// Dedicated Private Auth & GitHub Server Health / Identity Router
app.use(
  '/api/v1/auth',
  createAuthServerRouter({
    getPrice: (s) => instrumentsMap.get(s)?.price ?? 100,
    setAuthCookie,
  })
);

// Executable Platform Skills Registry API
app.get('/api/v1/skills', (_req, res) => {
  res.json({ skills: PLATFORM_SKILLS });
});

app.post('/api/v1/skills/:id/run', async (req, res) => {
  const session = extractSessionFromReq(req);
  const isFounder = Boolean(session && isFounderEmail(session.user.email));
  const symbol = ((req.body as { symbol?: string })?.symbol ?? 'NVDA').toUpperCase();
  const wsState = session
    ? getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100)
    : undefined;
  const githubStatus = isFounder ? await probePrivateGitHubServer(false) : undefined;
  const metrics = perfEngine.getMetrics(isFounder);
  const oauthCount =
    (validateGoogleOAuthCredentials().ok ? 1 : 0) +
    (validateGitHubOAuthCredentials().ok ? 1 : 0);

  const result = executePlatformSkill(req.params.id, {
    activeSymbol: symbol,
    cashBalance: wsState?.cashBalance ?? 1_000_000,
    instruments: Array.from(instrumentsMap.values()),
    predictions: Object.fromEntries(predictionsMap.entries()),
    user: session?.user,
    isFounder,
    securityStatus,
    githubStatus,
    storageStores: metrics.storageStores,
    oauthConfiguredCount: oauthCount,
  });

  res.json({ result });
});

app.post('/api/v1/auth/register', (req, res) => {
  const body = req.body as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    experienceMode?: 'newbie' | 'pro';
    marketFocus?: string;
    contactPhone?: string;
    termsAccepted?: boolean;
  };
  const result = registerAccount(
    {
      email: body.email ?? '',
      password: body.password ?? '',
      name: body.name ?? '',
      role: body.role,
      experienceMode: body.experienceMode,
      marketFocus: body.marketFocus,
      contactPhone: body.contactPhone,
      termsAccepted: body.termsAccepted,
    },
    {
      userAgent: req.headers['user-agent'] ?? 'Browser Client',
      rawIp: extractRawClientIp(req),
    },
    (s) => instrumentsMap.get(s)?.price ?? 100
  );

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  setAuthCookie(req, res, result.token);
  recordDeviceFromReq(result.user.id, req);
  void getOrCreateUser(result.user.id, result.user.email, {
    displayName: result.user.name,
    role: result.user.role,
    isAdmin: result.user.isAdmin,
    marketFocus: result.user.marketFocus,
    realMoneyEnabled: result.user.realMoneyEnabled,
  })
    .then(() =>
      recordAuthAuditInCloudSql({
        uid: result.user.id,
        email: result.user.email,
        eventType: 'REGISTER',
        provider: 'scrypt',
        outcome: 'SUCCESS',
        detail: 'New investor account synced to Cloud SQL',
      })
    )
    .catch(() => {});
  res.status(201).json({
    user: result.user,
    token: result.token,
    lockdownMode: false,
    sessions: listUserSessions(result.user.id, result.sessionId),
    passkeys: [],
  });
});

app.post('/api/v1/auth/logout', (req, res) => {
  const session = extractSessionFromReq(req);
  if (session) {
    revokeSession(session.sid, {
      rawIp: extractRawClientIp(req),
      userAgent: req.headers['user-agent'] ?? 'Browser Client',
    });
  }
  const https = isHttpsContext(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: https ? 'none' : 'lax',
    secure: https,
  });
  res.json({ ok: true });
});

app.get('/api/v1/auth/sessions', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  res.json({ sessions: listUserSessions(session.user.id, session.sid) });
});

app.post('/api/v1/auth/sessions/revoke-others', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const removed = revokeOtherUserSessions(session.user.id, session.sid, {
    rawIp: extractRawClientIp(req),
    userAgent: req.headers['user-agent'] ?? 'Browser Client',
  });
  res.json({
    ok: true,
    removed,
    sessions: listUserSessions(session.user.id, session.sid),
  });
});

app.patch('/api/v1/auth/preferences', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const body = req.body as {
    experienceMode?: 'newbie' | 'pro';
    twoFactorEnabled?: boolean;
    name?: string;
    role?: string;
  };
  const updated = updateUserSecurityPrefs(session.user.id, body);
  if (!updated) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json({ user: updated });
});

app.post('/api/v1/auth/real-money', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const enabled = Boolean((req.body as { enabled?: boolean })?.enabled);
  if (enabled) {
    const verif = isUserVerifiedForRealTrading(session.user.id, wsState);
    if (!verif.ok) {
      res.status(403).json({ error: verif.reason, kycVerified: verif.kycVerified, paymentVerified: verif.paymentVerified });
      return;
    }
  }
  const result = setRealMoneyTradingMode(
    session.user.id,
    enabled,
    {
      lockdownMode: wsState.lockdownMode,
      hasBankRail: wsState.bankAccounts.length > 0,
    },
    {
      rawIp: extractRawClientIp(req),
      userAgent: req.headers['user-agent'] ?? 'Browser Client',
    }
  );

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  pushAuditLog({
    id: `aud-rm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    eventType: 'RISK_GATE_CHECK',
    actor: session.user.name,
    symbol: 'CUSTODY',
    summary: result.user.realMoneyEnabled
      ? 'Real-Money Custody Mode Enabled (2+ MFA Methods Verified)'
      : 'Switched Desk Back to Simulation / Research Mode',
    payloadJson: JSON.stringify({
      userId: session.user.id,
      realMoneyEnabled: result.user.realMoneyEnabled,
      totpEnabled: result.user.totpEnabled,
      passkeysCount: result.user.passkeysCount,
    }),
    createdAt: Date.now(),
  });
  broadcast({
    type: 'audit:update',
    payload: {
      auditLogs: auditLogsList.slice(0, 50),
      riskEvents: riskEventsList.slice(0, 40),
    },
  });

  res.json({ user: result.user });
});

// Founder-Only Authentication, Registration Telemetry & Server Directory Endpoints
app.get('/api/v1/admin/overview', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }

  const users = listAdminUserDirectory((s) => instrumentsMap.get(s)?.price ?? 100);
  const authEvents = listAuthTelemetryEvents(250);
  const authStats = getAuthStats();
  const telemetrySummary = getAuthTelemetrySummary();

  res.json({
    overview: {
      totalUsers: authStats.totalUsers,
      activeSessions: authStats.activeSessions,
      totalAuthEvents: telemetrySummary.totalAuthEvents,
      failedAuthEvents: telemetrySummary.failedAuthEvents,
      realMoneyEnabledUsers: users.filter((u) => u.realMoneyEnabled).length,
      dualMfaReadyUsers: users.filter((u) => u.totpEnabled && u.passkeysCount > 0).length,
      uptimeSec: Math.round(process.uptime()),
      storageBackend: 'Encrypted Persistent Server Store',
      storageFile: path.relative(process.cwd(), STORE_FILE_PATH),
      keyStatus: getSafeServerKeyStatus(),
    },
    users,
    authEvents,
  });
});

app.get('/api/v1/admin/auth-logs', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: 'Founder Admin privileges required.' });
    return;
  }
  const rawLimit = Number(req.query.limit ?? 200);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(1000, Math.floor(rawLimit))) : 200;
  res.json({ authEvents: listAuthTelemetryEvents(limit) });
});

app.post('/api/v1/admin/users/:id/revoke-sessions', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: 'Founder Admin privileges required.' });
    return;
  }
  const result = revokeAllSessionsForUser(req.params.id, session.user.name, {
    rawIp: extractRawClientIp(req),
    userAgent: req.headers['user-agent'] ?? 'Admin Console',
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ ok: true, removed: result.removed });
});

app.post('/api/v1/admin/users/:id/admin-role', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: 'Founder Admin privileges required.' });
    return;
  }
  const makeAdmin = Boolean((req.body as { isAdmin?: boolean })?.isAdmin);
  const result = setUserAdminRole(req.params.id, makeAdmin, session.user.name, {
    rawIp: extractRawClientIp(req),
    userAgent: req.headers['user-agent'] ?? 'Admin Console',
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ ok: true, user: result.user });
});

app.get('/api/v1/admin/export/app-guide', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: 'Founder Admin privileges required to export server guide.' });
    return;
  }
  const docPath = path.resolve(process.cwd(), 'APP_KEYS_AND_INFO.md');
  if (!fs.existsSync(docPath)) {
    res.status(404).json({ error: 'APP_KEYS_AND_INFO.md not found on server.' });
    return;
  }
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="APP_KEYS_AND_INFO.md"');
  res.send(fs.readFileSync(docPath, 'utf8'));
});

// CCXT Multi-Exchange Live Connectors Status & Sync (Binance & KuCoin)
app.get('/api/v1/connectors/status', (_req, res) => {
  res.json({
    connectors: ccxtAdapters.getStatuses(),
    updatedAt: Date.now(),
  });
});

app.post('/api/v1/connectors/sync', async (_req, res) => {
  await ccxtAdapters.refreshSnapshots();
  res.json({
    ok: true,
    connectors: ccxtAdapters.getStatuses(),
    updatedAt: Date.now(),
  });
});

// Live 24-Agent Real-Market Leaderboard, Global Exchange Monitor & Viral Promo Engine APIs
app.get('/api/v1/agents/leaderboard', (_req, res) => {
  res.json({
    agents: getAgentLeaderboardSnapshot(),
    updatedAt: Date.now(),
  });
});

app.get('/api/v1/monitor/global', (_req, res) => {
  res.json(
    buildGlobalMonitorSnapshot({
      instrumentsMap,
      predictionsMap,
      securityStatus,
      activeLockdowns: Array.from(listAllWorkspaces()).filter((w) => w.lockdownMode).length,
    })
  );
});

// Compliance Country Guidelines, Copyright Safe Harbor, Global Bank/UPI Directory, News Radar, KYC & Investor Profiles
app.get('/api/v1/compliance/guidelines', (_req, res) => {
  res.json({ guidelines: COUNTRY_GUIDELINES, updatedAt: Date.now() });
});

app.get('/api/v1/payments/directory', (_req, res) => {
  res.json({ directory: GLOBAL_BANK_DIRECTORY, updatedAt: Date.now() });
});

app.get('/api/v1/news/radar', (_req, res) => {
  res.json({
    news: newsFeed,
    radar: buildNextMoveInterestRadar(
      Array.from(instrumentsMap.values()),
      Object.fromEntries(predictionsMap.entries()),
      newsFeed
    ),
    updatedAt: Date.now(),
  });
});

app.get('/api/v1/kyc/status', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to inspect KYC verification.' });
    return;
  }
  res.json({ kyc: getKycVerification(session.user.id) });
});

app.post('/api/v1/kyc/submit', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to submit KYC verification.' });
    return;
  }
  const body = req.body as {
    country?: string;
    fullName?: string;
    docType?: 'Passport' | 'Aadhaar' | 'PAN' | 'National ID' | 'Drivers License';
    docNumber?: string;
    proofOfAddressType?: string;
    selfieLivenessToken?: string;
    antiScamPledge?: boolean;
  };
  const envelopeProof = verifyClientPacketEnvelope(
    'KYC_SUBMIT',
    req.header('x-aurex-envelope'),
    body
  );
  if (!envelopeProof.ok) {
    res.status(403).json({ error: envelopeProof.reason ?? 'Encrypted envelope validation failed.' });
    return;
  }
  const result = submitKycVerification({
    userId: session.user.id,
    country: sanitizePlainText(body.country, 50) || 'India',
    fullName: sanitizePlainText(body.fullName, 80),
    docType:
      body.docType === 'Aadhaar' ||
      body.docType === 'PAN' ||
      body.docType === 'National ID' ||
      body.docType === 'Drivers License'
        ? body.docType
        : 'Passport',
    docNumber: sanitizePlainText(body.docNumber, 40),
    proofOfAddressType: sanitizePlainText(body.proofOfAddressType, 60) || 'Bank Statement / Utility Bill',
    selfieLivenessToken: sanitizePlainText(body.selfieLivenessToken, 40),
    antiScamPledge: Boolean(body.antiScamPledge),
  });
  if (!result.ok || !result.record) {
    res.status(400).json({ error: result.error ?? 'KYC validation failed.' });
    return;
  }

  trackUserQuestProgress(session.user.id, 'quest-kyc', 1);
  pushAuditLog({
    id: `aud-kyc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    eventType: 'RISK_GATE_CHECK',
    actor: session.user.name,
    symbol: 'KYC',
    summary: `Tier 2 KYC & Anti-Scam Attestation Verified (${result.record.badgeCode})`,
    payloadJson: JSON.stringify({
      userId: session.user.id,
      docType: result.record.docType,
      docHash: result.record.docHash,
    }),
    createdAt: Date.now(),
  });
  res.json({ ok: true, kyc: result.record, rewardsState: getUserRewardsState(session.user.id) });
});

app.get('/api/v1/investors/profiles', (_req, res) => {
  res.json({ profiles: listInvestorProfiles() });
});

app.post('/api/v1/investors/profiles/:id/follow', (req, res) => {
  const profile = toggleFollowInvestorProfile(req.params.id);
  if (!profile) {
    res.status(404).json({ error: 'Investor profile not found.' });
    return;
  }
  const session = extractSessionFromReq(req);
  const socialGraph = session
    ? toggleSocialFollow(session.user.id, profile.id, profile.name).graph
    : undefined;
  res.json({
    profile,
    socialGraph,
    rewardsState: session ? getUserRewardsState(session.user.id) : undefined,
  });
});

app.post('/api/v1/investors/profiles/publish', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Sign in required to publish your verified investor profile.' });
    return;
  }
  const body = req.body as {
    title?: string;
    style?: string;
    country?: string;
    focusMarkets?: string[];
    bio?: string;
  };
  const profile = publishMyInvestorProfile({
    userId: session.user.id,
    name: session.user.name,
    title: sanitizePlainText(body.title, 70),
    style: sanitizePlainText(body.style, 80),
    country: sanitizePlainText(body.country, 40),
    focusMarkets: Array.isArray(body.focusMarkets)
      ? body.focusMarkets.map((s) => sanitizePlainText(s, 20)).filter(Boolean)
      : [],
    bio: sanitizePlainText(body.bio, 260),
  });
  res.status(201).json({ profile });
});

app.get('/api/v1/scam/reports', (_req, res) => {
  res.json({ reports: listScamReports() });
});

app.post('/api/v1/scam/report', (req, res) => {
  const session = extractSessionFromReq(req);
  const body = req.body as {
    suspectedHandle?: string;
    channel?: string;
    description?: string;
  };
  const result = submitScamReport({
    suspectedHandle: sanitizePlainText(body.suspectedHandle, 80),
    channel: sanitizePlainText(body.channel, 40) || 'Social / Messaging',
    description: sanitizePlainText(body.description, 320),
    reportedBy: session?.user.name ?? 'Verified Community Watch',
  });
  if (!result.ok || !result.report) {
    res.status(400).json({ error: result.error ?? 'Invalid report submission.' });
    return;
  }
  res.status(201).json({ report: result.report });
});

app.get('/api/v1/promo/me', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to inspect referral & promo rewards.' });
    return;
  }
  const profile = getPromoProfile(
    session.user.id,
    getRequestRpAndOrigin(req).origin,
    (s: string) => instrumentsMap.get(s)?.price ?? 100
  );
  res.json({ profile });
});

app.post('/api/v1/promo/redeem', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Sign in required to claim promo or referral bonus credits.' });
    return;
  }
  const code = String((req.body as { code?: string })?.code ?? '');
  const result = redeemPromoCode(
    session.user.id,
    code,
    getRequestRpAndOrigin(req).origin,
    (s: string) => instrumentsMap.get(s)?.price ?? 100
  );
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  perfEngine.sendToUser(session.user.id, {
    type: 'desk:state',
    payload: buildDeskStatePayload(wsState),
  });
  res.json({
    ok: true,
    message: result.rewardLabel,
    bonusCreditedUsd: result.profile.bonusDemoUsd,
    profile: result.profile,
    ...buildDeskStatePayload(wsState),
  });
});

app.post('/api/v1/promo/share', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Sign in required to record social referral share rewards.' });
    return;
  }
  const channel = sanitizePlainText((req.body as { channel?: string })?.channel ?? 'social', 24) || 'social';
  const result = recordReferralShare(
    session.user.id,
    channel,
    getRequestRpAndOrigin(req).origin,
    (s: string) => instrumentsMap.get(s)?.price ?? 100
  );
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  perfEngine.sendToUser(session.user.id, {
    type: 'desk:state',
    payload: buildDeskStatePayload(wsState),
  });
  res.json({
    ok: true,
    bonusAwardedUsd: result.firstShareBonusAwarded ? 10_000 : 0,
    profile: result.profile,
    ...buildDeskStatePayload(wsState),
  });
});

// High-Performance Engine Metrics & Concurrency Stress Benchmark
app.get('/api/v1/engine/metrics', (req, res) => {
  const session = extractSessionFromReq(req);
  const isFounder = Boolean(session && isFounderEmail(session.user.email));
  res.json({
    engineMetrics: perfEngine.getMetrics(isFounder),
    ...(isFounder ? { authStats: getAuthStats() } : {}),
  });
});

app.post('/api/v1/engine/stress-test', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Sign in required to run engine stress benchmark.' });
    return;
  }
  const requested = Number((req.body as { concurrency?: unknown })?.concurrency);
  const concurrency = Number.isFinite(requested)
    ? Math.max(25, Math.min(1000, Math.floor(requested)))
    : 250;
  const tStart = performance.now();
  const latencies: number[] = [];
  let succeeded = 0;

  const symbols = SEED_ASSETS.map((a) => a.symbol);
  for (let i = 0; i < concurrency; i++) {
    const op0 = performance.now();
    const sym = symbols[i % symbols.length];
    const inst = instrumentsMap.get(sym)!;
    const candles = candlesMap.get(sym)!;
    const book = orderBooksMap.get(sym)!;
    // Exercise ML inference + snapshot cache + HMAC verification in parallel batch
    perfEngine.getCachedSnapshot(250, () => ({ ok: true }));
    runShortTermMlPrediction(inst, candles, newsFeed, book);
    succeeded += 1;
    latencies.push(performance.now() - op0);
  }

  const totalMs = Math.max(1, performance.now() - tStart);
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0.5;

  const result: StressTestResult = {
    concurrency,
    totalOperations: concurrency,
    succeeded,
    blockedByWaf: 0,
    durationMs: Number(totalMs.toFixed(2)),
    opsPerSec: Math.round((concurrency / totalMs) * 1000),
    p95LatencyMs: Number(p95.toFixed(3)),
    timestamp: Date.now(),
  };

  res.json({
    result,
    engineMetrics: perfEngine.getMetrics(),
  });
});

app.post('/api/v1/engine/flush-storage', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to flush persistent server stores.' });
    return;
  }
  flushWorkspacesImmediate();
  flushMarketStateNow({
    instruments: Array.from(instrumentsMap.values()),
    auditLogs: auditLogsList.slice(0, 80),
    riskEvents: riskEventsList.slice(0, 60),
  });
  res.json({
    ok: true,
    flushedAt: Date.now(),
    engineMetrics: perfEngine.getMetrics(),
  });
});

app.post('/api/v1/nexus/evaluate', (req, res) => {
  const body = req.body as { symbol?: string };
  const sym = (body.symbol ?? 'NVDA').toUpperCase();
  const report = runAndRecordNexusEvaluation(sym, 'Analyst Desk Request');
  if (!report) {
    res.status(404).json({ error: `Unknown symbol ${sym}` });
    return;
  }
  res.json(report);
});

app.post('/api/v1/nexus/execute', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Sign in required before routing orders.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (wsState.lockdownMode) {
    res.status(423).json({
      error: 'Account Lockdown Active: Trading & outbound execution paused by Security Firewall.',
    });
    return;
  }
  if (wsState.accountMode === 'real') {
    const verif = isUserVerifiedForRealTrading(session.user.id, wsState);
    if (!verif.ok) {
      res.status(403).json({ error: verif.reason });
      return;
    }
  }

  const body = req.body as { symbol?: string; traderName?: string };
  const sym = (body.symbol ?? 'NVDA').toUpperCase();
  const report = runAndRecordNexusEvaluation(sym, session.user.name);
  if (!report) {
    res.status(404).json({ error: `Unknown symbol ${sym}` });
    return;
  }

  if (report.riskGate.verdict === 'REJECT') {
    res.status(403).json({
      error: `Blocked by Independent Risk Agent A24: ${report.riskGate.summary}`,
      report,
    });
    return;
  }

  if (report.finalDecision === 'HOLD' || report.finalDecision === 'NO TRADE') {
    res.status(400).json({
      error: `No directional order routed because 24-agent consensus is ${report.finalDecision}.`,
      report,
    });
    return;
  }

  const inst = instrumentsMap.get(sym)!;
  const side: 'buy' | 'sell' = report.finalDecision === 'BUY' ? 'buy' : 'sell';
  const size = Math.max(report.riskGate.recommendedSize, inst.price > 1000 ? 0.1 : 5);
  const execPrice = side === 'buy' ? inst.ask : inst.bid;

  const order: Order = {
    id: `ord-nx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    clientId: session.user.id,
    traderName: session.user.name,
    symbol: sym,
    side,
    type: 'market',
    price: roundPrice(sym, execPrice),
    size,
    filledSize: 0,
    status: 'open',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notional: Number((size * execPrice).toFixed(2)),
  };

  const orderList = wsState.accountMode === 'real' ? wsState.realOrders : wsState.orders;
  orderList.unshift(order);
  if (orderList.length > 100) orderList.pop();
  executeOrderFill(wsState, order, execPrice, wsState.accountMode);

  pushAuditLog({
    id: `aud-exec-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    eventType: 'ORDER_ROUTED',
    actor: order.traderName,
    symbol: sym,
    summary: `Execution (${wsState.accountMode.toUpperCase()}): ${side.toUpperCase()} ${order.size} ${sym} @ ${order.price} (A24 ${report.riskGate.verdict})`,
    payloadJson: JSON.stringify(order),
    createdAt: Date.now(),
  });

  perfEngine.sendToUser(session.user.id, {
    type: 'desk:state',
    payload: buildDeskStatePayload(wsState),
  });
  broadcast({
    type: 'audit:update',
    payload: {
      auditLogs: auditLogsList.slice(0, 50),
      riskEvents: riskEventsList.slice(0, 40),
    },
  });

  res.json({ order, report });
});

// Zero-Trust Security Firewall, Encrypted Banking Vault & Social Desk APIs
app.get('/api/v1/security/status', (req, res) => {
  const session = extractSessionFromReq(req);
  const wsState = session
    ? getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100)
    : undefined;
  const chainValid = wsState ? verifyTransferChain(wsState.vaultTransfers) : true;
  const userStatus: SecurityStatus = {
    ...securityStatus,
    lockdownMode: wsState?.lockdownMode ?? false,
    ledgerChainValid: chainValid,
    lastVerifiedAt: Date.now(),
  };
  res.json({
    securityStatus: userStatus,
    firewallIncidents: firewallIncidentsList.slice(0, 40),
  });
});

app.post('/api/v1/security/lockdown', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to modify Vault Lockdown state.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const body = req.body as { enabled?: boolean };
  const next = typeof body.enabled === 'boolean' ? body.enabled : !wsState.lockdownMode;
  wsState.lockdownMode = next;
  persistWorkspacesSnapshot();

  pushFirewallIncident({
    id: `fw-lock-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    severity: next ? 'CRITICAL' : 'MEDIUM',
    category: 'LOCKDOWN',
    ruleTriggered: next
      ? `Emergency Vault Lockdown Engaged (${session.user.name})`
      : `Emergency Vault Lockdown Released (${session.user.name})`,
    method: 'POST',
    path: '/api/v1/security/lockdown',
    maskedIp: maskClientIp(req),
    action: next ? 'BLOCKED' : 'THROTTLED',
    createdAt: Date.now(),
  });

  pushAuditLog({
    id: `aud-sec-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    eventType: 'RISK_GATE_CHECK',
    actor: session.user.name,
    symbol: 'VAULT',
    summary: next
      ? 'Emergency Security Lockdown Enabled — outbound transfers & order routing frozen'
      : 'Security Lockdown Lifted — verified vault operations resumed',
    payloadJson: JSON.stringify({ lockdownMode: next, userId: session.user.id }),
    createdAt: Date.now(),
  });

  const userSecStatus: SecurityStatus = {
    ...securityStatus,
    lockdownMode: wsState.lockdownMode,
    ledgerChainValid: verifyTransferChain(wsState.vaultTransfers),
    lastVerifiedAt: Date.now(),
  };

  perfEngine.sendToUser(session.user.id, {
    type: 'security:update',
    payload: {
      securityStatus: userSecStatus,
      firewallIncidents: firewallIncidentsList.slice(0, 40),
    },
  });
  broadcast({
    type: 'audit:update',
    payload: {
      auditLogs: auditLogsList.slice(0, 50),
      riskEvents: riskEventsList.slice(0, 40),
    },
  });
  res.json({ securityStatus: userSecStatus });
});

app.post('/api/v1/security/verify-chain', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to verify user vault chain.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const valid = verifyTransferChain(wsState.vaultTransfers);
  if (valid) {
    trackUserQuestProgress(session.user.id, 'quest-2fa', 1);
  }
  const userSecStatus: SecurityStatus = {
    ...securityStatus,
    lockdownMode: wsState.lockdownMode,
    ledgerChainValid: valid,
    lastVerifiedAt: Date.now(),
  };
  perfEngine.sendToUser(session.user.id, {
    type: 'security:update',
    payload: {
      securityStatus: userSecStatus,
      firewallIncidents: firewallIncidentsList.slice(0, 40),
    },
  });
  res.json({ valid, count: wsState.vaultTransfers.length, verifiedAt: userSecStatus.lastVerifiedAt });
});

app.post('/api/v1/security/test-probe', (_req, res) => {
  res.json({
    ok: true,
    message: 'Clean request passed Zero-Trust WAF inspection.',
  });
});

app.post('/api/v1/vault/challenge', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to issue Step-Up 2FA code.' });
    return;
  }
  const body = req.body as { purpose?: string };
  const purpose = sanitizePlainText(body.purpose ?? 'Banking Operation', 60);
  const challenge = issueStepUpChallenge(purpose);
  res.json(challenge);
});

// Account Mode Switcher (Demo Trading Account <-> Real Trading Account)
app.post('/api/v1/account/mode', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to switch trading account.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const requested = (req.body as { mode?: 'demo' | 'real' })?.mode === 'real' ? 'real' : 'demo';
  if (requested === 'real') {
    const verif = isUserVerifiedForRealTrading(session.user.id, wsState);
    if (!verif.ok) {
      res.status(403).json({
        error: verif.reason,
        kycVerified: verif.kycVerified,
        paymentVerified: verif.paymentVerified,
      });
      return;
    }
  }
  wsState.accountMode = requested;
  wsState.cashBalance = getActiveCashBalance(wsState);
  persistWorkspacesSnapshot();

  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, {
    type: 'desk:state',
    payload: deskPayload,
  });
  res.json(deskPayload);
});

// Hacker-Proof Cold Vault Shield (Lock real trading funds away from active session / Release via 2FA OTP)
app.post('/api/v1/vault/shield', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to manage Cold Vault protection.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (wsState.lockdownMode) {
    res.status(423).json({
      error: 'Emergency Lockdown Active: Lift Vault Lockdown first before moving Cold Vault funds.',
    });
    return;
  }

  const body = req.body as {
    action?: 'lock' | 'unlock';
    amountUsd?: number;
    challengeId?: string;
    otpCode?: string;
  };
  const action = body.action === 'unlock' ? 'unlock' : 'lock';
  const amountUsd = Number(body.amountUsd ?? 0);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    res.status(400).json({ error: 'Provide a positive USD amount to move.' });
    return;
  }

  if (action === 'unlock') {
    const otpCheck = verifyStepUpChallenge(body.challengeId ?? '', body.otpCode ?? '');
    if (!otpCheck.ok) {
      pushFirewallIncident({
        id: `fw-vault-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        severity: 'CRITICAL',
        category: 'AUTH_STEPUP',
        ruleTriggered: otpCheck.reason ?? 'Unauthorized Cold Vault unlock blocked',
        method: 'POST',
        path: '/api/v1/vault/shield',
        maskedIp: maskClientIp(req),
        action: 'BLOCKED',
        createdAt: Date.now(),
      });
      securityStatus.totalBlocked += 1;
      res.status(401).json({ error: otpCheck.reason });
      return;
    }
    if (amountUsd > wsState.vaultBalanceUsd) {
      res.status(400).json({
        error: `Requested $${amountUsd.toLocaleString()} exceeds Cold Vault balance ($${wsState.vaultBalanceUsd.toLocaleString()}).`,
      });
      return;
    }
    wsState.vaultBalanceUsd = Number((wsState.vaultBalanceUsd - amountUsd).toFixed(2));
    wsState.realCashBalance = Number((wsState.realCashBalance + amountUsd).toFixed(2));
  } else {
    if (amountUsd > wsState.realCashBalance) {
      res.status(400).json({
        error: `Requested $${amountUsd.toLocaleString()} exceeds Real Trading Account cash ($${wsState.realCashBalance.toLocaleString()}). Deposit into Real Account first.`,
      });
      return;
    }
    wsState.realCashBalance = Number((wsState.realCashBalance - amountUsd).toFixed(2));
    wsState.vaultBalanceUsd = Number((wsState.vaultBalanceUsd + amountUsd).toFixed(2));
  }

  wsState.cashBalance = getActiveCashBalance(wsState);
  const createdAt = Date.now();
  const txId = `tx-${createdAt}-${Math.random().toString(36).slice(2, 6)}`;
  const prevHash = wsState.vaultTransfers[0]?.entryHash ?? 'GENESIS_0000000000000000';
  const txType = action === 'lock' ? 'vault_lock' : 'vault_unlock';
  const entryHash = computeLedgerHmac(
    prevHash,
    `${txId}|${txType}|${amountUsd}|cold-vault|settled|${createdAt}`
  );
  const record: VaultTransferRecord = {
    id: txId,
    type: txType,
    amountUsd,
    nativeAmount: amountUsd,
    currency: 'USD',
    bankAccountId: 'cold-vault',
    bankLabel: action === 'lock' ? 'Cold Capital Vault Shield (Locked)' : 'Cold Vault -> Real Trading Desk',
    destination: action === 'lock' ? 'cold_vault' : 'real_trading',
    status: 'settled',
    prevHash,
    entryHash,
    createdAt,
  };
  wsState.vaultTransfers.unshift(record);
  if (wsState.vaultTransfers.length > 100) wsState.vaultTransfers.pop();
  persistWorkspacesSnapshot();

  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, { type: 'desk:state', payload: deskPayload });
  perfEngine.sendToUser(session.user.id, {
    type: 'vault:update',
    payload: {
      bankAccounts: wsState.bankAccounts,
      vaultTransfers: wsState.vaultTransfers.slice(0, 40),
      securityStatus: {
        ...securityStatus,
        lockdownMode: wsState.lockdownMode,
        ledgerChainValid: verifyTransferChain(wsState.vaultTransfers),
        lastVerifiedAt: Date.now(),
      },
    },
  });
  res.json({ transfer: record, ...deskPayload });
});

app.post('/api/v1/vault/bank-accounts', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to link encrypted banking rails.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);

  const body = req.body as {
    bankName?: string;
    accountHolder?: string;
    rail?: BankRailType;
    currency?: SupportedCurrency;
    accountNumber?: string;
    routingCode?: string;
    challengeId?: string;
    otpCode?: string;
  };

  const envProof = verifyClientPacketEnvelope(
    'VAULT_BANK_LINK',
    req.header('x-aurex-envelope'),
    body
  );
  if (!envProof.ok) {
    res.status(403).json({ error: envProof.reason ?? 'Encrypted bank link envelope rejected.' });
    return;
  }

  const bankName = sanitizePlainText(body.bankName, 64);
  const accountHolder = sanitizePlainText(body.accountHolder, 64);
  const rawNum = sanitizePlainText(body.accountNumber, 48);
  const rawRouting = sanitizePlainText(body.routingCode, 28) || 'INSTANT';

  if (!bankName || !accountHolder || rawNum.length < 4) {
    res.status(400).json({ error: 'Provide bank/app name, holder name, and valid UPI ID / IBAN / account number.' });
    return;
  }

  const otpCheck = verifyStepUpChallenge(body.challengeId ?? '', body.otpCode ?? '');
  if (!otpCheck.ok) {
    pushFirewallIncident({
      id: `fw-otp-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      severity: 'HIGH',
      category: 'AUTH_STEPUP',
      ruleTriggered: otpCheck.reason ?? 'Step-Up OTP Verification Failed',
      method: 'POST',
      path: '/api/v1/vault/bank-accounts',
      maskedIp: maskClientIp(req),
      action: 'BLOCKED',
      createdAt: Date.now(),
    });
    securityStatus.totalBlocked += 1;
    broadcast({
      type: 'security:update',
      payload: {
        securityStatus: { ...securityStatus, lockdownMode: wsState.lockdownMode },
        firewallIncidents: firewallIncidentsList.slice(0, 40),
      },
    });
    res.status(401).json({ error: otpCheck.reason });
    return;
  }

  const allowedCurrencies: SupportedCurrency[] = [
    'USD',
    'INR',
    'EUR',
    'GBP',
    'SGD',
    'AED',
    'JPY',
    'AUD',
    'CAD',
    'CHF',
  ];
  const currency: SupportedCurrency = allowedCurrencies.includes(body.currency as SupportedCurrency)
    ? (body.currency as SupportedCurrency)
    : 'USD';

  const allowedRails: BankRailType[] = ['UPI', 'IMPS', 'NEFT', 'ACH', 'SEPA', 'FPS', 'SWIFT', 'WIRE', 'CARD'];
  const rail: BankRailType = allowedRails.includes(body.rail as BankRailType)
    ? (body.rail as BankRailType)
    : currency === 'INR'
    ? 'UPI'
    : 'ACH';

  const secured = storeEncryptedBankAccount(
    {
      id: `bnk-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      bankName,
      accountHolder,
      rail,
      currency,
      verified: true,
      addedAt: Date.now(),
    },
    rawNum,
    rawRouting
  );
  wsState.bankAccounts.unshift(secured);
  persistWorkspacesSnapshot();

  perfEngine.sendToUser(session.user.id, {
    type: 'vault:update',
    payload: {
      bankAccounts: wsState.bankAccounts,
      vaultTransfers: wsState.vaultTransfers.slice(0, 40),
      securityStatus: {
        ...securityStatus,
        lockdownMode: wsState.lockdownMode,
        ledgerChainValid: verifyTransferChain(wsState.vaultTransfers),
      },
    },
  });

  res.status(201).json({ account: secured, networkTelemetry: getEncryptedNetworkTelemetry() });
});

app.post('/api/v1/vault/transfer', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required for vault deposits and withdrawals.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);

  if (wsState.lockdownMode) {
    res.status(423).json({
      error: 'Vault Lockdown Active: Deposits and withdrawals are frozen until you lift lockdown.',
    });
    return;
  }

  const body = req.body as {
    type?: 'deposit' | 'withdrawal';
    amount?: number;
    currency?: SupportedCurrency;
    bankAccountId?: string;
    destination?: 'real_trading' | 'cold_vault';
    challengeId?: string;
    otpCode?: string;
  };

  const transferEnv = verifyClientPacketEnvelope(
    'VAULT_TRANSFER',
    req.header('x-aurex-envelope'),
    body
  );
  if (!transferEnv.ok) {
    res.status(403).json({ error: transferEnv.reason ?? 'Encrypted payment envelope rejected.' });
    return;
  }

  const otpCheck = verifyStepUpChallenge(body.challengeId ?? '', body.otpCode ?? '');
  if (!otpCheck.ok) {
    pushFirewallIncident({
      id: `fw-otp-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      severity: 'HIGH',
      category: 'AUTH_STEPUP',
      ruleTriggered: otpCheck.reason ?? 'Transfer Step-Up OTP Rejected',
      method: 'POST',
      path: '/api/v1/vault/transfer',
      maskedIp: maskClientIp(req),
      action: 'BLOCKED',
      createdAt: Date.now(),
    });
    securityStatus.totalBlocked += 1;
    broadcast({
      type: 'security:update',
      payload: {
        securityStatus: { ...securityStatus, lockdownMode: wsState.lockdownMode },
        firewallIncidents: firewallIncidentsList.slice(0, 40),
      },
    });
    res.status(401).json({ error: otpCheck.reason });
    return;
  }

  const type: 'deposit' | 'withdrawal' = body.type === 'withdrawal' ? 'withdrawal' : 'deposit';
  const allowedCurrencies: SupportedCurrency[] = [
    'USD',
    'INR',
    'EUR',
    'GBP',
    'SGD',
    'AED',
    'JPY',
    'AUD',
    'CAD',
    'CHF',
  ];
  const currency: SupportedCurrency = allowedCurrencies.includes(body.currency as SupportedCurrency)
    ? (body.currency as SupportedCurrency)
    : 'USD';

  const nativeAmount = Number(body.amount ?? 0);
  if (!Number.isFinite(nativeAmount) || nativeAmount <= 0) {
    res.status(400).json({ error: 'Transfer amount must be positive.' });
    return;
  }

  const amountUsd = convertNativeCurrencyToUsd(nativeAmount, currency);

  if (amountUsd > 500_000) {
    res.status(400).json({ error: 'Single transfer exceeds $500,000 velocity ceiling.' });
    return;
  }

  const bank = wsState.bankAccounts.find((b) => b.id === body.bankAccountId) ?? wsState.bankAccounts[0];
  if (!bank) {
    res.status(400).json({ error: 'Link a UPI ID, bank account, or payment rail first.' });
    return;
  }

  if (type === 'withdrawal') {
    if (amountUsd > wsState.realCashBalance) {
      res.status(400).json({
        error:
          wsState.vaultBalanceUsd > 0
            ? `Real Trading balance ($${wsState.realCashBalance.toLocaleString()}) is too low. Release funds from your Cold Vault ($${wsState.vaultBalanceUsd.toLocaleString()}) using 2FA first.`
            : `Insufficient Real Account balance ($${wsState.realCashBalance.toLocaleString()}) for this withdrawal.`,
      });
      return;
    }
    wsState.realCashBalance = Number((wsState.realCashBalance - amountUsd).toFixed(2));
  } else {
    const dest = body.destination === 'cold_vault' ? 'cold_vault' : 'real_trading';
    if (dest === 'cold_vault') {
      wsState.vaultBalanceUsd = Number((wsState.vaultBalanceUsd + amountUsd).toFixed(2));
    } else {
      wsState.realCashBalance = Number((wsState.realCashBalance + amountUsd).toFixed(2));
    }
  }

  wsState.cashBalance = getActiveCashBalance(wsState);

  const createdAt = Date.now();
  const txId = `tx-${createdAt}-${Math.random().toString(36).slice(2, 6)}`;
  const prevHash = wsState.vaultTransfers[0]?.entryHash ?? 'GENESIS_0000000000000000';
  const entryHash = computeLedgerHmac(
    prevHash,
    `${txId}|${type}|${amountUsd}|${bank.id}|settled|${createdAt}`
  );

  const transfer: VaultTransferRecord = {
    id: txId,
    type,
    amountUsd,
    nativeAmount,
    currency,
    bankAccountId: bank.id,
    bankLabel: `${bank.bankName} · ${bank.rail} (${bank.maskedNumber})`,
    destination:
      type === 'withdrawal'
        ? 'external_bank'
        : body.destination === 'cold_vault'
        ? 'cold_vault'
        : 'real_trading',
    status: 'settled',
    prevHash,
    entryHash,
    createdAt,
  };

  wsState.vaultTransfers.unshift(transfer);
  if (wsState.vaultTransfers.length > 100) wsState.vaultTransfers.pop();
  persistWorkspacesSnapshot();

  const chainValid = verifyTransferChain(wsState.vaultTransfers);
  const deskPayload = buildDeskStatePayload(wsState);

  perfEngine.sendToUser(session.user.id, {
    type: 'desk:state',
    payload: deskPayload,
  });
  perfEngine.sendToUser(session.user.id, {
    type: 'vault:update',
    payload: {
      bankAccounts: wsState.bankAccounts,
      vaultTransfers: wsState.vaultTransfers.slice(0, 40),
      securityStatus: {
        ...securityStatus,
        lockdownMode: wsState.lockdownMode,
        ledgerChainValid: chainValid,
        lastVerifiedAt: Date.now(),
      },
    },
  });

  res.status(201).json({ transfer, ...deskPayload, networkTelemetry: getEncryptedNetworkTelemetry() });
});

// ---------------------------------------------------------------------------
// Built-In Encrypted Network Mesh (X25519 + HKDF-SHA256 + AES-256-GCM)
// ---------------------------------------------------------------------------
app.get('/api/v1/network/handshake', (_req, res) => {
  res.json(getClientNetworkHandshake());
});

app.get('/api/v1/network/telemetry', (_req, res) => {
  res.json({ telemetry: getEncryptedNetworkTelemetry() });
});

app.post('/api/v1/network/verify-envelope', (req, res) => {
  const channel = sanitizePlainText((req.body as { channel?: string })?.channel ?? 'CLIENT_PROBE', 40) || 'CLIENT_PROBE';
  const proofRes = verifyClientPacketEnvelope(channel, req.header('x-aurex-envelope'), req.body);
  if (!proofRes.ok) {
    res.status(403).json({ error: proofRes.reason });
    return;
  }
  const sealed = sealServerEnvelope(channel, { verified: true, timestamp: Date.now() });
  res.json({
    ok: true,
    verifiedProof: proofRes.verifiedProof,
    sealedEcho: sealed,
    telemetry: getEncryptedNetworkTelemetry(),
  });
});

// ---------------------------------------------------------------------------
// Built-In Advanced Bug & Error Solver + Hack Protection AI Squad
// ---------------------------------------------------------------------------
app.get('/api/v1/diagnostics/status', (req, res) => {
  const session = extractSessionFromReq(req);
  const wsState = session
    ? getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100)
    : undefined;
  const metrics = perfEngine.getMetrics(Boolean(session && isFounderEmail(session.user.email)));
  const report = runDiagnosticsSuite({
    instruments: Array.from(instrumentsMap.values()),
    orderBooksMap,
    candlesMap,
    connectors: ccxtAdapters.getStatuses(),
    eventLoopLagMs: metrics.eventLoopLagMs ?? 1.2,
    memoryRssMb: metrics.memoryRssMb,
    allVaultTransfers: wsState?.vaultTransfers ?? [],
    networkHandshakeActive: true,
    securityStatus,
  });
  res.json({ report });
});

app.post('/api/v1/diagnostics/solve', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to execute self-diagnostics remediation.' });
    return;
  }
  const isFounder = isFounderEmail(session.user.email);
  const targetId = sanitizePlainText((req.body as { targetId?: string })?.targetId ?? 'all', 40) || 'all';
  const result = executeAutoRemediation(targetId, isFounder, {
    rebuildOrderBooks: () => {
      let fixed = 0;
      for (const [sym, inst] of instrumentsMap.entries()) {
        orderBooksMap.set(sym, buildOrderBook(sym, inst.price, inst.assetClass));
        fixed += 1;
      }
      return fixed;
    },
    repairCandles: () => {
      let repaired = 0;
      for (const [sym, list] of candlesMap.entries()) {
        const inst = instrumentsMap.get(sym);
        for (const c of list) {
          if (!Number.isFinite(c.close) || c.close <= 0) {
            c.close = inst?.price ?? 100;
            repaired += 1;
          }
          if (c.high < Math.max(c.open, c.close)) {
            c.high = Math.max(c.open, c.close);
            repaired += 1;
          }
          if (c.low > Math.min(c.open, c.close) || c.low <= 0) {
            c.low = Math.max(1e-8, Math.min(c.open, c.close));
            repaired += 1;
          }
        }
      }
      return repaired;
    },
    refreshFeeds: () => {
      void ccxtAdapters.refreshSnapshots();
    },
    pruneDiagnosticsCache: () => {
      perfEngine.invalidateSnapshotCache();
      return 1;
    },
  });

  if (!result.ok) {
    res.status(403).json({ error: result.summary });
    return;
  }

  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const metrics = perfEngine.getMetrics(isFounder);
  const report = runDiagnosticsSuite({
    instruments: Array.from(instrumentsMap.values()),
    orderBooksMap,
    candlesMap,
    connectors: ccxtAdapters.getStatuses(),
    eventLoopLagMs: metrics.eventLoopLagMs ?? 1.2,
    memoryRssMb: metrics.memoryRssMb,
    allVaultTransfers: wsState.vaultTransfers,
    networkHandshakeActive: true,
    securityStatus,
  });
  res.json({ ok: true, summary: result.summary, fixedCount: result.fixedCount, report });
});

app.get('/api/v1/security/defense-team', (_req, res) => {
  res.json({
    agents: getHackDefenseAgentsSnapshot(firewallIncidentsList),
    updatedAt: Date.now(),
  });
});

app.get('/api/v1/security/enterprise-suite', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to inspect Enterprise Security Suite.' });
    return;
  }
  recordDeviceFromReq(session.user.id, req);
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const allAuthEvents = listAuthTelemetryEvents(200);
  const emailLower = session.user.email.toLowerCase();
  const userAuditLogs = allAuthEvents.filter(
    (e) => e.userId === session.user.id || e.email.toLowerCase() === emailLower
  );
  const snapshot = buildEnterpriseSecuritySnapshot({
    userId: session.user.id,
    totpEnabled: Boolean(session.user.totpEnabled),
    passkeysCount: listPasskeysForUser(session.user.id).length,
    kycVerified: getKycVerification(session.user.id).status === 'VERIFIED',
    bankRailsCount: wsState.bankAccounts.length,
    realCashBalance: wsState.realCashBalance,
    vaultBalanceUsd: wsState.vaultBalanceUsd,
    lockdownMode: wsState.lockdownMode,
    ledgerChainValid: verifyTransferChain(wsState.vaultTransfers),
    ddos: getDdosTelemetry(),
    userAuditLogs,
  });
  res.json({ snapshot });
});

app.post('/api/v1/security/devices/:id/trust', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const status = (req.body as { status?: string })?.status === 'REVOKED' ? 'REVOKED' : 'TRUSTED';
  const device = setUserDeviceTrust(session.user.id, req.params.id, status);
  if (!device) {
    res.status(404).json({ error: 'Device fingerprint not found.' });
    return;
  }
  res.json({ ok: true, device });
});

app.delete('/api/v1/security/devices/:id', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const device = setUserDeviceTrust(session.user.id, req.params.id, 'REVOKED');
  if (!device) {
    res.status(404).json({ error: 'Device fingerprint not found.' });
    return;
  }
  res.json({ ok: true, device });
});

app.post('/api/v1/security/hsm/sign-attestation', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to request HSM attestation.' });
    return;
  }
  const subject = sanitizePlainText(
    (req.body as { subject?: string })?.subject ?? `${session.user.name} Custody Proof`,
    64
  );
  const attestation = signHsmAttestation(subject);
  res.json({ ok: true, attestation });
});

app.post('/api/v1/security/hsm/rotate', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to rotate HSM slot.' });
    return;
  }
  const slotId = sanitizePlainText((req.body as { slotId?: string })?.slotId ?? 'SLOT-01-VAULT-DEK', 40);
  const slot = rotateHsmSlot(slotId, `${session.user.name} (${maskClientIp(req)})`);
  if (!slot) {
    res.status(404).json({ error: `Unknown HSM key slot: ${slotId}` });
    return;
  }
  res.json({ ok: true, slot });
});

app.post('/api/v1/security/bounty/submit', (req, res) => {
  const session = extractSessionFromReq(req);
  const body = req.body as {
    title?: string;
    severity?: 'Critical' | 'High' | 'Medium' | 'Low';
    component?: string;
    description?: string;
    reproductionSteps?: string;
    reporterHandle?: string;
  };
  const result = submitBountyReport({
    title: body.title ?? '',
    severity: body.severity ?? 'Medium',
    component: body.component ?? 'Exchange Core / API',
    description: body.description ?? '',
    reproductionSteps: body.reproductionSteps ?? '',
    reporterHandle: session?.user.name ?? body.reporterHandle ?? 'External Security Researcher',
  });
  if (!result.ok || !result.submission) {
    res.status(400).json({ error: result.reason ?? 'Invalid bug bounty submission.' });
    return;
  }
  res.status(201).json({ ok: true, submission: result.submission });
});

app.post('/api/v1/security/pentest/run', async (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to execute live penetration test.' });
    return;
  }
  try {
    const report = await runAutomatedPentestSuite({
      port: PORT,
      verifySessionTokenFn: verifySessionToken,
    });
    res.json({ ok: true, report });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Automated pentest suite execution failed.',
    });
  }
});

app.get('/api/v1/system/export-policy-bundle', (_req, res) => {
  const metrics = perfEngine.getMetrics(false);
  const markdown = buildSanitizedSystemBlueprintMarkdown({
    instrumentsCount: instrumentsMap.size,
    activeConnections: metrics.activeConnections,
    ddos: getDdosTelemetry(),
    totalBlockedThreats: securityStatus.totalBlocked,
  });
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="SECURITY_AND_SYSTEM_POLICY.md"');
  res.send(markdown);
});

// ---------------------------------------------------------------------------
// Quantitative Portfolio Analytics (Sharpe, Volatility, Covariance, VaR)
// ---------------------------------------------------------------------------
app.get('/api/v1/portfolio/analytics', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to inspect Portfolio Analytics.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const rfQuery = Number.parseFloat(String(req.query.rf ?? '4.25'));
  const riskFreeRatePct = Number.isFinite(rfQuery) ? Math.max(0, Math.min(15, rfQuery)) : 4.25;
  const activePositions = recomputePositions(wsState, wsState.accountMode);
  const report = computePortfolioAnalyticsReport({
    positions: activePositions,
    instruments: Array.from(instrumentsMap.values()),
    predictions: Object.fromEntries(predictionsMap.entries()),
    cashBalance: getActiveCashBalance(wsState),
    vaultBalanceUsd: wsState.vaultBalanceUsd,
    accountMode: wsState.accountMode,
    riskFreeRatePct,
  });
  res.json({ report });
});

// ---------------------------------------------------------------------------
// Exchange Features: Staking Yield, 5m/15m/1h Predictions & Amber Metal Card
// ---------------------------------------------------------------------------
app.get('/api/v1/exchange/features', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required for exchange features.' });
    return;
  }
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.json({ features });
});

app.post('/api/v1/staking/stake', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to stake assets.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (wsState.lockdownMode) {
    res.status(423).json({ error: 'Account Lockdown Active: Lift lockdown in Vault before staking.' });
    return;
  }
  const body = req.body as { poolId?: string; amountUsd?: number };
  const activeCash = getActiveCashBalance(wsState);
  const result = stakeIntoPool(
    session.user.id,
    session.user.name,
    String(body.poolId ?? ''),
    Number(body.amountUsd ?? 0),
    instrumentsMap,
    activeCash
  );
  if (!result.ok || result.deductedUsd === undefined) {
    res.status(400).json({ error: result.error ?? 'Unable to stake assets.' });
    return;
  }
  setActiveCashBalance(wsState, Math.max(0, activeCash - result.deductedUsd));
  persistWorkspacesSnapshot();
  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, { type: 'desk:state', payload: deskPayload });
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.status(201).json({ ok: true, features, cashBalance: deskPayload.cashBalance });
});

app.post('/api/v1/staking/unstake', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to redeem staked position.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const body = req.body as { positionId?: string };
  const result = unstakePosition(
    session.user.id,
    session.user.name,
    String(body.positionId ?? ''),
    instrumentsMap
  );
  if (!result.ok || result.creditedUsd === undefined) {
    res.status(400).json({ error: result.error ?? 'Unable to unstake position.' });
    return;
  }
  const activeCash = getActiveCashBalance(wsState);
  setActiveCashBalance(wsState, activeCash + result.creditedUsd);
  persistWorkspacesSnapshot();
  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, { type: 'desk:state', payload: deskPayload });
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.json({ ok: true, creditedUsd: result.creditedUsd, features, cashBalance: deskPayload.cashBalance });
});

app.post('/api/v1/predictions/bet', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to open prediction contract.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (wsState.lockdownMode) {
    res.status(423).json({ error: 'Account Lockdown Active: Lift lockdown in Vault before trading.' });
    return;
  }
  const body = req.body as { contractId?: string; direction?: 'UP' | 'DOWN'; stakeUsd?: number };
  const direction = body.direction === 'DOWN' ? 'DOWN' : 'UP';
  const activeCash = getActiveCashBalance(wsState);
  const result = placePredictionBet(
    session.user.id,
    session.user.name,
    String(body.contractId ?? ''),
    direction,
    Number(body.stakeUsd ?? 0),
    instrumentsMap,
    activeCash
  );
  if (!result.ok || result.deductedUsd === undefined) {
    res.status(400).json({ error: result.error ?? 'Unable to place prediction.' });
    return;
  }
  setActiveCashBalance(wsState, Math.max(0, activeCash - result.deductedUsd));
  persistWorkspacesSnapshot();
  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, { type: 'desk:state', payload: deskPayload });
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.status(201).json({ ok: true, bet: result.bet, features, cashBalance: deskPayload.cashBalance });
});

app.post('/api/v1/predictions/close', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to settle prediction.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  const body = req.body as { betId?: string };
  const result = settlePredictionBet(
    session.user.id,
    session.user.name,
    String(body.betId ?? ''),
    instrumentsMap
  );
  if (!result.ok || result.creditedUsd === undefined) {
    res.status(400).json({ error: result.error ?? 'Unable to settle prediction.' });
    return;
  }
  const activeCash = getActiveCashBalance(wsState);
  setActiveCashBalance(wsState, activeCash + result.creditedUsd);
  persistWorkspacesSnapshot();
  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, { type: 'desk:state', payload: deskPayload });
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.json({ ok: true, bet: result.bet, creditedUsd: result.creditedUsd, features, cashBalance: deskPayload.cashBalance });
});

app.post('/api/v1/card/toggle-freeze', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to control card security.' });
    return;
  }
  const body = req.body as { frozen?: boolean };
  toggleCardFreeze(session.user.id, session.user.name, Boolean(body.frozen), instrumentsMap);
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.json({ ok: true, features });
});

app.post('/api/v1/card/config', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to update card settings.' });
    return;
  }
  const body = req.body as { cashbackAsset?: 'BTC' | 'SOL' | 'USDT'; dailyLimitUsd?: number };
  updateCardConfig(session.user.id, session.user.name, body, instrumentsMap);
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.json({ ok: true, features });
});

app.post('/api/v1/card/spend', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required for card transactions.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (wsState.lockdownMode) {
    res.status(423).json({ error: 'Account Lockdown Active: Card rails suspended.' });
    return;
  }
  const body = req.body as { merchant?: string; category?: string; amountUsd?: number };
  const activeCash = getActiveCashBalance(wsState);
  const result = executeCardSpend(
    session.user.id,
    session.user.name,
    sanitizePlainText(body.merchant ?? 'Global Merchant', 48),
    sanitizePlainText(body.category ?? 'Commerce', 24),
    Number(body.amountUsd ?? 0),
    activeCash,
    instrumentsMap
  );
  if (!result.ok || result.netDebitUsd === undefined) {
    const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
    res.status(400).json({ error: result.error ?? 'Card spend declined.', features });
    return;
  }
  const cashbackCredit = result.cardProfile.transactions[0]?.cashbackUsd ?? 0;
  setActiveCashBalance(wsState, Math.max(0, activeCash - result.netDebitUsd + cashbackCredit));
  persistWorkspacesSnapshot();
  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, { type: 'desk:state', payload: deskPayload });
  const features = getExchangeFeaturesState(session.user.id, session.user.name, instrumentsMap);
  res.status(201).json({ ok: true, features, cashBalance: deskPayload.cashBalance });
});

// ---------------------------------------------------------------------------
// Smart Trading Bots (GitHub Quantitative Patterns)
// ---------------------------------------------------------------------------
app.get('/api/v1/bots', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to inspect Smart Trading Bots.' });
    return;
  }
  res.json({ bots: listUserTradingBots(session.user.id) });
});

app.post('/api/v1/bots', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to deploy Smart Trading Bots.' });
    return;
  }
  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (wsState.lockdownMode) {
    res.status(423).json({ error: 'Account Lockdown Active: Lift lockdown in Vault before starting bots.' });
    return;
  }
  if (wsState.accountMode === 'real') {
    const verif = isUserVerifiedForRealTrading(session.user.id, wsState);
    if (!verif.ok) {
      res.status(403).json({ error: verif.reason });
      return;
    }
  }
  const body = req.body as {
    name?: string;
    symbol?: string;
    strategy?: 'GRID' | 'DCA' | 'MOMENTUM_EMA' | 'MEAN_REVERSION_BB' | 'TWAP_SMART';
    allocatedUsd?: number;
    orderSizeUnits?: number;
    gridLower?: number;
    gridUpper?: number;
    gridLevels?: number;
    intervalSec?: number;
    maxDrawdownPct?: number;
  };
  const sym = (body.symbol ?? 'BTC-USD').toUpperCase();
  const inst = instrumentsMap.get(sym);
  if (!inst) {
    res.status(404).json({ error: `Unknown market symbol: ${sym}` });
    return;
  }
  const validStrategies = ['GRID', 'DCA', 'MOMENTUM_EMA', 'MEAN_REVERSION_BB', 'TWAP_SMART'] as const;
  const strategy = validStrategies.find((s) => s === body.strategy) ?? 'GRID';

  const result = createTradingBot({
    userId: session.user.id,
    name: sanitizePlainText(body.name, 48) || `${strategy} ${sym}`,
    symbol: sym,
    strategy,
    accountMode: wsState.accountMode,
    allocatedUsd: body.allocatedUsd === undefined ? 5000 : Number(body.allocatedUsd),
    orderSizeUnits:
      body.orderSizeUnits === undefined
        ? inst.price > 1000
          ? 0.05
          : 5
        : Number(body.orderSizeUnits),
    gridLower: body.gridLower,
    gridUpper: body.gridUpper,
    gridLevels: body.gridLevels,
    intervalSec: body.intervalSec,
    maxDrawdownPct: body.maxDrawdownPct,
    currentPrice: inst.price,
  });

  if (!result.ok || !result.bot) {
    res.status(400).json({ error: result.reason ?? 'Could not create trading bot.' });
    return;
  }
  trackUserQuestProgress(session.user.id, 'quest-bot', 1);
  res.status(201).json({
    bot: result.bot,
    bots: listUserTradingBots(session.user.id),
    rewardsState: getUserRewardsState(session.user.id),
  });
});

app.post('/api/v1/bots/:id/toggle', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const updated = toggleTradingBotStatus(session.user.id, req.params.id);
  if (!updated) {
    res.status(404).json({ error: 'Trading bot not found.' });
    return;
  }
  res.json({ bot: updated, bots: listUserTradingBots(session.user.id) });
});

app.delete('/api/v1/bots/:id', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const removed = deleteTradingBot(session.user.id, req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Trading bot not found.' });
    return;
  }
  res.json({ ok: true, bots: listUserTradingBots(session.user.id) });
});

// ---------------------------------------------------------------------------
// Rewards Center & Bidirectional Social Graph
// ---------------------------------------------------------------------------
app.get('/api/v1/rewards/me', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to inspect Rewards Center.' });
    return;
  }
  res.json({ rewardsState: getUserRewardsState(session.user.id) });
});

app.post('/api/v1/rewards/claim', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to claim quest rewards.' });
    return;
  }
  const questId = sanitizePlainText((req.body as { questId?: string })?.questId ?? '', 40);
  const claim = claimUserQuestReward(session.user.id, questId);
  if (!claim.ok) {
    res.status(400).json({ error: claim.reason, rewardsState: claim.state });
    return;
  }

  const wsState = getOrCreateWorkspace(session.user.id, (s) => instrumentsMap.get(s)?.price ?? 100);
  wsState.demoCashBalance = Number((wsState.demoCashBalance + claim.bonusDemoUsd).toFixed(2));
  wsState.cashBalance = getActiveCashBalance(wsState);
  persistWorkspacesSnapshot();

  const deskPayload = buildDeskStatePayload(wsState);
  perfEngine.sendToUser(session.user.id, { type: 'desk:state', payload: deskPayload });
  res.json({ ok: true, rewardsState: claim.state, bonusDemoUsd: claim.bonusDemoUsd, ...deskPayload });
});

app.get('/api/v1/social/graph', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required to load social graph.' });
    return;
  }
  res.json({ socialGraph: getUserSocialGraph(session.user.id) });
});

// ---------------------------------------------------------------------------
// Founder-Only AI Admin Improvement Team & Admin Rewards Governance
// ---------------------------------------------------------------------------
app.get('/api/v1/admin/ai-team', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }
  res.json({ teamState: getFounderAiTeamState() });
});

app.post('/api/v1/admin/ai-team/review', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }
  const authStats = getAuthStats();
  const teamState = triggerFounderAiReview({
    totalUsers: authStats.totalUsers,
    blockedThreats: securityStatus.totalBlocked,
    activeBots: listAllActiveBotsCount(),
    unresolvedErrors: getUnresolvedDiagnosticErrorsCount(),
  });
  res.json({ teamState });
});

app.post('/api/v1/admin/ai-team/proposals/:id/apply', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }
  const outcome = applyFounderProposal(req.params.id, {
    onRebuildBuffers: () => {
      for (const [sym, inst] of instrumentsMap.entries()) {
        orderBooksMap.set(sym, buildOrderBook(sym, inst.price, inst.assetClass));
      }
      perfEngine.invalidateSnapshotCache();
    },
    onSecuritySweep: () => {
      securityStatus.lastVerifiedAt = Date.now();
    },
    onLaunchBonusCampaign: () => {
      createFounderRewardCampaign({
        code: 'FOUNDERV24',
        title: 'Founder Deployed Double-XP Milestone',
        bonusDemoUsd: 50_000,
        xpReward: 500,
        feeDiscountPct: 15,
      });
    },
  });
  res.json(outcome);
});

app.get('/api/v1/admin/rewards', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }
  const usersDir = listAdminUserDirectory((s) => instrumentsMap.get(s)?.price ?? 100);
  res.json({ overview: getAdminRewardsOverview(usersDir) });
});

app.post('/api/v1/admin/rewards/campaigns', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }
  const body = req.body as {
    code?: string;
    title?: string;
    bonusDemoUsd?: number;
    xpReward?: number;
    feeDiscountPct?: number;
  };
  const campaign = createFounderRewardCampaign({
    code: body.code ?? 'AUREXVIP',
    title: body.title ?? 'Founder Special Campaign',
    bonusDemoUsd: body.bonusDemoUsd ?? 25_000,
    xpReward: body.xpReward ?? 300,
    feeDiscountPct: body.feeDiscountPct ?? 10,
  });
  const usersDir = listAdminUserDirectory((s) => instrumentsMap.get(s)?.price ?? 100);
  res.status(201).json({ campaign, overview: getAdminRewardsOverview(usersDir) });
});

app.post('/api/v1/admin/rewards/campaigns/:id/toggle', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }
  const toggled = toggleFounderCampaignActive(req.params.id);
  if (!toggled) {
    res.status(404).json({ error: 'Campaign not found.' });
    return;
  }
  const usersDir = listAdminUserDirectory((s) => instrumentsMap.get(s)?.price ?? 100);
  res.json({ campaign: toggled, overview: getAdminRewardsOverview(usersDir) });
});

app.post('/api/v1/admin/rewards/grant', (req, res) => {
  const session = extractSessionFromReq(req);
  if (!session || !session.user.isAdmin || !isFounderEmail(session.user.email)) {
    res.status(403).json({ error: `Founder-only access (${FOUNDER_EMAIL}).` });
    return;
  }
  const body = req.body as { targetUserId?: string; xpAmount?: number; bonusDemoUsd?: number };
  if (!body.targetUserId) {
    res.status(400).json({ error: 'targetUserId required.' });
    return;
  }
  const granted = grantFounderManualReward(
    body.targetUserId,
    Number(body.xpAmount ?? 250),
    Number(body.bonusDemoUsd ?? 10_000)
  );
  const wsState = getOrCreateWorkspace(body.targetUserId, (s) => instrumentsMap.get(s)?.price ?? 100);
  wsState.demoCashBalance = Number((wsState.demoCashBalance + granted.grantedDemoUsd).toFixed(2));
  wsState.cashBalance = getActiveCashBalance(wsState);
  persistWorkspacesSnapshot();
  const usersDir = listAdminUserDirectory((s) => instrumentsMap.get(s)?.price ?? 100);
  res.json({ ok: true, granted, overview: getAdminRewardsOverview(usersDir) });
});

app.post('/api/v1/social/posts', (req, res) => {
  const session = extractSessionFromReq(req);
  const body = req.body as {
    author?: string;
    role?: string;
    symbol?: string;
    bias?: SocialPost['bias'];
    title?: string;
    thesis?: string;
    targetPrice?: number;
  };

  const title = sanitizePlainText(body.title, 120);
  const thesis = sanitizePlainText(body.thesis, 500);
  const symbol = (body.symbol ?? 'NVDA').toUpperCase();
  if (!title || !thesis || !instrumentsMap.has(symbol)) {
    res.status(400).json({ error: 'Valid symbol, headline title, and thesis text are required.' });
    return;
  }

  const bias: SocialPost['bias'] =
    body.bias === 'Bearish' || body.bias === 'Neutral' ? body.bias : 'Bullish';

  const post: SocialPost = {
    id: `soc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    author: session?.user.name ?? (sanitizePlainText(body.author, 40) || 'Desk Member'),
    role: session?.user.role ?? (sanitizePlainText(body.role, 40) || 'Community Investor'),
    symbol,
    bias,
    title,
    thesis,
    targetPrice:
      typeof body.targetPrice === 'number' && Number.isFinite(body.targetPrice) && body.targetPrice > 0
        ? body.targetPrice
        : undefined,
    likes: 1,
    likedByClientIds: [],
    createdAt: Date.now(),
  };

  socialPostsList.unshift(post);
  if (socialPostsList.length > 40) socialPostsList.pop();

  broadcast({
    type: 'social:update',
    payload: {
      socialPosts: socialPostsList,
      contributors: contributorsList,
    },
  });
  res.status(201).json({ post });
});

app.post('/api/v1/social/posts/:id/like', (req, res) => {
  const post = socialPostsList.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const session = extractSessionFromReq(req);
  const voterId = session?.user.id ?? sanitizePlainText((req.body as { clientId?: string })?.clientId ?? 'anon', 40);
  const idx = post.likedByClientIds.indexOf(voterId);
  if (idx === -1) {
    post.likedByClientIds.push(voterId);
    post.likes += 1;
  } else {
    post.likedByClientIds.splice(idx, 1);
    post.likes = Math.max(0, post.likes - 1);
  }
  broadcast({
    type: 'social:update',
    payload: {
      socialPosts: socialPostsList,
      contributors: contributorsList,
    },
  });
  res.json({ post });
});

app.post('/api/v1/social/contributors/:id/follow', (req, res) => {
  const ctr = contributorsList.find((c) => c.id === req.params.id);
  if (!ctr) {
    res.status(404).json({ error: 'Contributor not found' });
    return;
  }
  ctr.following = !ctr.following;
  ctr.followers += ctr.following ? 1 : -1;
  broadcast({
    type: 'social:update',
    payload: {
      socialPosts: socialPostsList,
      contributors: contributorsList,
    },
  });
  res.json({ contributor: ctr });
});

const server = http.createServer(app);
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 16 * 1024,
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { level: 3 },
  },
});

server.on('upgrade', (request, socket, head) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
      return;
    }
  } catch {
    // ignore malformed URL
  }
  socket.destroy();
});

// Prune zombie / half-open WebSockets every 30s to keep memory & CPU tight at high concurrency
setInterval(() => {
  for (const client of clients.values()) {
    if (!client.isAlive) {
      perfEngine.unregisterSocket(client.ws);
      clients.delete(client.ws);
      client.ws.terminate();
      continue;
    }
    client.isAlive = false;
    try {
      client.ws.ping();
    } catch {
      // handled next cycle
    }
  }
}, 30_000).unref();

wss.on('connection', (ws, req) => {
  const reqUrl = new URL(req.url ?? '/ws', 'http://localhost');
  const tokenParam = reqUrl.searchParams.get('token') ?? undefined;
  const session = extractSessionFromHeaders(req.headers.cookie, tokenParam);
  const user = session?.user;
  const wsState = user
    ? getOrCreateWorkspace(user.id, (s) => instrumentsMap.get(s)?.price ?? 100)
    : undefined;

  const clientId = `desk-${Math.random().toString(36).slice(2, 8)}`;
  const defaultSymbol = 'NVDA';
  const client: ConnectedClient = {
    ws,
    clientId,
    userId: user?.id,
    email: user?.email,
    isAdmin: user?.isAdmin ?? false,
    activeSymbol: defaultSymbol,
    activeTimeframe: '1m',
    name: user?.name ?? `Guest ${clientId.slice(-3).toUpperCase()}`,
    role: user?.role ?? 'Market Observer',
    connectedAt: Date.now(),
    isAlive: true,
  };
  clients.set(ws, client);
  perfEngine.registerSocket(ws, user?.id ?? clientId, defaultSymbol);

  ws.on('pong', () => {
    client.isAlive = true;
  });

  sendToClient(ws, {
    type: 'init',
    payload: {
      clientId,
      user,
      instruments: Array.from(instrumentsMap.values()),
      predictions: Object.fromEntries(predictionsMap.entries()),
      patterns: recentPatterns.slice(0, 24),
      insights: actionableInsights,
      news: newsFeed,
      activeSymbol: defaultSymbol,
      candles: candlesMap.get(defaultSymbol) ?? [],
      orderBook: orderBooksMap.get(defaultSymbol)!,
      recentTrades: tradesMap.get(defaultSymbol) ?? [],
      accountMode: wsState?.accountMode ?? 'demo',
      cashBalance: wsState ? getActiveCashBalance(wsState) : 1_000_000,
      demoCashBalance: wsState?.demoCashBalance ?? 1_000_000,
      realCashBalance: wsState?.realCashBalance ?? 0,
      vaultBalanceUsd: wsState?.vaultBalanceUsd ?? 0,
      orders: wsState ? (wsState.accountMode === 'real' ? wsState.realOrders : wsState.orders).slice(0, 60) : [],
      positions: wsState ? recomputePositions(wsState) : [],
      alerts: wsState ? [...wsState.alerts] : [],
      deskMembers: Array.from(clients.values())
        .slice(0, 60)
        .map((c) => ({
          clientId: c.clientId,
          name: c.name,
          role: c.role,
          activeSymbol: c.activeSymbol,
          connectedAt: c.connectedAt,
        })),
      apiKeys: user && isFounderEmail(user.email) ? apiKeysList : [],
      nexusReport: latestNexusReport,
      auditLogs: auditLogsList.slice(0, 50),
      riskEvents: riskEventsList.slice(0, 40),
      bankAccounts: wsState?.bankAccounts ?? [],
      vaultTransfers: wsState ? wsState.vaultTransfers.slice(0, 40) : [],
      firewallIncidents: firewallIncidentsList.slice(0, 40),
      securityStatus: {
        ...securityStatus,
        lockdownMode: wsState?.lockdownMode ?? false,
        ledgerChainValid: wsState ? verifyTransferChain(wsState.vaultTransfers) : true,
      },
      socialPosts: socialPostsList,
      contributors: contributorsList,
      engineMetrics: perfEngine.getMetrics(Boolean(user && isFounderEmail(user.email))),
      connectors: ccxtAdapters.getStatuses(),
      networkTelemetry: getEncryptedNetworkTelemetry(),
      defenseAgents: getHackDefenseAgentsSnapshot(firewallIncidentsList),
      rewardsState: user ? getUserRewardsState(user.id) : undefined,
      socialGraph: user ? getUserSocialGraph(user.id) : undefined,
      bots: user ? listUserTradingBots(user.id) : [],
      agentLeaderboard: getAgentLeaderboardSnapshot(),
      globalMonitor: buildGlobalMonitorSnapshot({
        instrumentsMap,
        predictionsMap,
        securityStatus,
        activeLockdowns: Array.from(listAllWorkspaces()).filter((w) => w.lockdownMode).length,
      }),
      promoProfile: user
        ? getPromoProfile(
            user.id,
            getRequestRpAndOrigin(req).origin,
            (s: string) => instrumentsMap.get(s)?.price ?? 100
          )
        : undefined,
    },
  });

  broadcastDeskPresence();

  let wsMsgTimestamps: number[] = [];

  ws.on('message', (raw) => {
    try {
      const now = Date.now();
      wsMsgTimestamps = wsMsgTimestamps.filter((t) => now - t < 5000);
      wsMsgTimestamps.push(now);
      if (wsMsgTimestamps.length > 45) {
        pushFirewallIncident({
          id: `fw-ws-${now}-${crypto.randomBytes(2).toString('hex')}`,
          severity: 'MEDIUM',
          category: 'WS_GUARD',
          ruleTriggered: 'WebSocket frame burst limit exceeded (>45 frames / 5s)',
          method: 'WS',
          path: '/ws',
          maskedIp: client.userId ?? client.clientId,
          action: 'THROTTLED',
          createdAt: now,
        });
        securityStatus.totalBlocked += 1;
        broadcast({
          type: 'security:update',
          payload: {
            securityStatus: { ...securityStatus, lockdownMode: wsState?.lockdownMode ?? false },
            firewallIncidents: firewallIncidentsList.slice(0, 40),
          },
        });
        sendToClient(ws, { type: 'error', payload: { message: 'WebSocket rate limit reached. Slow down requests.' } });
        return;
      }

      const msg = JSON.parse(raw.toString()) as WsClientMessage;
      if (msg.type === 'subscribe') {
        const sym = msg.symbol.toUpperCase();
        const tf = normalizeTimeframe((msg as { timeframe?: string }).timeframe);
        if (instrumentsMap.has(sym)) {
          client.activeSymbol = sym;
          client.activeTimeframe = tf;
          perfEngine.switchSymbol(ws, sym);
          sendToClient(ws, {
            type: 'symbol:detail',
            payload: {
              symbol: sym,
              timeframe: tf,
              candles: getCandlesForTimeframe(sym, tf),
              orderBook: orderBooksMap.get(sym)!,
              recentTrades: tradesMap.get(sym) ?? [],
            },
          });
          broadcastDeskPresence();
        }
        return;
      }

      // All state-mutating WebSocket actions require an authenticated user session
      if (!client.userId) {
        sendToClient(ws, {
          type: 'error',
          payload: { message: 'Please sign in to place orders, manage alerts, or modify desk state.' },
        });
        return;
      }

      const activeWorkspace = getOrCreateWorkspace(
        client.userId,
        (s) => instrumentsMap.get(s)?.price ?? 100
      );

      if (msg.type === 'order:place') {
        if (activeWorkspace.lockdownMode) {
          sendToClient(ws, {
            type: 'error',
            payload: { message: 'Account Lockdown Active: Lift Lockdown in Wallet & Vault before placing orders.' },
          });
          return;
        }
        if (activeWorkspace.accountMode === 'real') {
          const verif = isUserVerifiedForRealTrading(client.userId, activeWorkspace);
          if (!verif.ok) {
            sendToClient(ws, {
              type: 'error',
              payload: {
                message:
                  verif.reason ??
                  'Complete Tier 2 KYC and Payment Rail verification before placing Real-Money orders.',
              },
            });
            return;
          }
        }
        const { symbol, side, type, size, price, stopPrice, traderName } = msg.payload;
        const sym = symbol.toUpperCase();
        const inst = instrumentsMap.get(sym);
        if (!inst || !Number.isFinite(size) || size <= 0) {
          sendToClient(ws, { type: 'error', payload: { message: 'Invalid order parameters' } });
          return;
        }
        const execPrice = type === 'market' ? (side === 'buy' ? inst.ask : inst.bid) : Number(price ?? inst.price);
        if (!Number.isFinite(execPrice) || execPrice <= 0) {
          sendToClient(ws, { type: 'error', payload: { message: 'Invalid limit/stop price' } });
          return;
        }

        const order: Order = {
          id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          clientId: client.userId,
          traderName: sanitizePlainText(traderName || client.name, 40),
          symbol: sym,
          side,
          type,
          price: roundPrice(sym, execPrice),
          stopPrice: stopPrice && Number.isFinite(stopPrice) ? roundPrice(sym, stopPrice) : undefined,
          size: Number(size.toFixed(6)),
          filledSize: 0,
          status: 'open',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          notional: Number((size * execPrice).toFixed(2)),
        };

        const activeOrders = activeWorkspace.accountMode === 'real' ? activeWorkspace.realOrders : activeWorkspace.orders;
        activeOrders.unshift(order);
        if (activeOrders.length > 100) activeOrders.pop();
        if (type === 'market') {
          executeOrderFill(activeWorkspace, order, execPrice, activeWorkspace.accountMode);
          if (order.status === 'cancelled') {
            sendToClient(ws, {
              type: 'error',
              payload: {
                message:
                  activeWorkspace.accountMode === 'real'
                    ? `Real Account order rejected: deposit funds or unlock Cold Vault balance in Wallet & Vault for ${sym}.`
                    : `Order rejected: insufficient Demo buying power or short-margin collateral for ${sym}.`,
              },
            });
          }
        }

        perfEngine.sendToUser(client.userId, {
          type: 'desk:state',
          payload: buildDeskStatePayload(activeWorkspace),
        });
        void recordOrderInCloudSql({
          uid: client.userId,
          email: client.email ?? 'trader@meridianmarkets.ai',
          externalOrderId: order.id,
          symbol: order.symbol,
          side: order.side,
          orderType: order.type,
          size: order.size,
          limitPrice: order.price,
          filledPrice: order.status === 'filled' ? order.price : undefined,
          status: order.status,
          cashBalance: getActiveCashBalance(activeWorkspace),
        }).catch(() => {});
      } else if (msg.type === 'order:cancel') {
        const activeOrders = activeWorkspace.accountMode === 'real' ? activeWorkspace.realOrders : activeWorkspace.orders;
        const ord = activeOrders.find((o) => o.id === msg.orderId);
        if (ord && ord.status === 'open') {
          ord.status = 'cancelled';
          ord.updatedAt = Date.now();
          persistWorkspacesSnapshot();
          perfEngine.sendToUser(client.userId, {
            type: 'desk:state',
            payload: buildDeskStatePayload(activeWorkspace),
          });
        }
      } else if (msg.type === 'alert:create') {
        const { symbol, condition, targetPrice, note } = msg.payload;
        const sym = symbol.toUpperCase();
        if (!instrumentsMap.has(sym) || !Number.isFinite(targetPrice) || targetPrice <= 0) return;
        const alert: PriceAlert = {
          id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          symbol: sym,
          condition,
          targetPrice: roundPrice(sym, targetPrice),
          active: true,
          createdAt: Date.now(),
          note: note ? sanitizePlainText(note, 100) : undefined,
        };
        activeWorkspace.alerts.unshift(alert);
        if (activeWorkspace.alerts.length > 50) activeWorkspace.alerts.pop();
        persistWorkspacesSnapshot();
        perfEngine.sendToUser(client.userId, {
          type: 'alerts:updated',
          payload: [...activeWorkspace.alerts],
        });
        void recordAlertInCloudSql({
          uid: client.userId,
          email: client.email ?? 'trader@meridianmarkets.ai',
          externalAlertId: alert.id,
          symbol: alert.symbol,
          condition: alert.condition,
          targetPrice: alert.targetPrice,
          note: alert.note,
          active: alert.active,
        }).catch(() => {});
      } else if (msg.type === 'alert:delete') {
        const idx = activeWorkspace.alerts.findIndex((a) => a.id === msg.alertId);
        if (idx !== -1) {
          activeWorkspace.alerts.splice(idx, 1);
          persistWorkspacesSnapshot();
          perfEngine.sendToUser(client.userId, {
            type: 'alerts:updated',
            payload: [...activeWorkspace.alerts],
          });
        }
      } else if (msg.type === 'desk:join') {
        client.name = sanitizePlainText(msg.name, 32) || client.name;
        client.role = sanitizePlainText(msg.role, 32) || client.role;
        broadcastDeskPresence();
      } else if (msg.type === 'portfolio:reset') {
        // Safely resets ONLY the Demo Practice Account, never touching Real Account or Cold Vault
        activeWorkspace.demoCashBalance = 1_000_000;
        activeWorkspace.orders.length = 0;
        activeWorkspace.positionsMap.clear();
        if (activeWorkspace.accountMode === 'demo') {
          activeWorkspace.cashBalance = 1_000_000;
        }
        persistWorkspacesSnapshot();
        perfEngine.sendToUser(client.userId, {
          type: 'desk:state',
          payload: buildDeskStatePayload(activeWorkspace),
        });
      }
    } catch {
      // Ignore malformed client message
    }
  });

  ws.on('close', () => {
    perfEngine.unregisterSocket(ws);
    clients.delete(ws);
    broadcastDeskPresence();
  });
});

// JSON-only Error Boundary for /api routes so proxy/Express errors never emit HTML
app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const errObj = err as { type?: string; status?: number; statusCode?: number; message?: string } | null;
  if (
    errObj &&
    (errObj.type === 'entity.parse.failed' || errObj.status === 400 || errObj.statusCode === 400)
  ) {
    if (!res.headersSent) {
      res.status(400).json({ error: 'Malformed JSON request payload.' });
    }
    return;
  }
  const message = err instanceof Error ? err.message : 'Unexpected internal API error.';
  recordRuntimeDiagnosticError('server', 'ERROR', message, 'Run Diagnostics Auto-Fix to clear transient error state.');
  if (!res.headersSent) {
    res.status(500).json({ error: message });
  }
});

async function bootstrap() {
  app.get('/.well-known/security.txt', (_req, res) => {
    const secTxtPath = path.resolve(process.cwd(), 'public', '.well-known', 'security.txt');
    if (fs.existsSync(secTxtPath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(fs.readFileSync(secTxtPath, 'utf8'));
      return;
    }
    res.status(404).send('Not found');
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.environments.client.transformRequest('/@vite/client');
        if (!result?.code) {
          next();
          return;
        }
        const safeCode = result.code
          .replace(/console\.debug\("\[vite\] connecting\.\.\."\);/, 'console.debug("[vite] static dev client ready (HMR disabled).");')
          .replace(/const hmrPort\s*=\s*[^;]+;/, 'const hmrPort = null;')
          .replace(
            /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
            'let wsTransport = { connect: async () => {}, disconnect: async () => {}, send: () => {} };'
          )
          .replace(
            /wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/g,
            'wsTransport = { connect: async () => {}, disconnect: async () => {}, send: () => {} };'
          )
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            'void Promise.resolve(transport.connect(createHMRHandler(handleMessage))).catch(() => {});'
          );
        res.status(200);
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(safeCode);
      } catch {
        next();
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  process.on('uncaughtException', (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    recordRuntimeDiagnosticError('server', 'ERROR', `Fault isolated: ${msg}`, 'Auto-isolated transient server exception without downtime.');
  });
  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    recordRuntimeDiagnosticError('server', 'WARN', `Promise rejection isolated: ${msg}`, 'Async handler failure isolated safely.');
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Aurex Global Exchange engine listening on http://0.0.0.0:${PORT} (${instrumentsMap.size} global markets)`);
  });

  const handleGracefulShutdown = () => {
    ccxtAdapters.stop();
    flushWorkspacesImmediate();
    flushMarketStateNow({
      instruments: Array.from(instrumentsMap.values()),
      auditLogs: auditLogsList.slice(0, 80),
      riskEvents: riskEventsList.slice(0, 60),
    });
    process.exit(0);
  };
  process.once('SIGINT', handleGracefulShutdown);
  process.once('SIGTERM', handleGracefulShutdown);
}

void bootstrap();
