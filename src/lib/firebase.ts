import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function isValidGoogleApiKeyFormat(key: string): boolean {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key.trim());
}

function maskApiKeyPreview(key: string): string {
  const clean = key.trim();
  if (!clean) return 'NOT_SET';
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••`;
  return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
}

const rawEnvApiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() || '';
const envKeyValidFormat = rawEnvApiKey.length > 0 && isValidGoogleApiKeyFormat(rawEnvApiKey);
const envKeyIgnoredAsInvalid = rawEnvApiKey.length > 0 && !envKeyValidFormat;
const fallbackConfigApiKey = ((firebaseConfig as { apiKey?: string }).apiKey ?? '').trim();
const configKeyValidFormat = isValidGoogleApiKeyFormat(fallbackConfigApiKey);

const resolvedApiKey = envKeyValidFormat
  ? rawEnvApiKey
  : configKeyValidFormat
  ? fallbackConfigApiKey
  : '';

const resolvedApiKeySource: 'VITE_FIREBASE_API_KEY' | 'firebase-applet-config.json' | 'NONE' =
  envKeyValidFormat
    ? 'VITE_FIREBASE_API_KEY'
    : configKeyValidFormat
    ? 'firebase-applet-config.json'
    : 'NONE';

export interface FirebaseDiagnosticLogEntry {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  subsystem: 'CONFIG' | 'FIRESTORE' | 'AUTH' | 'GMAIL_OAUTH';
  code: string;
  message: string;
  hint?: string;
}

export interface FirebaseDiagnosticsSnapshot {
  projectId: string;
  authDomain: string;
  firestoreDatabaseId: string;
  usingNamedDatabase: boolean;
  apiKeySource: 'VITE_FIREBASE_API_KEY' | 'firebase-applet-config.json' | 'NONE';
  apiKeyFormatValid: boolean;
  maskedApiKeyPreview: string;
  envOverrideIgnored: boolean;
  envOverridePreview: string | null;
  oAuthClientConfigured: boolean;
  gmailConnected: boolean;
  gmailEmail: string | null;
  connectionStatus: 'UNTESTED' | 'HEALTHY' | 'CONFIG_ERROR' | 'AUTH_REQUIRED' | 'OFFLINE';
  lastProbeLatencyMs: number | null;
  lastCheckedAt: number | null;
  logs: FirebaseDiagnosticLogEntry[];
}

const firebaseDiagnosticLogs: FirebaseDiagnosticLogEntry[] = [];
let diagConnectionStatus: FirebaseDiagnosticsSnapshot['connectionStatus'] = 'UNTESTED';
let diagLastLatencyMs: number | null = null;
let diagLastCheckedAt: number | null = null;

function pushFirebaseDiagLog(entry: Omit<FirebaseDiagnosticLogEntry, 'id' | 'timestamp'>): void {
  firebaseDiagnosticLogs.unshift({
    ...entry,
    id: `fb-diag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  });
  if (firebaseDiagnosticLogs.length > 40) {
    firebaseDiagnosticLogs.length = 40;
  }
}

if (envKeyIgnoredAsInvalid) {
  pushFirebaseDiagLog({
    level: 'WARN',
    subsystem: 'CONFIG',
    code: 'INVALID_ENV_API_KEY_IGNORED',
    message: `Runtime VITE_FIREBASE_API_KEY (${maskApiKeyPreview(rawEnvApiKey)}) does not match Google AIza... format and was rejected.`,
    hint: 'Set VITE_FIREBASE_API_KEY in your .env or runtime Secrets Manager to a valid AIza... Web API key restricted by HTTP referrer.',
  });
} else if (!resolvedApiKey) {
  pushFirebaseDiagLog({
    level: 'WARN',
    subsystem: 'CONFIG',
    code: 'MISSING_VITE_FIREBASE_API_KEY',
    message: 'VITE_FIREBASE_API_KEY is not set; hardcoded apiKey was removed from firebase-applet-config.json.',
    hint: 'Provide a referrer-restricted AIza... Firebase Web API key via VITE_FIREBASE_API_KEY in .env or deployment secrets.',
  });
}

const optionalDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId?.trim();
if (!optionalDatabaseId) {
  pushFirebaseDiagLog({
    level: 'WARN',
    subsystem: 'FIRESTORE',
    code: 'DEFAULT_DATABASE_FALLBACK',
    message: "No 'firestoreDatabaseId' configured; Firestore SDK will attempt '(default)' database.",
    hint: "Provision Firestore or set 'firestoreDatabaseId' in firebase-applet-config.json to match your Cloud Firestore database ID.",
  });
}

const app: FirebaseApp | null = resolvedApiKey
  ? initializeApp({ ...firebaseConfig, apiKey: resolvedApiKey })
  : null;
export const db: Firestore | null = app
  ? optionalDatabaseId
    ? getFirestore(app, optionalDatabaseId)
    : getFirestore(app)
  : null;
export const auth: Auth | null = app ? getAuth(app) : null;
export const googleAuthProvider = new GoogleAuthProvider();

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'] as const;
const gmailAlertProvider = new GoogleAuthProvider();
gmailAlertProvider.addScope('https://www.googleapis.com/auth/gmail.send');

// In-memory cache ONLY for Gmail OAuth access token (never stored in localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;
let cachedGmailConnectedEmail: string | null = null;

if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedGmailAccessToken = null;
      cachedGmailConnectedEmail = null;
    }
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  pushFirebaseDiagLog({
    level: 'ERROR',
    subsystem: 'FIRESTORE',
    code: 'FIRESTORE_OPERATION_FAILED',
    message: `${operationType.toUpperCase()} ${path ?? '(unknown)'}: ${errInfo.error}`,
  });
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getFirebaseDiagnostics(): FirebaseDiagnosticsSnapshot {
  return {
    projectId: firebaseConfig.projectId || 'UNSET',
    authDomain: firebaseConfig.authDomain || 'UNSET',
    firestoreDatabaseId: optionalDatabaseId || '(default)',
    usingNamedDatabase: Boolean(optionalDatabaseId),
    apiKeySource: resolvedApiKeySource,
    apiKeyFormatValid: isValidGoogleApiKeyFormat(resolvedApiKey),
    maskedApiKeyPreview: maskApiKeyPreview(resolvedApiKey),
    envOverrideIgnored: envKeyIgnoredAsInvalid,
    envOverridePreview: envKeyIgnoredAsInvalid ? maskApiKeyPreview(rawEnvApiKey) : null,
    oAuthClientConfigured: Boolean((firebaseConfig as { oAuthClientId?: string }).oAuthClientId),
    gmailConnected: Boolean(cachedGmailAccessToken),
    gmailEmail: cachedGmailConnectedEmail,
    connectionStatus: diagConnectionStatus,
    lastProbeLatencyMs: diagLastLatencyMs,
    lastCheckedAt: diagLastCheckedAt,
    logs: [...firebaseDiagnosticLogs],
  };
}

export function clearFirebaseDiagnosticLogs(): void {
  firebaseDiagnosticLogs.length = 0;
}

export const FIREBASE_RUNTIME_FLAGS = {
  API_KEY_VALID: 0b00000001,
  ENV_OVERRIDE_USED: 0b00000010,
  NAMED_FIRESTORE_DB: 0b00000100,
  OAUTH_CLIENT_SET: 0b00001000,
  ENV_INVALID_IGNORED: 0b00010000,
} as const;

export function getFirebaseConfigBitmask(): { value: number; binary: string } {
  let mask = 0;
  if (isValidGoogleApiKeyFormat(resolvedApiKey)) mask |= FIREBASE_RUNTIME_FLAGS.API_KEY_VALID;
  if (resolvedApiKeySource === 'VITE_FIREBASE_API_KEY') mask |= FIREBASE_RUNTIME_FLAGS.ENV_OVERRIDE_USED;
  if (Boolean(optionalDatabaseId)) mask |= FIREBASE_RUNTIME_FLAGS.NAMED_FIRESTORE_DB;
  if (Boolean((firebaseConfig as { oAuthClientId?: string }).oAuthClientId)) {
    mask |= FIREBASE_RUNTIME_FLAGS.OAUTH_CLIENT_SET;
  }
  if (envKeyIgnoredAsInvalid) mask |= FIREBASE_RUNTIME_FLAGS.ENV_INVALID_IGNORED;
  return {
    value: mask,
    binary: `0b${mask.toString(2).padStart(8, '0')}`,
  };
}

export async function fetchRuntimeFirebaseConfig(): Promise<{
  config: Record<string, string>;
  meta?: { apiKeySource: string; securityBitmask: number; securityBitmaskBinary: string };
} | null> {
  try {
    const res = await fetch('/api/v1/firebase/runtime-config', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as {
      config: Record<string, string>;
      meta?: { apiKeySource: string; securityBitmask: number; securityBitmaskBinary: string };
    };
  } catch {
    return null;
  }
}

export async function runFirebaseDiagnosticsProbe(): Promise<FirebaseDiagnosticsSnapshot> {
  const t0 = performance.now();
  diagLastCheckedAt = Date.now();

  // 1. Validate Identity Toolkit API Key reachability
  if (resolvedApiKey && isValidGoogleApiKeyFormat(resolvedApiKey)) {
    try {
      const idpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(resolvedApiKey)}`
      );
      if (idpRes.ok) {
        pushFirebaseDiagLog({
          level: 'INFO',
          subsystem: 'AUTH',
          code: 'IDENTITY_TOOLKIT_OK',
          message: `Firebase Auth API key (${maskApiKeyPreview(resolvedApiKey)}) accepted by Identity Toolkit for project ${firebaseConfig.projectId}.`,
        });
      } else {
        const bodyText = await idpRes.text().catch(() => '');
        pushFirebaseDiagLog({
          level: 'ERROR',
          subsystem: 'AUTH',
          code: `IDENTITY_TOOLKIT_${idpRes.status}`,
          message: `Identity Toolkit rejected API key with HTTP ${idpRes.status}. ${bodyText.slice(0, 140)}`,
          hint: 'Verify the API key in Google Cloud Console has Identity Toolkit API enabled and allows this domain referrer.',
        });
      }
    } catch (err) {
      pushFirebaseDiagLog({
        level: 'WARN',
        subsystem: 'AUTH',
        code: 'IDENTITY_TOOLKIT_NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unable to reach Identity Toolkit endpoint.',
      });
    }
  } else {
    pushFirebaseDiagLog({
      level: 'ERROR',
      subsystem: 'CONFIG',
      code: 'MISSING_OR_INVALID_API_KEY',
      message: 'No valid AIza... Firebase Web API key is active.',
      hint: 'Set VITE_FIREBASE_API_KEY or provision Firebase config via AI Studio.',
    });
  }

  // 2. Test Firestore server connection against configured databaseId
  if (!db) {
    diagConnectionStatus = 'CONFIG_ERROR';
    pushFirebaseDiagLog({
      level: 'ERROR',
      subsystem: 'FIRESTORE',
      code: 'FIRESTORE_NOT_INITIALIZED',
      message: 'Firestore client instance is null because Firebase app did not initialize.',
    });
    return getFirebaseDiagnostics();
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    diagLastLatencyMs = Math.round(performance.now() - t0);
    diagConnectionStatus = 'HEALTHY';
    pushFirebaseDiagLog({
      level: 'INFO',
      subsystem: 'FIRESTORE',
      code: 'FIRESTORE_CONNECTED',
      message: `Connected to Firestore database '${optionalDatabaseId || '(default)'}' in ${diagLastLatencyMs}ms.`,
    });
  } catch (error) {
    diagLastLatencyMs = Math.round(performance.now() - t0);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Database') && msg.includes('not found')) {
      diagConnectionStatus = 'CONFIG_ERROR';
      pushFirebaseDiagLog({
        level: 'ERROR',
        subsystem: 'FIRESTORE',
        code: 'FIRESTORE_DB_NOT_FOUND',
        message: msg,
        hint: "Ensure getFirestore(app, firebaseConfig.firestoreDatabaseId) uses the provisioned Enterprise database ID rather than '(default)'.",
      });
    } else if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient permissions')) {
      // Expected when unauthenticated against fail-closed default-deny firestore.rules; proves database endpoint IS reachable!
      diagConnectionStatus = 'AUTH_REQUIRED';
      pushFirebaseDiagLog({
        level: 'INFO',
        subsystem: 'FIRESTORE',
        code: 'FIRESTORE_REACHABLE_RULES_ACTIVE',
        message: `Firestore database '${optionalDatabaseId || '(default)'}' reachable (${diagLastLatencyMs}ms); fail-closed security rules enforced.`,
      });
    } else if (msg.includes('the client is offline')) {
      diagConnectionStatus = 'OFFLINE';
      pushFirebaseDiagLog({
        level: 'ERROR',
        subsystem: 'FIRESTORE',
        code: 'CLIENT_OFFLINE',
        message: 'Firestore client reported offline or unreachable backend.',
        hint: 'Check CSP connect-src (firestore.googleapis.com), projectId, and firestoreDatabaseId.',
      });
      console.error('Please check your Firebase configuration.');
    } else {
      diagConnectionStatus = 'CONFIG_ERROR';
      pushFirebaseDiagLog({
        level: 'WARN',
        subsystem: 'FIRESTORE',
        code: 'FIRESTORE_PROBE_ERROR',
        message: msg,
      });
    }
  }

  return getFirebaseDiagnostics();
}

async function testConnection() {
  await runFirebaseDiagnosticsProbe();
}

void testConnection();

export async function syncFirebaseUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  marketFocus?: string;
  experienceMode?: 'newbie' | 'pro';
}): Promise<void> {
  if (!db) return;
  const safeUid = params.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!safeUid) return;

  const profilePath = `users/${safeUid}`;
  const privatePath = `users/${safeUid}/private/info`;

  try {
    const profileRef = doc(db, 'users', safeUid);
    const existing = await getDoc(profileRef);
    const safeDisplayName = (params.displayName || 'Nuvra Trader').slice(0, 80);
    const safeMarketFocus = (params.marketFocus || 'Global Multi-Asset').slice(0, 64);
    const safeExp = params.experienceMode === 'pro' ? 'pro' : 'newbie';

    if (!existing.exists()) {
      await setDoc(profileRef, {
        uid: safeUid,
        displayName: safeDisplayName,
        marketFocus: safeMarketFocus,
        experienceMode: safeExp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        profileRef,
        {
          displayName: safeDisplayName,
          marketFocus: safeMarketFocus,
          experienceMode: safeExp,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  try {
    const privateRef = doc(db, 'users', safeUid, 'private', 'info');
    const existingPrivate = await getDoc(privateRef);
    const safeEmail = (params.email || '').slice(0, 160);
    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        uid: safeUid,
        email: safeEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        privateRef,
        {
          email: safeEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function syncWatchlistSymbolToFirestore(
  symbol: string,
  note = ''
): Promise<void> {
  if (!db || !auth) return;
  const current = auth.currentUser;
  if (!current || !current.emailVerified) return;
  const safeUid = current.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const safeSymbol = symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 24);
  if (!safeUid || !safeSymbol) return;
  const itemPath = `users/${safeUid}/watchlists/${safeSymbol}`;

  try {
    const itemRef = doc(db, 'users', safeUid, 'watchlists', safeSymbol);
    const existing = await getDoc(itemRef);
    if (!existing.exists()) {
      await setDoc(itemRef, {
        ownerId: safeUid,
        symbol: safeSymbol,
        note: note.slice(0, 240),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        itemRef,
        {
          note: note.slice(0, 240),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, itemPath);
  }
}

function resolveVerifiedFirebaseOwner(): string | null {
  if (!db || !auth?.currentUser || !auth.currentUser.emailVerified) return null;
  const safeUid = auth.currentUser.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return safeUid || null;
}

export async function syncWalletChainToFirestore(params: {
  chain: 'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX';
  assetSymbol: string;
  depositAddress: string;
  dailyLimitUsd: number;
  strictAllowlist: boolean;
}): Promise<void> {
  const safeUid = resolveVerifiedFirebaseOwner();
  if (!db || !safeUid) return;
  const safeChain = params.chain;
  const safeAsset = params.assetSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const safeAddress = params.depositAddress.replace(/[^a-zA-Z0-9]/g, '').slice(0, 128);
  const safeDailyLimit = Math.min(Math.max(0, Number(params.dailyLimitUsd) || 0), 10_000_000);
  if (!safeAsset || safeAddress.length < 16) return;

  const docPath = `users/${safeUid}/wallets/${safeChain}`;
  try {
    const ref = doc(db, 'users', safeUid, 'wallets', safeChain);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: safeUid,
        chain: safeChain,
        assetSymbol: safeAsset,
        depositAddress: safeAddress,
        dailyLimitUsd: safeDailyLimit,
        strictAllowlist: Boolean(params.strictAllowlist),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          dailyLimitUsd: safeDailyLimit,
          strictAllowlist: Boolean(params.strictAllowlist),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function syncAllowlistEntryToFirestore(params: {
  id: string;
  label: string;
  chain: 'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX';
  address: string;
  enabled: boolean;
  threatStatus: 'CLEAN' | 'SUSPICIOUS' | 'BLOCKED';
}): Promise<void> {
  const safeUid = resolveVerifiedFirebaseOwner();
  if (!db || !safeUid) return;
  const safeId = params.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const safeLabel = (params.label || 'Verified Destination').trim().slice(0, 64);
  const safeAddress = params.address.replace(/[^a-zA-Z0-9]/g, '').slice(0, 128);
  if (!safeId || !safeLabel || safeAddress.length < 16) return;

  const docPath = `users/${safeUid}/allowlists/${safeId}`;
  try {
    const ref = doc(db, 'users', safeUid, 'allowlists', safeId);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: safeUid,
        label: safeLabel,
        chain: params.chain,
        address: safeAddress,
        enabled: Boolean(params.enabled),
        threatStatus: params.threatStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          label: safeLabel,
          enabled: Boolean(params.enabled),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteAllowlistEntryFromFirestore(entryId: string): Promise<void> {
  const safeUid = resolveVerifiedFirebaseOwner();
  if (!db || !safeUid) return;
  const safeId = entryId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!safeId) return;
  const docPath = `users/${safeUid}/allowlists/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'allowlists', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function syncSecurityAuditToFirestore(params: {
  auditId: string;
  overallScorePct: number;
  passedCount: number;
  warnCount: number;
  failCount: number;
  summary: string;
}): Promise<void> {
  const safeUid = resolveVerifiedFirebaseOwner();
  if (!db || !safeUid) return;
  const safeId = params.auditId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const safeSummary = (params.summary || 'Runtime security scan completed').slice(0, 240);
  if (!safeId || safeSummary.length < 4) return;
  const docPath = `users/${safeUid}/securityAudits/${safeId}`;
  try {
    const ref = doc(db, 'users', safeUid, 'securityAudits', safeId);
    await setDoc(ref, {
      ownerId: safeUid,
      overallScorePct: Math.min(100, Math.max(0, Math.round(params.overallScorePct))),
      passedCount: Math.max(0, Math.round(params.passedCount)),
      warnCount: Math.max(0, Math.round(params.warnCount)),
      failCount: Math.max(0, Math.round(params.failCount)),
      summary: safeSummary,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function syncNotificationToFirestore(params: {
  id: string;
  category: 'SECURITY_429' | 'VERIFICATION' | 'COIN_LAUNCH' | 'PASSWORD_RECOVERY' | 'TRADING' | 'LIMIT_BREACH';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  read: boolean;
}): Promise<void> {
  const safeUid = resolveVerifiedFirebaseOwner();
  if (!db || !safeUid) return;
  const safeId = params.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const safeTitle = (params.title || 'Platform Alert').slice(0, 120);
  const safeMsg = (params.message || 'Security telemetry update').slice(0, 400);
  if (!safeId || safeTitle.length < 2 || safeMsg.length < 2) return;
  const docPath = `users/${safeUid}/notifications/${safeId}`;
  try {
    const ref = doc(db, 'users', safeUid, 'notifications', safeId);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: safeUid,
        category: params.category,
        severity: params.severity,
        title: safeTitle,
        message: safeMsg,
        read: Boolean(params.read),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          read: Boolean(params.read),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function syncVerificationStatusToFirestore(params: {
  profileVerified: boolean;
  documentStatus: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
  bankVerificationStatus: 'NOT_STARTED' | 'MICRO_DEPOSIT_SENT' | 'VERIFIED' | 'FAILED';
  overallTier: string;
}): Promise<void> {
  const safeUid = resolveVerifiedFirebaseOwner();
  if (!db || !safeUid) return;
  const docPath = `users/${safeUid}/verifications/primary`;
  const safeTier = (params.overallTier || 'Unverified').slice(0, 48);
  if (safeTier.length < 4) return;
  try {
    const ref = doc(db, 'users', safeUid, 'verifications', 'primary');
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: safeUid,
        profileVerified: Boolean(params.profileVerified),
        documentStatus: params.documentStatus,
        bankVerificationStatus: params.bankVerificationStatus,
        overallTier: safeTier,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          profileVerified: Boolean(params.profileVerified),
          documentStatus: params.documentStatus,
          bankVerificationStatus: params.bankVerificationStatus,
          overallTier: safeTier,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function syncCoinLaunchToFirestore(params: {
  id: string;
  symbol: string;
  name: string;
  chain: 'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'ARB' | 'BASE' | 'TRX';
  status: 'PENDING_REVIEW' | 'APPROVED_LISTED' | 'REJECTED';
}): Promise<void> {
  const safeUid = resolveVerifiedFirebaseOwner();
  if (!db || !safeUid) return;
  const safeId = params.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const safeSym = params.symbol.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  const safeName = (params.name || safeSym).slice(0, 64);
  if (!safeId || safeSym.length < 2 || safeName.length < 2) return;
  const docPath = `users/${safeUid}/coinLaunches/${safeId}`;
  try {
    const ref = doc(db, 'users', safeUid, 'coinLaunches', safeId);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: safeUid,
        symbol: safeSym,
        name: safeName,
        chain: params.chain,
        status: params.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function getGmailConnectionStatus(): { connected: boolean; email: string | null } {
  return {
    connected: Boolean(cachedGmailAccessToken),
    email: cachedGmailConnectedEmail,
  };
}

export async function connectAdminGmailAlerts(): Promise<{
  ok: boolean;
  email?: string;
  error?: string;
}> {
  if (!auth) {
    pushFirebaseDiagLog({
      level: 'ERROR',
      subsystem: 'GMAIL_OAUTH',
      code: 'AUTH_NOT_INITIALIZED',
      message: 'Firebase Auth is not initialized (missing valid Web API key).',
    });
    return { ok: false, error: 'Firebase client auth is not initialized.' };
  }
  try {
    const result = await signInWithPopup(auth, gmailAlertProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      pushFirebaseDiagLog({
        level: 'WARN',
        subsystem: 'GMAIL_OAUTH',
        code: 'MISSING_GMAIL_ACCESS_TOKEN',
        message: 'Google Sign-In completed without a gmail.send OAuth access token.',
      });
      return { ok: false, error: 'Gmail permission token was not granted.' };
    }
    cachedGmailAccessToken = credential.accessToken;
    cachedGmailConnectedEmail = result.user.email ?? null;
    pushFirebaseDiagLog({
      level: 'INFO',
      subsystem: 'GMAIL_OAUTH',
      code: 'GMAIL_CHANNEL_CONNECTED',
      message: `Connected Gmail alert channel for ${result.user.email ?? 'Google Account'} (in-memory token).`,
    });
    return { ok: true, email: result.user.email ?? undefined };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : 'Unable to connect Gmail alert channel.';
    let hint = 'Verify browser popups are allowed and retry connecting your Google Account.';
    if (rawMsg.includes('api-key-not-valid')) {
      hint = 'Ensure VITE_FIREBASE_API_KEY (if set) is a valid AIza... key for project root-deployment-wflln.';
    } else if (rawMsg.includes('unauthorized-domain')) {
      hint = 'Add the active origin hostname under Firebase Console -> Authentication -> Settings -> Authorized domains.';
    } else if (rawMsg.includes('popup-closed-by-user') || rawMsg.includes('popup-blocked')) {
      hint = 'Allow popups for this site and complete the Google consent dialog.';
    }
    pushFirebaseDiagLog({
      level: 'ERROR',
      subsystem: 'GMAIL_OAUTH',
      code: 'GMAIL_OAUTH_FAILED',
      message: rawMsg,
      hint,
    });
    return {
      ok: false,
      error: `${rawMsg} (${hint})`,
    };
  }
}

export function disconnectAdminGmailAlerts(): void {
  cachedGmailAccessToken = null;
  cachedGmailConnectedEmail = null;
}

export async function sendAdminAlertViaGmail(params: {
  toEmail: string;
  subject: string;
  bodyText: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!cachedGmailAccessToken) {
    return { ok: false, error: 'Connect Gmail first to send admin email alerts.' };
  }
  const cleanTo = params.toEmail.replace(/[\r\n]/g, '').trim();
  const cleanSubj = params.subject.replace(/[\r\n]/g, ' ').trim();
  const mime = [
    `To: ${cleanTo}`,
    `Subject: ${cleanSubj}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    params.bodyText,
  ].join('\r\n');

  const bytes = new TextEncoder().encode(mime);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const raw = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cachedGmailAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        cachedGmailAccessToken = null;
      }
      const errBody = await res.json().catch(() => ({}));
      const msg = (errBody as { error?: { message?: string } })?.error?.message;
      return { ok: false, error: msg ?? `Gmail API returned ${res.status}.` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch {
    return { ok: false, error: 'Network error communicating with Gmail API.' };
  }
}


