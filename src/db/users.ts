import { and, eq } from 'drizzle-orm';
import { db, isCloudSqlConfigured } from './index.ts';
import {
  authAuditLogs,
  coinLaunches,
  fxSwaps,
  intelligenceLogs,
  ipRateLimitEvents,
  ipRateLimitRules,
  passwordResetTokens,
  platformNotifications,
  priceAlerts,
  reaAgents,
  reaEvents,
  reaResources,
  securityAudits,
  topTierVerifications,
  tradeOrders,
  userFeatureGrants,
  userLimits,
  users,
  walletAccounts,
  withdrawalAllowlist,
  workspaces,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  options: {
    displayName?: string;
    role?: string;
    isAdmin?: boolean;
    marketFocus?: string;
    realMoneyEnabled?: boolean;
  } = {}
) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: options.displayName ?? existing[0]?.displayName ?? 'Nuvra Trader',
        role: options.role ?? existing[0]?.role ?? 'Multi-Market Investor',
        isAdmin: options.isAdmin ?? existing[0]?.isAdmin ?? false,
        marketFocus: options.marketFocus ?? existing[0]?.marketFocus ?? 'Global Multi-Asset',
        realMoneyEnabled: options.realMoneyEnabled ?? existing[0]?.realMoneyEnabled ?? false,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(options.displayName ? { displayName: options.displayName } : {}),
          ...(options.role ? { role: options.role } : {}),
          ...(options.isAdmin !== undefined ? { isAdmin: options.isAdmin } : {}),
          ...(options.marketFocus ? { marketFocus: options.marketFocus } : {}),
          ...(options.realMoneyEnabled !== undefined
            ? { realMoneyEnabled: options.realMoneyEnabled }
            : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    const userRow = result[0];
    if (userRow) {
      await db
        .insert(workspaces)
        .values({
          userId: userRow.id,
          cashBalance: 1_000_000,
          lockdownMode: false,
        })
        .onConflictDoNothing({ target: workspaces.userId });
    }

    return userRow;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserOrdersByUid(uid: string) {
  try {
    return await db
      .select({
        id: tradeOrders.id,
        externalOrderId: tradeOrders.externalOrderId,
        symbol: tradeOrders.symbol,
        side: tradeOrders.side,
        orderType: tradeOrders.orderType,
        size: tradeOrders.size,
        limitPrice: tradeOrders.limitPrice,
        filledPrice: tradeOrders.filledPrice,
        status: tradeOrders.status,
        createdAt: tradeOrders.createdAt,
      })
      .from(tradeOrders)
      .innerJoin(users, eq(tradeOrders.userId, users.id))
      .where(eq(users.uid, uid));
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function recordOrderInCloudSql(params: {
  uid: string;
  email: string;
  externalOrderId: string;
  symbol: string;
  side: string;
  orderType: string;
  size: number;
  limitPrice?: number;
  filledPrice?: number;
  status: string;
  cashBalance?: number;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(tradeOrders)
      .values({
        userId: userRow.id,
        externalOrderId: params.externalOrderId,
        symbol: params.symbol,
        side: params.side,
        orderType: params.orderType,
        size: params.size,
        limitPrice: params.limitPrice ?? null,
        filledPrice: params.filledPrice ?? null,
        status: params.status,
      })
      .onConflictDoUpdate({
        target: tradeOrders.externalOrderId,
        set: {
          status: params.status,
          filledPrice: params.filledPrice ?? null,
        },
      });

    if (params.cashBalance !== undefined) {
      await db
        .update(workspaces)
        .set({ cashBalance: params.cashBalance, updatedAt: new Date() })
        .where(eq(workspaces.userId, userRow.id));
    }
  } catch (error) {
    console.error('Cloud SQL order sync skipped:', error);
  }
}

export async function recordAlertInCloudSql(params: {
  uid: string;
  email: string;
  externalAlertId: string;
  symbol: string;
  condition: string;
  targetPrice: number;
  note?: string;
  active: boolean;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(priceAlerts)
      .values({
        userId: userRow.id,
        externalAlertId: params.externalAlertId,
        symbol: params.symbol,
        condition: params.condition,
        targetPrice: params.targetPrice,
        note: params.note ?? null,
        active: params.active,
      })
      .onConflictDoUpdate({
        target: priceAlerts.externalAlertId,
        set: {
          active: params.active,
        },
      });
  } catch (error) {
    console.error('Cloud SQL alert sync skipped:', error);
  }
}

export async function recordAuthAuditInCloudSql(params: {
  uid: string;
  email: string;
  eventType: string;
  provider: string;
  outcome: string;
  detail: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db.insert(authAuditLogs).values({
      uid: params.uid,
      email: params.email,
      eventType: params.eventType,
      provider: params.provider,
      outcome: params.outcome,
      detail: params.detail,
    });
  } catch (error) {
    console.error('Cloud SQL auth audit sync skipped:', error);
  }
}

export async function syncWalletAccountInCloudSql(params: {
  uid: string;
  email: string;
  chain: string;
  assetSymbol: string;
  depositAddress: string;
  balanceNative: number;
  balanceUsd: number;
  dailyLimitUsd: number;
  singleTxLimitUsd: number;
  spent24hUsd: number;
  strictAllowlist: boolean;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    const existing = await db
      .select({ id: walletAccounts.id })
      .from(walletAccounts)
      .where(and(eq(walletAccounts.userId, userRow.id), eq(walletAccounts.chain, params.chain)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(walletAccounts)
        .set({
          assetSymbol: params.assetSymbol,
          depositAddress: params.depositAddress,
          balanceNative: params.balanceNative,
          balanceUsd: params.balanceUsd,
          dailyLimitUsd: params.dailyLimitUsd,
          singleTxLimitUsd: params.singleTxLimitUsd,
          spent24hUsd: params.spent24hUsd,
          strictAllowlist: params.strictAllowlist,
          updatedAt: new Date(),
        })
        .where(eq(walletAccounts.id, existing[0].id));
    } else {
      await db.insert(walletAccounts).values({
        userId: userRow.id,
        chain: params.chain,
        assetSymbol: params.assetSymbol,
        depositAddress: params.depositAddress,
        balanceNative: params.balanceNative,
        balanceUsd: params.balanceUsd,
        dailyLimitUsd: params.dailyLimitUsd,
        singleTxLimitUsd: params.singleTxLimitUsd,
        spent24hUsd: params.spent24hUsd,
        strictAllowlist: params.strictAllowlist,
      });
    }
  } catch (error) {
    console.error('Cloud SQL wallet account sync skipped:', error);
  }
}

export async function recordAllowlistInCloudSql(params: {
  uid: string;
  email: string;
  externalId: string;
  label: string;
  chain: string;
  address: string;
  enabled: boolean;
  threatStatus: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(withdrawalAllowlist)
      .values({
        userId: userRow.id,
        externalId: params.externalId,
        label: params.label,
        chain: params.chain,
        address: params.address,
        enabled: params.enabled,
        threatStatus: params.threatStatus,
      })
      .onConflictDoUpdate({
        target: withdrawalAllowlist.externalId,
        set: {
          label: params.label,
          enabled: params.enabled,
          threatStatus: params.threatStatus,
        },
      });
  } catch (error) {
    console.error('Cloud SQL allowlist sync skipped:', error);
  }
}

export async function deleteAllowlistInCloudSql(params: {
  uid: string;
  externalId: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, params.uid))
      .limit(1);
    if (!existingUser[0]) return;
    await db
      .delete(withdrawalAllowlist)
      .where(
        and(
          eq(withdrawalAllowlist.userId, existingUser[0].id),
          eq(withdrawalAllowlist.externalId, params.externalId)
        )
      );
  } catch (error) {
    console.error('Cloud SQL allowlist delete skipped:', error);
  }
}

export async function recordFxSwapInCloudSql(params: {
  uid: string;
  email: string;
  externalSwapId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  feeUsd: number;
  rateSource: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(fxSwaps)
      .values({
        userId: userRow.id,
        externalSwapId: params.externalSwapId,
        fromCurrency: params.fromCurrency,
        toCurrency: params.toCurrency,
        fromAmount: params.fromAmount,
        toAmount: params.toAmount,
        rate: params.rate,
        feeUsd: params.feeUsd,
        rateSource: params.rateSource,
      })
      .onConflictDoNothing({ target: fxSwaps.externalSwapId });
  } catch (error) {
    console.error('Cloud SQL FX swap sync skipped:', error);
  }
}

export async function recordSecurityAuditInCloudSql(params: {
  uid: string;
  email: string;
  externalAuditId: string;
  overallScorePct: number;
  passedCount: number;
  warnCount: number;
  failCount: number;
  summary: string;
  findingsJson: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(securityAudits)
      .values({
        userId: userRow.id,
        externalAuditId: params.externalAuditId,
        overallScorePct: Math.round(params.overallScorePct),
        passedCount: params.passedCount,
        warnCount: params.warnCount,
        failCount: params.failCount,
        summary: params.summary,
        findingsJson: params.findingsJson,
      })
      .onConflictDoNothing({ target: securityAudits.externalAuditId });
  } catch (error) {
    console.error('Cloud SQL security audit sync skipped:', error);
  }
}

export async function recordIntelligenceLogInCloudSql(params: {
  uid: string;
  email: string;
  logType: string;
  queryTarget: string;
  riskLevel: string;
  summary: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db.insert(intelligenceLogs).values({
      userId: userRow.id,
      logType: params.logType,
      queryTarget: params.queryTarget,
      riskLevel: params.riskLevel,
      summary: params.summary,
    });
  } catch (error) {
    console.error('Cloud SQL intelligence log skipped:', error);
  }
}

export async function syncUserLimitsInCloudSql(params: {
  uid: string;
  email: string;
  tierCode: string;
  dailyDepositLimitUsd: number;
  dailyWithdrawalLimitUsd: number;
  singleOrderMaxUsd: number;
  maxOpenPositions: number;
  maxLeverageX: number;
  apiCallsPerMin: number;
  updatedByAdmin: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(userLimits)
      .values({
        userId: userRow.id,
        tierCode: params.tierCode,
        dailyDepositLimitUsd: params.dailyDepositLimitUsd,
        dailyWithdrawalLimitUsd: params.dailyWithdrawalLimitUsd,
        singleOrderMaxUsd: params.singleOrderMaxUsd,
        maxOpenPositions: params.maxOpenPositions,
        maxLeverageX: params.maxLeverageX,
        apiCallsPerMin: params.apiCallsPerMin,
        updatedByAdmin: params.updatedByAdmin,
      })
      .onConflictDoUpdate({
        target: userLimits.userId,
        set: {
          tierCode: params.tierCode,
          dailyDepositLimitUsd: params.dailyDepositLimitUsd,
          dailyWithdrawalLimitUsd: params.dailyWithdrawalLimitUsd,
          singleOrderMaxUsd: params.singleOrderMaxUsd,
          maxOpenPositions: params.maxOpenPositions,
          maxLeverageX: params.maxLeverageX,
          apiCallsPerMin: params.apiCallsPerMin,
          updatedByAdmin: params.updatedByAdmin,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Cloud SQL user_limits sync skipped:', error);
  }
}

export async function syncUserFeatureGrantsInCloudSql(params: {
  uid: string;
  email: string;
  canTradeRealMoney: boolean;
  canCreateApiKeys: boolean;
  canLaunchTokens: boolean;
  canBypassVelocity: boolean;
  canExportAudit: boolean;
  updatedByAdmin: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(userFeatureGrants)
      .values({
        userId: userRow.id,
        canTradeRealMoney: params.canTradeRealMoney,
        canCreateApiKeys: params.canCreateApiKeys,
        canLaunchTokens: params.canLaunchTokens,
        canBypassVelocity: params.canBypassVelocity,
        canExportAudit: params.canExportAudit,
        updatedByAdmin: params.updatedByAdmin,
      })
      .onConflictDoUpdate({
        target: userFeatureGrants.userId,
        set: {
          canTradeRealMoney: params.canTradeRealMoney,
          canCreateApiKeys: params.canCreateApiKeys,
          canLaunchTokens: params.canLaunchTokens,
          canBypassVelocity: params.canBypassVelocity,
          canExportAudit: params.canExportAudit,
          updatedByAdmin: params.updatedByAdmin,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Cloud SQL user_feature_grants sync skipped:', error);
  }
}

export async function syncIpRateLimitRuleInCloudSql(params: {
  externalId: string;
  ipPattern: string;
  maskedIp: string;
  maxRequestsPerMin: number;
  burstAllowance: number;
  status: string;
  blockedCount: number;
  reason: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(ipRateLimitRules)
      .values(params)
      .onConflictDoUpdate({
        target: ipRateLimitRules.externalId,
        set: {
          maxRequestsPerMin: params.maxRequestsPerMin,
          burstAllowance: params.burstAllowance,
          status: params.status,
          blockedCount: params.blockedCount,
          reason: params.reason,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Cloud SQL ip_rate_limit_rules sync skipped:', error);
  }
}

export async function recordIpRateLimitEventInCloudSql(params: {
  externalId: string;
  maskedIp: string;
  path: string;
  method: string;
  limitApplied: number;
  requestsInWindow: number;
  statusCode: number;
  notifiedAdmin: boolean;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(ipRateLimitEvents)
      .values(params)
      .onConflictDoNothing({ target: ipRateLimitEvents.externalId });
  } catch (error) {
    console.error('Cloud SQL ip_rate_limit_events sync skipped:', error);
  }
}

export async function recordPasswordResetTokenInCloudSql(params: {
  uid: string;
  email: string;
  tokenHash: string;
  expiresAtMs: number;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db.insert(passwordResetTokens).values({
      userId: userRow.id,
      tokenHash: params.tokenHash,
      expiresAt: new Date(params.expiresAtMs),
    });
  } catch (error) {
    console.error('Cloud SQL password_reset_tokens sync skipped:', error);
  }
}

export async function consumePasswordResetTokenInCloudSql(tokenHash: string) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .update(passwordResetTokens)
      .set({ consumed: true })
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
  } catch (error) {
    console.error('Cloud SQL password reset consume skipped:', error);
  }
}

export async function recordReaEventInCloudSql(params: {
  externalEventId: string;
  eventType: string;
  resourceSymbol: string;
  resourceName: string;
  resourceType: string;
  referenceUsdPrice: number;
  giveAgentId: string;
  giveAgentLabel: string;
  giveAgentRole: string;
  takeAgentId: string;
  takeAgentLabel: string;
  takeAgentRole: string;
  quantity: number;
  usdNotional: number;
  referenceId: string;
  invariantBalanced: boolean;
  prevHash: string;
  entryHash: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(reaResources)
      .values({
        symbol: params.resourceSymbol,
        name: params.resourceName,
        resourceType: params.resourceType,
        totalLedgerUnits: params.quantity,
        referenceUsdPrice: params.referenceUsdPrice,
      })
      .onConflictDoUpdate({
        target: reaResources.symbol,
        set: {
          referenceUsdPrice: params.referenceUsdPrice,
          updatedAt: new Date(),
        },
      });

    for (const ag of [
      { agentId: params.giveAgentId, label: params.giveAgentLabel, agentRole: params.giveAgentRole },
      { agentId: params.takeAgentId, label: params.takeAgentLabel, agentRole: params.takeAgentRole },
    ]) {
      await db
        .insert(reaAgents)
        .values({
          agentId: ag.agentId,
          label: ag.label,
          agentRole: ag.agentRole,
          verified: true,
        })
        .onConflictDoNothing({ target: reaAgents.agentId });
    }

    await db
      .insert(reaEvents)
      .values({
        externalEventId: params.externalEventId,
        eventType: params.eventType,
        resourceSymbol: params.resourceSymbol,
        giveAgentId: params.giveAgentId,
        takeAgentId: params.takeAgentId,
        quantity: params.quantity,
        usdNotional: params.usdNotional,
        referenceId: params.referenceId,
        invariantBalanced: params.invariantBalanced,
        prevHash: params.prevHash,
        entryHash: params.entryHash,
      })
      .onConflictDoNothing({ target: reaEvents.externalEventId });
  } catch (error) {
    console.error('Cloud SQL REA event sync skipped:', error);
  }
}

export async function syncCoinLaunchInCloudSql(params: {
  externalId: string;
  uid: string;
  ownerEmail: string;
  name: string;
  symbol: string;
  chain: string;
  contractAddress: string;
  totalSupply: number;
  initialPriceUsd: number;
  whitepaperSummary: string;
  auditHash: string;
  threatVerdict: string;
  status: string;
  adminNote: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.ownerEmail);
    await db
      .insert(coinLaunches)
      .values({
        externalId: params.externalId,
        userId: userRow.id,
        ownerEmail: params.ownerEmail,
        name: params.name,
        symbol: params.symbol,
        chain: params.chain,
        contractAddress: params.contractAddress,
        totalSupply: params.totalSupply,
        initialPriceUsd: params.initialPriceUsd,
        whitepaperSummary: params.whitepaperSummary,
        auditHash: params.auditHash,
        threatVerdict: params.threatVerdict,
        status: params.status,
        adminNote: params.adminNote,
      })
      .onConflictDoUpdate({
        target: coinLaunches.externalId,
        set: {
          status: params.status,
          adminNote: params.adminNote,
        },
      });
  } catch (error) {
    console.error('Cloud SQL coin_launches sync skipped:', error);
  }
}

export async function syncTopTierVerificationInCloudSql(params: {
  uid: string;
  email: string;
  profileVerified: boolean;
  profileCountry: string;
  documentStatus: string;
  documentType: string;
  maskedDocument: string;
  bankVerificationStatus: string;
  bankName: string;
  overallTier: string;
  reviewNote: string;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    const userRow = await getOrCreateUser(params.uid, params.email);
    await db
      .insert(topTierVerifications)
      .values({
        userId: userRow.id,
        profileVerified: params.profileVerified,
        profileCountry: params.profileCountry,
        documentStatus: params.documentStatus,
        documentType: params.documentType,
        maskedDocument: params.maskedDocument,
        bankVerificationStatus: params.bankVerificationStatus,
        bankName: params.bankName,
        overallTier: params.overallTier,
        reviewNote: params.reviewNote,
      })
      .onConflictDoUpdate({
        target: topTierVerifications.userId,
        set: {
          profileVerified: params.profileVerified,
          profileCountry: params.profileCountry,
          documentStatus: params.documentStatus,
          documentType: params.documentType,
          maskedDocument: params.maskedDocument,
          bankVerificationStatus: params.bankVerificationStatus,
          bankName: params.bankName,
          overallTier: params.overallTier,
          reviewNote: params.reviewNote,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Cloud SQL top_tier_verifications sync skipped:', error);
  }
}

export async function recordPlatformNotificationInCloudSql(params: {
  externalId: string;
  recipientScope: string;
  recipientUserId?: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  read: boolean;
  gmailDispatched: boolean;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(platformNotifications)
      .values({
        externalId: params.externalId,
        recipientScope: params.recipientScope,
        recipientUserId: params.recipientUserId ?? null,
        category: params.category,
        severity: params.severity,
        title: params.title,
        message: params.message,
        read: params.read,
        gmailDispatched: params.gmailDispatched,
      })
      .onConflictDoUpdate({
        target: platformNotifications.externalId,
        set: {
          read: params.read,
          gmailDispatched: params.gmailDispatched,
        },
      });
  } catch (error) {
    console.error('Cloud SQL notification sync skipped:', error);
  }
}


