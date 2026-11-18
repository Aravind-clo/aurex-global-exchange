import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Meridian Trader'),
  role: text('role').notNull().default('Multi-Market Investor'),
  isAdmin: boolean('is_admin').notNull().default(false),
  marketFocus: text('market_focus').notNull().default('Global Multi-Asset'),
  realMoneyEnabled: boolean('real_money_enabled').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  cashBalance: doublePrecision('cash_balance').notNull().default(1_000_000),
  lockdownMode: boolean('lockdown_mode').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tradeOrders = pgTable('trade_orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalOrderId: text('external_order_id').notNull().unique(),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),
  orderType: text('order_type').notNull(),
  size: doublePrecision('size').notNull(),
  limitPrice: doublePrecision('limit_price'),
  filledPrice: doublePrecision('filled_price'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalAlertId: text('external_alert_id').notNull().unique(),
  symbol: text('symbol').notNull(),
  condition: text('condition').notNull(),
  targetPrice: doublePrecision('target_price').notNull(),
  note: text('note'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const authAuditLogs = pgTable('auth_audit_logs', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull(),
  email: text('email').notNull(),
  eventType: text('event_type').notNull(),
  provider: text('provider').notNull(),
  outcome: text('outcome').notNull(),
  detail: text('detail').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const walletAccounts = pgTable('wallet_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  chain: text('chain').notNull(),
  assetSymbol: text('asset_symbol').notNull(),
  depositAddress: text('deposit_address').notNull(),
  balanceNative: doublePrecision('balance_native').notNull().default(0),
  balanceUsd: doublePrecision('balance_usd').notNull().default(0),
  dailyLimitUsd: doublePrecision('daily_limit_usd').notNull().default(25_000),
  singleTxLimitUsd: doublePrecision('single_tx_limit_usd').notNull().default(10_000),
  spent24hUsd: doublePrecision('spent_24h_usd').notNull().default(0),
  strictAllowlist: boolean('strict_allowlist').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const withdrawalAllowlist = pgTable('withdrawal_allowlist', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull().unique(),
  label: text('label').notNull(),
  chain: text('chain').notNull(),
  address: text('address').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  threatStatus: text('threat_status').notNull().default('CLEAN'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fxSwaps = pgTable('fx_swaps', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalSwapId: text('external_swap_id').notNull().unique(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  fromAmount: doublePrecision('from_amount').notNull(),
  toAmount: doublePrecision('to_amount').notNull(),
  rate: doublePrecision('rate').notNull(),
  feeUsd: doublePrecision('fee_usd').notNull(),
  rateSource: text('rate_source').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const securityAudits = pgTable('security_audits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalAuditId: text('external_audit_id').notNull().unique(),
  overallScorePct: integer('overall_score_pct').notNull(),
  passedCount: integer('passed_count').notNull(),
  warnCount: integer('warn_count').notNull(),
  failCount: integer('fail_count').notNull(),
  summary: text('summary').notNull(),
  findingsJson: text('findings_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const intelligenceLogs = pgTable('intelligence_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  logType: text('log_type').notNull(),
  queryTarget: text('query_target').notNull(),
  riskLevel: text('risk_level').notNull(),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.id],
    references: [workspaces.userId],
  }),
  orders: many(tradeOrders),
  alerts: many(priceAlerts),
  walletAccounts: many(walletAccounts),
  withdrawalAllowlist: many(withdrawalAllowlist),
  fxSwaps: many(fxSwaps),
  securityAudits: many(securityAudits),
  intelligenceLogs: many(intelligenceLogs),
}));

export const workspacesRelations = relations(workspaces, ({ one }) => ({
  user: one(users, {
    fields: [workspaces.userId],
    references: [users.id],
  }),
}));

export const tradeOrdersRelations = relations(tradeOrders, ({ one }) => ({
  user: one(users, {
    fields: [tradeOrders.userId],
    references: [users.id],
  }),
}));

export const priceAlertsRelations = relations(priceAlerts, ({ one }) => ({
  user: one(users, {
    fields: [priceAlerts.userId],
    references: [users.id],
  }),
}));

export const walletAccountsRelations = relations(walletAccounts, ({ one }) => ({
  user: one(users, {
    fields: [walletAccounts.userId],
    references: [users.id],
  }),
}));

export const withdrawalAllowlistRelations = relations(withdrawalAllowlist, ({ one }) => ({
  user: one(users, {
    fields: [withdrawalAllowlist.userId],
    references: [users.id],
  }),
}));

export const fxSwapsRelations = relations(fxSwaps, ({ one }) => ({
  user: one(users, {
    fields: [fxSwaps.userId],
    references: [users.id],
  }),
}));

export const securityAuditsRelations = relations(securityAudits, ({ one }) => ({
  user: one(users, {
    fields: [securityAudits.userId],
    references: [users.id],
  }),
}));

export const intelligenceLogsRelations = relations(intelligenceLogs, ({ one }) => ({
  user: one(users, {
    fields: [intelligenceLogs.userId],
    references: [users.id],
  }),
}));

