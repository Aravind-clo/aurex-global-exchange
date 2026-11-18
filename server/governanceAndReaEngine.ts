import crypto from 'node:crypto';
import type {
  BackendChartAnalytics,
  Candle,
  CoinLaunchSubmission,
  IpRateLimitEvent,
  IpRateLimitRule,
  KycDocumentType,
  OrderBook,
  PlatformNotification,
  ReaAgentRecord,
  ReaEventRecord,
  ReaLedgerSnapshot,
  ReaResourceRecord,
  TopTierVerificationBundle,
  UserFeatureGrants,
  UserLimitRecord,
} from '../src/types/market.ts';
import {
  recordIpRateLimitEventInCloudSql,
  recordPlatformNotificationInCloudSql,
  recordReaEventInCloudSql,
  syncCoinLaunchInCloudSql,
  syncIpRateLimitRuleInCloudSql,
  syncTopTierVerificationInCloudSql,
  syncUserFeatureGrantsInCloudSql,
  syncUserLimitsInCloudSql,
} from '../src/db/users.ts';

const FOUNDER_EMAIL = 'vemulavankeswararao@gmail.com';

// --- 1. Separated User Limits & 1-Click Feature Grants (isolated from users/wallet_accounts tables) ---
const userLimitsStore = new Map<string, UserLimitRecord>();
const userGrantsStore = new Map<string, UserFeatureGrants>();

function buildDefaultLimits(userId: string, email: string): UserLimitRecord {
  const isFounder = email.trim().toLowerCase() === FOUNDER_EMAIL;
  return {
    userId,
    tierCode: isFounder ? 'INSTITUTIONAL' : 'STARTER',
    dailyDepositLimitUsd: isFounder ? 5_000_000 : 25_000,
    dailyWithdrawalLimitUsd: isFounder ? 2_500_000 : 10_000,
    singleOrderMaxUsd: isFounder ? 2_500_000 : 50_000,
    maxOpenPositions: isFounder ? 150 : 12,
    maxLeverageX: isFounder ? 25 : 5,
    apiCallsPerMin: isFounder ? 1200 : 120,
    updatedByAdmin: 'system-default',
    updatedAt: Date.now(),
  };
}

function buildDefaultGrants(userId: string, email: string): UserFeatureGrants {
  const isFounder = email.trim().toLowerCase() === FOUNDER_EMAIL;
  return {
    userId,
    canTradeRealMoney: isFounder,
    canCreateApiKeys: isFounder,
    canLaunchTokens: isFounder,
    canBypassVelocity: isFounder,
    canExportAudit: isFounder,
    updatedByAdmin: 'system-default',
    updatedAt: Date.now(),
  };
}

export function getUserLimits(userId: string, email = ''): UserLimitRecord {
  const existing = userLimitsStore.get(userId);
  if (existing) return existing;
  const created = buildDefaultLimits(userId, email);
  userLimitsStore.set(userId, created);
  return created;
}

export function updateUserLimits(
  userId: string,
  email: string,
  patch: Partial<
    Pick<
      UserLimitRecord,
      | 'tierCode'
      | 'dailyDepositLimitUsd'
      | 'dailyWithdrawalLimitUsd'
      | 'singleOrderMaxUsd'
      | 'maxOpenPositions'
      | 'maxLeverageX'
      | 'apiCallsPerMin'
    >
  >,
  adminEmail: string
): UserLimitRecord {
  const cur = getUserLimits(userId, email);
  const next: UserLimitRecord = {
    ...cur,
    tierCode: patch.tierCode ?? cur.tierCode,
    dailyDepositLimitUsd:
      typeof patch.dailyDepositLimitUsd === 'number' && Number.isFinite(patch.dailyDepositLimitUsd)
        ? Math.max(100, Math.min(50_000_000, patch.dailyDepositLimitUsd))
        : cur.dailyDepositLimitUsd,
    dailyWithdrawalLimitUsd:
      typeof patch.dailyWithdrawalLimitUsd === 'number' && Number.isFinite(patch.dailyWithdrawalLimitUsd)
        ? Math.max(100, Math.min(25_000_000, patch.dailyWithdrawalLimitUsd))
        : cur.dailyWithdrawalLimitUsd,
    singleOrderMaxUsd:
      typeof patch.singleOrderMaxUsd === 'number' && Number.isFinite(patch.singleOrderMaxUsd)
        ? Math.max(50, Math.min(25_000_000, patch.singleOrderMaxUsd))
        : cur.singleOrderMaxUsd,
    maxOpenPositions:
      typeof patch.maxOpenPositions === 'number' && Number.isFinite(patch.maxOpenPositions)
        ? Math.max(1, Math.min(500, Math.round(patch.maxOpenPositions)))
        : cur.maxOpenPositions,
    maxLeverageX:
      typeof patch.maxLeverageX === 'number' && Number.isFinite(patch.maxLeverageX)
        ? Math.max(1, Math.min(50, Math.round(patch.maxLeverageX)))
        : cur.maxLeverageX,
    apiCallsPerMin:
      typeof patch.apiCallsPerMin === 'number' && Number.isFinite(patch.apiCallsPerMin)
        ? Math.max(10, Math.min(5000, Math.round(patch.apiCallsPerMin)))
        : cur.apiCallsPerMin,
    updatedByAdmin: adminEmail,
    updatedAt: Date.now(),
  };
  userLimitsStore.set(userId, next);

  void syncUserLimitsInCloudSql({
    uid: userId,
    email: email || `${userId}@nuvra.exchange`,
    tierCode: next.tierCode,
    dailyDepositLimitUsd: next.dailyDepositLimitUsd,
    dailyWithdrawalLimitUsd: next.dailyWithdrawalLimitUsd,
    singleOrderMaxUsd: next.singleOrderMaxUsd,
    maxOpenPositions: next.maxOpenPositions,
    maxLeverageX: next.maxLeverageX,
    apiCallsPerMin: next.apiCallsPerMin,
    updatedByAdmin: adminEmail,
  }).catch(() => {});

  emitPlatformNotification({
    recipientScope: 'USER',
    recipientUserId: userId,
    category: 'LIMIT_BREACH',
    severity: 'INFO',
    title: 'Account Limits Updated',
    message: `Your trading tier is now ${next.tierCode} (Single Order Max $${next.singleOrderMaxUsd.toLocaleString()}, Daily Withdrawal $${next.dailyWithdrawalLimitUsd.toLocaleString()}).`,
  });

  return next;
}

export function getUserFeatureGrants(userId: string, email = ''): UserFeatureGrants {
  const existing = userGrantsStore.get(userId);
  if (existing) return existing;
  const created = buildDefaultGrants(userId, email);
  userGrantsStore.set(userId, created);
  return created;
}

export function updateUserFeatureGrants(
  userId: string,
  email: string,
  patch: Partial<
    Pick<
      UserFeatureGrants,
      | 'canTradeRealMoney'
      | 'canCreateApiKeys'
      | 'canLaunchTokens'
      | 'canBypassVelocity'
      | 'canExportAudit'
    >
  >,
  adminEmail: string
): UserFeatureGrants {
  const cur = getUserFeatureGrants(userId, email);
  const next: UserFeatureGrants = {
    ...cur,
    canTradeRealMoney:
      typeof patch.canTradeRealMoney === 'boolean' ? patch.canTradeRealMoney : cur.canTradeRealMoney,
    canCreateApiKeys:
      typeof patch.canCreateApiKeys === 'boolean' ? patch.canCreateApiKeys : cur.canCreateApiKeys,
    canLaunchTokens:
      typeof patch.canLaunchTokens === 'boolean' ? patch.canLaunchTokens : cur.canLaunchTokens,
    canBypassVelocity:
      typeof patch.canBypassVelocity === 'boolean' ? patch.canBypassVelocity : cur.canBypassVelocity,
    canExportAudit:
      typeof patch.canExportAudit === 'boolean' ? patch.canExportAudit : cur.canExportAudit,
    updatedByAdmin: adminEmail,
    updatedAt: Date.now(),
  };
  userGrantsStore.set(userId, next);

  void syncUserFeatureGrantsInCloudSql({
    uid: userId,
    email: email || `${userId}@nuvra.exchange`,
    canTradeRealMoney: next.canTradeRealMoney,
    canCreateApiKeys: next.canCreateApiKeys,
    canLaunchTokens: next.canLaunchTokens,
    canBypassVelocity: next.canBypassVelocity,
    canExportAudit: next.canExportAudit,
    updatedByAdmin: adminEmail,
  }).catch(() => {});

  emitPlatformNotification({
    recipientScope: 'USER',
    recipientUserId: userId,
    category: 'VERIFICATION',
    severity: 'INFO',
    title: 'Privilege Grants Updated by Admin',
    message: `Real Trading: ${next.canTradeRealMoney ? 'Allowed' : 'Locked'} · API Keys: ${next.canCreateApiKeys ? 'Allowed' : 'Locked'} · Coin Launchpad: ${next.canLaunchTokens ? 'Allowed' : 'Locked'}.`,
  });

  return next;
}

export function checkOrderAgainstLimits(params: {
  userId: string;
  email?: string;
  orderNotionalUsd: number;
  openPositionsCount: number;
}): { allowed: boolean; reason?: string; limits: UserLimitRecord } {
  const limits = getUserLimits(params.userId, params.email);
  if (params.orderNotionalUsd > limits.singleOrderMaxUsd) {
    emitPlatformNotification({
      recipientScope: 'ADMIN',
      category: 'LIMIT_BREACH',
      severity: 'WARNING',
      title: 'Single Order Limit Enforced',
      message: `${params.email || params.userId} attempted $${Math.round(params.orderNotionalUsd).toLocaleString()} order (limit $${limits.singleOrderMaxUsd.toLocaleString()}).`,
    });
    return {
      allowed: false,
      reason: `Order notional ($${params.orderNotionalUsd.toFixed(2)}) exceeds your ${limits.tierCode} single-order cap ($${limits.singleOrderMaxUsd.toLocaleString()}).`,
      limits,
    };
  }
  if (params.openPositionsCount >= limits.maxOpenPositions) {
    return {
      allowed: false,
      reason: `Open positions cap (${limits.maxOpenPositions}) reached for ${limits.tierCode} tier.`,
      limits,
    };
  }
  return { allowed: true, limits };
}

export function checkWithdrawalAgainstLimits(params: {
  userId: string;
  email?: string;
  amountUsd: number;
}): { allowed: boolean; reason?: string; limits: UserLimitRecord } {
  const limits = getUserLimits(params.userId, params.email);
  if (params.amountUsd > limits.dailyWithdrawalLimitUsd) {
    emitPlatformNotification({
      recipientScope: 'ADMIN',
      category: 'LIMIT_BREACH',
      severity: 'WARNING',
      title: 'Withdrawal Limit Blocked',
      message: `${params.email || params.userId} withdrawal $${params.amountUsd.toFixed(2)} exceeded daily cap ($${limits.dailyWithdrawalLimitUsd.toLocaleString()}).`,
    });
    return {
      allowed: false,
      reason: `Withdrawal $${params.amountUsd.toFixed(2)} exceeds your ${limits.tierCode} daily withdrawal limit ($${limits.dailyWithdrawalLimitUsd.toLocaleString()}).`,
      limits,
    };
  }
  return { allowed: true, limits };
}

// --- 2. IP-Based Rate Limiter (`429: Too many requests`) & Dual Notifications ---
const ipRulesMap = new Map<string, IpRateLimitRule>();
const ipWindowBuckets = new Map<string, number[]>();
const ipEventsLog: IpRateLimitEvent[] = [];
const lastNotified429ByIp = new Map<string, number>();

export function listIpRateRules(): IpRateLimitRule[] {
  return Array.from(ipRulesMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listIpRateEvents(limit = 80): IpRateLimitEvent[] {
  return ipEventsLog.slice(0, Math.max(1, Math.min(200, limit)));
}

function normalizeMaskIp(raw: string): string {
  if (raw.includes('*')) return raw;
  if (raw.includes('.')) {
    const parts = raw.split('.');
    return `${parts[0]}.${parts[1]}.***.${parts[3] ?? '0'}`;
  }
  return `${raw.slice(0, 8)}::***`;
}

export function upsertIpRateRule(input: {
  id?: string;
  ipPattern: string;
  maxRequestsPerMin: number;
  burstAllowance?: number;
  status?: 'ACTIVE' | 'THROTTLED' | 'BLOCKED';
  reason?: string;
}): IpRateLimitRule {
  const cleanPattern = input.ipPattern.trim().slice(0, 80) || '0.0.0.0';
  const existing = input.id ? ipRulesMap.get(input.id) : undefined;
  const id = existing?.id ?? `ipr-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const rule: IpRateLimitRule = {
    id,
    ipPattern: cleanPattern,
    maskedIp: normalizeMaskIp(cleanPattern),
    maxRequestsPerMin: Math.max(1, Math.min(10000, Math.round(input.maxRequestsPerMin || 60))),
    burstAllowance: Math.max(0, Math.min(500, Math.round(input.burstAllowance ?? 5))),
    status: input.status ?? existing?.status ?? 'ACTIVE',
    hitCount60s: existing?.hitCount60s ?? 0,
    blockedCount: existing?.blockedCount ?? 0,
    reason: (input.reason ?? existing?.reason ?? 'Admin Edge IP Policy').slice(0, 140),
    updatedAt: Date.now(),
  };
  ipRulesMap.set(id, rule);

  void syncIpRateLimitRuleInCloudSql({
    externalId: rule.id,
    ipPattern: rule.ipPattern,
    maskedIp: rule.maskedIp,
    maxRequestsPerMin: rule.maxRequestsPerMin,
    burstAllowance: rule.burstAllowance,
    status: rule.status,
    blockedCount: rule.blockedCount,
    reason: rule.reason,
  }).catch(() => {});

  return rule;
}

export function unblockIpRule(id: string): IpRateLimitRule | null {
  const rule = ipRulesMap.get(id);
  if (!rule) return null;
  rule.status = 'ACTIVE';
  rule.reason = 'Cleared by Founder Admin';
  rule.updatedAt = Date.now();
  ipWindowBuckets.delete(rule.ipPattern);

  void syncIpRateLimitRuleInCloudSql({
    externalId: rule.id,
    ipPattern: rule.ipPattern,
    maskedIp: rule.maskedIp,
    maxRequestsPerMin: rule.maxRequestsPerMin,
    burstAllowance: rule.burstAllowance,
    status: rule.status,
    blockedCount: rule.blockedCount,
    reason: rule.reason,
  }).catch(() => {});

  return rule;
}

function matchIpRule(rawIp: string, maskedIp: string): IpRateLimitRule | undefined {
  for (const rule of ipRulesMap.values()) {
    if (rule.ipPattern === rawIp || rule.ipPattern === maskedIp) return rule;
    if (rule.ipPattern.endsWith('*')) {
      const prefix = rule.ipPattern.slice(0, -1);
      if (rawIp.startsWith(prefix) || maskedIp.startsWith(prefix)) return rule;
    }
  }
  return undefined;
}

export function checkIpEdgeLimit(params: {
  rawIp: string;
  maskedIp: string;
  path: string;
  method: string;
  defaultLimitPerMin: number;
  bypassRateLimit?: boolean;
}): {
  allowed: boolean;
  statusCode: 200 | 429 | 403;
  limitApplied: number;
  requestsInWindow: number;
  remaining: number;
  retryAfterSec: number;
  reason?: string;
} {
  const now = Date.now();
  const windowMs = 60_000;
  const matchedRule = matchIpRule(params.rawIp, params.maskedIp);

  if (matchedRule && matchedRule.status === 'BLOCKED' && !params.bypassRateLimit) {
    matchedRule.blockedCount += 1;
    matchedRule.updatedAt = now;
    const ev: IpRateLimitEvent = {
      id: `ipe-${now}-${crypto.randomBytes(2).toString('hex')}`,
      maskedIp: params.maskedIp,
      path: params.path.slice(0, 100),
      method: params.method,
      limitApplied: 0,
      requestsInWindow: matchedRule.hitCount60s + 1,
      statusCode: 403,
      notifiedAdmin: true,
      createdAt: now,
    };
    ipEventsLog.unshift(ev);
    if (ipEventsLog.length > 200) ipEventsLog.pop();
    void recordIpRateLimitEventInCloudSql({
      externalId: ev.id,
      maskedIp: ev.maskedIp,
      path: ev.path,
      method: ev.method,
      limitApplied: ev.limitApplied,
      requestsInWindow: ev.requestsInWindow,
      statusCode: ev.statusCode,
      notifiedAdmin: ev.notifiedAdmin,
    }).catch(() => {});
    return {
      allowed: false,
      statusCode: 403,
      limitApplied: 0,
      requestsInWindow: ev.requestsInWindow,
      remaining: 0,
      retryAfterSec: 60,
      reason: `IP blocked by Nuvra Edge Policy (${matchedRule.reason})`,
    };
  }

  const limitApplied = matchedRule
    ? matchedRule.maxRequestsPerMin + matchedRule.burstAllowance
    : params.defaultLimitPerMin;
  const bucketKey = matchedRule ? `rule:${matchedRule.id}` : `ip:${params.rawIp}`;
  const stamps = (ipWindowBuckets.get(bucketKey) ?? []).filter((t) => now - t < windowMs);
  stamps.push(now);
  ipWindowBuckets.set(bucketKey, stamps);
  if (matchedRule) {
    matchedRule.hitCount60s = stamps.length;
  }

  if (params.bypassRateLimit) {
    return {
      allowed: true,
      statusCode: 200,
      limitApplied,
      requestsInWindow: stamps.length,
      remaining: Math.max(0, limitApplied - stamps.length),
      retryAfterSec: 0,
    };
  }

  if (stamps.length > limitApplied) {
    const oldest = stamps[0] ?? now;
    const retryAfterSec = Math.max(5, Math.ceil((windowMs - (now - oldest)) / 1000));
    const lastAlertAt = lastNotified429ByIp.get(bucketKey) ?? 0;
    const shouldNotify = now - lastAlertAt > 20_000;
    if (shouldNotify) {
      lastNotified429ByIp.set(bucketKey, now);
    }

    if (matchedRule) {
      matchedRule.blockedCount += 1;
      matchedRule.status = 'THROTTLED';
      matchedRule.updatedAt = now;
      void syncIpRateLimitRuleInCloudSql({
        externalId: matchedRule.id,
        ipPattern: matchedRule.ipPattern,
        maskedIp: matchedRule.maskedIp,
        maxRequestsPerMin: matchedRule.maxRequestsPerMin,
        burstAllowance: matchedRule.burstAllowance,
        status: matchedRule.status,
        blockedCount: matchedRule.blockedCount,
        reason: matchedRule.reason,
      }).catch(() => {});
    }

    const ev: IpRateLimitEvent = {
      id: `ipe-${now}-${crypto.randomBytes(2).toString('hex')}`,
      maskedIp: params.maskedIp,
      path: params.path.slice(0, 100),
      method: params.method,
      limitApplied,
      requestsInWindow: stamps.length,
      statusCode: 429,
      notifiedAdmin: shouldNotify,
      createdAt: now,
    };
    ipEventsLog.unshift(ev);
    if (ipEventsLog.length > 200) ipEventsLog.pop();

    void recordIpRateLimitEventInCloudSql({
      externalId: ev.id,
      maskedIp: ev.maskedIp,
      path: ev.path,
      method: ev.method,
      limitApplied: ev.limitApplied,
      requestsInWindow: ev.requestsInWindow,
      statusCode: 429,
      notifiedAdmin: ev.notifiedAdmin,
    }).catch(() => {});

    if (shouldNotify) {
      emitPlatformNotification({
        recipientScope: 'ADMIN',
        category: 'SECURITY_429',
        severity: 'CRITICAL',
        title: `429 Rate Limit Triggered (${params.maskedIp})`,
        message: `${stamps.length}/${limitApplied} req/min on ${params.method} ${params.path}. Client throttled with Retry-After: ${retryAfterSec}s.`,
      });
    }

    return {
      allowed: false,
      statusCode: 429,
      limitApplied,
      requestsInWindow: stamps.length,
      remaining: 0,
      retryAfterSec,
      reason: `429: Too many requests (${stamps.length}/${limitApplied} req/min). Retry after ${retryAfterSec}s.`,
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    limitApplied,
    requestsInWindow: stamps.length,
    remaining: Math.max(0, limitApplied - stamps.length),
    retryAfterSec: 0,
  };
}

// --- 3. Full REA (Resources-Events-Agents) Cryptographic Double-Entry Ledger ---
const reaResourcesMap = new Map<string, ReaResourceRecord>([
  ['USD', { symbol: 'USD', name: 'US Dollar Clearing Reserve', resourceType: 'FIAT', totalLedgerUnits: 12_500_000, referenceUsdPrice: 1, updatedAt: Date.now() }],
  ['BTC', { symbol: 'BTC', name: 'Bitcoin Multi-Sig Reserve', resourceType: 'CRYPTO', totalLedgerUnits: 145.5, referenceUsdPrice: 91500, updatedAt: Date.now() }],
  ['ETH', { symbol: 'ETH', name: 'Ethereum Custody Reserve', resourceType: 'CRYPTO', totalLedgerUnits: 2150, referenceUsdPrice: 3180, updatedAt: Date.now() }],
  ['SOL', { symbol: 'SOL', name: 'Solana Liquidity Pool', resourceType: 'CRYPTO', totalLedgerUnits: 28000, referenceUsdPrice: 195, updatedAt: Date.now() }],
  ['NVDA', { symbol: 'NVDA', name: 'NVIDIA Omnibus Settlement', resourceType: 'EQUITY', totalLedgerUnits: 8500, referenceUsdPrice: 142.5, updatedAt: Date.now() }],
  ['RELIANCE.NS', { symbol: 'RELIANCE.NS', name: 'Reliance Industries NSE Clearing', resourceType: 'EQUITY', totalLedgerUnits: 14000, referenceUsdPrice: 31.2, updatedAt: Date.now() }],
  ['XAU', { symbol: 'XAU', name: 'Allocated Spot Gold Vault', resourceType: 'FIAT', totalLedgerUnits: 920, referenceUsdPrice: 2650, updatedAt: Date.now() }],
]);

const reaAgentsMap = new Map<string, ReaAgentRecord>([
  ['agt-house-desk', { agentId: 'agt-house-desk', label: 'Nuvra Liquidity Desk', agentRole: 'HOUSE_DESK', verified: true }],
  ['agt-clearing-rail', { agentId: 'agt-clearing-rail', label: 'Nuvra Multi-Rail Clearing', agentRole: 'CLEARING_RAIL', verified: true }],
  ['agt-token-foundry', { agentId: 'agt-token-foundry', label: 'Nuvra Verified Coin Foundry', agentRole: 'TOKEN_ISSUER', verified: true }],
]);

const reaEventsList: ReaEventRecord[] = [];
const REA_GENESIS_HASH = 'REA_GENESIS_NUVRA_0000000000000000000000000000';

function computeReaEntryHash(prevHash: string, core: Omit<ReaEventRecord, 'prevHash' | 'entryHash'>): string {
  return crypto
    .createHash('sha256')
    .update(
      `${prevHash}|${core.id}|${core.eventType}|${core.resourceSymbol}|${core.giveAgentId}|${core.takeAgentId}|${core.quantity}|${core.usdNotional}|${core.referenceId}|${core.createdAt}`
    )
    .digest('hex')
    .slice(0, 40);
}

export function recordReaEvent(input: {
  eventType: ReaEventRecord['eventType'];
  resourceSymbol: string;
  resourceName?: string;
  resourceType?: ReaResourceRecord['resourceType'];
  referenceUsdPrice?: number;
  giveAgentId: string;
  giveAgentLabel?: string;
  giveAgentRole?: ReaAgentRecord['agentRole'];
  takeAgentId: string;
  takeAgentLabel?: string;
  takeAgentRole?: ReaAgentRecord['agentRole'];
  quantity: number;
  usdNotional: number;
  referenceId: string;
}): ReaEventRecord {
  const now = Date.now();
  const sym = input.resourceSymbol.toUpperCase();
  const qty = Math.max(0.000001, Number(input.quantity.toFixed(6)));
  const notional = Math.max(0, Number(input.usdNotional.toFixed(2)));

  const existingResource = reaResourcesMap.get(sym);
  const resRecord: ReaResourceRecord = existingResource
    ? {
        ...existingResource,
        totalLedgerUnits: Number((existingResource.totalLedgerUnits + qty).toFixed(6)),
        referenceUsdPrice: input.referenceUsdPrice ?? existingResource.referenceUsdPrice,
        updatedAt: now,
      }
    : {
        symbol: sym,
        name: input.resourceName ?? `${sym} Reserve`,
        resourceType: input.resourceType ?? 'CRYPTO',
        totalLedgerUnits: qty,
        referenceUsdPrice: input.referenceUsdPrice ?? (qty > 0 ? notional / qty : 1),
        updatedAt: now,
      };
  reaResourcesMap.set(sym, resRecord);

  if (!reaAgentsMap.has(input.giveAgentId)) {
    reaAgentsMap.set(input.giveAgentId, {
      agentId: input.giveAgentId,
      label: input.giveAgentLabel ?? input.giveAgentId,
      agentRole: input.giveAgentRole ?? 'TRADER',
      verified: true,
    });
  }
  if (!reaAgentsMap.has(input.takeAgentId)) {
    reaAgentsMap.set(input.takeAgentId, {
      agentId: input.takeAgentId,
      label: input.takeAgentLabel ?? input.takeAgentId,
      agentRole: input.takeAgentRole ?? 'TRADER',
      verified: true,
    });
  }

  const prevHash = reaEventsList[0]?.entryHash ?? REA_GENESIS_HASH;
  const id = `rea-${now}-${crypto.randomBytes(3).toString('hex')}`;
  const core: Omit<ReaEventRecord, 'prevHash' | 'entryHash'> = {
    id,
    eventType: input.eventType,
    resourceSymbol: sym,
    giveAgentId: input.giveAgentId,
    takeAgentId: input.takeAgentId,
    quantity: qty,
    usdNotional: notional,
    referenceId: input.referenceId,
    invariantBalanced: qty > 0 && input.giveAgentId !== input.takeAgentId,
    createdAt: now,
  };
  const entryHash = computeReaEntryHash(prevHash, core);
  const fullEvent: ReaEventRecord = {
    ...core,
    prevHash,
    entryHash,
  };
  reaEventsList.unshift(fullEvent);
  if (reaEventsList.length > 240) reaEventsList.pop();

  const giveAgent = reaAgentsMap.get(input.giveAgentId)!;
  const takeAgent = reaAgentsMap.get(input.takeAgentId)!;

  void recordReaEventInCloudSql({
    externalEventId: fullEvent.id,
    eventType: fullEvent.eventType,
    resourceSymbol: resRecord.symbol,
    resourceName: resRecord.name,
    resourceType: resRecord.resourceType,
    referenceUsdPrice: resRecord.referenceUsdPrice,
    giveAgentId: giveAgent.agentId,
    giveAgentLabel: giveAgent.label,
    giveAgentRole: giveAgent.agentRole,
    takeAgentId: takeAgent.agentId,
    takeAgentLabel: takeAgent.label,
    takeAgentRole: takeAgent.agentRole,
    quantity: fullEvent.quantity,
    usdNotional: fullEvent.usdNotional,
    referenceId: fullEvent.referenceId,
    invariantBalanced: fullEvent.invariantBalanced,
    prevHash: fullEvent.prevHash,
    entryHash: fullEvent.entryHash,
  }).catch(() => {});

  return fullEvent;
}

export function getReaLedgerSnapshot(): ReaLedgerSnapshot {
  const chronological = [...reaEventsList].reverse();
  let expectedPrev = REA_GENESIS_HASH;
  let chainValid = true;
  for (const ev of chronological) {
    if (ev.prevHash !== expectedPrev) {
      chainValid = false;
      break;
    }
    const recomputed = computeReaEntryHash(ev.prevHash, {
      id: ev.id,
      eventType: ev.eventType,
      resourceSymbol: ev.resourceSymbol,
      giveAgentId: ev.giveAgentId,
      takeAgentId: ev.takeAgentId,
      quantity: ev.quantity,
      usdNotional: ev.usdNotional,
      referenceId: ev.referenceId,
      invariantBalanced: ev.invariantBalanced,
      createdAt: ev.createdAt,
    });
    if (ev.entryHash !== recomputed) {
      chainValid = false;
      break;
    }
    expectedPrev = ev.entryHash;
  }

  return {
    resources: Array.from(reaResourcesMap.values()),
    agents: Array.from(reaAgentsMap.values()),
    events: reaEventsList.slice(0, 60),
    totalBalancedEvents: reaEventsList.filter((e) => e.invariantBalanced).length,
    chainValid,
    updatedAt: Date.now(),
  };
}

// Seed initial clearing proof so REA ledger starts populated & verified
recordReaEvent({
  eventType: 'DEPOSIT',
  resourceSymbol: 'USD',
  referenceUsdPrice: 1,
  giveAgentId: 'agt-clearing-rail',
  takeAgentId: 'agt-house-desk',
  quantity: 2_500_000,
  usdNotional: 2_500_000,
  referenceId: 'GENESIS-CUSTODY-POOL-01',
});

// --- 4. Top-Tier Multi-Stage Verification (Profile + Document + Bank Penny-Drop) ---
interface InternalVerificationState {
  bundle: TopTierVerificationBundle;
  email: string;
  microDepositCents?: [number, number];
}

const verificationStore = new Map<string, InternalVerificationState>();

function recomputeVerificationTier(b: TopTierVerificationBundle): TopTierVerificationBundle['overallTier'] {
  if (b.profileVerified && b.documentStatus === 'VERIFIED' && b.bankVerificationStatus === 'VERIFIED') {
    return 'Tier 3 Full Bank & Custody';
  }
  if (b.profileVerified && b.documentStatus === 'VERIFIED') {
    return 'Tier 2 Documented';
  }
  if (b.profileVerified) {
    return 'Tier 1 Profile';
  }
  return 'Unverified';
}

export function getTopTierVerification(userId: string, email = ''): TopTierVerificationBundle {
  const existing = verificationStore.get(userId);
  if (existing) return existing.bundle;

  const isFounder = email.trim().toLowerCase() === FOUNDER_EMAIL;
  const bundle: TopTierVerificationBundle = {
    userId,
    profileVerified: isFounder,
    profileFullName: isFounder ? 'Founder Control Desk' : '',
    profileCountry: isFounder ? 'India' : 'United States',
    profileCompletenessPct: isFounder ? 100 : 20,
    documentStatus: isFounder ? 'VERIFIED' : 'NOT_SUBMITTED',
    documentType: 'Passport',
    maskedDocument: isFounder ? '•••• 9042' : '',
    documentChecksumOk: isFounder,
    livenessOk: isFounder,
    bankVerificationStatus: isFounder ? 'VERIFIED' : 'NOT_STARTED',
    bankName: isFounder ? 'HDFC Institutional Rail' : '',
    bankMaskedAcct: isFounder ? '•••• 1829' : '',
    overallTier: isFounder ? 'Tier 3 Full Bank & Custody' : 'Unverified',
    reviewNote: isFounder
      ? 'Founder institutional identity & clearing verification active.'
      : 'Complete profile, government ID document, and bank micro-deposit challenge.',
    updatedAt: Date.now(),
  };
  verificationStore.set(userId, { bundle, email });
  return bundle;
}

export function submitProfileVerification(
  userId: string,
  email: string,
  input: { fullName: string; country: string }
): TopTierVerificationBundle {
  const cur = getTopTierVerification(userId, email);
  const fullName = input.fullName.trim().slice(0, 80);
  const country = input.country.trim().slice(0, 60) || 'United States';
  const next: TopTierVerificationBundle = {
    ...cur,
    profileFullName: fullName,
    profileCountry: country,
    profileVerified: fullName.length >= 3,
    profileCompletenessPct: fullName.length >= 3 ? Math.max(cur.profileCompletenessPct, 55) : 35,
    updatedAt: Date.now(),
  };
  next.overallTier = recomputeVerificationTier(next);
  verificationStore.set(userId, {
    ...(verificationStore.get(userId) ?? { email, bundle: next }),
    bundle: next,
    email,
  });

  void syncTopTierVerificationInCloudSql({
    uid: userId,
    email: email || `${userId}@nuvra.exchange`,
    profileVerified: next.profileVerified,
    profileCountry: next.profileCountry,
    documentStatus: next.documentStatus,
    documentType: next.documentType,
    maskedDocument: next.maskedDocument,
    bankVerificationStatus: next.bankVerificationStatus,
    bankName: next.bankName,
    overallTier: next.overallTier,
    reviewNote: next.reviewNote,
  }).catch(() => {});

  return next;
}

export function submitDocumentVerification(
  userId: string,
  email: string,
  input: { docType: KycDocumentType; docNumber: string; livenessSelfieConfirmed: boolean }
): { ok: true; bundle: TopTierVerificationBundle } | { ok: false; error: string } {
  const cleanDoc = input.docNumber.replace(/\s+/g, '').toUpperCase();
  if (cleanDoc.length < 6) {
    return { ok: false, error: 'Document identifier must contain at least 6 characters.' };
  }
  const checksumOk = /^[A-Z0-9-]{6,24}$/.test(cleanDoc);
  const cur = getTopTierVerification(userId, email);
  const masked = `${cleanDoc.slice(0, 2)}••••${cleanDoc.slice(-4)}`;
  const next: TopTierVerificationBundle = {
    ...cur,
    documentType: input.docType,
    maskedDocument: masked,
    documentChecksumOk: checksumOk,
    livenessOk: Boolean(input.livenessSelfieConfirmed),
    documentStatus: checksumOk && input.livenessSelfieConfirmed ? 'PENDING_REVIEW' : 'NOT_SUBMITTED',
    profileCompletenessPct: Math.max(cur.profileCompletenessPct, 80),
    reviewNote:
      checksumOk && input.livenessSelfieConfirmed
        ? 'Document checksum & liveness verified. Queued for 1-click Admin approval.'
        : 'Confirm liveness biometric check and valid ID checksum.',
    updatedAt: Date.now(),
  };
  next.overallTier = recomputeVerificationTier(next);
  verificationStore.set(userId, {
    ...(verificationStore.get(userId) ?? { email, bundle: next }),
    bundle: next,
    email,
  });

  void syncTopTierVerificationInCloudSql({
    uid: userId,
    email: email || `${userId}@nuvra.exchange`,
    profileVerified: next.profileVerified,
    profileCountry: next.profileCountry,
    documentStatus: next.documentStatus,
    documentType: next.documentType,
    maskedDocument: next.maskedDocument,
    bankVerificationStatus: next.bankVerificationStatus,
    bankName: next.bankName,
    overallTier: next.overallTier,
    reviewNote: next.reviewNote,
  }).catch(() => {});

  emitPlatformNotification({
    recipientScope: 'ADMIN',
    category: 'VERIFICATION',
    severity: 'INFO',
    title: 'New Top-Tier Document Submitted',
    message: `${email || userId} submitted ${input.docType} (${masked}) for Admin review.`,
  });

  return { ok: true, bundle: next };
}

export function initiateBankMicroDeposit(
  userId: string,
  email: string,
  input: { bankName: string; accountNumber: string }
): { ok: true; bundle: TopTierVerificationBundle } | { ok: false; error: string } {
  const cleanAcct = input.accountNumber.replace(/\s+/g, '');
  if (cleanAcct.length < 4) {
    return { ok: false, error: 'Enter a valid bank account number or UPI handle.' };
  }
  const cur = getTopTierVerification(userId, email);
  const c1 = crypto.randomInt(11, 48);
  const c2 = crypto.randomInt(51, 95);
  const maskedAcct = `•••• ${cleanAcct.slice(-4)}`;
  const next: TopTierVerificationBundle = {
    ...cur,
    bankName: input.bankName.trim().slice(0, 60) || 'Primary Settlement Bank',
    bankMaskedAcct: maskedAcct,
    bankVerificationStatus: 'MICRO_DEPOSIT_SENT',
    bankMicroDepositHint: `Penny-drop test slip dispatched: $0.${c1} & $0.${c2} (enter cents to confirm ownership)`,
    reviewNote: 'Enter the two micro-deposit cent amounts to complete bank rail verification.',
    updatedAt: Date.now(),
  };
  next.overallTier = recomputeVerificationTier(next);
  verificationStore.set(userId, {
    email,
    bundle: next,
    microDepositCents: [c1, c2],
  });

  void syncTopTierVerificationInCloudSql({
    uid: userId,
    email: email || `${userId}@nuvra.exchange`,
    profileVerified: next.profileVerified,
    profileCountry: next.profileCountry,
    documentStatus: next.documentStatus,
    documentType: next.documentType,
    maskedDocument: next.maskedDocument,
    bankVerificationStatus: next.bankVerificationStatus,
    bankName: next.bankName,
    overallTier: next.overallTier,
    reviewNote: next.reviewNote,
  }).catch(() => {});

  return { ok: true, bundle: next };
}

export function verifyBankMicroDeposit(
  userId: string,
  email: string,
  input: { deposit1Cents: number; deposit2Cents: number }
): { ok: true; bundle: TopTierVerificationBundle } | { ok: false; error: string } {
  const state = verificationStore.get(userId);
  if (!state || !state.microDepositCents) {
    return { ok: false, error: 'Initiate a penny-drop bank challenge first.' };
  }
  const [e1, e2] = state.microDepositCents;
  if (Math.round(input.deposit1Cents) !== e1 || Math.round(input.deposit2Cents) !== e2) {
    return { ok: false, error: 'Micro-deposit amounts do not match bank clearing slip.' };
  }
  const next: TopTierVerificationBundle = {
    ...state.bundle,
    bankVerificationStatus: 'VERIFIED',
    bankMicroDepositHint: undefined,
    profileCompletenessPct: 100,
    reviewNote: 'Bank penny-drop verified. Ready for Tier 3 custody & Admin approval.',
    updatedAt: Date.now(),
  };
  next.overallTier = recomputeVerificationTier(next);
  verificationStore.set(userId, { ...state, bundle: next, microDepositCents: undefined });

  void syncTopTierVerificationInCloudSql({
    uid: userId,
    email: email || `${userId}@nuvra.exchange`,
    profileVerified: next.profileVerified,
    profileCountry: next.profileCountry,
    documentStatus: next.documentStatus,
    documentType: next.documentType,
    maskedDocument: next.maskedDocument,
    bankVerificationStatus: next.bankVerificationStatus,
    bankName: next.bankName,
    overallTier: next.overallTier,
    reviewNote: next.reviewNote,
  }).catch(() => {});

  return { ok: true, bundle: next };
}

export function listVerificationsForAdmin(): Array<TopTierVerificationBundle & { email: string }> {
  return Array.from(verificationStore.values())
    .map((v) => ({ ...v.bundle, email: v.email }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function reviewTopTierVerification(
  userId: string,
  email: string,
  decision: 'APPROVE' | 'REJECT',
  note: string,
  adminEmail: string
): TopTierVerificationBundle {
  const cur = getTopTierVerification(userId, email);
  const next: TopTierVerificationBundle = {
    ...cur,
    profileVerified: decision === 'APPROVE' ? true : cur.profileVerified,
    documentStatus: decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED',
    bankVerificationStatus:
      decision === 'APPROVE' && cur.bankName ? 'VERIFIED' : cur.bankVerificationStatus,
    profileCompletenessPct: decision === 'APPROVE' ? 100 : cur.profileCompletenessPct,
    reviewNote:
      note.trim().slice(0, 180) ||
      (decision === 'APPROVE'
        ? `Approved to Top-Tier Verified by ${adminEmail}`
        : `Rejected by ${adminEmail}`),
    updatedAt: Date.now(),
  };
  next.overallTier = recomputeVerificationTier(next);
  verificationStore.set(userId, {
    ...(verificationStore.get(userId) ?? { email, bundle: next }),
    bundle: next,
    email,
  });

  if (decision === 'APPROVE') {
    updateUserFeatureGrants(
      userId,
      email,
      { canTradeRealMoney: true, canCreateApiKeys: true },
      adminEmail
    );
  }

  void syncTopTierVerificationInCloudSql({
    uid: userId,
    email: email || `${userId}@nuvra.exchange`,
    profileVerified: next.profileVerified,
    profileCountry: next.profileCountry,
    documentStatus: next.documentStatus,
    documentType: next.documentType,
    maskedDocument: next.maskedDocument,
    bankVerificationStatus: next.bankVerificationStatus,
    bankName: next.bankName,
    overallTier: next.overallTier,
    reviewNote: next.reviewNote,
  }).catch(() => {});

  emitPlatformNotification({
    recipientScope: 'USER',
    recipientUserId: userId,
    category: 'VERIFICATION',
    severity: decision === 'APPROVE' ? 'INFO' : 'WARNING',
    title:
      decision === 'APPROVE'
        ? 'Top-Tier Identity & Custody Approved'
        : 'Verification Review Requires Update',
    message: next.reviewNote,
  });

  return next;
}

// --- 5. New Coin Registration & Launchpad ---
const coinLaunchesList: CoinLaunchSubmission[] = [
  {
    id: 'launch-nvx-seed',
    ownerId: 'founder',
    ownerEmail: FOUNDER_EMAIL,
    name: 'Nuvra Protocol Governance',
    symbol: 'NUVX-USD',
    chain: 'ETH',
    contractAddress: '0x71C9A82E4F12b403981239E5b77f89A21849E210',
    totalSupply: 100_000_000,
    initialPriceUsd: 4.25,
    whitepaperSummary: 'Institutional clearing settlement & cryptographic REA ledger fee rebate token.',
    auditHash: crypto.createHash('sha256').update('NUVX-USD:GENESIS').digest('hex').slice(0, 24),
    threatVerdict: 'CLEAN',
    tickerUnique: true,
    reaReserveMinted: true,
    status: 'APPROVED_LISTED',
    adminNote: 'Genesis protocol settlement token audited and live.',
    createdAt: Date.now() - 86_400_000 * 3,
    listedAt: Date.now() - 86_400_000 * 3,
  },
];

export function listCoinLaunches(viewerUserId: string, isAdmin: boolean): CoinLaunchSubmission[] {
  if (isAdmin) return [...coinLaunchesList];
  return coinLaunchesList.filter(
    (c) => c.status === 'APPROVED_LISTED' || c.ownerId === viewerUserId
  );
}

export function submitCoinLaunch(input: {
  ownerId: string;
  ownerEmail: string;
  name: string;
  symbol: string;
  chain: CoinLaunchSubmission['chain'];
  contractAddress: string;
  totalSupply: number;
  initialPriceUsd: number;
  whitepaperSummary: string;
  existingSymbols: Set<string>;
  threatVerdict: CoinLaunchSubmission['threatVerdict'];
}): { ok: true; submission: CoinLaunchSubmission } | { ok: false; error: string } {
  const cleanSymRaw = input.symbol.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanSym = cleanSymRaw.includes('-') ? cleanSymRaw : `${cleanSymRaw}-USD`;
  if (!cleanSymRaw || cleanSymRaw.length < 2 || cleanSymRaw.length > 10) {
    return { ok: false, error: 'Ticker symbol must be 2–10 alphanumeric characters.' };
  }
  const tickerDuplicate =
    input.existingSymbols.has(cleanSym) ||
    coinLaunchesList.some((c) => c.symbol === cleanSym && c.status !== 'REJECTED');
  if (tickerDuplicate) {
    return { ok: false, error: `Ticker ${cleanSym} already exists on the exchange or launchpad.` };
  }
  const contract = input.contractAddress.trim();
  if (contract.length < 16) {
    return { ok: false, error: 'Provide a valid on-chain contract or mint address.' };
  }
  if (input.threatVerdict === 'BLOCKED') {
    return { ok: false, error: 'Contract address failed pre-listing threat & drainer screening.' };
  }
  const supply = Math.max(1000, Math.min(1_000_000_000_000, Number(input.totalSupply || 1_000_000)));
  const price = Math.max(0.0001, Math.min(1_000_000, Number(input.initialPriceUsd || 1)));
  const now = Date.now();
  const submission: CoinLaunchSubmission = {
    id: `launch-${now}-${crypto.randomBytes(2).toString('hex')}`,
    ownerId: input.ownerId,
    ownerEmail: input.ownerEmail,
    name: input.name.trim().slice(0, 64) || cleanSym,
    symbol: cleanSym,
    chain: input.chain,
    contractAddress: contract.slice(0, 96),
    totalSupply: supply,
    initialPriceUsd: price,
    whitepaperSummary: input.whitepaperSummary.trim().slice(0, 360) || 'Verified multi-chain asset.',
    auditHash: crypto
      .createHash('sha256')
      .update(`${cleanSym}|${contract}|${supply}|${now}`)
      .digest('hex')
      .slice(0, 24),
    threatVerdict: input.threatVerdict,
    tickerUnique: true,
    reaReserveMinted: false,
    status: 'PENDING_REVIEW',
    adminNote: 'Awaiting Admin 1-click verification & REA reserve minting.',
    createdAt: now,
  };
  coinLaunchesList.unshift(submission);

  void syncCoinLaunchInCloudSql({
    externalId: submission.id,
    uid: submission.ownerId,
    ownerEmail: submission.ownerEmail,
    name: submission.name,
    symbol: submission.symbol,
    chain: submission.chain,
    contractAddress: submission.contractAddress,
    totalSupply: submission.totalSupply,
    initialPriceUsd: submission.initialPriceUsd,
    whitepaperSummary: submission.whitepaperSummary,
    auditHash: submission.auditHash,
    threatVerdict: submission.threatVerdict,
    status: submission.status,
    adminNote: submission.adminNote,
  }).catch(() => {});

  emitPlatformNotification({
    recipientScope: 'ADMIN',
    category: 'COIN_LAUNCH',
    severity: 'INFO',
    title: `New Coin Launch Submission: ${submission.symbol}`,
    message: `${submission.name} on ${submission.chain} submitted by ${submission.ownerEmail} ($${submission.initialPriceUsd} initial price).`,
  });

  return { ok: true, submission };
}

export function reviewCoinLaunch(
  id: string,
  decision: 'APPROVE' | 'REJECT',
  note: string,
  adminEmail: string,
  onMintLiveMarket: (sub: CoinLaunchSubmission) => void
): { ok: true; submission: CoinLaunchSubmission } | { ok: false; status: number; error: string } {
  const sub = coinLaunchesList.find((c) => c.id === id);
  if (!sub) {
    return { ok: false, status: 404, error: 'Coin launch submission not found.' };
  }
  const now = Date.now();
  sub.adminNote =
    note.trim().slice(0, 180) ||
    (decision === 'APPROVE'
      ? `Approved & listed on Nuvra Markets by ${adminEmail}`
      : `Rejected by ${adminEmail}`);

  if (decision === 'APPROVE') {
    sub.status = 'APPROVED_LISTED';
    sub.listedAt = now;
    if (!sub.reaReserveMinted) {
      recordReaEvent({
        eventType: 'TOKEN_MINT',
        resourceSymbol: sub.symbol.replace('-USD', ''),
        resourceName: sub.name,
        resourceType: 'LAUNCHED_TOKEN',
        referenceUsdPrice: sub.initialPriceUsd,
        giveAgentId: 'agt-token-foundry',
        takeAgentId: `agt-issuer-${sub.ownerId.slice(0, 10)}`,
        takeAgentLabel: sub.ownerEmail,
        takeAgentRole: 'TOKEN_ISSUER',
        quantity: sub.totalSupply,
        usdNotional: Number((sub.totalSupply * sub.initialPriceUsd).toFixed(2)),
        referenceId: sub.id,
      });
      sub.reaReserveMinted = true;
    }
    onMintLiveMarket(sub);
  } else {
    sub.status = 'REJECTED';
  }

  void syncCoinLaunchInCloudSql({
    externalId: sub.id,
    uid: sub.ownerId,
    ownerEmail: sub.ownerEmail,
    name: sub.name,
    symbol: sub.symbol,
    chain: sub.chain,
    contractAddress: sub.contractAddress,
    totalSupply: sub.totalSupply,
    initialPriceUsd: sub.initialPriceUsd,
    whitepaperSummary: sub.whitepaperSummary,
    auditHash: sub.auditHash,
    threatVerdict: sub.threatVerdict,
    status: sub.status,
    adminNote: sub.adminNote,
  }).catch(() => {});

  emitPlatformNotification({
    recipientScope: 'USER',
    recipientUserId: sub.ownerId,
    category: 'COIN_LAUNCH',
    severity: decision === 'APPROVE' ? 'INFO' : 'WARNING',
    title:
      decision === 'APPROVE'
        ? `${sub.symbol} Listed Live on Nuvra Markets`
        : `${sub.symbol} Launch Submission Rejected`,
    message: sub.adminNote,
  });

  return { ok: true, submission: sub };
}

// --- 6. Platform Notifications Center ---
const notificationsStore: PlatformNotification[] = [
  {
    id: 'notif-boot-welcome',
    recipientScope: 'ADMIN',
    category: 'SECURITY_429',
    severity: 'INFO',
    title: 'Nuvra Governance & IP Shield Armed',
    message: 'Edge 429 IP rate limiter, REA hash-chained ledger, and Admin Gmail escalation ready.',
    read: false,
    gmailDispatched: false,
    createdAt: Date.now(),
  },
];

let notificationListener: ((n: PlatformNotification) => void) | null = null;

export function setNotificationBroadcastListener(cb: (n: PlatformNotification) => void) {
  notificationListener = cb;
}

export function emitPlatformNotification(
  input: Omit<PlatformNotification, 'id' | 'read' | 'gmailDispatched' | 'createdAt'>
): PlatformNotification {
  const notif: PlatformNotification = {
    id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    ...input,
    read: false,
    gmailDispatched: false,
    createdAt: Date.now(),
  };
  notificationsStore.unshift(notif);
  if (notificationsStore.length > 200) notificationsStore.pop();

  void recordPlatformNotificationInCloudSql({
    externalId: notif.id,
    recipientScope: notif.recipientScope,
    recipientUserId: notif.recipientUserId,
    category: notif.category,
    severity: notif.severity,
    title: notif.title,
    message: notif.message,
    read: notif.read,
    gmailDispatched: notif.gmailDispatched,
  }).catch(() => {});

  if (notificationListener) {
    try {
      notificationListener(notif);
    } catch {
      // ignore socket listener errors
    }
  }
  return notif;
}

export function listNotificationsForViewer(userId: string, isAdmin: boolean): PlatformNotification[] {
  return notificationsStore
    .filter((n) => (n.recipientScope === 'ADMIN' ? isAdmin : n.recipientUserId === userId))
    .slice(0, 60);
}

export function markNotificationRead(id: string, userId: string, isAdmin: boolean): PlatformNotification | null {
  const n = notificationsStore.find((item) => item.id === id);
  if (!n) return null;
  if (n.recipientScope === 'ADMIN' && !isAdmin) return null;
  if (n.recipientScope === 'USER' && n.recipientUserId !== userId && !isAdmin) return null;
  n.read = true;
  void recordPlatformNotificationInCloudSql({
    externalId: n.id,
    recipientScope: n.recipientScope,
    recipientUserId: n.recipientUserId,
    category: n.category,
    severity: n.severity,
    title: n.title,
    message: n.message,
    read: true,
    gmailDispatched: n.gmailDispatched,
  }).catch(() => {});
  return n;
}

export function markNotificationGmailDispatched(id: string): PlatformNotification | null {
  const n = notificationsStore.find((item) => item.id === id);
  if (!n) return null;
  n.gmailDispatched = true;
  n.read = true;
  void recordPlatformNotificationInCloudSql({
    externalId: n.id,
    recipientScope: n.recipientScope,
    recipientUserId: n.recipientUserId,
    category: n.category,
    severity: n.severity,
    title: n.title,
    message: n.message,
    read: true,
    gmailDispatched: true,
  }).catch(() => {});
  return n;
}

// --- 7. Backend-Computed Chart Analytics & Measurements ---
function computeEmaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function computeBackendChartAnalytics(
  symbol: string,
  candles: Candle[],
  orderBook?: OrderBook
): BackendChartAnalytics {
  const safeCandles = candles.length > 0 ? candles : [{ time: Date.now(), open: 100, high: 101, low: 99, close: 100, volume: 1000 }];
  const closes = safeCandles.map((c) => c.close);
  const lastPrice = closes[closes.length - 1];

  // VWAP
  let pvSum = 0;
  let volSum = 0;
  for (const c of safeCandles.slice(-60)) {
    const typical = (c.high + c.low + c.close) / 3;
    pvSum += typical * Math.max(c.volume, 1);
    volSum += Math.max(c.volume, 1);
  }
  const vwap = volSum > 0 ? pvSum / volSum : lastPrice;

  // ATR14
  const trs: number[] = [];
  for (let i = 1; i < safeCandles.length; i++) {
    const cur = safeCandles[i];
    const prev = safeCandles[i - 1];
    trs.push(Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close)));
  }
  const atrSlice = trs.slice(-14);
  const atr14 = atrSlice.length ? atrSlice.reduce((a, b) => a + b, 0) / atrSlice.length : lastPrice * 0.01;

  // SMA20 & Bollinger Bands
  const bbWindow = closes.slice(-20);
  const sma20 = bbWindow.reduce((a, b) => a + b, 0) / bbWindow.length;
  const bbVar =
    bbWindow.length > 1
      ? bbWindow.reduce((acc, v) => acc + (v - sma20) ** 2, 0) / bbWindow.length
      : 0;
  const stdDev20 = Math.sqrt(bbVar);
  const bollingerUpper = sma20 + 2 * stdDev20;
  const bollingerLower = Math.max(0, sma20 - 2 * stdDev20);
  const bollingerWidthPct = sma20 > 0 ? ((bollingerUpper - bollingerLower) / sma20) * 100 : 0;

  // EMA50 & MACD (12, 26, 9)
  const ema50Series = computeEmaSeries(closes, 50);
  const ema50 = ema50Series[ema50Series.length - 1] ?? lastPrice;
  const ema12Series = computeEmaSeries(closes, 12);
  const ema26Series = computeEmaSeries(closes, 26);
  const macdSeries = ema12Series.map((v, idx) => v - (ema26Series[idx] ?? v));
  const signalSeries = computeEmaSeries(macdSeries, 9);
  const macdLine = macdSeries[macdSeries.length - 1] ?? 0;
  const macdSignal = signalSeries[signalSeries.length - 1] ?? 0;
  const macdHistogram = macdLine - macdSignal;

  // RSI14
  let gains = 0;
  let losses = 0;
  const rsiSlice = closes.slice(-15);
  for (let i = 1; i < rsiSlice.length; i++) {
    const diff = rsiSlice[i] - rsiSlice[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi14 = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + rs);

  // OrderBook depth & imbalance
  const bidDepthUsd = (orderBook?.bids ?? []).reduce((acc, l) => acc + l.price * l.size, 0);
  const askDepthUsd = (orderBook?.asks ?? []).reduce((acc, l) => acc + l.price * l.size, 0);
  const totalDepth = bidDepthUsd + askDepthUsd;
  const orderBookImbalancePct =
    totalDepth > 0 ? ((bidDepthUsd - askDepthUsd) / totalDepth) * 100 : orderBook?.imbalancePct ?? 0;

  // Realized Vol, Liquidity Ratio & Sharpe estimate
  const logRets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) {
      logRets.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  const meanRet = logRets.length ? logRets.reduce((a, b) => a + b, 0) / logRets.length : 0;
  const retVar =
    logRets.length > 1
      ? logRets.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) / (logRets.length - 1)
      : 0;
  const retStd = Math.sqrt(retVar);
  const realizedVolAnnualPct = retStd * Math.sqrt(252 * 390) * 100;
  const sharpeEstimate = retStd > 1e-8 ? ((meanRet * 252 * 390 - 0.04) / (retStd * Math.sqrt(252 * 390))) : 0;
  const liquidityRatio = askDepthUsd > 0 ? bidDepthUsd / askDepthUsd : 1;

  return {
    symbol: symbol.toUpperCase(),
    lastPrice: Number(lastPrice.toFixed(6)),
    vwap: Number(vwap.toFixed(6)),
    atr14: Number(atr14.toFixed(6)),
    sma20: Number(sma20.toFixed(6)),
    ema50: Number(ema50.toFixed(6)),
    bollingerUpper: Number(bollingerUpper.toFixed(6)),
    bollingerMiddle: Number(sma20.toFixed(6)),
    bollingerLower: Number(bollingerLower.toFixed(6)),
    bollingerWidthPct: Number(bollingerWidthPct.toFixed(3)),
    macdLine: Number(macdLine.toFixed(6)),
    macdSignal: Number(macdSignal.toFixed(6)),
    macdHistogram: Number(macdHistogram.toFixed(6)),
    rsi14: Number(rsi14.toFixed(2)),
    orderBookImbalancePct: Number(orderBookImbalancePct.toFixed(2)),
    bidDepthUsd: Number(bidDepthUsd.toFixed(2)),
    askDepthUsd: Number(askDepthUsd.toFixed(2)),
    realizedVolAnnualPct: Number(realizedVolAnnualPct.toFixed(2)),
    liquidityRatio: Number(liquidityRatio.toFixed(3)),
    sharpeEstimate: Number(Math.max(-5, Math.min(5, sharpeEstimate)).toFixed(2)),
    computedAt: Date.now(),
  };
}
