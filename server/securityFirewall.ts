import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import type {
  BankAccountRecord,
  DdosTelemetry,
  FirewallIncident,
  SecurityStatus,
  VaultTransferRecord,
} from '../src/types/market.ts';

function resolveVaultMasterSecret(): {
  secret: string;
  source: 'ENV_VAULT_MASTER_KEY' | 'MANAGED_SEALED_KEY';
} {
  if (process.env.VAULT_MASTER_KEY && process.env.VAULT_MASTER_KEY.length >= 16) {
    return { secret: process.env.VAULT_MASTER_KEY, source: 'ENV_VAULT_MASTER_KEY' };
  }
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const keyFile = path.join(dataDir, '.vault-master.key');
    if (fs.existsSync(keyFile)) {
      const existing = fs.readFileSync(keyFile, 'utf8').trim();
      if (existing.length >= 32) {
        return { secret: existing, source: 'MANAGED_SEALED_KEY' };
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyFile, generated, { encoding: 'utf8', mode: 0o600 });
    return { secret: generated, source: 'MANAGED_SEALED_KEY' };
  } catch {
    return { secret: crypto.randomBytes(32).toString('hex'), source: 'MANAGED_SEALED_KEY' };
  }
}

const VAULT_MASTER_RESOLVED = resolveVaultMasterSecret();
const MASTER_SECRET = VAULT_MASTER_RESOLVED.secret;

export function getVaultMasterKeyInfo(): {
  configured: boolean;
  source: 'ENV_VAULT_MASTER_KEY' | 'MANAGED_SEALED_KEY';
  fingerprint: string;
} {
  return {
    configured: true,
    source: VAULT_MASTER_RESOLVED.source,
    fingerprint: crypto.createHash('sha256').update(MASTER_SECRET).digest('hex').slice(0, 12).toUpperCase(),
  };
}

const VAULT_AES_KEY = crypto.scryptSync(MASTER_SECRET, 'meridian-banking-vault-v1', 32);
const LEDGER_HMAC_KEY = crypto.scryptSync(MASTER_SECRET, 'meridian-hmac-chain-v1', 32);
export const SESSION_SIGNING_KEY = crypto.scryptSync(MASTER_SECRET, 'meridian-session-jwt-v1', 32);

interface EncryptedBankPayload {
  ivHex: string;
  ciphertextHex: string;
  authTagHex: string;
}

const encryptedBankStore = new Map<string, EncryptedBankPayload>();

interface OtpChallenge {
  id: string;
  codeHash: string;
  purpose: string;
  expiresAt: number;
  attempts: number;
  consumed: boolean;
}

const activeChallenges = new Map<string, OtpChallenge>();

// Sliding-window rate limiter & L7 DDoS scrubber keyed by HMAC-hashed client IP (bounded memory)
const rateBuckets = new Map<string, number[]>();
const cooldownIpsUntil = new Map<string, number>();
const globalApiRequestTimestamps: number[] = [];
let blockedFloodRequests = 0;
let lastFloodBlockedAt: number | undefined;
const MAX_RATE_BUCKET_ENTRIES = 12_000;

export function getDdosTelemetry(): DdosTelemetry {
  const now = Date.now();
  const cutoff60s = now - 60_000;
  const recentCount = globalApiRequestTimestamps.filter((t) => t >= cutoff60s).length;
  const rps = Number((recentCount / 60).toFixed(2));
  let activeCooldowns = 0;
  for (const [, until] of cooldownIpsUntil.entries()) {
    if (until > now) activeCooldowns += 1;
  }
  const mode: DdosTelemetry['edgeScrubberMode'] =
    activeCooldowns > 2 || rps > 80
      ? 'UNDER_ATTACK'
      : activeCooldowns > 0 || rps > 25
      ? 'ELEVATED_SCRUB'
      : 'NORMAL';

  return {
    active: true,
    edgeScrubberMode: mode,
    requestsLast60s: recentCount,
    requestsPerSec: rps,
    activeIpBuckets: rateBuckets.size,
    blockedFloodRequests,
    activeCooldownIps: activeCooldowns,
    lastFloodBlockedAt,
  };
}

setInterval(() => {
  const now = Date.now();
  while (globalApiRequestTimestamps.length > 0 && now - globalApiRequestTimestamps[0] > 60_000) {
    globalApiRequestTimestamps.shift();
  }
  for (const [ipKey, until] of cooldownIpsUntil.entries()) {
    if (now > until) cooldownIpsUntil.delete(ipKey);
  }
  for (const [key, timestamps] of rateBuckets.entries()) {
    const fresh = timestamps.filter((t) => now - t < 60_000);
    if (fresh.length === 0) {
      rateBuckets.delete(key);
    } else {
      rateBuckets.set(key, fresh);
    }
  }
  for (const [id, ch] of activeChallenges.entries()) {
    if (now - ch.expiresAt > 60_000 || (ch.consumed && now > ch.expiresAt)) {
      activeChallenges.delete(id);
    }
  }
}, 45_000).unref();

const WAF_SIGNATURES: Array<{ name: string; regex: RegExp; severity: FirewallIncident['severity'] }> = [
  {
    name: 'SQL Injection Pattern',
    regex: /(\bunion\b\s+\bselect\b|\bdrop\b\s+\btable\b|\bor\b\s+1\s*=\s*1|;\s*--\s*|\bexec(\s|\()+xp_)/i,
    severity: 'CRITICAL',
  },
  {
    name: 'Cross-Site Scripting (XSS)',
    regex: /(<\s*script\b|javascript:|onerror\s*=|onload\s*=|<\s*iframe\b)/i,
    severity: 'HIGH',
  },
  {
    name: 'Prototype Pollution Vector',
    regex: /(__proto__|constructor\.prototype|\["prototype"\])/i,
    severity: 'CRITICAL',
  },
  {
    name: 'Path Traversal Probe',
    regex: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/)/i,
    severity: 'HIGH',
  },
  {
    name: 'Shell Command Injection',
    regex: /(\$\([^)]+\)|`[^`]+`|\|\|\s*(cat|curl|wget|bash|sh)\b)/i,
    severity: 'CRITICAL',
  },
];

export function extractRawClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim().length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? '127.0.0.1';
}

export function maskClientIp(req: Request): string {
  return maskIpString(extractRawClientIp(req));
}

export function maskIpString(raw: string): string {
  if (raw.includes('.')) {
    const parts = raw.split('.');
    return `${parts[0]}.${parts[1]}.***.${parts[3] ?? '0'}`;
  }
  return `${raw.slice(0, 8)}::***`;
}

function hashIpForRateBucket(req: Request): string {
  return crypto
    .createHmac('sha256', LEDGER_HMAC_KEY)
    .update(extractRawClientIp(req))
    .digest('hex')
    .slice(0, 16);
}

export function sanitizePlainText(input: unknown, maxLength: number): string {
  return String(input ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function encryptSensitiveText(plain: string): EncryptedBankPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ivHex: iv.toString('hex'),
    ciphertextHex: encrypted.toString('hex'),
    authTagHex: authTag.toString('hex'),
  };
}

export function maskAccountNumber(raw: string): string {
  const clean = raw.replace(/\s+/g, '');
  if (clean.length <= 4) return '••••';
  return `•••• ${clean.slice(-4)}`;
}

export function computeLedgerHmac(prevHash: string, payload: string): string {
  return crypto
    .createHmac('sha256', LEDGER_HMAC_KEY)
    .update(`${prevHash}|${payload}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyTransferChain(transfers: VaultTransferRecord[]): boolean {
  // Transfers are stored newest-first; validate oldest -> newest
  const chronological = [...transfers].reverse();
  let expectedPrev = 'GENESIS_0000000000000000';
  for (const t of chronological) {
    if (t.prevHash !== expectedPrev) return false;
    const expectedHash = computeLedgerHmac(
      t.prevHash,
      `${t.id}|${t.type}|${t.amountUsd}|${t.bankAccountId}|${t.status}|${t.createdAt}`
    );
    if (t.entryHash !== expectedHash) return false;
    expectedPrev = t.entryHash;
  }
  return true;
}

export function issueStepUpChallenge(purpose: string): {
  challengeId: string;
  otpPreview: string;
  expiresAt: number;
} {
  const code = String(crypto.randomInt(100000, 999999));
  const id = `otp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const expiresAt = Date.now() + 120_000;
  const codeHash = crypto
    .createHmac('sha256', LEDGER_HMAC_KEY)
    .update(`${id}:${code}`)
    .digest('hex');

  activeChallenges.set(id, {
    id,
    codeHash,
    purpose,
    expiresAt,
    attempts: 0,
    consumed: false,
  });

  return { challengeId: id, otpPreview: code, expiresAt };
}

export function verifyStepUpChallenge(
  challengeId: string,
  otpCode: string
): { ok: boolean; reason?: string } {
  const ch = activeChallenges.get(challengeId);
  if (!ch) return { ok: false, reason: 'Security challenge not found or expired' };
  if (ch.consumed) return { ok: false, reason: 'Security code already used (replay blocked)' };
  if (Date.now() > ch.expiresAt) {
    activeChallenges.delete(challengeId);
    return { ok: false, reason: 'Security code expired (120s TTL exceeded)' };
  }
  if (ch.attempts >= 3) {
    return { ok: false, reason: 'Max verification attempts exceeded; request a new OTP' };
  }

  const candidateHash = crypto
    .createHmac('sha256', LEDGER_HMAC_KEY)
    .update(`${challengeId}:${otpCode.trim()}`)
    .digest('hex');

  const valid = crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(ch.codeHash, 'hex')
  );

  if (!valid) {
    ch.attempts += 1;
    return { ok: false, reason: `Invalid 6-digit security code (${3 - ch.attempts} tries left)` };
  }

  ch.consumed = true;
  return { ok: true };
}

export function storeEncryptedBankAccount(
  account: Omit<BankAccountRecord, 'maskedNumber' | 'maskedRouting' | 'cipherSuite' | 'authTagPreview'>,
  rawNumber: string,
  rawRouting: string
): BankAccountRecord {
  const enc = encryptSensitiveText(`${rawNumber.trim()}::${rawRouting.trim()}`);
  encryptedBankStore.set(account.id, enc);
  return {
    ...account,
    maskedNumber: maskAccountNumber(rawNumber),
    maskedRouting: maskAccountNumber(rawRouting),
    cipherSuite: 'AES-256-GCM',
    authTagPreview: enc.authTagHex.slice(0, 12),
  };
}

export interface FirewallContext {
  securityStatus: SecurityStatus;
  firewallIncidents: FirewallIncident[];
  onSecurityEvent: (incident?: FirewallIncident) => void;
}

const SENSITIVE_PATH_PROBE_REGEX =
  /(\/\.env|\/\.git|\/\.vault-master\.key|firebase-applet-config|firebase-blueprint|APP_KEYS_AND_INFO\.md|firestore\.rules|\.\.\/|\.\.\\|%2e%2e)/i;
const SENSITIVE_ROOT_PATH_REGEX =
  /^\/(data|server)(\/|$)|^\/(server\.ts|server\.js|vite\.config\.ts|package\.json|package-lock\.json|tsconfig\.json)$/i;

export function createSecurityFirewallMiddleware(ctx: FirewallContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Strict HTTP Security Headers (preserving AI Studio preview iframe & OAuth popup opener compatibility)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; worker-src 'self' blob:; connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://api.coinbase.com https://api.exchange.coinbase.com https://query1.finance.yahoo.com https://api.github.com; frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://*.google.com; object-src 'none'; base-uri 'self';"
    );
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // 1B. KeySentinel Sensitive File & Secret Isolation Guard (Blocks ALL non-API & API probes to secret/source paths)
    const rawTargetUrl = `${req.path} ${req.originalUrl}`;
    const isViteDevBundle =
      req.path.startsWith('/node_modules/') || req.path.startsWith('/@fs/') || req.path.startsWith('/@id/');
    const isViteFirebaseConfigImport =
      req.path === '/firebase-applet-config.json' &&
      Object.prototype.hasOwnProperty.call(req.query, 'import');
    if (
      (!isViteFirebaseConfigImport && SENSITIVE_PATH_PROBE_REGEX.test(rawTargetUrl)) ||
      (!isViteDevBundle && SENSITIVE_ROOT_PATH_REGEX.test(req.path))
    ) {
      const incident: FirewallIncident = {
        id: `fw-key-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        severity: 'CRITICAL',
        category: 'KEY_ISOLATION',
        ruleTriggered: `KeySentinel Blocked Restricted File Probe (${req.path.slice(0, 60)})`,
        method: req.method,
        path: req.path.slice(0, 100),
        maskedIp: maskClientIp(req),
        action: 'BLOCKED',
        createdAt: Date.now(),
      };
      ctx.firewallIncidents.unshift(incident);
      if (ctx.firewallIncidents.length > 80) ctx.firewallIncidents.pop();
      ctx.securityStatus.totalBlocked += 1;
      ctx.onSecurityEvent(incident);
      res.status(403).json({
        error: 'Blocked by KeySentinel File & Key Isolation Policy. Incident logged.',
        incidentId: incident.id,
      });
      return;
    }

    // Only apply WAF & burst rate-limiting to /api routes so static/module loading stays fast
    if (!req.path.startsWith('/api')) {
      next();
      return;
    }

    res.setHeader('X-Aurex-Encrypted-Channel', 'X25519-AES-256-GCM');

    // CSRF Origin Defense on state-mutating requests (proxy-aware + custom domains)
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin) {
      try {
        const originUrl = new URL(req.headers.origin);
        const originHost = originUrl.host.toLowerCase();
        const originHostname = originUrl.hostname.toLowerCase();
        const reqHost = (req.headers.host ?? '').toLowerCase();
        const forwardedHostRaw = req.headers['x-forwarded-host'];
        const forwardedHost = (
          Array.isArray(forwardedHostRaw) ? forwardedHostRaw[0] : forwardedHostRaw ?? ''
        )
          .split(',')[0]
          .trim()
          .toLowerCase();
        let configuredAppHost = '';
        if (process.env.APP_URL && /^https?:\/\//i.test(process.env.APP_URL)) {
          try {
            configuredAppHost = new URL(process.env.APP_URL).host.toLowerCase();
          } catch {
            // ignore
          }
        }
        const customDomains = (process.env.CUSTOM_ALLOWED_DOMAINS ?? '')
          .split(',')
          .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
          .filter(Boolean);

        const isTrustedOrigin =
          originHost === reqHost ||
          (forwardedHost && originHost === forwardedHost) ||
          (configuredAppHost && originHost === configuredAppHost) ||
          customDomains.some((d) => originHost === d || originHostname === d || originHostname.endsWith(`.${d}`)) ||
          originHost.startsWith('localhost') ||
          originHost.startsWith('127.0.0.1') ||
          originHost.endsWith('.run.app') ||
          originHost.endsWith('.web.app') ||
          originHost.endsWith('.firebaseapp.com');

        if (!isTrustedOrigin) {
          const incident: FirewallIncident = {
            id: `fw-csrf-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
            severity: 'CRITICAL',
            category: 'WAF_SIGNATURE',
            ruleTriggered: `Cross-Origin CSRF mismatch (${originHost})`,
            method: req.method,
            path: req.path,
            maskedIp: maskClientIp(req),
            action: 'BLOCKED',
            createdAt: Date.now(),
          };
          ctx.firewallIncidents.unshift(incident);
          if (ctx.firewallIncidents.length > 80) ctx.firewallIncidents.pop();
          ctx.securityStatus.totalBlocked += 1;
          ctx.onSecurityEvent(incident);
          res.status(403).json({
            error: 'Blocked by Zero-Trust CSRF Origin Policy.',
          });
          return;
        }
      } catch {
        // Malformed origin header
        res.status(403).json({ error: 'Malformed Origin header rejected.' });
        return;
      }
    }

    const maskedIp = maskClientIp(req);
    const bucketIpHash = hashIpForRateBucket(req);
    const now = Date.now();
    const isAuthOrSensitive =
      req.path.startsWith('/api/v1/auth/login') ||
      req.path.startsWith('/api/v1/auth/register') ||
      req.path.startsWith('/api/v1/vault') ||
      req.path.startsWith('/api/v1/wallet') ||
      req.path.startsWith('/api/v1/ai/enterprise-analyze') ||
      req.path.startsWith('/api/v1/security') ||
      req.path.startsWith('/api/v1/nexus/execute');

    const isStressProbe = req.path === '/api/v1/engine/stress-test';
    const isPentestProbe = req.headers['x-aurex-pentest'] === '1';
    const bucketKey = `${bucketIpHash}:${isAuthOrSensitive ? 'sensitive' : 'api'}`;
    const limit = isAuthOrSensitive ? 50 : 600;
    const windowMs = 60_000;

    globalApiRequestTimestamps.push(now);
    if (globalApiRequestTimestamps.length > 20_000) {
      globalApiRequestTimestamps.splice(0, globalApiRequestTimestamps.length - 10_000);
    }

    if (!rateBuckets.has(bucketKey) && rateBuckets.size >= MAX_RATE_BUCKET_ENTRIES) {
      const oldestKey = rateBuckets.keys().next().value;
      if (oldestKey) rateBuckets.delete(oldestKey);
    }

    const activeCooldownUntil = cooldownIpsUntil.get(bucketIpHash) ?? 0;
    const timestamps = (rateBuckets.get(bucketKey) ?? []).filter((t) => now - t < windowMs);
    timestamps.push(now);
    rateBuckets.set(bucketKey, timestamps);

    if (
      ctx.securityStatus.firewallActive &&
      !isStressProbe &&
      !isPentestProbe &&
      (now < activeCooldownUntil || timestamps.length > limit)
    ) {
      blockedFloodRequests += 1;
      lastFloodBlockedAt = now;
      if (timestamps.length > limit + 15) {
        cooldownIpsUntil.set(bucketIpHash, now + 30_000);
      }
      const incident: FirewallIncident = {
        id: `fw-${now}-${crypto.randomBytes(2).toString('hex')}`,
        severity: 'HIGH',
        category: 'RATE_LIMIT',
        ruleTriggered: `DDoS / Burst limit exceeded (${timestamps.length}/${limit} req/min)`,
        method: req.method,
        path: req.path,
        maskedIp,
        action: 'THROTTLED',
        createdAt: now,
      };
      ctx.firewallIncidents.unshift(incident);
      if (ctx.firewallIncidents.length > 80) ctx.firewallIncidents.pop();
      ctx.securityStatus.totalBlocked += 1;
      ctx.onSecurityEvent(incident);
      res.setHeader('Retry-After', '30');
      res.status(429).json({
        error: 'Blocked by Aurex L7 DDoS & Rate Shield: Threshold exceeded.',
        incidentId: incident.id,
      });
      return;
    }

    // 2. Deep Payload WAF Inspection + Recursive Prototype Pollution Object-Key Check
    const hasPollutedKey = (val: unknown, depth = 0): boolean => {
      if (!val || typeof val !== 'object' || depth > 8) return false;
      if (Array.isArray(val)) return val.some((item) => hasPollutedKey(item, depth + 1));
      for (const k of Object.getOwnPropertyNames(val)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return true;
        if (hasPollutedKey((val as Record<string, unknown>)[k], depth + 1)) return true;
      }
      return false;
    };

    if (ctx.securityStatus.firewallActive && hasPollutedKey(req.body)) {
      const incident: FirewallIncident = {
        id: `fw-${now}-${crypto.randomBytes(2).toString('hex')}`,
        severity: 'CRITICAL',
        category: 'WAF_SIGNATURE',
        ruleTriggered: 'Prototype Pollution JSON Key Blocked',
        method: req.method,
        path: req.path,
        maskedIp,
        action: 'BLOCKED',
        createdAt: now,
      };
      ctx.firewallIncidents.unshift(incident);
      if (ctx.firewallIncidents.length > 80) ctx.firewallIncidents.pop();
      ctx.securityStatus.totalBlocked += 1;
      ctx.onSecurityEvent(incident);
      res.status(403).json({
        error: 'Blocked by Aurex Zero-Trust WAF (Prototype Pollution attempt). Incident logged.',
        incidentId: incident.id,
      });
      return;
    }

    if (ctx.securityStatus.firewallActive) {
      let decodedUrl = req.originalUrl;
      try {
        decodedUrl = decodeURIComponent(req.originalUrl);
      } catch {
        decodedUrl = req.originalUrl;
      }
      const serializedTarget = `${req.originalUrl} ${decodedUrl} ${JSON.stringify(req.query ?? {})} ${JSON.stringify(req.body ?? {})}`;
      for (const sig of WAF_SIGNATURES) {
        if (sig.regex.test(serializedTarget)) {
          const incident: FirewallIncident = {
            id: `fw-${now}-${crypto.randomBytes(2).toString('hex')}`,
            severity: sig.severity,
            category: 'WAF_SIGNATURE',
            ruleTriggered: sig.name,
            method: req.method,
            path: req.path,
            maskedIp,
            action: 'BLOCKED',
            createdAt: now,
          };
          ctx.firewallIncidents.unshift(incident);
          if (ctx.firewallIncidents.length > 80) ctx.firewallIncidents.pop();
          ctx.securityStatus.totalBlocked += 1;
          ctx.onSecurityEvent(incident);
          res.status(403).json({
            error: `Blocked by Aurex Zero-Trust WAF (${sig.name}). Incident logged.`,
            incidentId: incident.id,
          });
          return;
        }
      }
    }

    next();
  };
}
