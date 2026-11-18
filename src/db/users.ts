import { and, eq } from 'drizzle-orm';
import { db, isCloudSqlConfigured } from './index.ts';
import {
  authAuditLogs,
  fxSwaps,
  intelligenceLogs,
  priceAlerts,
  securityAudits,
  tradeOrders,
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
        displayName: options.displayName ?? existing[0]?.displayName ?? 'Meridian Trader',
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

