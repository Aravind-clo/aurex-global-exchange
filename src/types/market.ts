export type AssetClass = 'equities' | 'crypto' | 'fx' | 'commodities';

export type MarketInstrumentType = 'spot' | 'futures' | 'options';

export type ChartTimeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '1D'
  | '1W'
  | '1M'
  | 'ALL';

export type MarketRegion =
  | 'crypto'
  | 'india'
  | 'us'
  | 'europe'
  | 'asia'
  | 'fx'
  | 'commodities';

export type ExchangeVenue =
  | 'NASDAQ'
  | 'NYSE'
  | 'NSE'
  | 'BSE'
  | 'LSE'
  | 'XETRA'
  | 'EURONEXT'
  | 'SIX'
  | 'TSE'
  | 'HKEX'
  | 'TWSE'
  | 'Coinbase'
  | 'Kraken'
  | 'Binance'
  | 'FX Prime'
  | 'CME';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DetectedPattern {
  id: string;
  symbol: string;
  name: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  timeframe: string;
  confidence: number;
  detectedAt: number;
  priceAtDetection: number;
  summary: string;
}

export interface MlPrediction {
  symbol: string;
  horizonLabel: string;
  currentPrice: number;
  predictedPrice: number;
  predictedReturnPct: number;
  predicted1hPrice: number;
  predicted1hReturnPct: number;
  predicted4hPrice: number;
  predicted4hReturnPct: number;
  supportLevel: number;
  resistanceLevel: number;
  suggestedStopLoss: number;
  suggestedTakeProfit: number;
  plainSummary: string;
  bandLow: number;
  bandHigh: number;
  direction: 'Bullish' | 'Bearish' | 'Neutral';
  confidence: number;
  rsi14: number;
  ema9: number;
  ema21: number;
  volatilityAnnPct: number;
  realizedVol24hPct?: number;
  atr24h?: number;
  atrPct?: number;
  zScore: number;
  opportunityScore: number;
  regime: 'Trending Up' | 'Trending Down' | 'Mean Reverting' | 'High Volatility';
  updatedAt: number;
}

export interface ContractSpec {
  underlying: string;
  expiry?: string;
  strike?: number;
  optionRight?: 'CALL' | 'PUT';
  maxLeverage?: number;
  fundingRatePct?: number;
  openInterestUsd?: number;
  lotSize?: number;
}

export interface MarketGenesisProfile {
  foundedYear: number;
  foundedDate: string;
  genesisPrice: number;
  allTimeHigh: number;
  athYear: number;
  allTimeLow: number;
  atlYear: number;
  marketCapUsd: number;
  marketCapFormatted: string;
  circulatingSupplyLabel: string;
  maxSupplyLabel: string;
  lifetimeReturnPct: number;
  historicalCagrPct: number;
  originStory: string;
  milestones: Array<{ year: number; event: string }>;
  yearlyCheckpoints: Array<{ year: number; price: number; marketCapUsd: number }>;
}

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  instrumentType?: MarketInstrumentType;
  contractSpec?: ContractSpec;
  venue: ExchangeVenue;
  region?: MarketRegion;
  sector?: string;
  quoteCurrency?: string;
  price: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  spreadBps: number;
  changePct: number;
  sparkline: number[];
  feedStatus: 'Live Feed' | 'Reference Feed';
  updatedAt: number;
  genesis?: MarketGenesisProfile;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  orders: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  mid: number;
  imbalancePct: number;
  updatedAt: number;
}

export interface TradeTapeItem {
  id: string;
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  time: number;
  venue: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  symbols: string[];
  region?: 'Global' | 'India' | 'US' | 'Europe' | 'Asia' | 'Crypto' | 'Macro';
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  sentimentScore: number;
  summary: string;
}

export interface ActionableInsight {
  id: string;
  symbol: string;
  venue: string;
  title: string;
  thesis: string;
  action: 'Accumulate' | 'Trim / Hedge' | 'Watch Breakout' | 'Mean Reversion Long';
  conviction: 'High' | 'Medium';
  predictedReturnPct: number;
  horizon: string;
  targetPrice: number;
  stopLossPrice: number;
  createdAt: number;
}

export interface Order {
  id: string;
  clientId: string;
  traderName: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  price: number;
  stopPrice?: number;
  size: number;
  filledSize: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  notional: number;
}

export interface Position {
  symbol: string;
  size: number;
  avgEntry: number;
  unrealizedPnl: number;
  realizedPnl: number;
  marketValue: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  active: boolean;
  triggeredAt?: number;
  createdAt: number;
  note?: string;
}

export interface DeskMember {
  clientId: string;
  name: string;
  role: string;
  activeSymbol: string;
  connectedAt: number;
}

export interface ApiLicenseKey {
  id: string;
  label: string;
  keyPreview: string;
  tier: 'Starter' | 'Pro' | 'Institutional';
  rateLimitPerMin: number;
  callsToday: number;
  createdAt: number;
}

export interface AiThesisBrief {
  symbol: string;
  stance: 'Strong Buy' | 'Tactical Long' | 'Neutral' | 'Tactical Short';
  headline: string;
  rationale: string;
  catalysts: string[];
  riskFactors: string[];
  entryZone: string;
  targetZone: string;
  invalidationLevel: string;
  generatedBy: 'Gemini 4 Hydrogen' | 'Quantitative Engine';
  generatedAt: number;
}

export type AgentDepartment =
  | 'Market Intelligence'
  | 'Technical Analysis'
  | 'Quantitative Intelligence'
  | 'Fundamental Intelligence'
  | 'News & Macro'
  | 'Strategy Intelligence'
  | 'Portfolio Management'
  | 'Risk & Governance';

export type AgentDirection = 'BUY' | 'SELL' | 'HOLD' | 'NO TRADE';

export interface AgentFinding {
  agent_id: string;
  agent_name: string;
  department: AgentDepartment;
  asset: string;
  market: string;
  timeframe: string;
  direction: AgentDirection;
  score: number;
  normalized_s: number;
  confidence: number;
  reliability: number;
  weight: number;
  evidence: string[];
  invalidations: string[];
  data_timestamp: string;
  model_version: string;
  requires_review: boolean;
}

export interface RiskRuleCheck {
  rule: string;
  limit: string;
  measured: string;
  passed: boolean;
}

export interface RiskGateVerdict {
  agent_id: 'A24';
  verdict: 'APPROVE' | 'REJECT' | 'ESCALATE';
  summary: string;
  maxPositionUsd: number;
  recommendedSize: number;
  checks: RiskRuleCheck[];
  evaluatedAt: number;
}

export interface NexusConsensusReport {
  runId: string;
  symbol: string;
  venue: ExchangeVenue;
  finalDecision: AgentDirection;
  weightedScore: number;
  calibratedProbability: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  rewardRiskRatio: number;
  horizon: string;
  departmentScores: Record<string, number>;
  findings: AgentFinding[];
  riskGate: RiskGateVerdict;
  createdAt: number;
}

export interface AuditLogEntry {
  id: string;
  eventType: 'CONSENSUS_RUN' | 'RISK_GATE_CHECK' | 'RISK_VETO' | 'ORDER_ROUTED';
  actor: string;
  symbol: string;
  summary: string;
  payloadJson: string;
  createdAt: number;
}

export interface RiskEventEntry {
  id: string;
  symbol: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  verdict: 'APPROVE' | 'REJECT' | 'ESCALATE';
  description: string;
  createdAt: number;
}

export type SupportedCurrency =
  | 'USD'
  | 'INR'
  | 'EUR'
  | 'GBP'
  | 'SGD'
  | 'AED'
  | 'JPY'
  | 'AUD'
  | 'CAD'
  | 'CHF';

export type BankRailType =
  | 'UPI'
  | 'IMPS'
  | 'NEFT'
  | 'ACH'
  | 'SEPA'
  | 'FPS'
  | 'SWIFT'
  | 'WIRE'
  | 'CARD';

export interface BankAccountRecord {
  id: string;
  bankName: string;
  accountHolder: string;
  rail: BankRailType;
  currency: SupportedCurrency;
  maskedNumber: string;
  maskedRouting: string;
  cipherSuite: 'AES-256-GCM';
  authTagPreview: string;
  verified: boolean;
  addedAt: number;
}

export interface VaultTransferRecord {
  id: string;
  type: 'deposit' | 'withdrawal' | 'vault_lock' | 'vault_unlock';
  amountUsd: number;
  nativeAmount: number;
  currency: SupportedCurrency;
  bankAccountId: string;
  bankLabel: string;
  destination?: 'real_trading' | 'cold_vault' | 'external_bank';
  status: 'settled' | 'blocked';
  entryHash: string;
  prevHash: string;
  createdAt: number;
}

export interface FirewallIncident {
  id: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category:
    | 'WAF_SIGNATURE'
    | 'RATE_LIMIT'
    | 'AUTH_STEPUP'
    | 'LOCKDOWN'
    | 'WS_GUARD'
    | 'KEY_ISOLATION'
    | 'PATH_PROBE';
  ruleTriggered: string;
  method: string;
  path: string;
  maskedIp: string;
  action: 'BLOCKED' | 'THROTTLED';
  createdAt: number;
}

export interface SecurityStatus {
  firewallActive: boolean;
  lockdownMode: boolean;
  totalBlocked: number;
  cipherSuite: string;
  ledgerChainValid: boolean;
  lastVerifiedAt: number;
}

export interface SocialPost {
  id: string;
  author: string;
  role: string;
  symbol: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  title: string;
  thesis: string;
  targetPrice?: number;
  likes: number;
  likedByClientIds: string[];
  createdAt: number;
}

export interface CommunityContributor {
  id: string;
  handle: string;
  role: string;
  specialty: string;
  winRatePct: number;
  followers: number;
  following: boolean;
  ideasCount: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  experienceMode: 'newbie' | 'pro';
  marketFocus?: string;
  contactPhone?: string;
  twoFactorEnabled: boolean;
  mfaEnabled: boolean;
  totpEnabled: boolean;
  passkeysCount: number;
  realMoneyEnabled: boolean;
  linkedProviders: Array<'google' | 'github'>;
  referralCode?: string;
  termsAcceptedAt?: number;
  kycTier?: 'Unverified' | 'Tier 1 Identity' | 'Tier 2 Documented' | 'Institutional';
  kycStatus?: 'NOT_SUBMITTED' | 'VERIFIED' | 'FLAGGED';
  createdAt: number;
  lastLoginAt: number;
}

export type AuthAuditEventType =
  | 'REGISTER_SUCCESS'
  | 'REGISTER_FAILED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'BRUTE_FORCE_LOCK'
  | 'MFA_CHALLENGE_ISSUED'
  | 'MFA_VERIFIED'
  | 'MFA_FAILED'
  | 'TOTP_ENROLLED'
  | 'TOTP_DISABLED'
  | 'PASSKEY_REGISTERED'
  | 'PASSKEY_REVOKED'
  | 'OAUTH_SIGNIN'
  | 'OAUTH_FAILED'
  | 'REAL_MONEY_ENABLED'
  | 'REAL_MONEY_REVOKED'
  | 'REAL_MONEY_DENIED'
  | 'SESSION_LOGOUT'
  | 'SESSIONS_REVOKED'
  | 'ADMIN_ACTION';

export interface AuthAuditEvent {
  id: string;
  eventType: AuthAuditEventType;
  outcome: 'SUCCESS' | 'CHALLENGE' | 'FAILED' | 'BLOCKED';
  method: 'password' | 'totp' | 'backup' | 'webauthn' | 'google' | 'github' | 'system';
  userId?: string;
  email: string;
  name?: string;
  role?: string;
  maskedIp: string;
  userAgent: string;
  detail: string;
  entryHash: string;
  prevHash: string;
  createdAt: number;
}

export interface AdminUserDirectoryEntry {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  experienceMode: 'newbie' | 'pro';
  marketFocus: string;
  contactPhone?: string;
  totpEnabled: boolean;
  passkeysCount: number;
  realMoneyEnabled: boolean;
  linkedProviders: Array<'google' | 'github'>;
  activeSessions: number;
  cashBalance: number;
  bankRailsCount: number;
  ordersCount: number;
  createdAt: number;
  lastLoginAt: number;
}

export interface AdminServerOverview {
  totalUsers: number;
  activeSessions: number;
  totalAuthEvents: number;
  failedAuthEvents: number;
  realMoneyEnabledUsers: number;
  dualMfaReadyUsers: number;
  uptimeSec: number;
  storageBackend: string;
  storageFile: string;
  keyStatus: Array<{
    keyName: string;
    scope: string;
    status: 'CONFIGURED' | 'RUNTIME_EPHEMERAL' | 'NOT_SET';
    purpose: string;
  }>;
}

export interface AiAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  symbol?: string;
  poweredBy?: string;
  createdAt: number;
}

export interface MfaChallengePayload {
  mfaToken: string;
  methods: Array<'totp' | 'webauthn' | 'backup'>;
  emailHint: string;
  expiresAt: number;
}

export interface PasskeyCredentialInfo {
  id: string;
  label: string;
  algorithm: string;
  transports: string[];
  createdAt: number;
  lastUsedAt?: number;
}

export interface OAuthProviderInfo {
  id: 'google' | 'github';
  name: string;
  configured: boolean;
  callbackUrl: string;
  missingEnvVars: string[];
}

export interface TotpEnrollmentSetup {
  secretBase32: string;
  otpauthUri: string;
  issuer: string;
  accountEmail: string;
  recoveryCodes: string[];
}

export interface AuthSessionInfo {
  sessionId: string;
  userAgent: string;
  maskedIp: string;
  createdAt: number;
  expiresAt: number;
  current: boolean;
}

export interface StorageStoreStatus {
  id: string;
  name: string;
  filePath: string;
  recordsCount: number;
  sizeBytes: number;
  lastSavedAt: number;
  integrity: 'AES-256-GCM + HMAC' | 'HMAC-SHA256' | 'ATOMIC_JSON';
}

export interface EngineMetrics {
  activeConnections: number;
  authenticatedUsers: number;
  subscribedRooms: number;
  ticksProcessed: number;
  ordersMatched: number;
  avgBroadcastLatencyMs: number;
  p95ApiLatencyMs: number;
  eventLoopLagMs?: number;
  snapshotCacheHits: number;
  snapshotCacheHitRatePct: number;
  memoryRssMb: number;
  uptimeSec: number;
  totalInstruments?: number;
  storageStores?: StorageStoreStatus[];
}

export interface StressTestResult {
  concurrency: number;
  totalOperations: number;
  succeeded: number;
  blockedByWaf: number;
  durationMs: number;
  opsPerSec: number;
  p95LatencyMs: number;
  timestamp: number;
}

export interface AgentLivePerformance {
  agentId: string;
  agentName: string;
  department: AgentDepartment;
  currentCall: AgentDirection;
  activeSymbol: string;
  entryPrice: number;
  markPrice: number;
  unrealizedPnlUsd: number;
  realizedPnlUsd: number;
  totalPnlUsd: number;
  returnPct: number;
  winRatePct: number;
  sharpe: number;
  closedTrades: number;
  winningTrades: number;
  streak: number;
  liveScore: number;
  rank: number;
  updatedAt: number;
}

export interface GlobalExchangeSession {
  id: string;
  name: string;
  code: string;
  region: string;
  timezone: string;
  localTimeStr: string;
  status: 'OPEN' | 'PRE_MARKET' | 'CLOSED';
  benchmarkSymbol: string;
  benchmarkPrice: number;
  benchmarkChangePct: number;
}

export interface GlobalMonitorSnapshot {
  sessions: GlobalExchangeSession[];
  totalMarkets: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  volatilityRegime: 'CALM' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  avgVolatilityPct: number;
  topGainers: Array<{
    symbol: string;
    name: string;
    venue: string;
    price: number;
    changePct: number;
  }>;
  topLosers: Array<{
    symbol: string;
    name: string;
    venue: string;
    price: number;
    changePct: number;
  }>;
  fxPulse: {
    usdInr: number;
    eurUsd: number;
    gbpUsd: number;
    goldUsd: number;
    btcUsd: number;
  };
  blockedThreats: number;
  activeLockdowns: number;
  updatedAt: number;
}

export interface ReferralPromoProfile {
  referralCode: string;
  inviteUrl: string;
  shareCount: number;
  sharesByChannel: Record<string, number>;
  redeemedCodes: string[];
  bonusDemoUsd: number;
  feeDiscountPct: number;
  tierLabel: string;
  recentRewards: Array<{
    code: string;
    label: string;
    bonusDemoUsd: number;
    feeDiscountPct: number;
    redeemedAt: number;
  }>;
}

export interface CcxtConnectorStatus {
  exchange: 'Binance' | 'KuCoin';
  transport: 'ws+ccxt' | 'ccxt-rest' | 'standby';
  connected: boolean;
  pairsCount: number;
  ticksReceived: number;
  lastTickAt: number | null;
  lastError?: string;
}

export interface InitPayload {
  clientId: string;
  user?: AuthUser;
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  patterns: DetectedPattern[];
  insights: ActionableInsight[];
  news: NewsItem[];
  activeSymbol: string;
  candles: Candle[];
  orderBook: OrderBook;
  recentTrades: TradeTapeItem[];
  accountMode?: 'demo' | 'real';
  cashBalance: number;
  demoCashBalance?: number;
  realCashBalance?: number;
  vaultBalanceUsd?: number;
  orders: Order[];
  positions: Position[];
  alerts: PriceAlert[];
  deskMembers: DeskMember[];
  apiKeys: ApiLicenseKey[];
  nexusReport?: NexusConsensusReport;
  agentLeaderboard?: AgentLivePerformance[];
  globalMonitor?: GlobalMonitorSnapshot;
  promoProfile?: ReferralPromoProfile;
  auditLogs?: AuditLogEntry[];
  riskEvents?: RiskEventEntry[];
  bankAccounts?: BankAccountRecord[];
  vaultTransfers?: VaultTransferRecord[];
  firewallIncidents?: FirewallIncident[];
  securityStatus?: SecurityStatus;
  socialPosts?: SocialPost[];
  contributors?: CommunityContributor[];
  engineMetrics?: EngineMetrics;
  connectors?: CcxtConnectorStatus[];
  networkTelemetry?: EncryptedNetworkTelemetry;
  defenseAgents?: HackDefenseAgent[];
  rewardsState?: UserRewardsState;
  socialGraph?: SocialGraphState;
  bots?: TradingBotRecord[];
}

export type WsServerMessage =
  | { type: 'init'; payload: InitPayload }
  | {
      type: 'market:batch';
      payload: {
        instruments: Instrument[];
        predictions: Record<string, MlPrediction>;
        engineMetrics?: EngineMetrics;
        connectors?: CcxtConnectorStatus[];
      };
    }
  | {
      type: 'symbol:detail';
      payload: {
        symbol: string;
        timeframe?: ChartTimeframe;
        candles: Candle[];
        orderBook: OrderBook;
        recentTrades: TradeTapeItem[];
      };
    }
  | { type: 'book:update'; payload: OrderBook }
  | { type: 'trade:executed'; payload: TradeTapeItem }
  | { type: 'candle:update'; payload: { symbol: string; candle: Candle } }
  | { type: 'pattern:detected'; payload: DetectedPattern }
  | { type: 'insight:new'; payload: ActionableInsight }
  | { type: 'news:update'; payload: NewsItem[] }
  | {
      type: 'desk:state';
      payload: {
        accountMode?: 'demo' | 'real';
        cashBalance: number;
        demoCashBalance?: number;
        realCashBalance?: number;
        vaultBalanceUsd?: number;
        orders: Order[];
        positions: Position[];
      };
    }
  | { type: 'alerts:updated'; payload: PriceAlert[] }
  | { type: 'alert:triggered'; payload: PriceAlert }
  | { type: 'desk:presence'; payload: DeskMember[] }
  | { type: 'nexus:report'; payload: NexusConsensusReport }
  | {
      type: 'audit:update';
      payload: { auditLogs: AuditLogEntry[]; riskEvents: RiskEventEntry[] };
    }
  | {
      type: 'security:update';
      payload: {
        securityStatus: SecurityStatus;
        firewallIncidents: FirewallIncident[];
      };
    }
  | {
      type: 'vault:update';
      payload: {
        bankAccounts: BankAccountRecord[];
        vaultTransfers: VaultTransferRecord[];
        securityStatus: SecurityStatus;
      };
    }
  | {
      type: 'social:update';
      payload: {
        socialPosts: SocialPost[];
        contributors: CommunityContributor[];
      };
    }
  | { type: 'agents:performance'; payload: AgentLivePerformance[] }
  | { type: 'global:monitor'; payload: GlobalMonitorSnapshot }
  | { type: 'admin:auth_event'; payload: AuthAuditEvent }
  | { type: 'error'; payload: { message: string } };

export type WsClientMessage =
  | { type: 'subscribe'; symbol: string; timeframe?: string }
  | {
      type: 'order:place';
      payload: {
        symbol: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit' | 'stop';
        size: number;
        price?: number;
        stopPrice?: number;
        traderName?: string;
      };
    }
  | { type: 'order:cancel'; orderId: string }
  | {
      type: 'alert:create';
      payload: {
        symbol: string;
        condition: 'above' | 'below';
        targetPrice: number;
        note?: string;
      };
    }
  | { type: 'alert:delete'; alertId: string }
  | { type: 'desk:join'; name: string; role: string }
  | { type: 'portfolio:reset' };

export type KycDocumentType =
  | 'Passport'
  | 'Aadhaar'
  | 'PAN'
  | 'National ID'
  | 'Drivers License';

export interface KycVerificationRecord {
  userId: string;
  tier: 'Unverified' | 'Tier 1 Identity' | 'Tier 2 Documented' | 'Institutional';
  status: 'NOT_SUBMITTED' | 'VERIFIED' | 'FLAGGED';
  country: string;
  fullName: string;
  docType: KycDocumentType;
  maskedDocNumber: string;
  docHash: string;
  proofOfAddressType: string;
  selfieVerified: boolean;
  antiScamPledgeAt?: number;
  badgeCode: string;
  updatedAt: number;
}

export interface ScamReportRecord {
  id: string;
  suspectedHandle: string;
  channel: string;
  description: string;
  reportedBy: string;
  status: 'INVESTIGATING' | 'CONFIRMED_SCAM_BLOCKED';
  createdAt: number;
}

export interface InvestorProfile {
  id: string;
  category: 'famous' | 'community';
  name: string;
  handle: string;
  title: string;
  country: string;
  verificationBadge: string;
  kycVerified: boolean;
  style: string;
  focusMarkets: string[];
  topHoldings: string[];
  winRatePct: number;
  returnYtdPct: number;
  aumOrCapitalLabel: string;
  followers: number;
  following?: boolean;
  bio: string;
  disclaimerNote: string;
  updatedAt: number;
}

export interface CountryGuideline {
  countryCode: string;
  countryName: string;
  regulator: string;
  cryptoPolicy: string;
  equitiesFxDerivativesRules: string;
  taxAndReportingNote: string;
  supportedPaymentRails: string[];
  accessStatus: 'OPEN_SIMULATION' | 'RESTRICTED_DISCLOSURE';
}

export interface GlobalBankDirectoryEntry {
  id: string;
  country: string;
  region: 'india' | 'international';
  bankName: string;
  rail: BankRailType;
  currency: SupportedCurrency;
  sampleAcct: string;
  routingCode: string;
  settlementSpeed: string;
}

export interface NextMoveInterestItem {
  symbol: string;
  name: string;
  region: string;
  sector: string;
  heatScore: number;
  direction: 'Bullish' | 'Bearish' | 'Neutral';
  newsMentions: number;
  opportunityScore: number;
  predictedReturnPct: number;
  reason: string;
}

export interface EncryptedEnvelopeProof {
  keyId: string;
  nonce: string;
  timestamp: number;
  channel: string;
  payloadHashSha256: string;
  clientEphemeralPubB64?: string;
}

export interface EncryptedNetworkTelemetry {
  ecdhCurve: 'X25519';
  cipherSuite: 'AES-256-GCM';
  kdf: 'HKDF-SHA256';
  handshakeActive: boolean;
  sessionKeyId: string;
  serverPublicKeySpkiB64: string;
  packetsSealed: number;
  packetsVerified: number;
  replayBlockedCount: number;
  tamperedRejectedCount: number;
  lastPacketAt: number;
  recentPackets: Array<{
    id: string;
    channel: string;
    direction: 'INBOUND_VERIFIED' | 'OUTBOUND_SEALED' | 'REPLAY_BLOCKED';
    keyId: string;
    authTagPreview: string;
    payloadBytes: number;
    createdAt: number;
  }>;
}

export interface DiagnosticProbeResult {
  id: string;
  name: string;
  category: 'OrderBook' | 'Candles' | 'Ledger' | 'Feeds' | 'Runtime' | 'Crypto' | 'Security';
  status: 'PASS' | 'WARN' | 'FAIL';
  summary: string;
  measuredValue: string;
  autoFixable: boolean;
  founderOnlyFix?: boolean;
  checkedAt: number;
}

export interface DiagnosticErrorLog {
  id: string;
  source: 'server' | 'client' | 'feed' | 'crypto';
  severity: 'WARN' | 'ERROR';
  message: string;
  autoFixHint: string;
  resolved: boolean;
  occurredAt: number;
}

export interface DiagnosticsReport {
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  healthScorePct: number;
  probes: DiagnosticProbeResult[];
  recentErrors: DiagnosticErrorLog[];
  lastAutoRemediationAt?: number;
  lastRemediationSummary?: string;
  checkedAt: number;
}

export interface AutoRemediationResult {
  ok: boolean;
  summary: string;
  fixedCount: number;
  report: DiagnosticsReport;
}

export interface HackDefenseAgent {
  id: string;
  codename: string;
  role: string;
  status: 'ACTIVE_GUARD' | 'CONTAINING' | 'HARDENED';
  threatsNeutralized: number;
  lastScanAt: number;
  focusSurface: string;
  latestAction: string;
}

export interface FounderAiMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  focusMetric: string;
  status: 'ONLINE' | 'AUDITING';
  lastInsight: string;
}

export interface FounderImprovementProposal {
  id: string;
  versionTag: string;
  authorRole: string;
  title: string;
  rationale: string;
  impactArea: 'Security' | 'Execution' | 'Compliance' | 'Growth' | 'Reliability';
  priority: 'P0' | 'P1' | 'P2';
  status: 'PROPOSED' | 'APPLIED';
  actionKey: string;
  proposedAt: number;
  appliedAt?: number;
}

export interface FounderAiTeamState {
  founderEmail: string;
  members: FounderAiMember[];
  proposals: FounderImprovementProposal[];
  lastReviewAt: number;
  platformVersion: string;
}

export type BotStrategyType =
  | 'GRID'
  | 'DCA'
  | 'MOMENTUM_EMA'
  | 'MEAN_REVERSION_BB'
  | 'TWAP_SMART';

export interface BotExecutionLog {
  id: string;
  botId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  reason: string;
  pnlImpactUsd: number;
  createdAt: number;
}

export interface TradingBotRecord {
  id: string;
  userId: string;
  name: string;
  symbol: string;
  strategy: BotStrategyType;
  accountMode: 'demo' | 'real';
  status: 'RUNNING' | 'PAUSED' | 'STOPPED_DRAWDOWN';
  allocatedUsd: number;
  orderSizeUnits: number;
  gridLower?: number;
  gridUpper?: number;
  gridLevels?: number;
  intervalSec?: number;
  maxDrawdownPct: number;
  tradesCount: number;
  realizedPnlUsd: number;
  lastSignalText: string;
  lastExecutedAt?: number;
  createdAt: number;
  logs: BotExecutionLog[];
}

export interface RewardQuest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  bonusDemoUsd: number;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface UserRewardsState {
  userId: string;
  xpPoints: number;
  tierName: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Obsidian';
  nextTierXp: number;
  streakDays: number;
  totalClaimedDemoUsd: number;
  feeDiscountPct: number;
  quests: RewardQuest[];
  claimedHistory: Array<{
    questId: string;
    title: string;
    xpReward: number;
    bonusDemoUsd: number;
    claimedAt: number;
  }>;
}

export interface SocialGraphState {
  followingIds: string[];
  followerIds: string[];
  followingCount: number;
  followersCount: number;
  recentFollowEvents: Array<{
    targetId: string;
    targetName: string;
    action: 'followed' | 'unfollowed';
    at: number;
  }>;
}

export interface FounderRewardCampaign {
  id: string;
  code: string;
  title: string;
  bonusDemoUsd: number;
  xpReward: number;
  feeDiscountPct: number;
  active: boolean;
  claimsCount: number;
  createdAt: number;
}

export interface AdminRewardsOverview {
  totalXpDistributed: number;
  totalBonusDemoGrantedUsd: number;
  totalQuestsClaimed: number;
  sybilFlagsCount: number;
  campaigns: FounderRewardCampaign[];
  topRewardHolders: Array<{
    userId: string;
    email: string;
    name: string;
    xpPoints: number;
    tierName: string;
    questsClaimed: number;
    flaggedSybil: boolean;
  }>;
}

export interface TrustedDeviceRecord {
  id: string;
  userId: string;
  fingerprintHash: string;
  label: string;
  maskedIp: string;
  trustStatus: 'TRUSTED' | 'NEW_OBSERVED' | 'REVOKED';
  sightings: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface DdosTelemetry {
  active: boolean;
  edgeScrubberMode: 'NORMAL' | 'ELEVATED_SCRUB' | 'UNDER_ATTACK';
  requestsLast60s: number;
  requestsPerSec: number;
  activeIpBuckets: number;
  blockedFloodRequests: number;
  activeCooldownIps: number;
  lastFloodBlockedAt?: number;
}

export interface WalletRiskFactor {
  id: string;
  label: string;
  category: 'MFA' | 'DEVICE' | 'KYC' | 'VAULT' | 'THREAT';
  impact: number;
  status: 'PASS' | 'WARN' | 'RISK';
  mitigation: string;
}

export interface WalletRiskAssessment {
  score: number;
  tier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  summary: string;
  factors: WalletRiskFactor[];
  computedAt: number;
}

export interface SiemEvent {
  id: string;
  correlationId: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceLayer: string;
  mitreTactic: string;
  summary: string;
  actorMasked: string;
  createdAt: number;
}

export interface HsmKeySlot {
  slotId: string;
  alias: string;
  algorithm: 'AES-256-GCM-WRAP' | 'ECDSA-P384' | 'HMAC-SHA256';
  epoch: number;
  publicKeyFingerprint: string;
  fipsLevel: 'FIPS 140-3 Level 3';
  lastRotatedAt: number;
  operationsCount: number;
}

export interface HsmAttestationResult {
  attestationId: string;
  slotId: string;
  algorithm: string;
  messageDigestHex: string;
  signatureHex: string;
  verified: boolean;
  signedAt: number;
}

export interface BugBountySubmission {
  id: string;
  ticketCode: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  component: string;
  description: string;
  reproductionSteps: string;
  rewardBandUsd: string;
  status: 'TRIAGED' | 'UNDER_REVIEW' | 'RESOLVED';
  reporterHandle: string;
  createdAt: number;
}

export interface PentestProbeResult {
  id: string;
  vectorName: string;
  targetLayer: string;
  expectedBehavior: string;
  actualResult: string;
  latencyMs: number;
  passed: boolean;
}

export interface PentestReport {
  runId: string;
  totalVectors: number;
  passedVectors: number;
  failedVectors: number;
  scorePct: number;
  executedAt: number;
  probes: PentestProbeResult[];
}

export interface EnterpriseSecuritySnapshot {
  walletRisk: WalletRiskAssessment;
  ddos: DdosTelemetry;
  siemEvents: SiemEvent[];
  hsmSlots: HsmKeySlot[];
  hsmLastAttestation?: HsmAttestationResult;
  trustedDevices: TrustedDeviceRecord[];
  userAuditLogs: AuthAuditEvent[];
  bountySubmissions: BugBountySubmission[];
  lastPentestReport?: PentestReport;
}

export interface PortfolioAllocationSlice {
  id: string;
  label: string;
  subLabel: string;
  category: 'crypto' | 'equities' | 'fx' | 'commodities' | 'cash';
  valueUsd: number;
  weightPct: number;
  riskContributionPct: number;
  color: string;
}

export interface AssetRiskAttribution {
  symbol: string;
  name: string;
  venue: string;
  assetClass: AssetClass;
  size: number;
  marketValueUsd: number;
  weightPct: number;
  unrealizedPnlUsd: number;
  realizedPnlUsd: number;
  annualizedReturnPct: number;
  annualizedVolatilityPct: number;
  marginalRiskPct: number;
  riskContributionPct: number;
  assetSharpe: number;
  betaEstimate: number;
}

export interface PortfolioCorrelationCell {
  rowSymbol: string;
  colSymbol: string;
  correlation: number;
}

export interface PortfolioAnalyticsReport {
  accountMode: 'demo' | 'real';
  totalEquityUsd: number;
  investedValueUsd: number;
  cashBalanceUsd: number;
  vaultBalanceUsd: number;
  cashWeightPct: number;
  totalUnrealizedPnlUsd: number;
  totalRealizedPnlUsd: number;
  riskFreeRatePct: number;
  annualizedReturnPct: number;
  portfolioVolatilityPct: number;
  dailyVolatilityPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  parametricVar95Usd: number;
  parametricVar95Pct: number;
  diversificationScorePct: number;
  concentrationHhi: number;
  portfolioBeta: number;
  byHoldingSlices: PortfolioAllocationSlice[];
  byAssetClassSlices: PortfolioAllocationSlice[];
  attributions: AssetRiskAttribution[];
  correlations: PortfolioCorrelationCell[];
  computedAt: number;
}

export interface StakingPool {
  id: string;
  symbol: string;
  assetName: string;
  apyPct: number;
  lockTermLabel: string;
  minStakeUsd: number;
  tvlUsd: number;
  accentColor: string;
}

export interface StakingPosition {
  id: string;
  poolId: string;
  symbol: string;
  assetName: string;
  amountUsd: number;
  apyPct: number;
  accruedRewardUsd: number;
  stakedAt: number;
}

export interface PredictionContract {
  id: string;
  title: string;
  symbol: string;
  horizonLabel: string;
  durationSec: number;
  upOddsMultiplier: number;
  downOddsMultiplier: number;
  category: 'Crypto' | 'Equities' | 'Macro';
}

export interface PredictionBet {
  id: string;
  contractId: string;
  title: string;
  symbol: string;
  horizonLabel: string;
  direction: 'UP' | 'DOWN';
  stakeUsd: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  expiresAt: number;
  status: 'OPEN' | 'SETTLED_WIN' | 'SETTLED_LOSS';
  createdAt: number;
}

export interface CardTransaction {
  id: string;
  merchant: string;
  category: string;
  amountUsd: number;
  cashbackUsd: number;
  cashbackAsset: 'BTC' | 'SOL' | 'USDT';
  status: 'COMPLETED' | 'DECLINED_FROZEN';
  createdAt: number;
}

export interface CardProfile {
  cardNumberMasked: string;
  holderName: string;
  tier: 'Obsidian Metal' | 'Amber Sovereign';
  frozen: boolean;
  dailyLimitUsd: number;
  spentTodayUsd: number;
  cashbackAsset: 'BTC' | 'SOL' | 'USDT';
  cashbackRatePct: number;
  totalCashbackEarnedUsd: number;
  transactions: CardTransaction[];
}

export interface ExchangeFeaturesState {
  stakingPools: StakingPool[];
  stakingPositions: StakingPosition[];
  predictionContracts: PredictionContract[];
  predictionBets: PredictionBet[];
  cardProfile: CardProfile;
}

