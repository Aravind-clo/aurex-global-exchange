import crypto from 'node:crypto';
import type { OAuthProviderInfo } from '../src/types/market.ts';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function computeTotpCode(secretBase32: string, stepOffset = 0, nowMs = Date.now()): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(nowMs / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secretBase32: string, candidateRaw: string): boolean {
  const clean = String(candidateRaw ?? '').replace(/\s|-/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const candBuf = Buffer.from(clean, 'utf8');
  for (const offset of [-1, 0, 1]) {
    const expected = computeTotpCode(secretBase32, offset);
    const expBuf = Buffer.from(expected, 'utf8');
    if (crypto.timingSafeEqual(candBuf, expBuf)) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(email: string, secretBase32: string): string {
  const issuer = 'Nuvra Exchange';
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateRecoveryCodes(): { plainCodes: string[]; hashes: string[] } {
  const plainCodes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const partA = crypto.randomBytes(2).toString('hex').toUpperCase();
    const partB = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${partA}-${partB}`;
    plainCodes.push(code);
    hashes.push(hashRecoveryCode(code));
  }
  return { plainCodes, hashes };
}

export function hashRecoveryCode(codeRaw: string): string {
  const norm = String(codeRaw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(norm).digest('hex');
}

// ============================================================
// WebAuthn / FIDO2 Hardware Key & Passkey Challenge Manager
// ============================================================

interface WebAuthnChallengeTicket {
  challenge: string; // base64url
  userId?: string;
  rpId: string;
  origin: string;
  kind: 'register' | 'assert';
  expiresAt: number;
}

interface PendingMfaTicket {
  mfaToken: string;
  userId: string;
  emailHint: string;
  methods: Array<'totp' | 'webauthn' | 'backup'>;
  expiresAt: number;
}

interface PendingOAuthState {
  state: string;
  provider: 'google' | 'github';
  redirectUri: string;
  expiresAt: number;
}

const webauthnTickets = new Map<string, WebAuthnChallengeTicket>();
const pendingMfaTickets = new Map<string, PendingMfaTicket>();
const pendingOAuthStates = new Map<string, PendingOAuthState>();

setInterval(() => {
  const now = Date.now();
  for (const [k, t] of webauthnTickets.entries()) {
    if (now > t.expiresAt) webauthnTickets.delete(k);
  }
  for (const [k, t] of pendingMfaTickets.entries()) {
    if (now > t.expiresAt) pendingMfaTickets.delete(k);
  }
  for (const [k, t] of pendingOAuthStates.entries()) {
    if (now > t.expiresAt) pendingOAuthStates.delete(k);
  }
}, 45_000).unref();

export function issuePendingMfaTicket(
  userId: string,
  email: string,
  methods: Array<'totp' | 'webauthn' | 'backup'>
): PendingMfaTicket {
  const mfaToken = `mfa-${crypto.randomBytes(18).toString('base64url')}`;
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : `${local[0] ?? '*'}*`;
  const ticket: PendingMfaTicket = {
    mfaToken,
    userId,
    emailHint: domain ? `${maskedLocal}@${domain}` : email,
    methods,
    expiresAt: Date.now() + 180_000,
  };
  pendingMfaTickets.set(mfaToken, ticket);
  return ticket;
}

export function peekPendingMfaTicket(mfaToken: string): PendingMfaTicket | null {
  const t = pendingMfaTickets.get(mfaToken);
  if (!t || Date.now() > t.expiresAt) {
    if (t) pendingMfaTickets.delete(mfaToken);
    return null;
  }
  return t;
}

export function consumePendingMfaTicket(mfaToken: string): PendingMfaTicket | null {
  const t = peekPendingMfaTicket(mfaToken);
  if (t) pendingMfaTickets.delete(mfaToken);
  return t;
}

export function createWebAuthnChallenge(params: {
  kind: 'register' | 'assert';
  userId?: string;
  rpId: string;
  origin: string;
}): { challengeId: string; challenge: string; expiresAt: number } {
  const challenge = crypto.randomBytes(32).toString('base64url');
  const challengeId = `wa-${crypto.randomBytes(12).toString('base64url')}`;
  const expiresAt = Date.now() + 120_000;
  webauthnTickets.set(challengeId, {
    challenge,
    userId: params.userId,
    rpId: params.rpId,
    origin: params.origin,
    kind: params.kind,
    expiresAt,
  });
  return { challengeId, challenge, expiresAt };
}

function consumeWebAuthnChallenge(
  challengeId: string,
  expectedKind: 'register' | 'assert'
): WebAuthnChallengeTicket | null {
  const ticket = webauthnTickets.get(challengeId);
  if (!ticket) return null;
  webauthnTickets.delete(challengeId);
  if (Date.now() > ticket.expiresAt || ticket.kind !== expectedKind) return null;
  return ticket;
}

function sha256(buf: Buffer | string): Buffer {
  return crypto.createHash('sha256').update(buf).digest();
}

export function verifyWebAuthnRegistrationPayload(input: {
  challengeId: string;
  userId: string;
  clientDataJSONB64: string;
  authenticatorDataB64?: string;
  spkiPublicKeyB64: string;
  algorithmCode: number;
}): { ok: true; spkiDerB64: string; algorithmName: string } | { ok: false; error: string } {
  const ticket = consumeWebAuthnChallenge(input.challengeId, 'register');
  if (!ticket || ticket.userId !== input.userId) {
    return { ok: false, error: 'WebAuthn registration challenge expired or invalid.' };
  }

  try {
    const clientDataBuf = Buffer.from(input.clientDataJSONB64, 'base64url');
    const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };

    if (clientData.type !== 'webauthn.create') {
      return { ok: false, error: 'Unexpected WebAuthn ceremony type.' };
    }
    if (clientData.challenge !== ticket.challenge) {
      return { ok: false, error: 'WebAuthn challenge mismatch.' };
    }

    // Verify RP ID hash if authenticatorData was provided
    if (input.authenticatorDataB64) {
      const authData = Buffer.from(input.authenticatorDataB64, 'base64url');
      if (authData.length < 37) {
        return { ok: false, error: 'Malformed authenticatorData.' };
      }
      const expectedRpHash = sha256(ticket.rpId);
      if (!crypto.timingSafeEqual(authData.subarray(0, 32), expectedRpHash)) {
        return { ok: false, error: 'WebAuthn RP ID hash verification failed.' };
      }
      const flags = authData[32];
      if ((flags & 0x01) === 0) {
        return { ok: false, error: 'User presence check was not satisfied.' };
      }
    }

    const spkiBuf = Buffer.from(input.spkiPublicKeyB64, 'base64url');
    // Confirm the SPKI key is parseable by Node crypto
    crypto.createPublicKey({ key: spkiBuf, format: 'der', type: 'spki' });

    const algorithmName =
      input.algorithmCode === -7
        ? 'ES256 (P-256)'
        : input.algorithmCode === -257
        ? 'RS256 (RSA)'
        : input.algorithmCode === -8
        ? 'EdDSA'
        : `COSE(${input.algorithmCode})`;

    return {
      ok: true,
      spkiDerB64: spkiBuf.toString('base64url'),
      algorithmName,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to verify passkey public key.',
    };
  }
}

export function verifyWebAuthnAssertionPayload(input: {
  challengeId: string;
  authenticatorDataB64: string;
  clientDataJSONB64: string;
  signatureB64: string;
  spkiPublicKeyB64: string;
}): { ok: true } | { ok: false; error: string } {
  const ticket = consumeWebAuthnChallenge(input.challengeId, 'assert');
  if (!ticket) {
    return { ok: false, error: 'Passkey sign-in challenge expired. Please try again.' };
  }

  try {
    const clientDataBuf = Buffer.from(input.clientDataJSONB64, 'base64url');
    const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };

    if (clientData.type !== 'webauthn.get') {
      return { ok: false, error: 'Invalid WebAuthn assertion ceremony type.' };
    }
    if (clientData.challenge !== ticket.challenge) {
      return { ok: false, error: 'Passkey challenge mismatch.' };
    }

    const authData = Buffer.from(input.authenticatorDataB64, 'base64url');
    if (authData.length < 37) {
      return { ok: false, error: 'Malformed authenticator assertion data.' };
    }

    const expectedRpHash = sha256(ticket.rpId);
    if (!crypto.timingSafeEqual(authData.subarray(0, 32), expectedRpHash)) {
      return { ok: false, error: 'Passkey relying-party ID mismatch.' };
    }

    const flags = authData[32];
    if ((flags & 0x01) === 0) {
      return { ok: false, error: 'Security key presence check failed.' };
    }

    const clientDataHash = sha256(clientDataBuf);
    const signedData = Buffer.concat([authData, clientDataHash]);
    const signatureBuf = Buffer.from(input.signatureB64, 'base64url');
    const spkiBuf = Buffer.from(input.spkiPublicKeyB64, 'base64url');
    const publicKey = crypto.createPublicKey({ key: spkiBuf, format: 'der', type: 'spki' });

    const valid = crypto.verify('sha256', signedData, publicKey, signatureBuf);
    if (!valid) {
      return { ok: false, error: 'Cryptographic passkey signature verification failed.' };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to validate passkey signature.',
    };
  }
}

// ============================================================
// Federated Social OAuth Engine (Google & GitHub)
// ============================================================

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

function isPlaceholderCredential(val: string): boolean {
  return /^(my_|your_|placeholder|example|test_|demo_|xxx|changeme)/i.test(val) || val.length < 10;
}

export function validateGoogleOAuthCredentials(): {
  ok: boolean;
  clientId: string;
  clientSecret: string;
  reason?: string;
} {
  const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      clientId: '',
      clientSecret: '',
      reason: 'Google OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are not configured in Secrets.',
    };
  }
  if (isPlaceholderCredential(clientId) || isPlaceholderCredential(clientSecret)) {
    return {
      ok: false,
      clientId: '',
      clientSecret: '',
      reason: 'Google OAuth is still set to a placeholder value. Replace it with your real Google Cloud OAuth 2.0 Web Client ID.',
    };
  }
  if (clientId.startsWith('GOCSPX-')) {
    return {
      ok: false,
      clientId: '',
      clientSecret: '',
      reason: 'GOOGLE_CLIENT_ID contains a Client Secret (GOCSPX-...). Swap GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to prevent Error 401: invalid_client.',
    };
  }
  if (!/^\d{6,}-[a-z0-9._-]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
    return {
      ok: false,
      clientId: '',
      clientSecret: '',
      reason: 'Invalid GOOGLE_CLIENT_ID format (must end with .apps.googleusercontent.com). Fixing this prevents Error 401: invalid_client.',
    };
  }
  return { ok: true, clientId, clientSecret };
}

export function validateGitHubOAuthCredentials(): {
  ok: boolean;
  clientId: string;
  clientSecret: string;
  reason?: string;
} {
  const clientId = cleanEnvValue(process.env.GITHUB_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GITHUB_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      clientId: '',
      clientSecret: '',
      reason: 'GitHub OAuth credentials (GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET) are not configured in Secrets.',
    };
  }
  if (isPlaceholderCredential(clientId) || isPlaceholderCredential(clientSecret)) {
    return {
      ok: false,
      clientId: '',
      clientSecret: '',
      reason: 'GitHub OAuth is still set to a placeholder value. Replace with real GitHub OAuth App credentials.',
    };
  }
  return { ok: true, clientId, clientSecret };
}

export function resolveAppBaseUrl(reqOrigin?: string): string {
  const envUrl = cleanEnvValue(process.env.APP_URL);
  if (envUrl && /^https?:\/\//i.test(envUrl) && !/MY_APP_URL/i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  if (reqOrigin && /^https?:\/\//i.test(reqOrigin)) {
    return reqOrigin.replace(/\/+$/, '');
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function getOAuthProviderConfigs(baseUrl: string): OAuthProviderInfo[] {
  const googleCheck = validateGoogleOAuthCredentials();
  const githubCheck = validateGitHubOAuthCredentials();

  return [
    {
      id: 'google',
      name: 'Google',
      configured: googleCheck.ok,
      callbackUrl: `${baseUrl}/api/v1/auth/oauth/google/callback`,
      missingEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    },
    {
      id: 'github',
      name: 'GitHub',
      configured: githubCheck.ok,
      callbackUrl: `${baseUrl}/api/v1/auth/oauth/github/callback`,
      missingEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    },
  ];
}

export function createOAuthAuthorizationUrl(
  provider: 'google' | 'github',
  baseUrl: string
): { ok: true; url: string; redirectUri: string } | { ok: false; error: string; callbackUrl: string; missingEnvVars: string[] } {
  const redirectUri = `${baseUrl}/api/v1/auth/oauth/${provider}/callback`;
  const state = crypto.randomBytes(20).toString('base64url');

  if (provider === 'google') {
    const check = validateGoogleOAuthCredentials();
    if (!check.ok) {
      return {
        ok: false,
        error: check.reason ?? 'Google OAuth credentials are invalid or not configured.',
        callbackUrl: redirectUri,
        missingEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      };
    }

    pendingOAuthStates.set(state, {
      state,
      provider,
      redirectUri,
      expiresAt: Date.now() + 300_000,
    });

    const params = new URLSearchParams({
      client_id: check.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
      access_type: 'online',
    });

    return {
      ok: true,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      redirectUri,
    };
  }

  const ghCheck = validateGitHubOAuthCredentials();
  if (!ghCheck.ok) {
    return {
      ok: false,
      error: ghCheck.reason ?? 'GitHub OAuth credentials are invalid or not configured.',
      callbackUrl: redirectUri,
      missingEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    };
  }

  pendingOAuthStates.set(state, {
    state,
    provider,
    redirectUri,
    expiresAt: Date.now() + 300_000,
  });

  const githubServerBase = (
    cleanEnvValue(process.env.GITHUB_SERVER_BASE_URL) || 'https://github.com'
  ).replace(/\/+$/, '');

  const params = new URLSearchParams({
    client_id: ghCheck.clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email read:org',
    state,
  });

  return {
    ok: true,
    url: `${githubServerBase}/login/oauth/authorize?${params.toString()}`,
    redirectUri,
  };
}

export async function exchangeOAuthCallback(
  provider: 'google' | 'github',
  code: string,
  state: string
): Promise<{ ok: true; email: string; name: string } | { ok: false; error: string }> {
  const pending = pendingOAuthStates.get(state);
  if (!pending || pending.provider !== provider || Date.now() > pending.expiresAt) {
    return { ok: false, error: 'OAuth state expired or failed CSRF check.' };
  }
  pendingOAuthStates.delete(state);

  if (provider === 'google') {
    const check = validateGoogleOAuthCredentials();
    if (!check.ok) {
      return { ok: false, error: check.reason ?? 'Invalid Google OAuth credentials.' };
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: check.clientId,
        client_secret: check.clientSecret,
        redirect_uri: pending.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      return {
        ok: false,
        error: errText.includes('invalid_client')
          ? 'Google returned invalid_client (401): verify GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET belong to the same active Web OAuth client and match Authorized Redirect URIs.'
          : 'Google token exchange failed. Confirm the Redirect URI matches Google Cloud Console.',
      };
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return { ok: false, error: 'Google did not return an access token.' };
    }

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) {
      return { ok: false, error: 'Failed to retrieve Google user profile.' };
    }
    const profile = (await userRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!profile.email || !profile.email_verified) {
      return { ok: false, error: 'Google account email must be verified.' };
    }
    return {
      ok: true,
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
    };
  }

  // GitHub (Standard github.com or Private GitHub Enterprise Server)
  const ghCheck = validateGitHubOAuthCredentials();
  if (!ghCheck.ok) {
    return { ok: false, error: ghCheck.reason ?? 'Invalid GitHub OAuth credentials.' };
  }
  const githubServerBase = (
    cleanEnvValue(process.env.GITHUB_SERVER_BASE_URL) || 'https://github.com'
  ).replace(/\/+$/, '');
  const githubApiBase = (
    cleanEnvValue(process.env.GITHUB_API_BASE_URL) ||
    (githubServerBase === 'https://github.com'
      ? 'https://api.github.com'
      : `${githubServerBase}/api/v3`)
  ).replace(/\/+$/, '');
  const allowedOrg = cleanEnvValue(process.env.GITHUB_ALLOWED_ORG);

  const tokenRes = await fetch(`${githubServerBase}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: ghCheck.clientId,
      client_secret: ghCheck.clientSecret,
      code,
      redirect_uri: pending.redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return { ok: false, error: 'GitHub token exchange failed.' };
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
  if (tokenJson.error) {
    return {
      ok: false,
      error: tokenJson.error_description || `GitHub OAuth error: ${tokenJson.error}`,
    };
  }
  if (!tokenJson.access_token) {
    return { ok: false, error: 'GitHub did not return an access token.' };
  }

  const ghHeaders = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Meridian-Markets-Auth',
  };

  const userRes = await fetch(`${githubApiBase}/user`, { headers: ghHeaders });
  if (!userRes.ok) {
    return { ok: false, error: 'Failed to read GitHub user profile.' };
  }
  const ghUser = (await userRes.json()) as { name?: string; login?: string; email?: string | null };

  if (allowedOrg) {
    const orgRes = await fetch(`${githubApiBase}/user/orgs`, { headers: ghHeaders });
    if (!orgRes.ok) {
      return { ok: false, error: `Unable to verify membership in private GitHub org "${allowedOrg}".` };
    }
    const orgs = (await orgRes.json()) as Array<{ login?: string }>;
    const inOrg = orgs.some((o) => o.login?.toLowerCase() === allowedOrg.toLowerCase());
    if (!inOrg) {
      return {
        ok: false,
        error: `Access denied: GitHub account @${ghUser.login ?? 'user'} is not a member of private org "${allowedOrg}".`,
      };
    }
  }

  let email = ghUser.email ?? undefined;
  if (!email) {
    const emailRes = await fetch(`${githubApiBase}/user/emails`, { headers: ghHeaders });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const verifiedPrimary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      email = verifiedPrimary?.email;
    }
  }

  if (!email) {
    return { ok: false, error: 'GitHub account must have a verified email address.' };
  }

  return {
    ok: true,
    email: email.toLowerCase(),
    name: ghUser.name || ghUser.login || email.split('@')[0],
  };
}
