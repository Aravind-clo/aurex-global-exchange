import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
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
export const db: Firestore | null = app
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : null;
export const auth: Auth | null = app ? getAuth(app) : null;
export const googleAuthProvider = new GoogleAuthProvider();

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
    const safeDisplayName = (params.displayName || 'Meridian Trader').slice(0, 80);
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
