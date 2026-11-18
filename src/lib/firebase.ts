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

const resolvedApiKey =
  (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() ||
  firebaseConfig.apiKey ||
  '';

const app: FirebaseApp | null = resolvedApiKey
  ? initializeApp({ ...firebaseConfig, apiKey: resolvedApiKey })
  : null;
const optionalDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
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
    return { ok: false, error: 'Firebase client auth is not initialized.' };
  }
  try {
    const result = await signInWithPopup(auth, gmailAlertProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      return { ok: false, error: 'Gmail permission token was not granted.' };
    }
    cachedGmailAccessToken = credential.accessToken;
    cachedGmailConnectedEmail = result.user.email ?? null;
    return { ok: true, email: result.user.email ?? undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to connect Gmail alert channel.',
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


