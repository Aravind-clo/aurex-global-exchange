import express from 'express';
import {
  extractSessionFromReq,
  findOrCreateOAuthUser,
  getAuthStats,
  getOrCreateWorkspace,
  isFounderEmail,
} from './authEngine.ts';
import { listAuthTelemetryEvents } from './adminTelemetryStore.ts';
import { probePrivateGitHubServer, verifyGitHubPrivateServerSignIn } from './githubServerAuth.ts';
import { validateGitHubOAuthCredentials, validateGoogleOAuthCredentials } from './mfaAuthEngine.ts';
import { extractRawClientIp } from './securityFirewall.ts';
import { adminAuth } from '../src/lib/firebase-admin.ts';
import { requireAuth, type AuthRequest } from '../src/middleware/auth.ts';
import { getOrCreateUser, getUserOrdersByUid, recordAuthAuditInCloudSql } from '../src/db/users.ts';

export interface AuthServerDeps {
  getPrice: (symbol: string) => number;
  setAuthCookie: (req: express.Request, res: express.Response, token: string) => void;
}

export function createAuthServerRouter(deps: AuthServerDeps): express.Router {
  const router = express.Router();

  // Instant connectivity & readiness ping used by AuthScreen to confirm server reachability
  router.get('/server-health', async (req, res) => {
    const session = extractSessionFromReq(req);
    const isFounder = Boolean(session && isFounderEmail(session.user.email));
    const github = await probePrivateGitHubServer(false);
    const googleCheck = validateGoogleOAuthCredentials();
    const githubCheck = validateGitHubOAuthCredentials();

    if (!isFounder) {
      res.json({
        ok: true,
        service: 'Nuvra Secure Authentication Gateway',
        mode: 'zero-trust-shield',
        uptimeSec: Math.round(process.uptime()),
        timestamp: Date.now(),
        oauth: {
          invalidClientShieldActive: true,
          googleReady: googleCheck.ok,
          githubReady: githubCheck.ok,
        },
        privateGitHubSignInAvailable: Boolean(github?.oauthConfigured || github?.privateTokenConfigured),
      });
      return;
    }

    const stats = getAuthStats();
    res.json({
      ok: true,
      service: 'Nuvra Dedicated Authentication, Registration & GitHub OAuth Server',
      mode: process.env.PRIVATE_AUTH_SERVER_URL ? 'proxied-private' : 'embedded-express',
      uptimeSec: Math.round(process.uptime()),
      timestamp: Date.now(),
      stats: {
        totalUsers: stats.totalUsers,
        activeSessions: stats.activeSessions,
        authEventsLogged: listAuthTelemetryEvents(500).length,
      },
      oauth: {
        invalidClientShieldActive: true,
        googleReady: googleCheck.ok,
        githubReady: githubCheck.ok,
      },
      privateGitHubSignInAvailable: Boolean(github?.oauthConfigured || github?.privateTokenConfigured),
      githubPrivateServer: github,
    });
  });

  // Explicit Private GitHub Server diagnostics (Founder-only)
  router.get('/github/server-status', async (req, res) => {
    const session = extractSessionFromReq(req);
    if (!session || !isFounderEmail(session.user.email)) {
      res.status(403).json({ error: 'Founder Admin privileges required for private GitHub server diagnostics.' });
      return;
    }
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const status = await probePrivateGitHubServer(refresh);
    res.json(status);
  });

  // Authenticate via Private GitHub Server Identity Token (when GITHUB_PRIVATE_SERVER_TOKEN is set)
  router.post('/github/private-signin', async (req, res) => {
    const verified = await verifyGitHubPrivateServerSignIn();
    if (!verified.ok) {
      res.status(400).json({ error: verified.error });
      return;
    }

    const result = findOrCreateOAuthUser(
      {
        provider: 'github',
        email: verified.email,
        name: verified.name,
      },
      {
        userAgent: `${req.headers['user-agent'] ?? 'Browser'} (GitHub Private Server @${verified.login})`,
        rawIp: extractRawClientIp(req),
      },
      deps.getPrice
    );

    if (result.mfaRequired) {
      res.json({
        mfaRequired: true,
        mfaChallenge: result.mfaChallenge,
      });
      return;
    }

    getOrCreateWorkspace(result.user.id, deps.getPrice);
    deps.setAuthCookie(req, res, result.token);
    res.json({
      ok: true,
      user: result.user,
      token: result.token,
      githubOperator: verified.login,
      orgs: verified.orgs,
    });
  });

  // Firebase Auth ID Token Verification + Cloud SQL User Sync
  router.post('/firebase', async (req, res) => {
    const { idToken } = (req.body ?? {}) as { idToken?: string };
    if (!idToken || typeof idToken !== 'string') {
      res.status(400).json({ error: 'Missing Firebase ID token.' });
      return;
    }

    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = decoded.email;
      if (!email) {
        res.status(400).json({ error: 'Firebase account did not include a verified email address.' });
        return;
      }

      const displayName =
        (typeof decoded.name === 'string' && decoded.name.trim()) ||
        email.split('@')[0] ||
        'Nuvra Trader';

      const result = findOrCreateOAuthUser(
        {
          provider: 'google',
          email,
          name: displayName,
        },
        {
          userAgent: `${req.headers['user-agent'] ?? 'Browser'} (Firebase Google Auth)`,
          rawIp: extractRawClientIp(req),
        },
        deps.getPrice
      );

      if (result.mfaRequired) {
        void getOrCreateUser(decoded.uid, email, {
          displayName,
        }).catch(() => {});
        res.json({
          ok: true,
          mfaRequired: true,
          mfaChallenge: result.mfaChallenge,
        });
        return;
      }

      // Sync verified Firebase UID + workspace to Cloud SQL PostgreSQL lazily
      void getOrCreateUser(decoded.uid, email, {
        displayName,
        role: result.user.role,
        isAdmin: result.user.isAdmin,
        marketFocus: result.user.marketFocus,
        realMoneyEnabled: result.user.realMoneyEnabled,
      })
        .then(() =>
          recordAuthAuditInCloudSql({
            uid: decoded.uid,
            email,
            eventType: 'FIREBASE_LOGIN',
            provider: 'firebase-google',
            outcome: 'SUCCESS',
            detail: 'Verified Firebase ID token via adminAuth',
          })
        )
        .catch(() => {});

      getOrCreateWorkspace(result.user.id, deps.getPrice);
      deps.setAuthCookie(req, res, result.token);
      res.json({
        ok: true,
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
    }
  });

  // Protected Cloud SQL profile endpoint (Firebase ID token required)
  router.get('/cloudsql/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email ?? '';
      if (!uid) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const userRecord = await getOrCreateUser(uid, email, {
        displayName: typeof req.user?.name === 'string' ? req.user.name : undefined,
      });
      const orders = await getUserOrdersByUid(uid);
      res.json({ user: userRecord, orders });
    } catch (error: unknown) {
      console.error('Failed to load Cloud SQL profile:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load profile',
      });
    }
  });

  return router;
}
