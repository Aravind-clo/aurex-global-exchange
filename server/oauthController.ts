import express from 'express';
import {
  createOAuthAuthorizationUrl,
  exchangeOAuthCallback,
  getOAuthProviderConfigs,
  resolveAppBaseUrl,
  validateGitHubOAuthCredentials,
  validateGoogleOAuthCredentials,
} from './mfaAuthEngine.ts';
import {
  extractSessionFromReq,
  findOrCreateOAuthUser,
  getOrCreateWorkspace,
  isFounderEmail,
  SESSION_COOKIE_NAME,
} from './authEngine.ts';
import { recordAuthTelemetryEvent } from './adminTelemetryStore.ts';
import { extractRawClientIp } from './securityFirewall.ts';

export interface OAuthControllerDeps {
  getPrice: (symbol: string) => number;
  isHttpsContext: (req: express.Request) => boolean;
  setAuthCookie: (req: express.Request, res: express.Response, token: string) => void;
}

function deriveCandidateUrls(req: express.Request, isHttps: boolean): {
  activeBaseUrl: string;
  devCallbackGoogle: string;
  sharedCallbackGoogle: string;
  devCallbackGithub: string;
  sharedCallbackGithub: string;
} {
  const reqOrigin =
    typeof req.headers.origin === 'string' && /^https?:\/\//i.test(req.headers.origin)
      ? req.headers.origin
      : `${isHttps ? 'https' : 'http'}://${req.headers.host || 'localhost:3000'}`;

  const activeBaseUrl = resolveAppBaseUrl(reqOrigin);
  const devBase = activeBaseUrl.includes('ais-pre-')
    ? activeBaseUrl.replace('ais-pre-', 'ais-dev-')
    : activeBaseUrl;
  const sharedBase = activeBaseUrl.includes('ais-dev-')
    ? activeBaseUrl.replace('ais-dev-', 'ais-pre-')
    : activeBaseUrl;

  return {
    activeBaseUrl,
    devCallbackGoogle: `${devBase}/api/v1/auth/oauth/google/callback`,
    sharedCallbackGoogle: `${sharedBase}/api/v1/auth/oauth/google/callback`,
    devCallbackGithub: `${devBase}/api/v1/auth/oauth/github/callback`,
    sharedCallbackGithub: `${sharedBase}/api/v1/auth/oauth/github/callback`,
  };
}

export function createOAuthControllerRouter(deps: OAuthControllerDeps): express.Router {
  const router = express.Router();

  router.get('/providers', (req, res) => {
    const reqOrigin =
      typeof req.headers.origin === 'string' && /^https?:\/\//i.test(req.headers.origin)
        ? req.headers.origin
        : `${deps.isHttpsContext(req) ? 'https' : 'http'}://${req.headers.host || 'localhost:3000'}`;
    const baseUrl = resolveAppBaseUrl(reqOrigin);
    res.json({ providers: getOAuthProviderConfigs(baseUrl) });
  });

  router.get('/diagnostics', async (req, res) => {
    const session = extractSessionFromReq(req);
    if (!session || !isFounderEmail(session.user.email)) {
      res.status(403).json({ error: 'Founder Admin privileges required for OAuth diagnostics.' });
      return;
    }
    const urls = deriveCandidateUrls(req, deps.isHttpsContext(req));
    const googleCheck = validateGoogleOAuthCredentials();
    const githubCheck = validateGitHubOAuthCredentials();
    const { probePrivateGitHubServer } = await import('./githubServerAuth.ts');
    const githubPrivateServer = await probePrivateGitHubServer(false);

    res.json({
      controller: 'Aurex OAuth 2.0 Pre-Flight & Callback Controller',
      activeBaseUrl: urls.activeBaseUrl,
      sessionCookieName: SESSION_COOKIE_NAME,
      bearerFallbackEnabled: true,
      invalidClientShieldActive: true,
      githubPrivateServer,
      providers: {
        google: {
          configured: googleCheck.ok,
          reason: googleCheck.ok ? 'Valid .apps.googleusercontent.com Client ID & Secret detected' : googleCheck.reason,
          activeCallbackUrl: `${urls.activeBaseUrl}/api/v1/auth/oauth/google/callback`,
          devCallbackUrl: urls.devCallbackGoogle,
          sharedCallbackUrl: urls.sharedCallbackGoogle,
        },
        github: {
          configured: githubCheck.ok,
          reason: githubCheck.ok ? 'Valid GitHub OAuth Client ID & Secret detected' : githubCheck.reason,
          activeCallbackUrl: `${urls.activeBaseUrl}/api/v1/auth/oauth/github/callback`,
          devCallbackUrl: urls.devCallbackGithub,
          sharedCallbackUrl: urls.sharedCallbackGithub,
        },
      },
    });
  });

  router.get('/:provider/url', (req, res) => {
    const provider =
      req.params.provider === 'google'
        ? 'google'
        : req.params.provider === 'github'
        ? 'github'
        : null;
    if (!provider) {
      res.status(404).json({ error: 'Unsupported OAuth provider' });
      return;
    }

    const reqOrigin =
      typeof req.headers.origin === 'string' && /^https?:\/\//i.test(req.headers.origin)
        ? req.headers.origin
        : `${deps.isHttpsContext(req) ? 'https' : 'http'}://${req.headers.host || 'localhost:3000'}`;
    const baseUrl = resolveAppBaseUrl(reqOrigin);
    const authReq = createOAuthAuthorizationUrl(provider, baseUrl);

    if (!authReq.ok) {
      recordAuthTelemetryEvent({
        eventType: 'OAUTH_FAILED',
        outcome: 'BLOCKED',
        method: provider,
        email: 'preflight-shield',
        rawIp: extractRawClientIp(req),
        userAgent: req.headers['user-agent'] ?? 'OAuth Pre-Flight',
        detail: `Pre-flight stopped ${provider.toUpperCase()} OAuth before invalid_client (401): ${authReq.error}`,
      });

      const session = extractSessionFromReq(req);
      const isFounder = Boolean(session && isFounderEmail(session.user.email));
      const urls = deriveCandidateUrls(req, deps.isHttpsContext(req));
      res.status(503).json({
        configured: false,
        provider,
        error: isFounder
          ? authReq.error
          : `${provider === 'google' ? 'Google' : 'GitHub'} SSO is awaiting Founder Admin activation. Sign in with Email & Password or Passkey.`,
        ...(isFounder
          ? {
              callbackUrl: authReq.callbackUrl,
              devCallbackUrl: provider === 'google' ? urls.devCallbackGoogle : urls.devCallbackGithub,
              sharedCallbackUrl: provider === 'google' ? urls.sharedCallbackGoogle : urls.sharedCallbackGithub,
              missingEnvVars: authReq.missingEnvVars,
            }
          : {}),
      });
      return;
    }

    res.json({
      configured: true,
      provider,
      url: authReq.url,
      redirectUri: authReq.redirectUri,
    });
  });

  const oauthCallbackHandler = async (req: express.Request, res: express.Response) => {
    const provider =
      req.params.provider === 'google'
        ? 'google'
        : req.params.provider === 'github'
        ? 'github'
        : null;
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    const oauthErrorDesc = typeof req.query.error_description === 'string' ? req.query.error_description : '';

    const renderPopupResult = (payload: Record<string, unknown>, heading: string, detail: string) => {
      const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html>
  <head><title>Aurex Global Exchange Sign-In</title></head>
  <body style="font-family:system-ui,-apple-system,sans-serif;background:#0B0E11;color:#EAECEF;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
    <div style="max-width:440px;padding:24px;border:1px solid #2B3139;border-radius:10px;background:#181A20;text-align:center;">
      <h2 style="margin:0 0 8px;font-size:16px;">${heading}</h2>
      <p style="margin:0;font-size:13px;color:#848E9C;line-height:1.5;">${detail}</p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage(${serialized}, '*');
        setTimeout(function(){ window.close(); }, 350);
      }
    </script>
  </body>
</html>`);
    };

    if (!provider || oauthError || !code || !state) {
      const friendly =
        oauthError === 'invalid_client'
          ? 'Google returned Error 401: invalid_client. Verify GOOGLE_CLIENT_ID ends with .apps.googleusercontent.com and both Dev & Shared Callback URLs are listed under Authorized Redirect URIs.'
          : oauthErrorDesc || oauthError || 'Authorization cancelled or missing parameters.';
      renderPopupResult(
        { type: 'OAUTH_AUTH_ERROR', error: friendly },
        'OAuth Authorization Incomplete',
        friendly
      );
      return;
    }

    try {
      const profile = await exchangeOAuthCallback(provider, code, state);
      if (!profile.ok) {
        recordAuthTelemetryEvent({
          eventType: 'OAUTH_FAILED',
          outcome: 'FAILED',
          method: provider,
          email: 'oauth-unknown',
          rawIp: extractRawClientIp(req),
          userAgent: req.headers['user-agent'] ?? 'OAuth Popup Client',
          detail: `${provider.toUpperCase()} OAuth token exchange failed: ${profile.error}`,
        });
        renderPopupResult(
          { type: 'OAUTH_AUTH_ERROR', error: profile.error },
          'Sign-In Failed',
          profile.error
        );
        return;
      }

      const result = findOrCreateOAuthUser(
        { provider, email: profile.email, name: profile.name },
        {
          userAgent: req.headers['user-agent'] ?? 'OAuth Popup Client',
          rawIp: extractRawClientIp(req),
        },
        deps.getPrice
      );

      if (result.mfaRequired) {
        renderPopupResult(
          { type: 'OAUTH_MFA_REQUIRED', mfaChallenge: result.mfaChallenge },
          '2nd-Factor MFA Required',
          'Complete your 2nd-factor verification in the Aurex Global Exchange window.'
        );
        return;
      }

      getOrCreateWorkspace(result.user.id, deps.getPrice);
      deps.setAuthCookie(req, res, result.token);
      renderPopupResult(
        { type: 'OAUTH_AUTH_SUCCESS', provider, token: result.token },
        'Authentication Verified',
        'Signed in cleanly. Returning to Aurex Global Exchange...'
      );
    } catch {
      renderPopupResult(
        { type: 'OAUTH_AUTH_ERROR', error: 'Unexpected OAuth callback error.' },
        'Authentication Error',
        'Unable to complete OAuth sign-in. Close this window and retry.'
      );
    }
  };

  router.get(['/:provider/callback', '/:provider/callback/'], (req, res) => {
    void oauthCallbackHandler(req, res);
  });

  return router;
}
