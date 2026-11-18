import crypto from 'node:crypto';
import type { Request } from 'express';
import type {
  AuthSessionInfo,
  AuthUser,
  BankAccountRecord,
  MfaChallengePayload,
  Order,
  PasskeyCredentialInfo,
  Position,
  PriceAlert,
  ReferralPromoProfile,
  TotpEnrollmentSetup,
  VaultTransferRecord,
} from '../src/types/market.ts';
import {
  buildOtpAuthUri,
  consumePendingMfaTicket,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  issuePendingMfaTicket,
  peekPendingMfaTicket,
  verifyTotpCode,
} from './mfaAuthEngine.ts';
import {
  SESSION_SIGNING_KEY,
  computeLedgerHmac,
  maskIpString,
  sanitizePlainText,
  storeEncryptedBankAccount,
} from './securityFirewall.ts';
import {
  loadPersistedAdminStore,
  recordAuthTelemetryEvent,
  scheduleUsersPersist,
  type PersistedUser,
} from './adminTelemetryStore.ts';
import {
  flushWorkspacesNow,
  loadPersistedWorkspaces,
  scheduleWorkspacesPersist,
  type PersistedWorkspaceSnapshot,
} from './workspacePersistence.ts';
import {
  consumePasswordResetTokenInCloudSql,
  recordPasswordResetTokenInCloudSql,
} from '../src/db/users.ts';

export interface StoredPasskeyRecord extends PasskeyCredentialInfo {
  credentialIdB64: string;
  spkiPublicKeyB64: string;
  userId: string;
}

export interface StoredUserRecord extends AuthUser {
  passwordHashHex: string;
  passwordSaltHex: string;
  totpSecret?: string;
  pendingTotpSecret?: string;
  pendingRecoveryHashes?: string[];
  backupCodeHashes: string[];
  passkeysList: StoredPasskeyRecord[];
  linkedProvidersSet: Set<'google' | 'github'>;
}

export interface StoredPromoState {
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
}

export interface UserWorkspaceState {
  userId: string;
  accountMode: 'demo' | 'real';
  cashBalance: number;
  demoCashBalance: number;
  realCashBalance: number;
  vaultBalanceUsd: number;
  orders: Order[];
  positionsMap: Map<string, Position>;
  realOrders: Order[];
  realPositionsMap: Map<string, Position>;
  alerts: PriceAlert[];
  bankAccounts: BankAccountRecord[];
  vaultTransfers: VaultTransferRecord[];
  lockdownMode: boolean;
  promo: StoredPromoState;
}

export const FOUNDER_EMAIL = 'vemulavankeswararao@gmail.com';

export function isFounderEmail(email?: string | null): boolean {
  return String(email ?? '').trim().toLowerCase() === FOUNDER_EMAIL;
}

export function getActiveCashBalance(ws: UserWorkspaceState): number {
  return ws.accountMode === 'real' ? ws.realCashBalance : ws.demoCashBalance;
}

export function setActiveCashBalance(ws: UserWorkspaceState, nextCash: number): void {
  const rounded = Number(nextCash.toFixed(2));
  if (ws.accountMode === 'real') {
    ws.realCashBalance = rounded;
  } else {
    ws.demoCashBalance = rounded;
  }
  ws.cashBalance = rounded;
}

export function getActiveOrders(ws: UserWorkspaceState): Order[] {
  return ws.accountMode === 'real' ? ws.realOrders : ws.orders;
}

export function getActivePositionsMap(ws: UserWorkspaceState): Map<string, Position> {
  return ws.accountMode === 'real' ? ws.realPositionsMap : ws.positionsMap;
}

interface SessionRecord {
  sessionId: string;
  userId: string;
  userAgent: string;
  maskedIp: string;
  createdAt: number;
  expiresAt: number;
}

interface FailedLoginBucket {
  count: number;
  lockedUntil: number;
  lastAttempt: number;
}

export const SESSION_COOKIE_NAME = 'meridian_sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const usersByEmail = new Map<string, StoredUserRecord>();
const usersById = new Map<string, StoredUserRecord>();
const sessionsMap = new Map<string, SessionRecord>();
const workspacesByUserId = new Map<string, UserWorkspaceState>();
const failedLoginBuckets = new Map<string, FailedLoginBucket>();

// Periodically expire stale sessions & brute-force trackers so memory stays flat under high traffic
setInterval(() => {
  const now = Date.now();
  for (const [sid, sess] of sessionsMap.entries()) {
    if (now > sess.expiresAt) sessionsMap.delete(sid);
  }
  for (const [k, bucket] of failedLoginBuckets.entries()) {
    if (now - bucket.lastAttempt > 15 * 60_000 && now > bucket.lockedUntil) {
      failedLoginBuckets.delete(k);
    }
  }
}, 60_000).unref();

function hashPassword(password: string, saltHex?: string): { hashHex: string; saltHex: string } {
  const salt = saltHex ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { hashHex: hash, saltHex: salt };
}

function verifyPassword(password: string, hashHex: string, saltHex: string): boolean {
  const candidate = crypto.scryptSync(password, saltHex, 64, { N: 16384, r: 8, p: 1 });
  const stored = Buffer.from(hashHex, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function signSessionToken(sessionId: string, userId: string): string {
  const payload = Buffer.from(JSON.stringify({ sid: sessionId, uid: userId }), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { sid: string; uid: string } | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sid?: string;
      uid?: string;
    };
    if (!decoded.sid || !decoded.uid) return null;
    const active = sessionsMap.get(decoded.sid);
    if (!active || active.userId !== decoded.uid || Date.now() > active.expiresAt) {
      return null;
    }
    return { sid: decoded.sid, uid: decoded.uid };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function extractSessionFromReq(req: Request): { sid: string; user: AuthUser } | null {
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
  const cookies = parseCookies(req.headers.cookie);
  const token = bearerToken || cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const verified = verifySessionToken(token);
  if (!verified) return null;
  const user = usersById.get(verified.uid);
  if (!user) return null;
  return { sid: verified.sid, user: toPublicUser(user) };
}

export function extractSessionFromHeaders(cookieHeader: string | undefined, tokenQuery?: string): { sid: string; user: AuthUser } | null {
  const cookies = parseCookies(cookieHeader);
  const token = tokenQuery || cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const verified = verifySessionToken(token);
  if (!verified) return null;
  const user = usersById.get(verified.uid);
  if (!user) return null;
  return { sid: verified.sid, user: toPublicUser(user) };
}

export function toPublicUser(u: StoredUserRecord): AuthUser {
  const founderAdmin = isFounderEmail(u.email);
  const ws = workspacesByUserId.get(u.id);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isAdmin: founderAdmin,
    experienceMode: u.experienceMode,
    marketFocus: u.marketFocus,
    contactPhone: u.contactPhone,
    twoFactorEnabled: u.twoFactorEnabled,
    mfaEnabled: u.totpEnabled || u.passkeysList.length > 0,
    totpEnabled: u.totpEnabled,
    passkeysCount: u.passkeysList.length,
    realMoneyEnabled: u.realMoneyEnabled,
    linkedProviders: Array.from(u.linkedProvidersSet),
    referralCode: ws?.promo.referralCode,
    termsAcceptedAt: u.termsAcceptedAt,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

function serializeUsersForDisk(): PersistedUser[] {
  return Array.from(usersById.values()).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isAdmin: isFounderEmail(u.email),
    experienceMode: u.experienceMode,
    marketFocus: u.marketFocus ?? 'Global Multi-Asset',
    contactPhone: u.contactPhone,
    twoFactorEnabled: u.twoFactorEnabled,
    totpEnabled: u.totpEnabled,
    totpSecret: u.totpSecret,
    backupCodeHashes: [...u.backupCodeHashes],
    realMoneyEnabled: u.realMoneyEnabled,
    linkedProviders: Array.from(u.linkedProvidersSet),
    passkeysList: u.passkeysList.map((p) => ({ ...p })),
    passwordHashHex: u.passwordHashHex,
    passwordSaltHex: u.passwordSaltHex,
    termsAcceptedAt: u.termsAcceptedAt,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));
}

function persistUsersSnapshot() {
  scheduleUsersPersist(serializeUsersForDisk());
}

function createInitialWorkspace(userId: string, ownerName: string, priceLookup: (sym: string) => number): UserWorkspaceState {
  const nvdaEntry = Number(((priceLookup('NVDA') || 146.8) * 0.986).toFixed(2));
  const btcEntry = Number(((priceLookup('BTC-USD') || 91420) * 0.991).toFixed(2));
  const positionsMap = new Map<string, Position>();
  positionsMap.set('NVDA', {
    symbol: 'NVDA',
    size: 120,
    avgEntry: nvdaEntry,
    unrealizedPnl: 0,
    realizedPnl: 1840.5,
    marketValue: 0,
  });
  positionsMap.set('BTC-USD', {
    symbol: 'BTC-USD',
    size: 0.45,
    avgEntry: btcEntry,
    unrealizedPnl: 0,
    realizedPnl: 920.0,
    marketValue: 0,
  });

  const startingCash = Number((1_000_000 - (120 * nvdaEntry + 0.45 * btcEntry)).toFixed(2));

  const isSeededDemoAccount = userId === 'usr-principal-1' || userId === 'usr-guided-2';
  const bankAccounts: BankAccountRecord[] = isSeededDemoAccount
    ? [
        storeEncryptedBankAccount(
          {
            id: `bnk-${userId}-us`,
            bankName: 'JPMorgan Private Custody Rail',
            accountHolder: ownerName,
            rail: 'ACH',
            currency: 'USD',
            verified: true,
            addedAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
          },
          '8839204829',
          '021000021'
        ),
        storeEncryptedBankAccount(
          {
            id: `bnk-${userId}-in`,
            bankName: 'HDFC Institutional Escrowed Rail',
            accountHolder: ownerName,
            rail: 'IMPS',
            currency: 'INR',
            verified: true,
            addedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
          },
          '501004927104',
          'HDFC0000240'
        ),
      ]
    : [];

  const seedTs = Date.now() - 1000 * 60 * 60 * 18;
  const seedPrev = 'GENESIS_0000000000000000';
  const seedId = `tx-seed-${userId}`;
  const seedHash = computeLedgerHmac(
    seedPrev,
    `${seedId}|deposit|1000000|bnk-${userId}-us|settled|${seedTs}`
  );

  const ws: UserWorkspaceState = {
    userId,
    accountMode: 'demo',
    cashBalance: startingCash,
    demoCashBalance: startingCash,
    realCashBalance: 0,
    vaultBalanceUsd: 0,
    orders: [],
    positionsMap,
    realOrders: [],
    realPositionsMap: new Map(),
    alerts: [
      {
        id: `alt-${userId}-1`,
        symbol: 'NVDA',
        condition: 'above',
        targetPrice: 148.5,
        active: true,
        createdAt: Date.now() - 1000 * 60 * 20,
        note: 'Breakout confirmation level',
      },
      {
        id: `alt-${userId}-2`,
        symbol: 'BTC-USD',
        condition: 'below',
        targetPrice: 89500,
        active: true,
        createdAt: Date.now() - 1000 * 60 * 12,
        note: 'Institutional demand zone',
      },
    ],
    bankAccounts,
    vaultTransfers: isSeededDemoAccount
      ? [
          {
            id: seedId,
            type: 'deposit',
            amountUsd: 1_000_000,
            nativeAmount: 1_000_000,
            currency: 'USD',
            bankAccountId: `bnk-${userId}-us`,
            bankLabel: 'JPMorgan Private Custody Rail (•••• 4829)',
            destination: 'real_trading',
            status: 'settled',
            prevHash: seedPrev,
            entryHash: seedHash,
            createdAt: seedTs,
          },
        ]
      : [],
    lockdownMode: false,
    promo: createDefaultPromoState(userId),
  };
  workspacesByUserId.set(userId, ws);
  return ws;
}

function createDefaultPromoState(userId: string): StoredPromoState {
  const shortHash = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 6).toUpperCase();
  return {
    referralCode: `AURX-${shortHash}`,
    shareCount: 0,
    sharesByChannel: {},
    redeemedCodes: [],
    bonusDemoUsd: 0,
    feeDiscountPct: 0,
    recentRewards: [],
  };
}

function serializeWorkspacesForDisk(): PersistedWorkspaceSnapshot[] {
  const out: PersistedWorkspaceSnapshot[] = [];
  for (const ws of workspacesByUserId.values()) {
    out.push({
      userId: ws.userId,
      accountMode: ws.accountMode,
      cashBalance: getActiveCashBalance(ws),
      demoCashBalance: ws.demoCashBalance,
      realCashBalance: ws.realCashBalance,
      vaultBalanceUsd: ws.vaultBalanceUsd,
      orders: ws.orders.slice(0, 100),
      positions: Array.from(ws.positionsMap.values()),
      realOrders: ws.realOrders.slice(0, 100),
      realPositions: Array.from(ws.realPositionsMap.values()),
      alerts: ws.alerts.slice(0, 50),
      bankAccounts: ws.bankAccounts,
      vaultTransfers: ws.vaultTransfers.slice(0, 100),
      lockdownMode: ws.lockdownMode,
      promo: ws.promo,
      updatedAt: Date.now(),
    });
  }
  return out;
}

export function persistWorkspacesSnapshot() {
  scheduleWorkspacesPersist(serializeWorkspacesForDisk());
}

export function flushWorkspacesImmediate() {
  flushWorkspacesNow(serializeWorkspacesForDisk());
}

export function getOrCreateWorkspace(userId: string, priceLookup: (sym: string) => number): UserWorkspaceState {
  const existing = workspacesByUserId.get(userId);
  if (existing) return existing;
  const owner = usersById.get(userId);
  const created = createInitialWorkspace(userId, owner?.name ?? 'Investor Desk', priceLookup);
  persistWorkspacesSnapshot();
  return created;
}

export function listAllWorkspaces(): UserWorkspaceState[] {
  return Array.from(workspacesByUserId.values());
}

export function getAuthStats(): { totalUsers: number; activeSessions: number } {
  const now = Date.now();
  let active = 0;
  for (const s of sessionsMap.values()) {
    if (s.expiresAt > now) active += 1;
  }
  return { totalUsers: usersById.size, activeSessions: active };
}

export function seedInitialUsers(priceLookup: (sym: string) => number) {
  // 1. Hydrate any persisted accounts from ./data/meridian-admin-store.json (strip Admin from any non-founder)
  const persisted = loadPersistedAdminStore();
  for (const pu of persisted.users) {
    if (usersByEmail.has(pu.email)) continue;
    const rec: StoredUserRecord = {
      id: pu.id,
      email: pu.email,
      name: pu.name,
      role: pu.role,
      isAdmin: isFounderEmail(pu.email),
      experienceMode: pu.experienceMode === 'pro' ? 'pro' : 'newbie',
      marketFocus: pu.marketFocus || 'Global Multi-Asset',
      contactPhone: pu.contactPhone,
      twoFactorEnabled: Boolean(pu.twoFactorEnabled),
      mfaEnabled: Boolean(pu.totpEnabled || (pu.passkeysList?.length ?? 0) > 0),
      totpEnabled: Boolean(pu.totpEnabled),
      totpSecret: pu.totpSecret,
      passkeysCount: pu.passkeysList?.length ?? 0,
      realMoneyEnabled: Boolean(pu.realMoneyEnabled),
      linkedProviders: Array.isArray(pu.linkedProviders) ? pu.linkedProviders : [],
      createdAt: pu.createdAt || Date.now(),
      lastLoginAt: pu.lastLoginAt || Date.now(),
      passwordHashHex: pu.passwordHashHex,
      passwordSaltHex: pu.passwordSaltHex,
      backupCodeHashes: Array.isArray(pu.backupCodeHashes) ? pu.backupCodeHashes : [],
      passkeysList: Array.isArray(pu.passkeysList) ? pu.passkeysList : [],
      linkedProvidersSet: new Set(Array.isArray(pu.linkedProviders) ? pu.linkedProviders : []),
      termsAcceptedAt: pu.termsAcceptedAt,
    };
    usersByEmail.set(rec.email, rec);
    usersById.set(rec.id, rec);
    createInitialWorkspace(rec.id, rec.name, priceLookup);
  }

  // 1b. Hydrate any persisted workspaces (isolated demo vs real cash, Cold Vault, positions, orders, alerts, bank rails)
  const persistedWorkspaces = loadPersistedWorkspaces();
  for (const [uid, pw] of persistedWorkspaces.entries()) {
    if (!usersById.has(uid)) continue;
    const demoPosMap = new Map<string, Position>();
    for (const pos of pw.positions ?? []) {
      demoPosMap.set(pos.symbol, { ...pos });
    }
    const realPosMap = new Map<string, Position>();
    for (const pos of pw.realPositions ?? []) {
      realPosMap.set(pos.symbol, { ...pos });
    }
    const accountMode: 'demo' | 'real' = pw.accountMode === 'real' ? 'real' : 'demo';
    const demoCash = typeof pw.demoCashBalance === 'number'
      ? pw.demoCashBalance
      : typeof pw.cashBalance === 'number'
      ? pw.cashBalance
      : 1_000_000;
    const realCash = typeof pw.realCashBalance === 'number' ? pw.realCashBalance : 0;
    const vaultUsd = typeof pw.vaultBalanceUsd === 'number' ? pw.vaultBalanceUsd : 0;
    workspacesByUserId.set(uid, {
      userId: uid,
      accountMode,
      cashBalance: accountMode === 'real' ? realCash : demoCash,
      demoCashBalance: demoCash,
      realCashBalance: realCash,
      vaultBalanceUsd: vaultUsd,
      orders: Array.isArray(pw.orders) ? pw.orders : [],
      positionsMap: demoPosMap,
      realOrders: Array.isArray(pw.realOrders) ? pw.realOrders : [],
      realPositionsMap: realPosMap,
      alerts: Array.isArray(pw.alerts) ? pw.alerts : [],
      bankAccounts: Array.isArray(pw.bankAccounts) ? pw.bankAccounts : [],
      vaultTransfers: Array.isArray(pw.vaultTransfers) ? pw.vaultTransfers : [],
      lockdownMode: Boolean(pw.lockdownMode),
      promo: pw.promo ? pw.promo : createDefaultPromoState(uid),
    });
  }

  // 2. Ensure core platform owner & demo accounts exist
  const seeds: Array<{
    id: string;
    email: string;
    password: string;
    name: string;
    role: string;
    isAdmin: boolean;
    experienceMode: 'newbie' | 'pro';
    marketFocus: string;
  }> = [
    {
      id: 'usr-principal-1',
      email: 'vemulavankeswararao@gmail.com',
      password: 'Meridian#2026',
      name: 'Principal Investor',
      role: 'Platform Admin · Managing Quant Desk',
      isAdmin: true,
      experienceMode: 'pro',
      marketFocus: 'Global Multi-Asset',
    },
    {
      id: 'usr-guided-2',
      email: 'demo@meridianmarkets.ai',
      password: 'DemoDesk#2026',
      name: 'Guided Investor',
      role: 'Wealth & SIP Member',
      isAdmin: false,
      experienceMode: 'newbie',
      marketFocus: 'India NSE/BSE + INR',
    },
  ];

  let addedSeed = false;
  for (const s of seeds) {
    if (usersByEmail.has(s.email)) {
      const existing = usersByEmail.get(s.email)!;
      if (!workspacesByUserId.has(existing.id)) {
        createInitialWorkspace(existing.id, existing.name, priceLookup);
      }
      continue;
    }
    const { hashHex, saltHex } = hashPassword(s.password);
    const rec: StoredUserRecord = {
      id: s.id,
      email: s.email,
      name: s.name,
      role: s.role,
      isAdmin: s.isAdmin,
      experienceMode: s.experienceMode,
      marketFocus: s.marketFocus,
      twoFactorEnabled: false,
      mfaEnabled: false,
      totpEnabled: false,
      passkeysCount: 0,
      realMoneyEnabled: false,
      linkedProviders: [],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
      lastLoginAt: Date.now(),
      passwordHashHex: hashHex,
      passwordSaltHex: saltHex,
      backupCodeHashes: [],
      passkeysList: [],
      linkedProvidersSet: new Set(),
    };
    usersByEmail.set(rec.email, rec);
    usersById.set(rec.id, rec);
    if (!workspacesByUserId.has(rec.id)) {
      createInitialWorkspace(rec.id, rec.name, priceLookup);
    }
    addedSeed = true;
  }

  if (addedSeed) {
    persistUsersSnapshot();
    persistWorkspacesSnapshot();
  }
}

function createAuthenticatedSessionForUser(
  user: StoredUserRecord,
  meta: { userAgent: string; rawIp: string }
): { user: AuthUser; token: string; sessionId: string } {
  const now = Date.now();
  user.lastLoginAt = now;
  const sessionId = `sid-${now}-${crypto.randomBytes(6).toString('hex')}`;
  sessionsMap.set(sessionId, {
    sessionId,
    userId: user.id,
    userAgent: sanitizePlainText(meta.userAgent, 120) || 'Browser Client',
    maskedIp: maskIpString(meta.rawIp),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  const token = signSessionToken(sessionId, user.id);
  return { user: toPublicUser(user), token, sessionId };
}

function buildMfaMethods(user: StoredUserRecord): Array<'totp' | 'webauthn' | 'backup'> {
  const methods: Array<'totp' | 'webauthn' | 'backup'> = [];
  if (user.totpEnabled && user.totpSecret) methods.push('totp');
  if (user.passkeysList.length > 0) methods.push('webauthn');
  if (user.backupCodeHashes.length > 0) methods.push('backup');
  return methods;
}

export function registerAccount(
  input: {
    email: string;
    password: string;
    name: string;
    role?: string;
    experienceMode?: 'newbie' | 'pro';
    marketFocus?: string;
    contactPhone?: string;
    termsAccepted?: boolean;
  },
  meta: { userAgent: string; rawIp: string },
  priceLookup: (sym: string) => number
): { ok: true; user: AuthUser; token: string; sessionId: string } | { ok: false; error: string; status: number } {
  const email = sanitizePlainText(input.email, 120).toLowerCase();
  const name = sanitizePlainText(input.name, 60);
  const role = sanitizePlainText(input.role || 'Multi-Market Investor', 50) || 'Multi-Market Investor';
  const marketFocus = sanitizePlainText(input.marketFocus || 'Global Multi-Asset', 40) || 'Global Multi-Asset';
  const contactPhone = sanitizePlainText(input.contactPhone ?? '', 24) || undefined;
  const password = String(input.password ?? '');

  if (input.termsAccepted === false) {
    return {
      ok: false,
      error: 'You must accept the Strict Terms & Conditions, Arbitration Clause & Privacy Policy to create an account.',
      status: 400,
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    recordAuthTelemetryEvent({
      eventType: 'REGISTER_FAILED',
      outcome: 'FAILED',
      method: 'password',
      email: email || 'invalid-email',
      name,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: 'Rejected registration: malformed email address.',
    });
    return { ok: false, error: 'Please enter a valid email address.', status: 400 };
  }
  if (!name || name.length < 2) {
    recordAuthTelemetryEvent({
      eventType: 'REGISTER_FAILED',
      outcome: 'FAILED',
      method: 'password',
      email,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: 'Rejected registration: full name shorter than 2 chars.',
    });
    return { ok: false, error: 'Please enter your name (at least 2 characters).', status: 400 };
  }
  if (password.length < 8) {
    recordAuthTelemetryEvent({
      eventType: 'REGISTER_FAILED',
      outcome: 'FAILED',
      method: 'password',
      email,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: 'Rejected registration: password below 8-character policy.',
    });
    return { ok: false, error: 'Password must be at least 8 characters for vault security.', status: 400 };
  }
  if (usersByEmail.has(email)) {
    recordAuthTelemetryEvent({
      eventType: 'REGISTER_FAILED',
      outcome: 'FAILED',
      method: 'password',
      email,
      name,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: 'Rejected duplicate registration attempt for existing email.',
    });
    return { ok: false, error: 'An account with this email already exists. Please sign in.', status: 409 };
  }

  const { hashHex, saltHex } = hashPassword(password);
  const now = Date.now();
  const userId = `usr-${now}-${crypto.randomBytes(3).toString('hex')}`;
  const rec: StoredUserRecord = {
    id: userId,
    email,
    name,
    role,
    isAdmin: isFounderEmail(email),
    experienceMode: input.experienceMode === 'pro' ? 'pro' : 'newbie',
    marketFocus,
    contactPhone,
    twoFactorEnabled: false,
    mfaEnabled: false,
    totpEnabled: false,
    passkeysCount: 0,
    realMoneyEnabled: false,
    linkedProviders: [],
    termsAcceptedAt: now,
    createdAt: now,
    lastLoginAt: now,
    passwordHashHex: hashHex,
    passwordSaltHex: saltHex,
    backupCodeHashes: [],
    passkeysList: [],
    linkedProvidersSet: new Set(),
  };

  usersByEmail.set(email, rec);
  usersById.set(userId, rec);
  createInitialWorkspace(userId, rec.name, priceLookup);
  persistUsersSnapshot();
  persistWorkspacesSnapshot();

  const auth = createAuthenticatedSessionForUser(rec, meta);
  recordAuthTelemetryEvent({
    eventType: 'REGISTER_SUCCESS',
    outcome: 'SUCCESS',
    method: 'password',
    userId: rec.id,
    email: rec.email,
    name: rec.name,
    role: rec.role,
    rawIp: meta.rawIp,
    userAgent: meta.userAgent,
    detail: `New account registered (${rec.experienceMode.toUpperCase()} · ${marketFocus}${contactPhone ? ` · Phone: ${contactPhone}` : ''}).`,
  });
  return { ok: true, ...auth };
}

export function authenticateAccount(
  input: { email: string; password: string },
  meta: { userAgent: string; rawIp: string }
):
  | { ok: true; mfaRequired?: false; user: AuthUser; token: string; sessionId: string }
  | { ok: true; mfaRequired: true; mfaChallenge: MfaChallengePayload }
  | { ok: false; error: string; status: number; bruteForceLocked?: boolean } {
  const email = sanitizePlainText(input.email, 120).toLowerCase();
  const password = String(input.password ?? '');
  const now = Date.now();
  const bucketKey = `${email}:${meta.rawIp}`;
  const bucket = failedLoginBuckets.get(bucketKey);

  if (bucket && now < bucket.lockedUntil) {
    const secs = Math.ceil((bucket.lockedUntil - now) / 1000);
    recordAuthTelemetryEvent({
      eventType: 'BRUTE_FORCE_LOCK',
      outcome: 'BLOCKED',
      method: 'password',
      email,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: `Sign-in blocked by brute-force shield (${secs}s lock remaining).`,
    });
    return {
      ok: false,
      error: `Account temporarily locked due to repeated failed attempts. Retry in ${secs}s.`,
      status: 429,
      bruteForceLocked: true,
    };
  }

  const user = usersByEmail.get(email);
  if (!user || !verifyPassword(password, user.passwordHashHex, user.passwordSaltHex)) {
    const nextCount = (bucket?.count ?? 0) + 1;
    const lockedUntil = nextCount >= 5 ? now + 120_000 : 0;
    failedLoginBuckets.set(bucketKey, {
      count: nextCount >= 5 ? 0 : nextCount,
      lockedUntil,
      lastAttempt: now,
    });
    recordAuthTelemetryEvent({
      eventType: lockedUntil > 0 ? 'BRUTE_FORCE_LOCK' : 'LOGIN_FAILED',
      outcome: lockedUntil > 0 ? 'BLOCKED' : 'FAILED',
      method: 'password',
      userId: user?.id,
      email,
      name: user?.name,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail:
        lockedUntil > 0
          ? '5 failed password attempts — 120s brute-force lockout engaged.'
          : `Invalid email or password (attempt ${nextCount}/5).`,
    });
    return {
      ok: false,
      error:
        lockedUntil > 0
          ? 'Too many failed sign-in attempts. Brute-force protection engaged for 120s.'
          : 'Invalid email or password.',
      status: lockedUntil > 0 ? 429 : 401,
      bruteForceLocked: lockedUntil > 0,
    };
  }

  failedLoginBuckets.delete(bucketKey);

  // Enforce 2nd factor if user enrolled TOTP Authenticator or Hardware Security Keys
  const mfaMethods = buildMfaMethods(user);
  if (mfaMethods.length > 0) {
    const ticket = issuePendingMfaTicket(user.id, user.email, mfaMethods);
    recordAuthTelemetryEvent({
      eventType: 'MFA_CHALLENGE_ISSUED',
      outcome: 'CHALLENGE',
      method: 'password',
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: `Primary credentials accepted; awaiting 2nd-factor challenge (${mfaMethods.join(', ')}).`,
    });
    return {
      ok: true,
      mfaRequired: true,
      mfaChallenge: {
        mfaToken: ticket.mfaToken,
        methods: ticket.methods,
        emailHint: ticket.emailHint,
        expiresAt: ticket.expiresAt,
      },
    };
  }

  const auth = createAuthenticatedSessionForUser(user, meta);
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'LOGIN_SUCCESS',
    outcome: 'SUCCESS',
    method: 'password',
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    rawIp: meta.rawIp,
    userAgent: meta.userAgent,
    detail: `Signed in via Scrypt password verification${user.isAdmin ? ' (ADMIN SESSION)' : ''}.`,
  });
  return { ok: true, ...auth };
}

export function verifyMfaLoginCode(
  input: { mfaToken: string; code: string },
  meta: { userAgent: string; rawIp: string }
): { ok: true; user: AuthUser; token: string; sessionId: string } | { ok: false; error: string; status: number } {
  const ticket = peekPendingMfaTicket(input.mfaToken);
  if (!ticket) {
    return { ok: false, error: 'MFA verification session expired. Please sign in again.', status: 401 };
  }
  const user = usersById.get(ticket.userId);
  if (!user) {
    return { ok: false, error: 'Account no longer exists.', status: 404 };
  }

  let verified = false;
  let usedMethod: 'totp' | 'backup' = 'totp';
  if (user.totpEnabled && user.totpSecret && verifyTotpCode(user.totpSecret, input.code)) {
    verified = true;
    usedMethod = 'totp';
  } else {
    const candidateHash = hashRecoveryCode(input.code);
    const idx = user.backupCodeHashes.indexOf(candidateHash);
    if (idx !== -1) {
      user.backupCodeHashes.splice(idx, 1); // single-use backup code
      verified = true;
      usedMethod = 'backup';
    }
  }

  if (!verified) {
    recordAuthTelemetryEvent({
      eventType: 'MFA_FAILED',
      outcome: 'FAILED',
      method: 'totp',
      userId: user.id,
      email: user.email,
      name: user.name,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: 'Invalid 6-digit TOTP or recovery backup code submitted.',
    });
    return { ok: false, error: 'Invalid 6-digit authenticator code or recovery code.', status: 401 };
  }

  consumePendingMfaTicket(input.mfaToken);
  const auth = createAuthenticatedSessionForUser(user, meta);
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'MFA_VERIFIED',
    outcome: 'SUCCESS',
    method: usedMethod,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    rawIp: meta.rawIp,
    userAgent: meta.userAgent,
    detail:
      usedMethod === 'backup'
        ? `MFA verified using single-use backup code (${user.backupCodeHashes.length} remaining).`
        : 'MFA verified with RFC-6238 TOTP authenticator code.',
  });
  return { ok: true, ...auth };
}

export function findOrCreateOAuthUser(
  profile: { provider: 'google' | 'github'; email: string; name: string },
  meta: { userAgent: string; rawIp: string },
  priceLookup: (sym: string) => number
):
  | { ok: true; mfaRequired?: false; user: AuthUser; token: string; sessionId: string }
  | { ok: true; mfaRequired: true; mfaChallenge: MfaChallengePayload } {
  const email = sanitizePlainText(profile.email, 120).toLowerCase();
  const name = sanitizePlainText(profile.name, 60) || email.split('@')[0];
  let user = usersByEmail.get(email);
  let newlyRegistered = false;

  if (!user) {
    const { hashHex, saltHex } = hashPassword(crypto.randomBytes(24).toString('hex'));
    const now = Date.now();
    const userId = `usr-${now}-${crypto.randomBytes(3).toString('hex')}`;
    user = {
      id: userId,
      email,
      name,
      role: 'Verified OAuth Investor',
      isAdmin: email === 'vemulavankeswararao@gmail.com',
      experienceMode: 'newbie',
      marketFocus: 'Global Multi-Asset',
      twoFactorEnabled: false,
      mfaEnabled: false,
      totpEnabled: false,
      passkeysCount: 0,
      realMoneyEnabled: false,
      linkedProviders: [profile.provider],
      createdAt: now,
      lastLoginAt: now,
      passwordHashHex: hashHex,
      passwordSaltHex: saltHex,
      backupCodeHashes: [],
      passkeysList: [],
      linkedProvidersSet: new Set([profile.provider]),
    };
    usersByEmail.set(email, user);
    usersById.set(userId, user);
    createInitialWorkspace(userId, user.name, priceLookup);
    newlyRegistered = true;
  } else {
    user.linkedProvidersSet.add(profile.provider);
  }

  const mfaMethods = buildMfaMethods(user);
  if (mfaMethods.length > 0) {
    const ticket = issuePendingMfaTicket(user.id, user.email, mfaMethods);
    persistUsersSnapshot();
    recordAuthTelemetryEvent({
      eventType: 'MFA_CHALLENGE_ISSUED',
      outcome: 'CHALLENGE',
      method: profile.provider,
      userId: user.id,
      email: user.email,
      name: user.name,
      rawIp: meta.rawIp,
      userAgent: meta.userAgent,
      detail: `${profile.provider.toUpperCase()} OAuth identity verified; awaiting 2nd-factor MFA (${mfaMethods.join(', ')}).`,
    });
    return {
      ok: true,
      mfaRequired: true,
      mfaChallenge: {
        mfaToken: ticket.mfaToken,
        methods: ticket.methods,
        emailHint: ticket.emailHint,
        expiresAt: ticket.expiresAt,
      },
    };
  }

  const auth = createAuthenticatedSessionForUser(user, meta);
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: newlyRegistered ? 'REGISTER_SUCCESS' : 'OAUTH_SIGNIN',
    outcome: 'SUCCESS',
    method: profile.provider,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    rawIp: meta.rawIp,
    userAgent: meta.userAgent,
    detail: newlyRegistered
      ? `Provisioned & signed in via ${profile.provider.toUpperCase()} OAuth 2.0.`
      : `Authenticated via ${profile.provider.toUpperCase()} OAuth 2.0.`,
  });
  return { ok: true, ...auth };
}

export function startTotpEnrollment(userId: string): TotpEnrollmentSetup | null {
  const user = usersById.get(userId);
  if (!user) return null;
  const secretBase32 = generateTotpSecret();
  const { plainCodes, hashes } = generateRecoveryCodes();
  user.pendingTotpSecret = secretBase32;
  user.pendingRecoveryHashes = hashes;
  return {
    secretBase32,
    otpauthUri: buildOtpAuthUri(user.email, secretBase32),
    issuer: 'Nuvra Exchange',
    accountEmail: user.email,
    recoveryCodes: plainCodes,
  };
}

export function confirmTotpEnrollment(
  userId: string,
  code: string,
  meta?: { rawIp?: string; userAgent?: string }
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const user = usersById.get(userId);
  if (!user || !user.pendingTotpSecret) {
    return { ok: false, error: 'No pending TOTP enrollment found. Generate a fresh QR secret first.' };
  }
  if (!verifyTotpCode(user.pendingTotpSecret, code)) {
    return { ok: false, error: 'The 6-digit verification code did not match your authenticator key.' };
  }
  user.totpSecret = user.pendingTotpSecret;
  user.totpEnabled = true;
  user.twoFactorEnabled = true;
  user.backupCodeHashes = user.pendingRecoveryHashes ?? [];
  user.pendingTotpSecret = undefined;
  user.pendingRecoveryHashes = undefined;
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'TOTP_ENROLLED',
    outcome: 'SUCCESS',
    method: 'totp',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail: 'RFC-6238 Authenticator App MFA & backup codes activated.',
  });
  return { ok: true, user: toPublicUser(user) };
}

export function disableTotpForUser(
  userId: string,
  meta?: { rawIp?: string; userAgent?: string }
): AuthUser | null {
  const user = usersById.get(userId);
  if (!user) return null;
  const wasRealMoney = user.realMoneyEnabled;
  user.totpEnabled = false;
  user.totpSecret = undefined;
  user.pendingTotpSecret = undefined;
  user.pendingRecoveryHashes = undefined;
  user.backupCodeHashes = [];
  user.realMoneyEnabled = false; // Fewer than 2 MFA methods remain
  if (user.passkeysList.length === 0) {
    user.twoFactorEnabled = false;
  }
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'TOTP_DISABLED',
    outcome: 'SUCCESS',
    method: 'totp',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail: wasRealMoney
      ? 'TOTP Authenticator removed; Real-Money Custody Mode auto-revoked.'
      : 'TOTP Authenticator MFA removed from account.',
  });
  return toPublicUser(user);
}

export function listPasskeysForUser(userId: string): PasskeyCredentialInfo[] {
  const user = usersById.get(userId);
  if (!user) return [];
  return user.passkeysList.map((p) => ({
    id: p.id,
    label: p.label,
    algorithm: p.algorithm,
    transports: p.transports,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt,
  }));
}

export function registerPasskeyForUser(
  userId: string,
  cred: {
    credentialIdB64: string;
    spkiPublicKeyB64: string;
    label: string;
    algorithm: string;
    transports: string[];
  },
  meta?: { rawIp?: string; userAgent?: string }
): { ok: true; user: AuthUser; passkey: PasskeyCredentialInfo } | { ok: false; error: string } {
  const user = usersById.get(userId);
  if (!user) return { ok: false, error: 'User not found' };
  const duplicate = user.passkeysList.find((p) => p.credentialIdB64 === cred.credentialIdB64);
  if (duplicate) {
    return { ok: false, error: 'This security key / passkey is already registered.' };
  }
  const passkey: StoredPasskeyRecord = {
    id: cred.credentialIdB64,
    credentialIdB64: cred.credentialIdB64,
    spkiPublicKeyB64: cred.spkiPublicKeyB64,
    userId,
    label: sanitizePlainText(cred.label, 48) || 'Hardware Security Key',
    algorithm: cred.algorithm,
    transports: cred.transports.slice(0, 4),
    createdAt: Date.now(),
  };
  user.passkeysList.push(passkey);
  user.twoFactorEnabled = true;
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'PASSKEY_REGISTERED',
    outcome: 'SUCCESS',
    method: 'webauthn',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail: `FIDO2 Hardware Passkey "${passkey.label}" (${passkey.algorithm}) enrolled.`,
  });
  return {
    ok: true,
    user: toPublicUser(user),
    passkey: {
      id: passkey.id,
      label: passkey.label,
      algorithm: passkey.algorithm,
      transports: passkey.transports,
      createdAt: passkey.createdAt,
    },
  };
}

export function removePasskeyForUser(
  userId: string,
  credentialId: string,
  meta?: { rawIp?: string; userAgent?: string }
): AuthUser | null {
  const user = usersById.get(userId);
  if (!user) return null;
  const wasRealMoney = user.realMoneyEnabled;
  user.passkeysList = user.passkeysList.filter((p) => p.id !== credentialId);
  if (user.passkeysList.length === 0) {
    user.realMoneyEnabled = false; // Fewer than 2 independent MFA methods remain
  }
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'PASSKEY_REVOKED',
    outcome: 'SUCCESS',
    method: 'webauthn',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail:
      wasRealMoney && user.passkeysList.length === 0
        ? 'Last Hardware Passkey revoked; Real-Money Custody Mode auto-revoked.'
        : 'Revoked FIDO2 Hardware Passkey credential.',
  });
  return toPublicUser(user);
}

export function setRealMoneyTradingMode(
  userId: string,
  enabled: boolean,
  checks: { lockdownMode: boolean; hasBankRail: boolean },
  meta?: { rawIp?: string; userAgent?: string }
): { ok: true; user: AuthUser } | { ok: false; status: number; error: string } {
  const user = usersById.get(userId);
  if (!user) return { ok: false, status: 404, error: 'Account not found.' };

  if (!enabled) {
    user.realMoneyEnabled = false;
    persistUsersSnapshot();
    recordAuthTelemetryEvent({
      eventType: 'REAL_MONEY_REVOKED',
      outcome: 'SUCCESS',
      method: 'system',
      userId: user.id,
      email: user.email,
      name: user.name,
      rawIp: meta?.rawIp,
      userAgent: meta?.userAgent,
      detail: 'Returned desk from Real-Money Custody Mode to Simulation Mode.',
    });
    return { ok: true, user: toPublicUser(user) };
  }

  const activeMfaMethods =
    (user.totpEnabled ? 1 : 0) + (user.passkeysList.length > 0 ? 1 : 0);
  if (activeMfaMethods < 2) {
    const err =
      'Security Checklist Incomplete: Enable at least two independent MFA methods (TOTP Authenticator App + FIDO2 Hardware Key / Passkey) before activating Real-Money Mode.';
    recordAuthTelemetryEvent({
      eventType: 'REAL_MONEY_DENIED',
      outcome: 'BLOCKED',
      method: 'system',
      userId: user.id,
      email: user.email,
      name: user.name,
      rawIp: meta?.rawIp,
      userAgent: meta?.userAgent,
      detail: `Blocked Real-Money Mode activation (${activeMfaMethods}/2 independent MFA methods verified).`,
    });
    return { ok: false, status: 403, error: err };
  }
  if (checks.lockdownMode) {
    return {
      ok: false,
      status: 423,
      error: 'Lift Emergency Vault Lockdown before enabling Real-Money Mode.',
    };
  }
  if (!checks.hasBankRail) {
    return {
      ok: false,
      status: 400,
      error: 'Link at least one verified AES-256-GCM banking rail first.',
    };
  }

  user.realMoneyEnabled = true;
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'REAL_MONEY_ENABLED',
    outcome: 'SUCCESS',
    method: 'system',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail: 'Real-Money Custody Mode activated after passing 2+ independent MFA & Vault Integrity checklist.',
  });
  return { ok: true, user: toPublicUser(user) };
}

export function findPasskeysForAuthLookup(input: {
  email?: string;
  mfaToken?: string;
}): { userId?: string; allowCredentials: Array<{ id: string; transports: string[] }> } {
  if (input.mfaToken) {
    const ticket = peekPendingMfaTicket(input.mfaToken);
    if (ticket) {
      const user = usersById.get(ticket.userId);
      return {
        userId: user?.id,
        allowCredentials:
          user?.passkeysList.map((p) => ({ id: p.credentialIdB64, transports: p.transports })) ?? [],
      };
    }
  }
  if (input.email) {
    const user = usersByEmail.get(sanitizePlainText(input.email, 120).toLowerCase());
    if (user) {
      return {
        userId: user.id,
        allowCredentials: user.passkeysList.map((p) => ({ id: p.credentialIdB64, transports: p.transports })),
      };
    }
  }
  const allCreds: Array<{ id: string; transports: string[] }> = [];
  for (const u of usersById.values()) {
    for (const p of u.passkeysList) {
      allCreds.push({ id: p.credentialIdB64, transports: p.transports });
    }
  }
  return { allowCredentials: allCreds };
}

export function findPasskeyRecordByCredentialId(credentialIdB64: string): StoredPasskeyRecord | null {
  for (const u of usersById.values()) {
    const found = u.passkeysList.find((p) => p.credentialIdB64 === credentialIdB64);
    if (found) return found;
  }
  return null;
}

export function completePasskeySignIn(
  passkey: StoredPasskeyRecord,
  meta: { userAgent: string; rawIp: string },
  mfaToken?: string
): { user: AuthUser; token: string; sessionId: string } | null {
  const user = usersById.get(passkey.userId);
  if (!user) return null;
  if (mfaToken) {
    const ticket = peekPendingMfaTicket(mfaToken);
    if (!ticket || ticket.userId !== user.id) return null;
    consumePendingMfaTicket(mfaToken);
  }
  passkey.lastUsedAt = Date.now();
  const auth = createAuthenticatedSessionForUser(user, meta);
  persistUsersSnapshot();
  recordAuthTelemetryEvent({
    eventType: 'LOGIN_SUCCESS',
    outcome: 'SUCCESS',
    method: 'webauthn',
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    rawIp: meta.rawIp,
    userAgent: meta.userAgent,
    detail: `Signed in via FIDO2 Hardware Passkey "${passkey.label}" signature verification.`,
  });
  return auth;
}

export function listUserSessions(userId: string, currentSessionId: string): AuthSessionInfo[] {
  const now = Date.now();
  const list: AuthSessionInfo[] = [];
  for (const s of sessionsMap.values()) {
    if (s.userId === userId && s.expiresAt > now) {
      list.push({
        sessionId: s.sessionId,
        userAgent: s.userAgent,
        maskedIp: s.maskedIp,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        current: s.sessionId === currentSessionId,
      });
    }
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function revokeSession(sessionId: string, meta?: { rawIp?: string; userAgent?: string }) {
  const sess = sessionsMap.get(sessionId);
  sessionsMap.delete(sessionId);
  if (sess) {
    const user = usersById.get(sess.userId);
    if (user) {
      recordAuthTelemetryEvent({
        eventType: 'SESSION_LOGOUT',
        outcome: 'SUCCESS',
        method: 'system',
        userId: user.id,
        email: user.email,
        name: user.name,
        rawIp: meta?.rawIp,
        userAgent: meta?.userAgent,
        detail: `Session ${sessionId.slice(0, 12)} signed out cleanly.`,
      });
    }
  }
}

export function revokeOtherUserSessions(
  userId: string,
  keepSessionId: string,
  meta?: { rawIp?: string; userAgent?: string }
): number {
  let removed = 0;
  for (const [sid, s] of sessionsMap.entries()) {
    if (s.userId === userId && sid !== keepSessionId) {
      sessionsMap.delete(sid);
      removed += 1;
    }
  }
  const user = usersById.get(userId);
  if (user && removed > 0) {
    recordAuthTelemetryEvent({
      eventType: 'SESSIONS_REVOKED',
      outcome: 'SUCCESS',
      method: 'system',
      userId: user.id,
      email: user.email,
      name: user.name,
      rawIp: meta?.rawIp,
      userAgent: meta?.userAgent,
      detail: `Revoked ${removed} other active session(s) for account security.`,
    });
  }
  return removed;
}

export function updateUserSecurityPrefs(
  userId: string,
  updates: { experienceMode?: 'newbie' | 'pro'; twoFactorEnabled?: boolean; name?: string; role?: string }
): AuthUser | null {
  const user = usersById.get(userId);
  if (!user) return null;
  if (updates.experienceMode === 'newbie' || updates.experienceMode === 'pro') {
    user.experienceMode = updates.experienceMode;
  }
  if (typeof updates.twoFactorEnabled === 'boolean') {
    user.twoFactorEnabled = updates.twoFactorEnabled;
  }
  if (updates.name) {
    const cleanName = sanitizePlainText(updates.name, 60);
    if (cleanName) user.name = cleanName;
  }
  if (updates.role) {
    const cleanRole = sanitizePlainText(updates.role, 50);
    if (cleanRole) user.role = cleanRole;
  }
  persistUsersSnapshot();
  return toPublicUser(user);
}

export function listAdminUserDirectory(priceLookup: (sym: string) => number) {
  const now = Date.now();
  const sessionCounts = new Map<string, number>();
  for (const s of sessionsMap.values()) {
    if (s.expiresAt > now) {
      sessionCounts.set(s.userId, (sessionCounts.get(s.userId) ?? 0) + 1);
    }
  }

  return Array.from(usersById.values())
    .map((u) => {
      const ws = getOrCreateWorkspace(u.id, priceLookup);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isAdmin: u.isAdmin,
        experienceMode: u.experienceMode,
        marketFocus: u.marketFocus ?? 'Global Multi-Asset',
        contactPhone: u.contactPhone,
        totpEnabled: u.totpEnabled,
        passkeysCount: u.passkeysList.length,
        realMoneyEnabled: u.realMoneyEnabled,
        linkedProviders: Array.from(u.linkedProvidersSet),
        activeSessions: sessionCounts.get(u.id) ?? 0,
        cashBalance: ws.cashBalance,
        bankRailsCount: ws.bankAccounts.length,
        ordersCount: ws.orders.length,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      };
    })
    .sort((a, b) => b.lastLoginAt - a.lastLoginAt);
}

export function setUserAdminRole(
  targetUserId: string,
  _isAdmin: boolean,
  _actorName: string,
  _meta?: { rawIp?: string; userAgent?: string }
): { ok: true; user: AuthUser } | { ok: false; error: string; status: number } {
  const user = usersById.get(targetUserId);
  if (!user) return { ok: false, error: 'Target user not found.', status: 404 };
  return {
    ok: false,
    error: `Admin privileges are permanently restricted to the App Founder (${FOUNDER_EMAIL}) only.`,
    status: 403,
  };
}

export function revokeAllSessionsForUser(
  targetUserId: string,
  actorName: string,
  meta?: { rawIp?: string; userAgent?: string }
): { ok: true; removed: number } | { ok: false; error: string; status: number } {
  const user = usersById.get(targetUserId);
  if (!user) return { ok: false, error: 'Target user not found.', status: 404 };
  let removed = 0;
  for (const [sid, s] of sessionsMap.entries()) {
    if (s.userId === targetUserId) {
      sessionsMap.delete(sid);
      removed += 1;
    }
  }
  recordAuthTelemetryEvent({
    eventType: 'ADMIN_ACTION',
    outcome: 'SUCCESS',
    method: 'system',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail: `Admin ${actorName} force-revoked ${removed} active session(s) for ${user.email}.`,
  });
  return { ok: true, removed };
}

const PROMO_CATALOG: Record<
  string,
  { label: string; bonusDemoUsd: number; feeDiscountPct: number }
> = {
  WELCOME500: {
    label: 'Welcome Strategy Booster (+$25,000 Demo Liquidity + 10% Fee Tier)',
    bonusDemoUsd: 25_000,
    feeDiscountPct: 10,
  },
  GLOBALVIP: {
    label: 'Global Multi-Market VIP (+$50,000 Demo Liquidity + 20% Fee Tier)',
    bonusDemoUsd: 50_000,
    feeDiscountPct: 20,
  },
  UPIZERO: {
    label: 'Zero-Fee Global UPI Corridor Pass (+$15,000 Demo Liquidity + 15% Fee Tier)',
    bonusDemoUsd: 15_000,
    feeDiscountPct: 15,
  },
  AGENTPRO: {
    label: '24-Agent Quant Unlock (+$35,000 Demo Liquidity + 15% Fee Tier)',
    bonusDemoUsd: 35_000,
    feeDiscountPct: 15,
  },
};

function computeTierLabel(shareCount: number, feeDiscountPct: number): string {
  if (shareCount >= 5 || feeDiscountPct >= 25) return 'Ambassador Diamond';
  if (shareCount >= 2 || feeDiscountPct >= 15) return 'Quant Partner Gold';
  if (shareCount >= 1 || feeDiscountPct > 0) return 'Verified Member Silver';
  return 'Standard Investor';
}

export function getPromoProfile(
  userId: string,
  originUrl: string,
  priceLookup: (sym: string) => number
): ReferralPromoProfile {
  const ws = getOrCreateWorkspace(userId, priceLookup);
  const p = ws.promo;
  const cleanOrigin = originUrl.replace(/\/+$/, '') || 'https://nuvra.exchange';
  return {
    referralCode: p.referralCode,
    inviteUrl: `${cleanOrigin}/?ref=${encodeURIComponent(p.referralCode)}`,
    shareCount: p.shareCount,
    sharesByChannel: { ...p.sharesByChannel },
    redeemedCodes: [...p.redeemedCodes],
    bonusDemoUsd: p.bonusDemoUsd,
    feeDiscountPct: p.feeDiscountPct,
    tierLabel: computeTierLabel(p.shareCount, p.feeDiscountPct),
    recentRewards: [...p.recentRewards],
  };
}

export function redeemPromoCode(
  userId: string,
  rawCode: string,
  originUrl: string,
  priceLookup: (sym: string) => number
):
  | { ok: true; profile: ReferralPromoProfile; demoCashBalance: number; rewardLabel: string }
  | { ok: false; status: number; error: string } {
  const code = sanitizePlainText(rawCode, 32).toUpperCase();
  const ws = getOrCreateWorkspace(userId, priceLookup);
  if (!code) {
    return { ok: false, status: 400, error: 'Enter a valid promo or referral code.' };
  }
  if (ws.promo.redeemedCodes.includes(code)) {
    return { ok: false, status: 409, error: `Promo code ${code} has already been redeemed on this account.` };
  }

  let reward = PROMO_CATALOG[code];
  if (!reward && /^AURX-[A-Z0-9]{4,8}$/.test(code) && code !== ws.promo.referralCode) {
    reward = {
      label: `Peer Referral Boost via ${code} (+$20,000 Demo Liquidity + 10% Fee Tier)`,
      bonusDemoUsd: 20_000,
      feeDiscountPct: 10,
    };
  }
  if (!reward) {
    return {
      ok: false,
      status: 404,
      error: 'Invalid promo code. Try WELCOME500, GLOBALVIP, UPIZERO, AGENTPRO, or a friend’s AURX code.',
    };
  }

  ws.promo.redeemedCodes.push(code);
  ws.promo.bonusDemoUsd += reward.bonusDemoUsd;
  ws.promo.feeDiscountPct = Math.min(40, Math.max(ws.promo.feeDiscountPct, reward.feeDiscountPct));
  ws.promo.recentRewards.unshift({
    code,
    label: reward.label,
    bonusDemoUsd: reward.bonusDemoUsd,
    feeDiscountPct: reward.feeDiscountPct,
    redeemedAt: Date.now(),
  });
  ws.promo.recentRewards = ws.promo.recentRewards.slice(0, 12);

  // Credit Demo Practice Capital immediately without altering isolated Real Money cash
  ws.demoCashBalance = Number((ws.demoCashBalance + reward.bonusDemoUsd).toFixed(2));
  if (ws.accountMode === 'demo') {
    ws.cashBalance = ws.demoCashBalance;
  }

  persistWorkspacesSnapshot();
  return {
    ok: true,
    profile: getPromoProfile(userId, originUrl, priceLookup),
    demoCashBalance: ws.demoCashBalance,
    rewardLabel: reward.label,
  };
}

export function recordReferralShare(
  userId: string,
  channelRaw: string,
  originUrl: string,
  priceLookup: (sym: string) => number
): { profile: ReferralPromoProfile; demoCashBalance: number; firstShareBonusAwarded: boolean } {
  const channel = sanitizePlainText(channelRaw, 24).toLowerCase() || 'copy';
  const ws = getOrCreateWorkspace(userId, priceLookup);
  const wasZero = ws.promo.shareCount === 0;
  ws.promo.shareCount += 1;
  ws.promo.sharesByChannel[channel] = (ws.promo.sharesByChannel[channel] ?? 0) + 1;

  let firstShareBonusAwarded = false;
  if (wasZero) {
    firstShareBonusAwarded = true;
    ws.promo.bonusDemoUsd += 10_000;
    ws.promo.feeDiscountPct = Math.min(40, ws.promo.feeDiscountPct + 5);
    ws.demoCashBalance = Number((ws.demoCashBalance + 10_000).toFixed(2));
    if (ws.accountMode === 'demo') {
      ws.cashBalance = ws.demoCashBalance;
    }
    ws.promo.recentRewards.unshift({
      code: 'SOCIAL-SHARE-1',
      label: 'First Social Invite Reward (+$10,000 Demo Liquidity + 5% Fee Boost)',
      bonusDemoUsd: 10_000,
      feeDiscountPct: 5,
      redeemedAt: Date.now(),
    });
  }

  persistWorkspacesSnapshot();
  return {
    profile: getPromoProfile(userId, originUrl, priceLookup),
    demoCashBalance: ws.demoCashBalance,
    firstShareBonusAwarded,
  };
}

// --- Zero-Enumeration Password Recovery (10-min SHA-256 single-use code + full session revocation) ---
interface PendingPasswordResetRecord {
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: number;
  attempts: number;
  consumed: boolean;
}

const passwordResetRequestsByEmail = new Map<string, PendingPasswordResetRecord>();

export function requestPasswordReset(
  rawEmail: string,
  meta?: { rawIp?: string; userAgent?: string }
): {
  ok: true;
  message: string;
  expiresInSec: number;
  requiresTotpIfEnrolled: boolean;
  sandboxVerificationCode?: string;
} {
  const email = sanitizePlainText(rawEmail, 120).toLowerCase();
  const genericMessage =
    'If an account matches that email, a 6-digit single-use recovery code (valid for 10 minutes) has been issued.';

  const user = usersByEmail.get(email);
  if (!user) {
    return {
      ok: true,
      message: genericMessage,
      expiresInSec: 600,
      requiresTotpIfEnrolled: false,
    };
  }

  const code = String(crypto.randomInt(100000, 999999));
  const tokenHash = crypto
    .createHash('sha256')
    .update(`nuvra-reset:${user.id}:${email}:${code}`)
    .digest('hex');
  const expiresAt = Date.now() + 10 * 60_000;

  passwordResetRequestsByEmail.set(email, {
    userId: user.id,
    email,
    tokenHash,
    expiresAt,
    attempts: 0,
    consumed: false,
  });

  void recordPasswordResetTokenInCloudSql({
    uid: user.id,
    email: user.email,
    tokenHash,
    expiresAtMs: expiresAt,
  }).catch(() => {});

  recordAuthTelemetryEvent({
    eventType: 'MFA_CHALLENGE_ISSUED',
    outcome: 'CHALLENGE',
    method: 'password',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail: 'Zero-enumeration 10-minute password recovery code generated.',
  });

  return {
    ok: true,
    message: genericMessage,
    expiresInSec: 600,
    requiresTotpIfEnrolled: user.totpEnabled,
    // Provided strictly for local SMTP-free sandbox testing on the non-admin preview/demo environment when no SMTP relay is configured
    sandboxVerificationCode: !process.env.SMTP_HOST ? code : undefined,
  };
}

export function confirmPasswordReset(
  input: {
    email: string;
    code: string;
    newPassword: string;
    totpCode?: string;
  },
  meta?: { rawIp?: string; userAgent?: string }
):
  | { ok: true; message: string; sessionsRevoked: number; userId: string; email: string }
  | { ok: false; status: number; error: string } {
  const email = sanitizePlainText(input.email, 120).toLowerCase();
  const code = String(input.code ?? '').trim();
  const newPassword = String(input.newPassword ?? '');

  if (newPassword.length < 8) {
    return { ok: false, status: 400, error: 'New password must be at least 8 characters long.' };
  }

  const pending = passwordResetRequestsByEmail.get(email);
  const user = usersByEmail.get(email);
  if (!pending || !user || pending.consumed) {
    return { ok: false, status: 400, error: 'Invalid or expired recovery code.' };
  }
  if (Date.now() > pending.expiresAt) {
    passwordResetRequestsByEmail.delete(email);
    return { ok: false, status: 400, error: 'Recovery code has expired. Request a new code.' };
  }
  if (pending.attempts >= 5) {
    return { ok: false, status: 429, error: 'Maximum recovery verification attempts exceeded.' };
  }

  const candidateHash = crypto
    .createHash('sha256')
    .update(`nuvra-reset:${user.id}:${email}:${code}`)
    .digest('hex');
  const codeMatch = crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(pending.tokenHash, 'hex')
  );
  if (!codeMatch) {
    pending.attempts += 1;
    return {
      ok: false,
      status: 400,
      error: `Invalid recovery code (${5 - pending.attempts} attempts remaining).`,
    };
  }

  if (user.totpEnabled && user.totpSecret) {
    const tCode = String(input.totpCode ?? '').trim();
    if (!verifyTotpCode(user.totpSecret, tCode)) {
      return {
        ok: false,
        status: 401,
        error: 'Valid 6-digit Authenticator App TOTP code is required to complete recovery.',
      };
    }
  }

  const { hashHex, saltHex } = hashPassword(newPassword);
  user.passwordHashHex = hashHex;
  user.passwordSaltHex = saltHex;
  pending.consumed = true;
  passwordResetRequestsByEmail.delete(email);

  // Revoke ALL active sessions for account hygiene
  let sessionsRevoked = 0;
  for (const [sid, sess] of sessionsMap.entries()) {
    if (sess.userId === user.id) {
      sessionsMap.delete(sid);
      sessionsRevoked += 1;
    }
  }

  persistUsersSnapshot();
  void consumePasswordResetTokenInCloudSql(pending.tokenHash).catch(() => {});

  recordAuthTelemetryEvent({
    eventType: 'SESSIONS_REVOKED',
    outcome: 'SUCCESS',
    method: 'password',
    userId: user.id,
    email: user.email,
    name: user.name,
    rawIp: meta?.rawIp,
    userAgent: meta?.userAgent,
    detail: `Password rotated via self-service recovery; ${sessionsRevoked} session(s) invalidated.`,
  });

  return {
    ok: true,
    message: `Password updated cleanly. ${sessionsRevoked} prior active session(s) revoked.`,
    sessionsRevoked,
    userId: user.id,
    email: user.email,
  };
}

