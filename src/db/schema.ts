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
  displayName: text('display_name').notNull().default('Nuvra Trader'),
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

export const userLimits = pgTable('user_limits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  tierCode: text('tier_code').notNull().default('STARTER'),
  dailyDepositLimitUsd: doublePrecision('daily_deposit_limit_usd').notNull().default(25_000),
  dailyWithdrawalLimitUsd: doublePrecision('daily_withdrawal_limit_usd').notNull().default(10_000),
  singleOrderMaxUsd: doublePrecision('single_order_max_usd').notNull().default(50_000),
  maxOpenPositions: integer('max_open_positions').notNull().default(15),
  maxLeverageX: integer('max_leverage_x').notNull().default(5),
  apiCallsPerMin: integer('api_calls_per_min').notNull().default(60),
  updatedByAdmin: text('updated_by_admin').notNull().default('system'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userFeatureGrants = pgTable('user_feature_grants', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  canTradeRealMoney: boolean('can_trade_real_money').notNull().default(false),
  canCreateApiKeys: boolean('can_create_api_keys').notNull().default(false),
  canLaunchTokens: boolean('can_launch_tokens').notNull().default(false),
  canBypassVelocity: boolean('can_bypass_velocity').notNull().default(false),
  canExportAudit: boolean('can_export_audit').notNull().default(false),
  updatedByAdmin: text('updated_by_admin').notNull().default('system'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ipRateLimitRules = pgTable('ip_rate_limit_rules', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  ipPattern: text('ip_pattern').notNull(),
  maskedIp: text('masked_ip').notNull(),
  maxRequestsPerMin: integer('max_requests_per_min').notNull().default(120),
  burstAllowance: integer('burst_allowance').notNull().default(25),
  status: text('status').notNull().default('ACTIVE'),
  blockedCount: integer('blocked_count').notNull().default(0),
  reason: text('reason').notNull().default('Adaptive edge rate shield'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ipRateLimitEvents = pgTable('ip_rate_limit_events', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  maskedIp: text('masked_ip').notNull(),
  path: text('path').notNull(),
  method: text('method').notNull(),
  limitApplied: integer('limit_applied').notNull(),
  requestsInWindow: integer('requests_in_window').notNull(),
  statusCode: integer('status_code').notNull().default(429),
  notifiedAdmin: boolean('notified_admin').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  attempts: integer('attempts').notNull().default(0),
  consumed: boolean('consumed').notNull().default(false),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reaResources = pgTable('rea_resources', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  resourceType: text('resource_type').notNull(),
  totalLedgerUnits: doublePrecision('total_ledger_units').notNull().default(0),
  referenceUsdPrice: doublePrecision('reference_usd_price').notNull().default(1),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const reaAgents = pgTable('rea_agents', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').notNull().unique(),
  label: text('label').notNull(),
  agentRole: text('agent_role').notNull(),
  verified: boolean('verified').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reaEvents = pgTable('rea_events', {
  id: serial('id').primaryKey(),
  externalEventId: text('external_event_id').notNull().unique(),
  eventType: text('event_type').notNull(),
  resourceSymbol: text('resource_symbol').notNull(),
  giveAgentId: text('give_agent_id').notNull(),
  takeAgentId: text('take_agent_id').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  usdNotional: doublePrecision('usd_notional').notNull(),
  referenceId: text('reference_id').notNull(),
  invariantBalanced: boolean('invariant_balanced').notNull().default(true),
  prevHash: text('prev_hash').notNull(),
  entryHash: text('entry_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const coinLaunches = pgTable('coin_launches', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  ownerEmail: text('owner_email').notNull(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  chain: text('chain').notNull(),
  contractAddress: text('contract_address').notNull(),
  totalSupply: doublePrecision('total_supply').notNull(),
  initialPriceUsd: doublePrecision('initial_price_usd').notNull(),
  whitepaperSummary: text('whitepaper_summary').notNull(),
  auditHash: text('audit_hash').notNull(),
  threatVerdict: text('threat_verdict').notNull().default('CLEAN'),
  status: text('status').notNull().default('PENDING_REVIEW'),
  adminNote: text('admin_note').notNull().default('Awaiting Admin verification'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const topTierVerifications = pgTable('top_tier_verifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  profileVerified: boolean('profile_verified').notNull().default(false),
  profileCountry: text('profile_country').notNull().default('Global'),
  documentStatus: text('document_status').notNull().default('NOT_SUBMITTED'),
  documentType: text('document_type').notNull().default('Passport'),
  maskedDocument: text('masked_document').notNull().default('Not linked'),
  bankVerificationStatus: text('bank_verification_status').notNull().default('NOT_STARTED'),
  bankName: text('bank_name').notNull().default('Not linked'),
  overallTier: text('overall_tier').notNull().default('Unverified'),
  reviewNote: text('review_note').notNull().default('Complete Profile, Document, and Bank checks'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const platformNotifications = pgTable('platform_notifications', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  recipientScope: text('recipient_scope').notNull(),
  recipientUserId: text('recipient_user_id'),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  gmailDispatched: boolean('gmail_dispatched').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.id],
    references: [workspaces.userId],
  }),
  limits: one(userLimits, {
    fields: [users.id],
    references: [userLimits.userId],
  }),
  featureGrants: one(userFeatureGrants, {
    fields: [users.id],
    references: [userFeatureGrants.userId],
  }),
  verificationBundle: one(topTierVerifications, {
    fields: [users.id],
    references: [topTierVerifications.userId],
  }),
  orders: many(tradeOrders),
  alerts: many(priceAlerts),
  walletAccounts: many(walletAccounts),
  withdrawalAllowlist: many(withdrawalAllowlist),
  fxSwaps: many(fxSwaps),
  securityAudits: many(securityAudits),
  intelligenceLogs: many(intelligenceLogs),
  coinLaunches: many(coinLaunches),
  passwordResetTokens: many(passwordResetTokens),
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

export const userLimitsRelations = relations(userLimits, ({ one }) => ({
  user: one(users, {
    fields: [userLimits.userId],
    references: [users.id],
  }),
}));

export const userFeatureGrantsRelations = relations(userFeatureGrants, ({ one }) => ({
  user: one(users, {
    fields: [userFeatureGrants.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const coinLaunchesRelations = relations(coinLaunches, ({ one }) => ({
  user: one(users, {
    fields: [coinLaunches.userId],
    references: [users.id],
  }),
}));

export const topTierVerificationsRelations = relations(topTierVerifications, ({ one }) => ({
  user: one(users, {
    fields: [topTierVerifications.userId],
    references: [users.id],
  }),
}));

