import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminServerOverview,
  AuthAuditEvent,
  AuthAuditEventType,
} from '../src/types/market.ts';
import {
  computeLedgerHmac,
  getVaultMasterKeyInfo,
  maskIpString,
  sanitizePlainText,
} from './securityFirewall.ts';

export interface PersistedPasskey {
  id: string;
  credentialIdB64: string;
  spkiPublicKeyB64: string;
  userId: string;
  label: string;
  algorithm: string;
  transports: string[];
  createdAt: number;
  lastUsedAt?: number;
}

export interface PersistedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  experienceMode: 'newbie' | 'pro';
  marketFocus: string;
  contactPhone?: string;
  twoFactorEnabled: boolean;
  totpEnabled: boolean;
  totpSecret?: string;
  backupCodeHashes: string[];
  realMoneyEnabled: boolean;
  linkedProviders: Array<'google' | 'github'>;
  passkeysList: PersistedPasskey[];
  passwordHashHex: string;
  passwordSaltHex: string;
  termsAcceptedAt?: number;
  createdAt: number;
  lastLoginAt: number;
}

interface StoreSnapshot {
  version: number;
  updatedAt: number;
  users: PersistedUser[];
  authEvents: AuthAuditEvent[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const STORE_FILE_PATH = path.join(DATA_DIR, 'meridian-admin-store.json');
const MAX_AUTH_EVENTS = 500;

let authEventsLog: AuthAuditEvent[] = [];
let persistedUsersCache: PersistedUser[] = [];
let writeTimer: NodeJS.Timeout | null = null;
let authEventListener: ((ev: AuthAuditEvent) => void) | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPersistedAdminStore(): {
  users: PersistedUser[];
  authEvents: AuthAuditEvent[];
} {
  try {
    ensureDataDir();
    if (!fs.existsSync(STORE_FILE_PATH)) {
      return { users: [], authEvents: [] };
    }
    const raw = fs.readFileSync(STORE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreSnapshot>;
    persistedUsersCache = Array.isArray(parsed.users) ? parsed.users : [];
    authEventsLog = Array.isArray(parsed.authEvents)
      ? parsed.authEvents.slice(0, MAX_AUTH_EVENTS)
      : [];
    return { users: persistedUsersCache, authEvents: authEventsLog };
  } catch {
    return { users: [], authEvents: [] };
  }
}

function flushStoreSync() {
  try {
    ensureDataDir();
    const tmpPath = `${STORE_FILE_PATH}.tmp`;
    const payload: StoreSnapshot = {
      version: 1,
      updatedAt: Date.now(),
      users: persistedUsersCache,
      authEvents: authEventsLog.slice(0, MAX_AUTH_EVENTS),
    };
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_FILE_PATH);
  } catch {
    // Keep in-memory state intact even if disk write fails in restricted container
  }
}

export function scheduleUsersPersist(users: PersistedUser[]) {
  persistedUsersCache = users;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flushStoreSync();
  }, 150);
  writeTimer.unref();
}

export function flushUsersAndEventsNow(users?: PersistedUser[]) {
  if (users) persistedUsersCache = users;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  flushStoreSync();
}

export function setAuthEventListener(cb: (ev: AuthAuditEvent) => void) {
  authEventListener = cb;
}

export function recordAuthTelemetryEvent(input: {
  eventType: AuthAuditEventType;
  outcome: AuthAuditEvent['outcome'];
  method: AuthAuditEvent['method'];
  userId?: string;
  email: string;
  name?: string;
  role?: string;
  rawIp?: string;
  userAgent?: string;
  detail: string;
}): AuthAuditEvent {
  const now = Date.now();
  const id = `auth-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const prevHash = authEventsLog[0]?.entryHash ?? 'AUTH_GENESIS_000000000000';
  const email = sanitizePlainText(input.email, 120).toLowerCase() || 'unknown';
  const detail = sanitizePlainText(input.detail, 240);
  const maskedIp = maskIpString(input.rawIp ?? '127.0.0.1');
  const userAgent = sanitizePlainText(input.userAgent ?? 'Browser Client', 120) || 'Browser Client';

  const entryHash = computeLedgerHmac(
    prevHash,
    `${id}|${input.eventType}|${input.outcome}|${input.method}|${email}|${maskedIp}|${now}`
  );

  const event: AuthAuditEvent = {
    id,
    eventType: input.eventType,
    outcome: input.outcome,
    method: input.method,
    userId: input.userId,
    email,
    name: input.name ? sanitizePlainText(input.name, 60) : undefined,
    role: input.role ? sanitizePlainText(input.role, 50) : undefined,
    maskedIp,
    userAgent,
    detail,
    prevHash,
    entryHash,
    createdAt: now,
  };

  authEventsLog.unshift(event);
  if (authEventsLog.length > MAX_AUTH_EVENTS) {
    authEventsLog.pop();
  }

  if (!writeTimer) {
    writeTimer = setTimeout(() => {
      writeTimer = null;
      flushStoreSync();
    }, 150);
    writeTimer.unref();
  }

  if (authEventListener) {
    try {
      authEventListener(event);
    } catch {
      // ignore broadcast listener error
    }
  }

  return event;
}

export function listAuthTelemetryEvents(limit = 200): AuthAuditEvent[] {
  return authEventsLog.slice(0, Math.max(1, Math.min(MAX_AUTH_EVENTS, limit)));
}

export function getAuthTelemetrySummary(): {
  totalAuthEvents: number;
  failedAuthEvents: number;
} {
  let failed = 0;
  for (const ev of authEventsLog) {
    if (ev.outcome === 'FAILED' || ev.outcome === 'BLOCKED') {
      failed += 1;
    }
  }
  return {
    totalAuthEvents: authEventsLog.length,
    failedAuthEvents: failed,
  };
}

export function getSafeServerKeyStatus(): AdminServerOverview['keyStatus'] {
  const hasGemini =
    Boolean(process.env.GEMINI_API_KEY) &&
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
  const vaultMasterInfo = getVaultMasterKeyInfo();
  const hasGoogle =
    Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const hasGithub =
    Boolean(process.env.GITHUB_CLIENT_ID) && Boolean(process.env.GITHUB_CLIENT_SECRET);
  const hasGithubPrivateToken = Boolean(process.env.GITHUB_PRIVATE_SERVER_TOKEN);
  const hasGithubCustomHost = Boolean(process.env.GITHUB_SERVER_BASE_URL);
  const hasAppUrl =
    Boolean(process.env.APP_URL) && process.env.APP_URL !== 'MY_APP_URL';

  return [
    {
      keyName: 'GEMINI_API_KEY',
      scope: 'AI Assistant & Thesis Engine (Server-Only)',
      status: hasGemini ? 'CONFIGURED' : 'NOT_SET',
      purpose: 'Powers Gemini 4 Hydrogen live AI Assistant & investment thesis synthesis.',
    },
    {
      keyName: 'VAULT_MASTER_KEY',
      scope: `AES-256-GCM Vault, HMAC Ledger & Session Signing (${vaultMasterInfo.source === 'ENV_VAULT_MASTER_KEY' ? 'ENV' : `Sealed Key #${vaultMasterInfo.fingerprint}`})`,
      status: vaultMasterInfo.configured ? 'CONFIGURED' : 'RUNTIME_EPHEMERAL',
      purpose:
        'Scrypt-derives AES-256-GCM banking rail encryption, HMAC ledger chain, and session HMAC keys persistently across restarts.',
    },
    {
      keyName: 'GOOGLE_CLIENT_ID / SECRET',
      scope: 'Federated Google OAuth 2.0 SSO',
      status: hasGoogle ? 'CONFIGURED' : 'NOT_SET',
      purpose: 'Enables popup OAuth 2.0 login with verified Google accounts.',
    },
    {
      keyName: 'GITHUB_CLIENT_ID / SECRET',
      scope: 'Federated GitHub OAuth & Enterprise SSO',
      status: hasGithub ? 'CONFIGURED' : 'NOT_SET',
      purpose: 'Enables popup OAuth login with GitHub.com or Private GitHub Enterprise Server.',
    },
    {
      keyName: 'GITHUB_PRIVATE_SERVER_TOKEN',
      scope: 'Private GitHub Server & Org Auth Bridge',
      status: hasGithubPrivateToken ? 'CONFIGURED' : 'NOT_SET',
      purpose:
        'Authenticates private GitHub org/repo access and enables Verified Private GitHub Operator sign-in.',
    },
    {
      keyName: 'GITHUB_SERVER_BASE_URL',
      scope: 'Private GitHub Enterprise Origin',
      status: hasGithubCustomHost ? 'CONFIGURED' : 'CONFIGURED',
      purpose: 'Defaults to https://github.com; override for private GitHub Enterprise server.',
    },
    {
      keyName: 'APP_URL',
      scope: 'Origin, WebAuthn RP & OAuth Redirect Base',
      status: hasAppUrl ? 'CONFIGURED' : 'RUNTIME_EPHEMERAL',
      purpose: 'Overrides auto-detected request host for OAuth callbacks, custom domain pinning, and FIDO2 Relying Party ID.',
    },
  ];
}
