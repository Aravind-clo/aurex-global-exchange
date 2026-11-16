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

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.id],
    references: [workspaces.userId],
  }),
  orders: many(tradeOrders),
  alerts: many(priceAlerts),
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
