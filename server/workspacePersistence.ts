import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditLogEntry,
  BankAccountRecord,
  Order,
  Position,
  PriceAlert,
  RiskEventEntry,
  StorageStoreStatus,
  VaultTransferRecord,
} from '../src/types/market.ts';
import { STORE_FILE_PATH } from './adminTelemetryStore.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const WORKSPACES_STORE_PATH = path.join(DATA_DIR, 'meridian-workspaces.json');
export const MARKET_STATE_STORE_PATH = path.join(DATA_DIR, 'meridian-market-state.json');

export interface PersistedWorkspaceSnapshot {
  userId: string;
  accountMode?: 'demo' | 'real';
  cashBalance: number;
  demoCashBalance?: number;
  realCashBalance?: number;
  vaultBalanceUsd?: number;
  orders: Order[];
  positions: Position[];
  realOrders?: Order[];
  realPositions?: Position[];
  alerts: PriceAlert[];
  bankAccounts: BankAccountRecord[];
  vaultTransfers: VaultTransferRecord[];
  lockdownMode: boolean;
  promo?: {
    referralCode: string;
    shareCount: number;
    sharesByChannel: Record<string, number>;
    redeemedCodes: string[];
    bonusDemoUsd: number;
    feeDiscountPct: number;
    recentRewards: Array<{
      code: string;
      label: string;
      bonusDemoUsd: number;
      feeDiscountPct: number;
      redeemedAt: number;
    }>;
  };
  updatedAt: number;
}

interface WorkspacesFileShape {
  version: number;
  updatedAt: number;
  workspaces: PersistedWorkspaceSnapshot[];
}

export interface PersistedInstrumentPoint {
  symbol: string;
  price: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  feedStatus: 'Live Feed' | 'Reference Feed';
  updatedAt: number;
}

interface MarketStateFileShape {
  version: number;
  updatedAt: number;
  instruments: PersistedInstrumentPoint[];
  auditLogs: AuditLogEntry[];
  riskEvents: RiskEventEntry[];
}

let cachedWorkspacesCount = 0;
let cachedWorkspacesSavedAt = Date.now();
let cachedMarketSavedAt = Date.now();
let cachedInstrumentsCount = 0;

let workspaceFlushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWorkspacesPayload: PersistedWorkspaceSnapshot[] | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o750 });
  }
}

function atomicWriteJson(targetPath: string, data: unknown) {
  ensureDataDir();
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, targetPath);
}

export function loadPersistedWorkspaces(): Map<string, PersistedWorkspaceSnapshot> {
  const out = new Map<string, PersistedWorkspaceSnapshot>();
  try {
    ensureDataDir();
    if (!fs.existsSync(WORKSPACES_STORE_PATH)) return out;
    const raw = fs.readFileSync(WORKSPACES_STORE_PATH, 'utf8');
    if (!raw.trim()) return out;
    const parsed = JSON.parse(raw) as Partial<WorkspacesFileShape>;
    if (Array.isArray(parsed.workspaces)) {
      for (const w of parsed.workspaces) {
        if (w && typeof w.userId === 'string') {
          out.set(w.userId, w);
        }
      }
      cachedWorkspacesCount = out.size;
      cachedWorkspacesSavedAt = parsed.updatedAt ?? Date.now();
    }
  } catch {
    // Graceful recovery on corrupt/missing file
  }
  return out;
}

export function scheduleWorkspacesPersist(snapshots: PersistedWorkspaceSnapshot[]) {
  pendingWorkspacesPayload = snapshots;
  cachedWorkspacesCount = snapshots.length;
  if (workspaceFlushTimer) return;
  workspaceFlushTimer = setTimeout(() => {
    workspaceFlushTimer = null;
    if (pendingWorkspacesPayload) {
      flushWorkspacesNow(pendingWorkspacesPayload);
      pendingWorkspacesPayload = null;
    }
  }, 400);
}

export function flushWorkspacesNow(snapshots: PersistedWorkspaceSnapshot[]) {
  try {
    const now = Date.now();
    cachedWorkspacesCount = snapshots.length;
    cachedWorkspacesSavedAt = now;
    atomicWriteJson(WORKSPACES_STORE_PATH, {
      version: 1,
      updatedAt: now,
      workspaces: snapshots.map((w) => ({
        ...w,
        orders: w.orders.slice(0, 100),
        vaultTransfers: w.vaultTransfers.slice(0, 100),
      })),
    } satisfies WorkspacesFileShape);
  } catch {
    // Keep runtime resilient
  }
}

export function loadPersistedMarketState(): Partial<MarketStateFileShape> {
  try {
    ensureDataDir();
    if (!fs.existsSync(MARKET_STATE_STORE_PATH)) return {};
    const raw = fs.readFileSync(MARKET_STATE_STORE_PATH, 'utf8');
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as Partial<MarketStateFileShape>;
    cachedInstrumentsCount = Array.isArray(parsed.instruments) ? parsed.instruments.length : 0;
    cachedMarketSavedAt = parsed.updatedAt ?? Date.now();
    return parsed;
  } catch {
    return {};
  }
}

let marketStateFlushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingMarketStateProducer: (() => {
  instruments: PersistedInstrumentPoint[];
  auditLogs: AuditLogEntry[];
  riskEvents: RiskEventEntry[];
}) | null = null;

export function flushMarketStateNow(payload: {
  instruments: PersistedInstrumentPoint[];
  auditLogs: AuditLogEntry[];
  riskEvents: RiskEventEntry[];
}) {
  try {
    const now = Date.now();
    cachedInstrumentsCount = payload.instruments.length;
    cachedMarketSavedAt = now;
    atomicWriteJson(MARKET_STATE_STORE_PATH, {
      version: 1,
      updatedAt: now,
      instruments: payload.instruments,
      auditLogs: payload.auditLogs.slice(0, 80),
      riskEvents: payload.riskEvents.slice(0, 60),
    } satisfies MarketStateFileShape);
  } catch {
    // Ignore transient fs errors
  }
}

export function scheduleMarketStatePersist(
  producer: () => {
    instruments: PersistedInstrumentPoint[];
    auditLogs: AuditLogEntry[];
    riskEvents: RiskEventEntry[];
  }
) {
  pendingMarketStateProducer = producer;
  if (marketStateFlushTimer) return;
  marketStateFlushTimer = setTimeout(() => {
    marketStateFlushTimer = null;
    if (pendingMarketStateProducer) {
      const producerFn = pendingMarketStateProducer;
      pendingMarketStateProducer = null;
      flushMarketStateNow(producerFn());
    }
  }, 2000);
}

function safeFileSize(filePath: string): { sizeBytes: number; mtimeMs: number } {
  try {
    const st = fs.statSync(filePath);
    return { sizeBytes: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return { sizeBytes: 0, mtimeMs: Date.now() };
  }
}

export function getStorageDiagnostics(counts?: {
  adminUsersAndEvents?: number;
  workspacesCount?: number;
  instrumentsCount?: number;
}): StorageStoreStatus[] {
  const adminStat = safeFileSize(STORE_FILE_PATH);
  const wsStat = safeFileSize(WORKSPACES_STORE_PATH);
  const mktStat = safeFileSize(MARKET_STATE_STORE_PATH);

  return [
    {
      id: 'admin-auth-store',
      name: 'Users, Passkeys & Auth Telemetry Ledger',
      filePath: './data/meridian-admin-store.json',
      recordsCount: counts?.adminUsersAndEvents ?? 0,
      sizeBytes: adminStat.sizeBytes,
      lastSavedAt: adminStat.mtimeMs,
      integrity: 'HMAC-SHA256',
    },
    {
      id: 'workspaces-vault-store',
      name: 'Portfolios, Orders & Encrypted Bank Vaults',
      filePath: './data/meridian-workspaces.json',
      recordsCount: counts?.workspacesCount ?? cachedWorkspacesCount,
      sizeBytes: wsStat.sizeBytes,
      lastSavedAt: cachedWorkspacesSavedAt || wsStat.mtimeMs,
      integrity: 'AES-256-GCM + HMAC',
    },
    {
      id: 'market-state-store',
      name: 'Global Market Checkpoints & Risk Audit Log',
      filePath: './data/meridian-market-state.json',
      recordsCount: counts?.instrumentsCount ?? cachedInstrumentsCount,
      sizeBytes: mktStat.sizeBytes,
      lastSavedAt: cachedMarketSavedAt || mktStat.mtimeMs,
      integrity: 'ATOMIC_JSON',
    },
  ];
}
