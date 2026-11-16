import { validateGitHubOAuthCredentials } from './mfaAuthEngine.ts';

function cleanVal(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

export interface GitHubPrivateServerConfig {
  serverBaseUrl: string;
  apiBaseUrl: string;
  isEnterpriseCustomHost: boolean;
  oauthConfigured: boolean;
  privateTokenConfigured: boolean;
  allowedOrg?: string;
}

export interface GitHubPrivateServerStatus extends GitHubPrivateServerConfig {
  connected: boolean;
  identity?: {
    login: string;
    name: string;
    email?: string;
    orgs: string[];
    privateRepoCount?: number;
  };
  reason: string;
  checkedAt: number;
}

let cachedProbe: { value: GitHubPrivateServerStatus; expiresAt: number } | null = null;

export function getGitHubPrivateServerConfig(): GitHubPrivateServerConfig {
  const serverBaseUrl = (cleanVal(process.env.GITHUB_SERVER_BASE_URL) || 'https://github.com').replace(
    /\/+$/,
    ''
  );
  const customApi = cleanVal(process.env.GITHUB_API_BASE_URL);
  const apiBaseUrl = (
    customApi ||
    (serverBaseUrl === 'https://github.com'
      ? 'https://api.github.com'
      : `${serverBaseUrl}/api/v3`)
  ).replace(/\/+$/, '');

  const oauthCheck = validateGitHubOAuthCredentials();
  const privateToken = cleanVal(process.env.GITHUB_PRIVATE_SERVER_TOKEN);
  const allowedOrg = cleanVal(process.env.GITHUB_ALLOWED_ORG) || undefined;

  return {
    serverBaseUrl,
    apiBaseUrl,
    isEnterpriseCustomHost: serverBaseUrl !== 'https://github.com',
    oauthConfigured: oauthCheck.ok,
    privateTokenConfigured: privateToken.length >= 16,
    allowedOrg,
  };
}

export async function probePrivateGitHubServer(forceRefresh = false): Promise<GitHubPrivateServerStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedProbe && now < cachedProbe.expiresAt) {
    return cachedProbe.value;
  }

  const cfg = getGitHubPrivateServerConfig();
  const privateToken = cleanVal(process.env.GITHUB_PRIVATE_SERVER_TOKEN);

  if (!cfg.privateTokenConfigured) {
    const status: GitHubPrivateServerStatus = {
      ...cfg,
      connected: cfg.oauthConfigured,
      reason: cfg.oauthConfigured
        ? 'GitHub OAuth App is active. Set GITHUB_PRIVATE_SERVER_TOKEN in Secrets for Private Repo / Organization verification.'
        : 'Set GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET (and optionally GITHUB_PRIVATE_SERVER_TOKEN) in Secrets to bind a Private GitHub Server.',
      checkedAt: now,
    };
    cachedProbe = { value: status, expiresAt: now + 15_000 };
    return status;
  }

  try {
    const headers = {
      Authorization: `Bearer ${privateToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Meridian-Private-Auth-Server/1.0',
    };

    const userRes = await fetch(`${cfg.apiBaseUrl}/user`, {
      headers,
      signal: AbortSignal.timeout(4500),
    });

    if (!userRes.ok) {
      const errStatus: GitHubPrivateServerStatus = {
        ...cfg,
        connected: false,
        reason: `Private GitHub Server returned HTTP ${userRes.status}. Verify GITHUB_PRIVATE_SERVER_TOKEN scopes (read:user, user:email, repo).`,
        checkedAt: now,
      };
      cachedProbe = { value: errStatus, expiresAt: now + 10_000 };
      return errStatus;
    }

    const userJson = (await userRes.json()) as {
      login?: string;
      name?: string;
      email?: string | null;
      total_private_repos?: number;
    };

    let orgs: string[] = [];
    try {
      const orgRes = await fetch(`${cfg.apiBaseUrl}/user/orgs`, {
        headers,
        signal: AbortSignal.timeout(3500),
      });
      if (orgRes.ok) {
        const orgJson = (await orgRes.json()) as Array<{ login?: string }>;
        orgs = orgJson.map((o) => o.login).filter((x): x is string => Boolean(x));
      }
    } catch {
      // ignore org lookup error
    }

    let email = userJson.email ?? undefined;
    if (!email) {
      try {
        const emRes = await fetch(`${cfg.apiBaseUrl}/user/emails`, {
          headers,
          signal: AbortSignal.timeout(3500),
        });
        if (emRes.ok) {
          const emails = (await emRes.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          email =
            emails.find((e) => e.primary && e.verified)?.email ??
            emails.find((e) => e.verified)?.email;
        }
      } catch {
        // ignore email lookup error
      }
    }

    const orgAllowed =
      !cfg.allowedOrg ||
      orgs.some((o) => o.toLowerCase() === cfg.allowedOrg?.toLowerCase());

    const okStatus: GitHubPrivateServerStatus = {
      ...cfg,
      connected: orgAllowed,
      identity: {
        login: userJson.login ?? 'github-operator',
        name: userJson.name || userJson.login || 'GitHub Private Operator',
        email,
        orgs,
        privateRepoCount: userJson.total_private_repos,
      },
      reason: orgAllowed
        ? `Connected to ${cfg.apiBaseUrl} as @${userJson.login ?? 'operator'}${orgs.length ? ` (${orgs.join(', ')})` : ''}.`
        : `Authenticated as @${userJson.login}, but required organization "${cfg.allowedOrg}" was not found.`,
      checkedAt: now,
    };
    cachedProbe = { value: okStatus, expiresAt: now + 30_000 };
    return okStatus;
  } catch (err) {
    const failStatus: GitHubPrivateServerStatus = {
      ...cfg,
      connected: false,
      reason:
        err instanceof Error
          ? `Unable to reach ${cfg.apiBaseUrl}: ${err.message}`
          : `Unable to reach ${cfg.apiBaseUrl}`,
      checkedAt: now,
    };
    cachedProbe = { value: failStatus, expiresAt: now + 8_000 };
    return failStatus;
  }
}

export async function verifyGitHubPrivateServerSignIn(): Promise<
  | { ok: true; email: string; name: string; login: string; orgs: string[] }
  | { ok: false; error: string }
> {
  const probe = await probePrivateGitHubServer(true);
  if (!probe.privateTokenConfigured) {
    return {
      ok: false,
      error:
        'GITHUB_PRIVATE_SERVER_TOKEN is not configured in Secrets. Add a GitHub Personal Access Token (or use GitHub OAuth) to authenticate via Private GitHub Server.',
    };
  }
  if (!probe.connected || !probe.identity) {
    return { ok: false, error: probe.reason };
  }
  const email =
    probe.identity.email?.toLowerCase() ??
    `${probe.identity.login.toLowerCase()}@users.noreply.github.com`;
  return {
    ok: true,
    email,
    name: probe.identity.name,
    login: probe.identity.login,
    orgs: probe.identity.orgs,
  };
}
