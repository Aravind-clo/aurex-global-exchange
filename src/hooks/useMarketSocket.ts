import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActionableInsight,
  AdminRewardsOverview,
  AdminServerOverview,
  AdminUserDirectoryEntry,
  AgentLivePerformance,
  ApiLicenseKey,
  AuditLogEntry,
  AuthAuditEvent,
  AuthSessionInfo,
  AuthUser,
  BankAccountRecord,
  BankRailType,
  BotStrategyType,
  Candle,
  CcxtConnectorStatus,
  ChartTimeframe,
  CommunityContributor,
  CountryGuideline,
  DeskMember,
  DetectedPattern,
  DiagnosticsReport,
  EncryptedNetworkTelemetry,
  EngineMetrics,
  FirewallIncident,
  FounderAiTeamState,
  GlobalBankDirectoryEntry,
  GlobalMonitorSnapshot,
  HackDefenseAgent,
  Instrument,
  InvestorProfile,
  KycDocumentType,
  KycVerificationRecord,
  MfaChallengePayload,
  MlPrediction,
  NewsItem,
  NextMoveInterestItem,
  NexusConsensusReport,
  OAuthProviderInfo,
  Order,
  OrderBook,
  PasskeyCredentialInfo,
  Position,
  PriceAlert,
  ReferralPromoProfile,
  RiskEventEntry,
  ScamReportRecord,
  SecurityStatus,
  SocialGraphState,
  SocialPost,
  StressTestResult,
  SupportedCurrency,
  TotpEnrollmentSetup,
  TradeTapeItem,
  TradingBotRecord,
  UserRewardsState,
  VaultTransferRecord,
  WsClientMessage,
  WsServerMessage,
} from '../types/market';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider, syncFirebaseUserProfile } from '../lib/firebase';
import { createEncryptedEnvelopeHeader, setActiveMeshKeyId } from '../utils/clientCrypto';

function b64UrlToUint8Array(b64Url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64Url.length % 4)) % 4);
  const b64 = (b64Url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = window.atob(b64);
  const buffer = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToB64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return window.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const BEARER_STORAGE_KEY = 'meridian_bearer_token';

function getStoredBearerToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(BEARER_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

function storeBearerToken(token?: string | null) {
  try {
    if (typeof window === 'undefined') return;
    if (token) window.sessionStorage.setItem(BEARER_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(BEARER_STORAGE_KEY);
  } catch {
    // ignore storage restriction
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredBearerToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}

async function authJsonRequest<T>(
  input: string,
  init: RequestInit = {},
  retries = 1
): Promise<{ ok: boolean; status: number; data: T | null; networkError?: string }> {
  let attempt = 0;
  while (true) {
    try {
      const res = await authFetch(input, init);
      const rawText = await res.text();
      let parsed: T | null = null;
      if (rawText.trim().length > 0) {
        try {
          parsed = JSON.parse(rawText) as T;
        } catch {
          parsed = null;
        }
      }
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 420));
        continue;
      }
      return { ok: res.ok, status: res.status, data: parsed };
    } catch (err) {
      if (attempt < retries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 420));
        continue;
      }
      return {
        ok: false,
        status: 0,
        data: null,
        networkError: err instanceof Error ? err.message : 'Network connection interrupted',
      };
    }
  }
}

export interface AlertToast {
  id: string;
  title: string;
  detail: string;
  tone: 'positive' | 'negative' | 'info';
  createdAt: number;
}

export interface GitHubPrivateServerStatusClient {
  serverBaseUrl: string;
  apiBaseUrl: string;
  isEnterpriseCustomHost: boolean;
  oauthConfigured: boolean;
  privateTokenConfigured: boolean;
  allowedOrg?: string;
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

export interface AuthServerStatus {
  online: boolean;
  checking: boolean;
  latencyMs: number | null;
  service: string;
  mode: string;
  invalidClientShieldActive: boolean;
  privateGitHubSignInAvailable?: boolean;
  githubPrivateServer?: GitHubPrivateServerStatusClient;
  lastCheckedAt: number;
  error?: string;
}

export interface PlatformSkillInfo {
  id: string;
  name: string;
  category: string;
  summary: string;
  inputsHint: string;
}

export interface SkillExecutionResult {
  skillId: string;
  skillName: string;
  status: 'OK' | 'WARN';
  headline: string;
  metrics: Array<{ label: string; value: string }>;
  recommendation: string;
  executedAt: number;
}

export interface OAuthDiagnostics {
  controller: string;
  activeBaseUrl: string;
  invalidClientShieldActive: boolean;
  githubPrivateServer?: GitHubPrivateServerStatusClient;
  providers: {
    google: {
      configured: boolean;
      reason?: string;
      activeCallbackUrl: string;
      devCallbackUrl: string;
      sharedCallbackUrl: string;
    };
    github: {
      configured: boolean;
      reason?: string;
      activeCallbackUrl: string;
      devCallbackUrl: string;
      sharedCallbackUrl: string;
    };
  };
}

export function useMarketSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMessagesRef = useRef<WsClientMessage[]>([]);
  const retryCountRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authSessions, setAuthSessions] = useState<AuthSessionInfo[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyCredentialInfo[]>([]);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderInfo[]>([]);
  const [oauthDiagnostics, setOauthDiagnostics] = useState<OAuthDiagnostics | null>(null);
  const [authServerStatus, setAuthServerStatus] = useState<AuthServerStatus>({
    online: false,
    checking: true,
    latencyMs: null,
    service: 'Aurex Authentication & Registration Server',
    mode: 'embedded-express',
    invalidClientShieldActive: true,
    lastCheckedAt: Date.now(),
  });
  const [skills, setSkills] = useState<PlatformSkillInfo[]>([]);
  const [pendingMfa, setPendingMfa] = useState<MfaChallengePayload | null>(null);
  const [engineMetrics, setEngineMetrics] = useState<EngineMetrics | null>(null);
  const [lastStressTest, setLastStressTest] = useState<StressTestResult | null>(null);
  const [clientId, setClientId] = useState('');
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [predictions, setPredictions] = useState<Record<string, MlPrediction>>({});
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [insights, setInsights] = useState<ActionableInsight[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeSymbol, setActiveSymbol] = useState('NVDA');
  const [activeTimeframe, setActiveTimeframe] = useState<ChartTimeframe>('1m');
  const activeSymbolRef = useRef('NVDA');
  const activeTimeframeRef = useRef<ChartTimeframe>('1m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeTapeItem[]>([]);
  const [accountMode, setAccountMode] = useState<'demo' | 'real'>('demo');
  const [cashBalance, setCashBalance] = useState(1_000_000);
  const [demoCashBalance, setDemoCashBalance] = useState(1_000_000);
  const [realCashBalance, setRealCashBalance] = useState(0);
  const [vaultBalanceUsd, setVaultBalanceUsd] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [deskMembers, setDeskMembers] = useState<DeskMember[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiLicenseKey[]>([]);
  const [nexusReport, setNexusReport] = useState<NexusConsensusReport | null>(null);
  const [agentLeaderboard, setAgentLeaderboard] = useState<AgentLivePerformance[]>([]);
  const [globalMonitor, setGlobalMonitor] = useState<GlobalMonitorSnapshot | null>(null);
  const [promoProfile, setPromoProfile] = useState<ReferralPromoProfile | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEventEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([]);
  const [vaultTransfers, setVaultTransfers] = useState<VaultTransferRecord[]>([]);
  const [firewallIncidents, setFirewallIncidents] = useState<FirewallIncident[]>([]);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    firewallActive: true,
    lockdownMode: false,
    totalBlocked: 0,
    cipherSuite: 'AES-256-GCM + HMAC-SHA256',
    ledgerChainValid: true,
    lastVerifiedAt: Date.now(),
  });
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [contributors, setContributors] = useState<CommunityContributor[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminServerOverview | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserDirectoryEntry[]>([]);
  const [adminAuthEvents, setAdminAuthEvents] = useState<AuthAuditEvent[]>([]);
  const [connectors, setConnectors] = useState<CcxtConnectorStatus[]>([]);
  const [kycRecord, setKycRecord] = useState<KycVerificationRecord | null>(null);
  const [investorProfiles, setInvestorProfiles] = useState<InvestorProfile[]>([]);
  const [scamReports, setScamReports] = useState<ScamReportRecord[]>([]);
  const [countryGuidelines, setCountryGuidelines] = useState<CountryGuideline[]>([]);
  const [bankDirectory, setBankDirectory] = useState<GlobalBankDirectoryEntry[]>([]);
  const [nextMoveRadar, setNextMoveRadar] = useState<NextMoveInterestItem[]>([]);
  const [networkTelemetry, setNetworkTelemetry] = useState<EncryptedNetworkTelemetry | null>(null);
  const [diagnosticsReport, setDiagnosticsReport] = useState<DiagnosticsReport | null>(null);
  const [defenseAgents, setDefenseAgents] = useState<HackDefenseAgent[]>([]);
  const [bots, setBots] = useState<TradingBotRecord[]>([]);
  const [rewardsState, setRewardsState] = useState<UserRewardsState | null>(null);
  const [socialGraph, setSocialGraph] = useState<SocialGraphState | null>(null);
  const [founderAiTeam, setFounderAiTeam] = useState<FounderAiTeamState | null>(null);
  const [adminRewards, setAdminRewards] = useState<AdminRewardsOverview | null>(null);
  const [toasts, setToasts] = useState<AlertToast[]>([]);

  const pushToast = useCallback((toast: Omit<AlertToast, 'id' | 'createdAt'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...toast, id, createdAt: Date.now() }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const sendMessage = useCallback((msg: WsClientMessage) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(msg));
        return;
      } catch {
        // Queue for next reconnect if send throws during teardown
      }
    }
    if (msg.type === 'subscribe') {
      pendingMessagesRef.current = [
        ...pendingMessagesRef.current.filter((m) => m.type !== 'subscribe'),
        msg,
      ];
    } else if (pendingMessagesRef.current.length < 20) {
      pendingMessagesRef.current.push(msg);
    }
  }, []);

  const refreshAuthState = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/auth/me');
      if (!res.ok) return false;
      const data = (await res.json()) as {
        authenticated?: boolean;
        user?: AuthUser;
        sessions?: AuthSessionInfo[];
        passkeys?: PasskeyCredentialInfo[];
      };
      if (data.authenticated && data.user) {
        setAuthUser(data.user);
        setAuthSessions(data.sessions ?? []);
        setPasskeys(data.passkeys ?? []);
        setPendingMfa(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const checkAuthServerHealth = useCallback(async (): Promise<AuthServerStatus> => {
    setAuthServerStatus((prev) => ({ ...prev, checking: true }));
    const t0 = performance.now();
    const res = await authJsonRequest<{
      ok?: boolean;
      service?: string;
      mode?: string;
      oauth?: { invalidClientShieldActive?: boolean };
      privateGitHubSignInAvailable?: boolean;
      githubPrivateServer?: GitHubPrivateServerStatusClient;
    }>('/api/v1/auth/server-health', { method: 'GET' }, 1);
    const latencyMs = Math.max(1, Math.round(performance.now() - t0));

    if (res.ok && res.data?.ok) {
      const next: AuthServerStatus = {
        online: true,
        checking: false,
        latencyMs,
        service: res.data.service ?? 'Aurex Auth & GitHub OAuth Server',
        mode: res.data.mode ?? 'embedded-express',
        invalidClientShieldActive: res.data.oauth?.invalidClientShieldActive ?? true,
        privateGitHubSignInAvailable: res.data.privateGitHubSignInAvailable,
        githubPrivateServer: res.data.githubPrivateServer,
        lastCheckedAt: Date.now(),
      };
      setAuthServerStatus(next);
      return next;
    }

    const offline: AuthServerStatus = {
      online: false,
      checking: false,
      latencyMs: null,
      service: 'Aurex Authentication Server',
      mode: 'embedded-express',
      invalidClientShieldActive: true,
      lastCheckedAt: Date.now(),
      error: res.networkError ?? (res.status ? `HTTP ${res.status}` : 'Unreachable'),
    };
    setAuthServerStatus(offline);
    return offline;
  }, []);

  // Check existing HttpOnly/Bearer session, OAuth controller & Private Auth/Skills readiness on boot
  useEffect(() => {
    let cancelled = false;
    void checkAuthServerHealth();

    fetch('/api/v1/auth/oauth/providers')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { providers?: OAuthProviderInfo[] };
        if (!cancelled && data.providers) setOauthProviders(data.providers);
      })
      .catch(() => {
        // ignore
      });

    fetch('/api/v1/skills')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { skills?: PlatformSkillInfo[] };
        if (!cancelled && Array.isArray(data.skills)) setSkills(data.skills);
      })
      .catch(() => {
        // ignore
      });

    fetch('/api/v1/compliance/guidelines')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { guidelines?: CountryGuideline[] };
        if (!cancelled && Array.isArray(data.guidelines)) setCountryGuidelines(data.guidelines);
      })
      .catch(() => {});

    fetch('/api/v1/payments/directory')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { directory?: GlobalBankDirectoryEntry[] };
        if (!cancelled && Array.isArray(data.directory)) setBankDirectory(data.directory);
      })
      .catch(() => {});

    fetch('/api/v1/investors/profiles')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { profiles?: InvestorProfile[] };
        if (!cancelled && Array.isArray(data.profiles)) setInvestorProfiles(data.profiles);
      })
      .catch(() => {});

    fetch('/api/v1/scam/reports')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { reports?: ScamReportRecord[] };
        if (!cancelled && Array.isArray(data.reports)) setScamReports(data.reports);
      })
      .catch(() => {});

    fetch('/api/v1/news/radar')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { news?: NewsItem[]; radar?: NextMoveInterestItem[] };
        if (!cancelled && Array.isArray(data.radar)) setNextMoveRadar(data.radar);
      })
      .catch(() => {});

    fetch('/api/v1/network/handshake')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          sessionKeyId?: string;
          telemetry?: EncryptedNetworkTelemetry;
        };
        if (data.sessionKeyId) setActiveMeshKeyId(data.sessionKeyId);
        if (!cancelled && data.telemetry) setNetworkTelemetry(data.telemetry);
      })
      .catch(() => {});

    fetch('/api/v1/security/defense-team')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { agents?: HackDefenseAgent[] };
        if (!cancelled && Array.isArray(data.agents)) setDefenseAgents(data.agents);
      })
      .catch(() => {});

    fetch('/api/v1/diagnostics/status')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { report?: DiagnosticsReport };
        if (!cancelled && data.report) setDiagnosticsReport(data.report);
      })
      .catch(() => {});

    const authController = new AbortController();
    const authTimeout = setTimeout(() => authController.abort(), 4500);

    authFetch('/api/v1/auth/me', { signal: authController.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) storeBearerToken(null);
          return;
        }
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: AuthUser;
          sessions?: AuthSessionInfo[];
          passkeys?: PasskeyCredentialInfo[];
        };
        if (!cancelled && data.authenticated && data.user) {
          setAuthUser(data.user);
          setAuthSessions(data.sessions ?? []);
          setPasskeys(data.passkeys ?? []);
        }
      })
      .catch(() => {
        // Stay unauthenticated
      })
      .finally(() => {
        clearTimeout(authTimeout);
        if (!cancelled) setAuthChecking(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(authTimeout);
      authController.abort();
    };
  }, []);

  // Listen for OAuth popup postMessage completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      const data = event.data as
        | { type?: string; provider?: string; token?: string; error?: string; mfaChallenge?: MfaChallengePayload }
        | undefined;
      if (!data?.type) return;

      if (data.type === 'OAUTH_AUTH_SUCCESS') {
        if (data.token) storeBearerToken(data.token);
        void refreshAuthState().then((ok) => {
          if (ok) {
            pushToast({
              title: `Federated Sign-In Verified`,
              detail: `Signed in securely via ${data.provider ?? 'OAuth'}.`,
              tone: 'positive',
            });
          }
        });
      } else if (data.type === 'OAUTH_MFA_REQUIRED' && data.mfaChallenge) {
        setPendingMfa(data.mfaChallenge);
        pushToast({
          title: '2nd-Factor MFA Required',
          detail: 'Complete TOTP or Hardware Passkey verification to finish OAuth login.',
          tone: 'info',
        });
      } else if (data.type === 'OAUTH_AUTH_ERROR') {
        pushToast({
          title: 'OAuth Sign-In Failed',
          detail: data.error ?? 'Authentication was cancelled.',
          tone: 'negative',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pushToast, refreshAuthState]);

  useEffect(() => {
    let unmounted = false;
    let activeCleanupSocket: (() => void) | null = null;
    let healthAbortController: AbortController | null = null;
    let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
    let hydratedFromSocket = false;

    const safeDisposeSocket = (
      socket: WebSocket | null,
      handshakeTimer: ReturnType<typeof setTimeout> | null
    ) => {
      if (handshakeTimer) clearTimeout(handshakeTimer);
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.close(1000, 'Client cleanup');
        } catch {
          // ignore close errors
        }
      } else if (socket.readyState === WebSocket.CONNECTING) {
        // Avoid closing mid-handshake, which causes "WebSocket closed without opened" console rejections
        socket.addEventListener(
          'open',
          () => {
            try {
              socket.close(1000, 'Superseded handshake');
            } catch {
              // ignore close errors
            }
          },
          { once: true }
        );
        socket.addEventListener('error', () => {}, { once: true });
      }
    };

    const waitForServerReady = async (): Promise<boolean> => {
      if (unmounted) return false;
      try {
        healthAbortController?.abort();
        healthAbortController = new AbortController();
        const timeout = setTimeout(() => healthAbortController?.abort(), 2500);
        const res = await fetch('/api/health', {
          cache: 'no-store',
          signal: healthAbortController.signal,
        });
        clearTimeout(timeout);
        return res.ok;
      } catch {
        return false;
      }
    };

    const connect = () => {
      if (unmounted) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined' || !window.location.host) {
        return;
      }

      if (activeCleanupSocket) {
        activeCleanupSocket();
        activeCleanupSocket = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getStoredBearerToken();
      const wsUrl = token
        ? `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
        : `${protocol}//${window.location.host}/ws`;

      let socket: WebSocket;
      let opened = false;
      let disposed = false;
      let reconnectScheduled = false;
      let handshakeTimer: ReturnType<typeof setTimeout> | null = null;

      const scheduleReconnect = (reason: string) => {
        if (unmounted || disposed || reconnectScheduled) return;
        reconnectScheduled = true;
        setConnected(false);
        setReconnecting(true);
        setSocketError(reason);

        const attempt = retryCountRef.current;
        const baseDelay =
          attempt === 0 ? 450 : Math.min(10000, 800 * 2 ** Math.min(attempt, 5));
        const jitter = Math.floor(Math.random() * 250);
        retryCountRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (unmounted) return;
          void waitForServerReady().finally(() => {
            if (!unmounted) connect();
          });
        }, baseDelay + jitter);
      };

      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to construct WebSocket';
        scheduleReconnect(message);
        return;
      }

      wsRef.current = socket;
      activeCleanupSocket = () => {
        disposed = true;
        safeDisposeSocket(socket, handshakeTimer);
      };

      handshakeTimer = setTimeout(() => {
        if (unmounted || disposed || opened) return;
        if (socket.readyState === WebSocket.CONNECTING) {
          const reason = 'WebSocket initial handshake timed out — retrying';
          scheduleReconnect(reason);
          disposed = true;
          safeDisposeSocket(socket, handshakeTimer);
        }
      }, 8000);

      socket.onopen = () => {
        if (handshakeTimer) {
          clearTimeout(handshakeTimer);
          handshakeTimer = null;
        }
        if (unmounted || disposed) {
          safeDisposeSocket(socket, null);
          return;
        }
        opened = true;
        retryCountRef.current = 0;
        setConnected(true);
        setReconnecting(false);
        setSocketError(null);

        if (activeSymbolRef.current !== 'NVDA' || activeTimeframeRef.current !== '1m') {
          try {
            socket.send(
              JSON.stringify({
                type: 'subscribe',
                symbol: activeSymbolRef.current,
                timeframe: activeTimeframeRef.current,
              })
            );
          } catch {
            // ignore transient send failure
          }
        }

        if (pendingMessagesRef.current.length > 0) {
          const queued = [...pendingMessagesRef.current];
          pendingMessagesRef.current = [];
          for (const queuedMsg of queued) {
            try {
              socket.send(JSON.stringify(queuedMsg));
            } catch {
              // ignore transient send failure
            }
          }
        }
      };

      socket.onerror = () => {
        if (unmounted || disposed) return;
        scheduleReconnect('WebSocket handshake failed before opening — retrying');
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsServerMessage;
          if (msg.type === 'init') {
            hydratedFromSocket = true;
            const p = msg.payload;
            setClientId(p.clientId);
            if (p.user) setAuthUser(p.user);
            setInstruments(p.instruments);
            setPredictions(p.predictions);
            setPatterns(p.patterns);
            setInsights(p.insights);
            setNews(p.news);
            setActiveSymbol(p.activeSymbol);
            setCandles(p.candles);
            setOrderBook(p.orderBook);
            setRecentTrades(p.recentTrades);
            setAccountMode(p.accountMode === 'real' ? 'real' : 'demo');
            setCashBalance(p.cashBalance);
            setDemoCashBalance(p.demoCashBalance ?? p.cashBalance);
            setRealCashBalance(p.realCashBalance ?? 0);
            setVaultBalanceUsd(p.vaultBalanceUsd ?? 0);
            setOrders(p.orders);
            setPositions(p.positions);
            setAlerts(p.alerts);
            setDeskMembers(p.deskMembers);
            setApiKeys(p.apiKeys);
            setNexusReport(p.nexusReport ?? null);
            setAuditLogs(p.auditLogs ?? []);
            setRiskEvents(p.riskEvents ?? []);
            setBankAccounts(p.bankAccounts ?? []);
            setVaultTransfers(p.vaultTransfers ?? []);
            setFirewallIncidents(p.firewallIncidents ?? []);
            if (p.securityStatus) setSecurityStatus(p.securityStatus);
            setSocialPosts(p.socialPosts ?? []);
            setContributors(p.contributors ?? []);
            if (p.engineMetrics) setEngineMetrics(p.engineMetrics);
            if (p.connectors) setConnectors(p.connectors);
            if (p.agentLeaderboard) setAgentLeaderboard(p.agentLeaderboard);
            if (p.globalMonitor) setGlobalMonitor(p.globalMonitor);
            if (p.promoProfile) setPromoProfile(p.promoProfile);
            if (p.networkTelemetry) {
              setNetworkTelemetry(p.networkTelemetry);
              if (p.networkTelemetry.sessionKeyId) {
                setActiveMeshKeyId(p.networkTelemetry.sessionKeyId);
              }
            }
            if (p.defenseAgents) setDefenseAgents(p.defenseAgents);
            if (p.rewardsState) setRewardsState(p.rewardsState);
            if (p.socialGraph) setSocialGraph(p.socialGraph);
            if (p.bots) setBots(p.bots);
            setLoading(false);
          } else if (msg.type === 'market:batch') {
            setInstruments(msg.payload.instruments);
            setPredictions(msg.payload.predictions);
            if (msg.payload.engineMetrics) setEngineMetrics(msg.payload.engineMetrics);
            if (msg.payload.connectors) setConnectors(msg.payload.connectors);
          } else if (msg.type === 'agents:performance') {
            setAgentLeaderboard(msg.payload);
          } else if (msg.type === 'global:monitor') {
            setGlobalMonitor(msg.payload);
          } else if (msg.type === 'symbol:detail') {
            setActiveSymbol(msg.payload.symbol);
            activeSymbolRef.current = msg.payload.symbol;
            if (msg.payload.timeframe) {
              setActiveTimeframe(msg.payload.timeframe);
              activeTimeframeRef.current = msg.payload.timeframe;
            }
            setCandles(msg.payload.candles);
            setOrderBook(msg.payload.orderBook);
            setRecentTrades(msg.payload.recentTrades);
          } else if (msg.type === 'candle:update') {
            setCandles((prev) => {
              const incoming = msg.payload.candle;
              if (prev.length === 0) return [incoming];
              const last = prev[prev.length - 1];
              if (activeTimeframeRef.current !== '1m') {
                const updatedLast: Candle = {
                  ...last,
                  close: incoming.close,
                  high: Math.max(last.high, incoming.high),
                  low: Math.min(last.low, incoming.low),
                };
                return [...prev.slice(0, -1), updatedLast];
              }
              if (last.time === incoming.time) {
                return [...prev.slice(0, -1), incoming];
              }
              if (incoming.time > last.time) {
                return [...prev.slice(-179), incoming];
              }
              return prev;
            });
          } else if (msg.type === 'book:update') {
            setOrderBook(msg.payload);
          } else if (msg.type === 'trade:executed') {
            setRecentTrades((prev) => [msg.payload, ...prev].slice(0, 45));
          } else if (msg.type === 'pattern:detected') {
            setPatterns((prev) => {
              if (prev.some((p) => p.id === msg.payload.id)) return prev;
              return [msg.payload, ...prev].slice(0, 30);
            });
          } else if (msg.type === 'insight:new') {
            setInsights((prev) => [msg.payload, ...prev.filter((i) => i.id !== msg.payload.id)].slice(0, 8));
          } else if (msg.type === 'news:update') {
            setNews(msg.payload);
          } else if (msg.type === 'desk:state') {
            if (msg.payload.accountMode) {
              setAccountMode(msg.payload.accountMode);
            }
            setCashBalance(msg.payload.cashBalance);
            if (typeof msg.payload.demoCashBalance === 'number') {
              setDemoCashBalance(msg.payload.demoCashBalance);
            }
            if (typeof msg.payload.realCashBalance === 'number') {
              setRealCashBalance(msg.payload.realCashBalance);
            }
            if (typeof msg.payload.vaultBalanceUsd === 'number') {
              setVaultBalanceUsd(msg.payload.vaultBalanceUsd);
            }
            setOrders(msg.payload.orders);
            setPositions(msg.payload.positions);
          } else if (msg.type === 'alerts:updated') {
            setAlerts(msg.payload);
          } else if (msg.type === 'alert:triggered') {
            pushToast({
              title: `Alert Triggered · ${msg.payload.symbol}`,
              detail: `Crossed ${msg.payload.condition} ${msg.payload.targetPrice}${msg.payload.note ? ` (${msg.payload.note})` : ''}`,
              tone: msg.payload.condition === 'above' ? 'positive' : 'negative',
            });
          } else if (msg.type === 'desk:presence') {
            setDeskMembers(msg.payload);
          } else if (msg.type === 'nexus:report') {
            setNexusReport(msg.payload);
          } else if (msg.type === 'audit:update') {
            setAuditLogs(msg.payload.auditLogs);
            setRiskEvents(msg.payload.riskEvents);
          } else if (msg.type === 'security:update') {
            setSecurityStatus(msg.payload.securityStatus);
            setFirewallIncidents(msg.payload.firewallIncidents);
          } else if (msg.type === 'vault:update') {
            setBankAccounts(msg.payload.bankAccounts);
            setVaultTransfers(msg.payload.vaultTransfers);
            setSecurityStatus(msg.payload.securityStatus);
          } else if (msg.type === 'social:update') {
            setSocialPosts(msg.payload.socialPosts);
            setContributors(msg.payload.contributors);
          } else if (msg.type === 'admin:auth_event') {
            setAdminAuthEvents((prev) => {
              if (prev.some((e) => e.id === msg.payload.id)) return prev;
              return [msg.payload, ...prev].slice(0, 250);
            });
            setAdminOverview((prev) =>
              prev
                ? {
                    ...prev,
                    totalAuthEvents: prev.totalAuthEvents + 1,
                    failedAuthEvents:
                      prev.failedAuthEvents +
                      (msg.payload.outcome === 'FAILED' || msg.payload.outcome === 'BLOCKED' ? 1 : 0),
                  }
                : prev
            );
          } else if (msg.type === 'error') {
            pushToast({
              title: 'Order Engine Notice',
              detail: msg.payload.message,
              tone: 'negative',
            });
          }
        } catch {
          // Ignore malformed packet
        }
      };

      socket.onclose = (event) => {
        if (handshakeTimer) {
          clearTimeout(handshakeTimer);
          handshakeTimer = null;
        }
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (unmounted || disposed) return;
        const reason = !opened
          ? `WebSocket closed without opening (code ${event.code || 1006}) — retrying`
          : `WebSocket closed (code ${event.code || 1006}) — reconnecting`;
        scheduleReconnect(reason);
      };
    };

    // Fallback snapshot hydration if initial WebSocket upgrade is delayed behind a proxy
    snapshotTimer = setTimeout(() => {
      if (unmounted || hydratedFromSocket) return;
      void fetch('/api/v1/market/snapshot', { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok || unmounted || hydratedFromSocket) return;
          const snap = (await res.json()) as {
            instruments?: Instrument[];
            predictions?: Record<string, MlPrediction>;
            insights?: ActionableInsight[];
            patterns?: DetectedPattern[];
          };
          if (Array.isArray(snap.instruments) && snap.instruments.length > 0) {
            setInstruments((prev) => (prev.length > 0 ? prev : snap.instruments!));
            if (snap.predictions) setPredictions((prev) => (Object.keys(prev).length > 0 ? prev : snap.predictions!));
            if (Array.isArray(snap.insights)) setInsights((prev) => (prev.length > 0 ? prev : snap.insights!));
            if (Array.isArray(snap.patterns)) setPatterns((prev) => (prev.length > 0 ? prev : snap.patterns!));
            setLoading(false);
          }
        })
        .catch(() => {
          // WebSocket retry continues in background
        });
    }, 1800);

    const handleOnline = () => {
      if (unmounted) return;
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        retryCountRef.current = 0;
        connect();
      }
    };
    window.addEventListener('online', handleOnline);

    connect();

    return () => {
      unmounted = true;
      window.removeEventListener('online', handleOnline);
      if (snapshotTimer) clearTimeout(snapshotTimer);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      healthAbortController?.abort();
      if (activeCleanupSocket) {
        activeCleanupSocket();
        activeCleanupSocket = null;
      }
    };
  }, [authUser?.id, pushToast]);

  const selectSymbol = useCallback(
    (symbol: string) => {
      setActiveSymbol(symbol);
      activeSymbolRef.current = symbol;
      sendMessage({ type: 'subscribe', symbol, timeframe: activeTimeframeRef.current });
    },
    [sendMessage]
  );

  const selectTimeframe = useCallback(
    async (tf: ChartTimeframe) => {
      setActiveTimeframe(tf);
      activeTimeframeRef.current = tf;
      const sym = activeSymbolRef.current;
      sendMessage({ type: 'subscribe', symbol: sym, timeframe: tf });
      try {
        const res = await fetch(
          `/api/v1/market/candles/${encodeURIComponent(sym)}?tf=${encodeURIComponent(tf)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { candles?: Candle[] };
          if (Array.isArray(data.candles)) {
            setCandles(data.candles);
          }
        }
      } catch {
        // WebSocket fallback handles update
      }
    },
    [sendMessage]
  );

  const placeOrder = useCallback(
    (payload: {
      symbol: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit' | 'stop';
      size: number;
      price?: number;
      stopPrice?: number;
      traderName?: string;
    }) => {
      sendMessage({ type: 'order:place', payload });
      pushToast({
        title: `${payload.side === 'buy' ? 'Buy' : 'Sell'} ${payload.type.toUpperCase()} Submitted`,
        detail: `${payload.size} ${payload.symbol}${payload.price ? ` @ ${payload.price}` : ''}`,
        tone: payload.side === 'buy' ? 'positive' : 'info',
      });
    },
    [pushToast, sendMessage]
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      sendMessage({ type: 'order:cancel', orderId });
    },
    [sendMessage]
  );

  const createAlert = useCallback(
    (payload: { symbol: string; condition: 'above' | 'below'; targetPrice: number; note?: string }) => {
      sendMessage({ type: 'alert:create', payload });
      pushToast({
        title: `Alert Armed · ${payload.symbol}`,
        detail: `Notify when ${payload.condition} ${payload.targetPrice}`,
        tone: 'info',
      });
    },
    [pushToast, sendMessage]
  );

  const deleteAlert = useCallback(
    (alertId: string) => {
      sendMessage({ type: 'alert:delete', alertId });
    },
    [sendMessage]
  );

  const updateDeskIdentity = useCallback(
    (name: string, role: string) => {
      sendMessage({ type: 'desk:join', name, role });
    },
    [sendMessage]
  );

  const resetPortfolio = useCallback(() => {
    sendMessage({ type: 'portfolio:reset' });
    pushToast({
      title: 'Desk Account Reset',
      detail: 'Buying power restored to $1,000,000.00',
      tone: 'info',
    });
  }, [pushToast, sendMessage]);

  const evaluateNexusAgents = useCallback(
    async (symbol: string): Promise<NexusConsensusReport | null> => {
      try {
        const res = await fetch('/api/v1/nexus/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          pushToast({
            title: '24-Agent Evaluation Failed',
            detail: err.error ?? `Unable to evaluate ${symbol}`,
            tone: 'negative',
          });
          return null;
        }
        const report = (await res.json()) as NexusConsensusReport;
        setNexusReport(report);
        pushToast({
          title: `24-Agent Consensus · ${report.symbol}`,
          detail: `${report.finalDecision} (S=${report.weightedScore.toFixed(3)}) · A24 Gate: ${report.riskGate.verdict}`,
          tone:
            report.riskGate.verdict === 'REJECT'
              ? 'negative'
              : report.finalDecision === 'BUY'
              ? 'positive'
              : 'info',
        });
        return report;
      } catch {
        pushToast({
          title: '24-Agent Evaluation Error',
          detail: 'Could not reach NEXUS Orchestrator endpoint.',
          tone: 'negative',
        });
        return null;
      }
    },
    [pushToast]
  );

  const executeNexusTrade = useCallback(
    async (
      symbol: string,
      traderName?: string
    ): Promise<{ ok: boolean; error?: string; report?: NexusConsensusReport }> => {
      try {
        const res = await authFetch('/api/v1/nexus/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, traderName }),
        });
        const data = (await res.json()) as {
          error?: string;
          order?: Order;
          report?: NexusConsensusReport;
        };
        if (data.report) {
          setNexusReport(data.report);
        }
        if (!res.ok || !data.order) {
          const msg = data.error ?? 'Order blocked by risk gate or non-directional consensus.';
          pushToast({
            title: `Gateway Blocked · ${symbol}`,
            detail: msg,
            tone: 'negative',
          });
          return { ok: false, error: msg, report: data.report };
        }
        pushToast({
          title: `Paper Execution · ${data.order.symbol}`,
          detail: `${data.order.side.toUpperCase()} ${data.order.size} @ ${data.order.price} (A24 ${data.report?.riskGate.verdict ?? 'APPROVE'})`,
          tone: 'positive',
        });
        return { ok: true, report: data.report };
      } catch {
        const msg = 'Unable to contact Paper Execution Gateway.';
        pushToast({
          title: 'Execution Gateway Error',
          detail: msg,
          tone: 'negative',
        });
        return { ok: false, error: msg };
      }
    },
    [pushToast]
  );

  const toggleLockdown = useCallback(
    async (enabled?: boolean) => {
      try {
        const res = await authFetch('/api/v1/security/lockdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        const data = (await res.json()) as { securityStatus?: SecurityStatus };
        if (data.securityStatus) {
          setSecurityStatus(data.securityStatus);
          pushToast({
            title: data.securityStatus.lockdownMode
              ? 'Emergency Vault Lockdown Active'
              : 'Vault Lockdown Lifted',
            detail: data.securityStatus.lockdownMode
              ? 'All withdrawals and order executions are frozen.'
              : 'Verified operations and order routing resumed.',
            tone: data.securityStatus.lockdownMode ? 'negative' : 'positive',
          });
        }
      } catch {
        pushToast({ title: 'Lockdown Request Failed', detail: 'Unable to reach security controller.', tone: 'negative' });
      }
    },
    [pushToast]
  );

  const verifyVaultChain = useCallback(async (): Promise<boolean> => {
    try {
      const res = await authFetch('/api/v1/security/verify-chain', { method: 'POST' });
      const data = (await res.json()) as { valid: boolean; count: number };
      pushToast({
        title: data.valid ? 'HMAC Ledger Chain Verified' : 'Ledger Integrity Mismatch',
        detail: `${data.count} vault entries cryptographically validated.`,
        tone: data.valid ? 'positive' : 'negative',
      });
      return Boolean(data.valid);
    } catch {
      return false;
    }
  }, [pushToast]);

  const requestVaultChallenge = useCallback(
    async (purpose: string): Promise<{ challengeId: string; otpPreview: string; expiresAt: number } | null> => {
      try {
        const res = await authFetch('/api/v1/vault/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purpose }),
        });
        if (!res.ok) return null;
        return (await res.json()) as { challengeId: string; otpPreview: string; expiresAt: number };
      } catch {
        return null;
      }
    },
    []
  );

  const switchAccountMode = useCallback(
    async (mode: 'demo' | 'real'): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/account/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
        const data = (await res.json()) as {
          error?: string;
          accountMode?: 'demo' | 'real';
          cashBalance?: number;
          demoCashBalance?: number;
          realCashBalance?: number;
          vaultBalanceUsd?: number;
        };
        if (!res.ok) {
          pushToast({
            title: 'Account Switch Blocked',
            detail: data.error ?? 'Unable to switch trading mode.',
            tone: 'negative',
          });
          return { ok: false, error: data.error };
        }
        if (data.accountMode) setAccountMode(data.accountMode);
        if (typeof data.cashBalance === 'number') setCashBalance(data.cashBalance);
        if (typeof data.demoCashBalance === 'number') setDemoCashBalance(data.demoCashBalance);
        if (typeof data.realCashBalance === 'number') setRealCashBalance(data.realCashBalance);
        if (typeof data.vaultBalanceUsd === 'number') setVaultBalanceUsd(data.vaultBalanceUsd);
        pushToast({
          title: mode === 'real' ? 'Switched to Real Trading Account' : 'Switched to Demo Practice Account',
          detail:
            mode === 'real'
              ? `Real account balance: $${(data.realCashBalance ?? 0).toLocaleString()}`
              : 'Practice safely with virtual demo capital.',
          tone: mode === 'real' ? 'positive' : 'info',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error switching account mode.' };
      }
    },
    [pushToast]
  );

  const transferVaultShield = useCallback(
    async (payload: {
      action: 'lock' | 'unlock';
      amountUsd: number;
      challengeId?: string;
      otpCode?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/vault/shield', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          error?: string;
          realCashBalance?: number;
          vaultBalanceUsd?: number;
          cashBalance?: number;
        };
        if (!res.ok) {
          pushToast({
            title: 'Cold Vault Shield Blocked',
            detail: data.error ?? 'Vault operation failed.',
            tone: 'negative',
          });
          return { ok: false, error: data.error };
        }
        if (typeof data.realCashBalance === 'number') setRealCashBalance(data.realCashBalance);
        if (typeof data.vaultBalanceUsd === 'number') setVaultBalanceUsd(data.vaultBalanceUsd);
        if (typeof data.cashBalance === 'number') setCashBalance(data.cashBalance);
        pushToast({
          title:
            payload.action === 'lock'
              ? 'Capital Locked in Cold Vault'
              : 'Capital Released to Real Trading',
          detail:
            payload.action === 'lock'
              ? `$${payload.amountUsd.toLocaleString()} isolated from trade execution & withdrawal routes.`
              : `$${payload.amountUsd.toLocaleString()} unlocked via 2FA into Real Trading.`,
          tone: 'positive',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error contacting Cold Vault Shield.' };
      }
    },
    [pushToast]
  );

  const linkBankAccount = useCallback(
    async (payload: {
      bankName: string;
      accountHolder: string;
      rail: BankRailType;
      currency: SupportedCurrency;
      accountNumber: string;
      routingCode: string;
      challengeId: string;
      otpCode: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const envelopeHeader = await createEncryptedEnvelopeHeader('VAULT_BANK_LINK', payload);
        const res = await authFetch('/api/v1/vault/bank-accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Aurex-Envelope': envelopeHeader,
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          error?: string;
          account?: BankAccountRecord;
          networkTelemetry?: EncryptedNetworkTelemetry;
        };
        if (data.networkTelemetry) setNetworkTelemetry(data.networkTelemetry);
        if (!res.ok) {
          pushToast({ title: 'Payment Rail Rejected', detail: data.error ?? 'Failed OTP or input validation', tone: 'negative' });
          return { ok: false, error: data.error };
        }
        pushToast({
          title: 'Payment Rail Encrypted & Linked',
          detail: `${data.account?.bankName} (${data.account?.maskedNumber}) · X25519 + AES-256-GCM`,
          tone: 'positive',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error' };
      }
    },
    [pushToast]
  );

  const submitVaultTransfer = useCallback(
    async (payload: {
      type: 'deposit' | 'withdrawal';
      amount: number;
      currency: SupportedCurrency;
      bankAccountId: string;
      destination?: 'real_trading' | 'cold_vault';
      challengeId: string;
      otpCode: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const envelopeHeader = await createEncryptedEnvelopeHeader('VAULT_TRANSFER', payload);
        const res = await authFetch('/api/v1/vault/transfer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Aurex-Envelope': envelopeHeader,
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          error?: string;
          transfer?: VaultTransferRecord;
          realCashBalance?: number;
          vaultBalanceUsd?: number;
          networkTelemetry?: EncryptedNetworkTelemetry;
        };
        if (data.networkTelemetry) setNetworkTelemetry(data.networkTelemetry);
        if (!res.ok) {
          pushToast({ title: 'Transfer Blocked', detail: data.error ?? 'Transfer rejected', tone: 'negative' });
          return { ok: false, error: data.error };
        }
        if (typeof data.realCashBalance === 'number') setRealCashBalance(data.realCashBalance);
        if (typeof data.vaultBalanceUsd === 'number') setVaultBalanceUsd(data.vaultBalanceUsd);
        pushToast({
          title: `${payload.type === 'deposit' ? 'Deposit Settled' : 'Withdrawal Settled'}`,
          detail: `$${data.transfer?.amountUsd.toLocaleString()} · HMAC ${data.transfer?.entryHash.slice(0, 10)}...`,
          tone: 'positive',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error' };
      }
    },
    [pushToast]
  );

  const runWafProbe = useCallback(
    async (probeType: 'sqli' | 'xss' | 'clean'): Promise<{ status: number; message: string }> => {
      const payload =
        probeType === 'sqli'
          ? { query: "admin' UNION SELECT password FROM users --" }
          : probeType === 'xss'
          ? { query: "<script>alert('xss')</script>" }
          : { query: 'NVDA quarterly telemetry check' };

      const res = await fetch('/api/v1/security/test-probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      const message = data.error ?? data.message ?? `HTTP ${res.status}`;
      pushToast({
        title: res.status === 403 ? 'WAF Threat Blocked (403)' : 'WAF Probe Passed',
        detail: message,
        tone: res.status === 403 ? 'positive' : 'info',
      });
      return { status: res.status, message };
    },
    [pushToast]
  );

  const publishSocialPost = useCallback(
    async (payload: {
      author: string;
      role: string;
      symbol: string;
      bias: SocialPost['bias'];
      title: string;
      thesis: string;
      targetPrice?: number;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/social/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          pushToast({ title: 'Publish Failed', detail: data.error ?? 'Invalid post payload', tone: 'negative' });
          return { ok: false, error: data.error };
        }
        pushToast({ title: `Thesis Published · ${payload.symbol}`, detail: payload.title, tone: 'positive' });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error' };
      }
    },
    [pushToast]
  );

  const toggleLikePost = useCallback(
    async (postId: string) => {
      await authFetch(`/api/v1/social/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
    },
    [clientId]
  );

  const toggleFollowContributor = useCallback(async (contributorId: string) => {
    await authFetch(`/api/v1/social/contributors/${contributorId}/follow`, {
      method: 'POST',
    });
  }, []);

  const loginAccount = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{
      ok: boolean;
      error?: string;
      user?: AuthUser;
      mfaRequired?: boolean;
      mfaChallenge?: MfaChallengePayload;
    }> => {
      const res = await authJsonRequest<{
        error?: string;
        mfaRequired?: boolean;
        mfaChallenge?: MfaChallengePayload;
        user?: AuthUser;
        token?: string;
        sessions?: AuthSessionInfo[];
        passkeys?: PasskeyCredentialInfo[];
      }>('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 0) {
        void checkAuthServerHealth();
        return {
          ok: false,
          error: `Unable to reach authentication server (${res.networkError ?? 'connection interrupted'}). Click "Check Server" or refresh.`,
        };
      }

      const data = res.data;
      if (res.ok && data?.mfaRequired && data.mfaChallenge) {
        setPendingMfa(data.mfaChallenge);
        return { ok: true, mfaRequired: true, mfaChallenge: data.mfaChallenge };
      }
      if (!res.ok || !data?.user) {
        return {
          ok: false,
          error: data?.error ?? `Sign-in failed (HTTP ${res.status}).`,
        };
      }
      if (data.token) storeBearerToken(data.token);
      setPendingMfa(null);
      setAuthUser(data.user);
      setAuthSessions(data.sessions ?? []);
      setPasskeys(data.passkeys ?? []);
      pushToast({
        title: `Signed In · ${data.user.name}`,
        detail: `${data.user.role} workspace hydrated with encrypted custody vault.`,
        tone: 'positive',
      });
      return { ok: true, user: data.user };
    },
    [pushToast, checkAuthServerHealth]
  );

  const verifyMfaCode = useCallback(
    async (mfaToken: string, code: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await authJsonRequest<{
        error?: string;
        user?: AuthUser;
        token?: string;
        sessions?: AuthSessionInfo[];
        passkeys?: PasskeyCredentialInfo[];
      }>('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code }),
      });
      if (res.status === 0) {
        return { ok: false, error: 'Unable to contact MFA verification endpoint.' };
      }
      const data = res.data;
      if (!res.ok || !data?.user) {
        return { ok: false, error: data?.error ?? `Invalid verification code (HTTP ${res.status}).` };
      }
      if (data.token) storeBearerToken(data.token);
      setPendingMfa(null);
      setAuthUser(data.user);
      setAuthSessions(data.sessions ?? []);
      setPasskeys(data.passkeys ?? []);
      pushToast({
        title: `MFA Verified · ${data.user.name}`,
        detail: '2nd-factor challenge succeeded. Trading desk unlocked.',
        tone: 'positive',
      });
      return { ok: true };
    },
    [pushToast]
  );

  const clearPendingMfa = useCallback(() => {
    setPendingMfa(null);
  }, []);

  const registerNewAccount = useCallback(
    async (payload: {
      email: string;
      password: string;
      name: string;
      role?: string;
      experienceMode?: 'newbie' | 'pro';
      marketFocus?: string;
      contactPhone?: string;
      termsAccepted?: boolean;
    }): Promise<{ ok: boolean; error?: string; user?: AuthUser }> => {
      const res = await authJsonRequest<{
        error?: string;
        user?: AuthUser;
        token?: string;
        sessions?: AuthSessionInfo[];
        passkeys?: PasskeyCredentialInfo[];
      }>('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 0) {
        void checkAuthServerHealth();
        return {
          ok: false,
          error: `Unable to reach registration server (${res.networkError ?? 'connection interrupted'}).`,
        };
      }
      const data = res.data;
      if (!res.ok || !data?.user) {
        return {
          ok: false,
          error: data?.error ?? `Registration failed (HTTP ${res.status}).`,
        };
      }
      if (data.token) storeBearerToken(data.token);
      setPendingMfa(null);
      setAuthUser(data.user);
      setAuthSessions(data.sessions ?? []);
      setPasskeys(data.passkeys ?? []);
      pushToast({
        title: `Account Created · ${data.user.name}`,
        detail: 'Isolated AES-256-GCM banking vault & $1,000,000 trading desk initialized.',
        tone: 'positive',
      });
      return { ok: true, user: data.user };
    },
    [pushToast, checkAuthServerHealth]
  );

  const logoutAccount = useCallback(async () => {
    try {
      await authFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Clear local state regardless
    }
    storeBearerToken(null);
    setPendingMfa(null);
    setAuthUser(null);
    setAuthSessions([]);
    setPasskeys([]);
    setAdminOverview(null);
    setAdminUsers([]);
    setAdminAuthEvents([]);
    setFounderAiTeam(null);
    setAdminRewards(null);
    setBots([]);
    setRewardsState(null);
    setSocialGraph(null);
    setPromoProfile(null);
    setOrders([]);
    setPositions([]);
    setBankAccounts([]);
    setVaultTransfers([]);
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/auth/sessions');
      if (!res.ok) return;
      const data = (await res.json()) as { sessions?: AuthSessionInfo[] };
      setAuthSessions(data.sessions ?? []);
    } catch {
      // ignore
    }
  }, []);

  const revokeOtherSessions = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/auth/sessions/revoke-others', { method: 'POST' });
      const data = (await res.json()) as { removed?: number; sessions?: AuthSessionInfo[] };
      if (data.sessions) setAuthSessions(data.sessions);
      pushToast({
        title: 'Other Sessions Revoked',
        detail: `${data.removed ?? 0} remote session(s) terminated immediately.`,
        tone: 'info',
      });
    } catch {
      // ignore
    }
  }, [pushToast]);

  const updateUserPrefs = useCallback(
    async (updates: { experienceMode?: 'newbie' | 'pro'; twoFactorEnabled?: boolean }) => {
      try {
        const res = await authFetch('/api/v1/auth/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const data = (await res.json()) as { user?: AuthUser };
        if (res.ok && data.user) {
          setAuthUser(data.user);
          pushToast({
            title: 'Security & Experience Preferences Saved',
            detail: `Mode: ${data.user.experienceMode === 'newbie' ? 'Beginner Guided' : 'Pro Quant'} · 2FA ${data.user.twoFactorEnabled ? 'Enforced' : 'On Vault Ops'}`,
            tone: 'positive',
          });
        }
      } catch {
        // ignore
      }
    },
    [pushToast]
  );

  // TOTP Authenticator App MFA Setup/Verify/Disable
  const setupTotp = useCallback(async (): Promise<TotpEnrollmentSetup | null> => {
    try {
      const res = await authFetch('/api/v1/auth/mfa/totp/setup', { method: 'POST' });
      if (!res.ok) return null;
      const data = (await res.json()) as { setup?: TotpEnrollmentSetup };
      return data.setup ?? null;
    } catch {
      return null;
    }
  }, []);

  const confirmTotp = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/auth/mfa/totp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as { user?: AuthUser; error?: string };
        if (!res.ok || !data.user) {
          return { ok: false, error: data.error ?? 'Unable to verify TOTP code.' };
        }
        setAuthUser(data.user);
        pushToast({
          title: 'Authenticator App MFA Enabled',
          detail: 'All future sign-ins require your 6-digit TOTP or backup recovery code.',
          tone: 'positive',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error confirming TOTP setup.' };
      }
    },
    [pushToast]
  );

  const disableTotp = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/auth/mfa/totp/disable', { method: 'POST' });
      const data = (await res.json()) as { user?: AuthUser };
      if (res.ok && data.user) {
        setAuthUser(data.user);
        pushToast({
          title: 'TOTP Authenticator Removed',
          detail: 'Authenticator App MFA disabled for this account.',
          tone: 'info',
        });
      }
    } catch {
      // ignore
    }
  }, [pushToast]);

  // WebAuthn Hardware Security Key / Passkey Enrollment & Sign-In
  const enrollPasskey = useCallback(
    async (label: string): Promise<{ ok: boolean; error?: string }> => {
      if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
        return {
          ok: false,
          error: 'WebAuthn Hardware Passkeys are not supported in this browser or context.',
        };
      }
      try {
        const optRes = await authFetch('/api/v1/auth/passkeys/register/options', { method: 'POST' });
        const optData = (await optRes.json()) as {
          error?: string;
          challengeId?: string;
          publicKey?: {
            challenge: string;
            rp: { name: string; id: string };
            user: { id: string; name: string; displayName: string };
            pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
            timeout: number;
            attestation: AttestationConveyancePreference;
            excludeCredentials: Array<{ id: string; type: 'public-key' }>;
            authenticatorSelection: AuthenticatorSelectionCriteria;
          };
        };
        if (!optRes.ok || !optData.publicKey || !optData.challengeId) {
          return { ok: false, error: optData.error ?? 'Failed to obtain passkey registration options.' };
        }

        const cred = (await navigator.credentials.create({
          publicKey: {
            challenge: b64UrlToUint8Array(optData.publicKey.challenge),
            rp: optData.publicKey.rp,
            user: {
              id: b64UrlToUint8Array(optData.publicKey.user.id),
              name: optData.publicKey.user.name,
              displayName: optData.publicKey.user.displayName,
            },
            pubKeyCredParams: optData.publicKey.pubKeyCredParams,
            timeout: optData.publicKey.timeout,
            attestation: optData.publicKey.attestation,
            excludeCredentials: optData.publicKey.excludeCredentials.map((c) => ({
              id: b64UrlToUint8Array(c.id),
              type: 'public-key',
            })),
            authenticatorSelection: optData.publicKey.authenticatorSelection,
          },
        })) as PublicKeyCredential | null;

        if (!cred) {
          return { ok: false, error: 'Passkey creation was cancelled.' };
        }

        const response = cred.response as AuthenticatorAttestationResponse;
        const spkiBuf = typeof response.getPublicKey === 'function' ? response.getPublicKey() : null;
        if (!spkiBuf) {
          return {
            ok: false,
            error: 'Browser did not expose SPKI public key (requires modern Chromium/Safari/Firefox).',
          };
        }

        const authDataBuf =
          typeof response.getAuthenticatorData === 'function' ? response.getAuthenticatorData() : null;

        const verRes = await authFetch('/api/v1/auth/passkeys/register/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: optData.challengeId,
            credentialIdB64: arrayBufferToB64Url(cred.rawId),
            clientDataJSONB64: arrayBufferToB64Url(response.clientDataJSON),
            authenticatorDataB64: authDataBuf ? arrayBufferToB64Url(authDataBuf) : undefined,
            spkiPublicKeyB64: arrayBufferToB64Url(spkiBuf),
            algorithmCode:
              typeof response.getPublicKeyAlgorithm === 'function'
                ? response.getPublicKeyAlgorithm()
                : -7,
            transports:
              typeof response.getTransports === 'function' ? response.getTransports() : ['internal'],
            label,
          }),
        });
        const verData = (await verRes.json()) as {
          error?: string;
          user?: AuthUser;
          passkeys?: PasskeyCredentialInfo[];
        };
        if (!verRes.ok || !verData.user) {
          return { ok: false, error: verData.error ?? 'Failed to verify hardware passkey.' };
        }
        setAuthUser(verData.user);
        setPasskeys(verData.passkeys ?? []);
        pushToast({
          title: 'Hardware Passkey Registered',
          detail: `"${label}" cryptographically bound to your vault.`,
          tone: 'positive',
        });
        return { ok: true };
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Hardware key prompt cancelled or blocked by iframe Permissions Policy.'
            : err instanceof Error
            ? err.message
            : 'Unable to register hardware security key.';
        return { ok: false, error: msg };
      }
    },
    [pushToast]
  );

  const removePasskey = useCallback(
    async (id: string) => {
      try {
        const res = await authFetch(`/api/v1/auth/passkeys/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const data = (await res.json()) as { user?: AuthUser; passkeys?: PasskeyCredentialInfo[] };
        if (res.ok && data.user) {
          setAuthUser(data.user);
          setPasskeys(data.passkeys ?? []);
          pushToast({
            title: 'Hardware Security Key Revoked',
            detail: 'Passkey credential removed from your account.',
            tone: 'info',
          });
        }
      } catch {
        // ignore
      }
    },
    [pushToast]
  );

  const loginWithPasskey = useCallback(
    async (email?: string, mfaToken?: string): Promise<{ ok: boolean; error?: string }> => {
      if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
        return {
          ok: false,
          error: 'WebAuthn Passkeys require a FIDO2-compatible browser over HTTPS or localhost.',
        };
      }
      try {
        const optRes = await fetch('/api/v1/auth/passkeys/login/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, mfaToken }),
        });
        const optData = (await optRes.json()) as {
          error?: string;
          challengeId?: string;
          publicKey?: {
            challenge: string;
            rpId: string;
            timeout: number;
            userVerification: UserVerificationRequirement;
            allowCredentials: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }>;
          };
        };
        if (!optRes.ok || !optData.publicKey || !optData.challengeId) {
          return {
            ok: false,
            error: optData.error ?? 'No passkeys found for this account.',
          };
        }

        const assertion = (await navigator.credentials.get({
          publicKey: {
            challenge: b64UrlToUint8Array(optData.publicKey.challenge),
            rpId: optData.publicKey.rpId,
            timeout: optData.publicKey.timeout,
            userVerification: optData.publicKey.userVerification,
            allowCredentials: optData.publicKey.allowCredentials.map((c) => ({
              id: b64UrlToUint8Array(c.id),
              type: 'public-key',
              transports: c.transports,
            })),
          },
        })) as PublicKeyCredential | null;

        if (!assertion) {
          return { ok: false, error: 'Passkey verification cancelled.' };
        }

        const assertResp = assertion.response as AuthenticatorAssertionResponse;
        const verRes = await fetch('/api/v1/auth/passkeys/login/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: optData.challengeId,
            credentialIdB64: arrayBufferToB64Url(assertion.rawId),
            authenticatorDataB64: arrayBufferToB64Url(assertResp.authenticatorData),
            clientDataJSONB64: arrayBufferToB64Url(assertResp.clientDataJSON),
            signatureB64: arrayBufferToB64Url(assertResp.signature),
            mfaToken,
          }),
        });
        const verData = (await verRes.json()) as {
          error?: string;
          user?: AuthUser;
          token?: string;
          sessions?: AuthSessionInfo[];
          passkeys?: PasskeyCredentialInfo[];
        };
        if (!verRes.ok || !verData.user) {
          return { ok: false, error: verData.error ?? 'Passkey signature verification failed.' };
        }
        if (verData.token) storeBearerToken(verData.token);

        setPendingMfa(null);
        setAuthUser(verData.user);
        setAuthSessions(verData.sessions ?? []);
        setPasskeys(verData.passkeys ?? []);
        pushToast({
          title: `Passkey Verified · ${verData.user.name}`,
          detail: 'Hardware FIDO2 cryptographic signature accepted.',
          tone: 'positive',
        });
        return { ok: true };
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Security key assertion cancelled or timed out.'
            : err instanceof Error
            ? err.message
            : 'Unable to authenticate with hardware passkey.';
        return { ok: false, error: msg };
      }
    },
    [pushToast]
  );

  // Popup-based Federated Social OAuth Login (Firebase Google Popup + Custom OAuth Controller)
  const startOAuthLogin = useCallback(
    async (
      provider: 'google' | 'github'
    ): Promise<{
      ok: boolean;
      configured?: boolean;
      error?: string;
      callbackUrl?: string;
      devCallbackUrl?: string;
      sharedCallbackUrl?: string;
      missingEnvVars?: string[];
    }> => {
      if (provider === 'google') {
        try {
          const cred = await signInWithPopup(auth, googleAuthProvider);
          const idToken = await cred.user.getIdToken();

          if (cred.user.emailVerified) {
            void syncFirebaseUserProfile({
              uid: cred.user.uid,
              email: cred.user.email ?? '',
              displayName: cred.user.displayName ?? 'Aurex Trader',
            }).catch(() => {});
          }

          const fbRes = await authJsonRequest<{
            ok?: boolean;
            error?: string;
            mfaRequired?: boolean;
            mfaChallenge?: MfaChallengePayload;
            user?: AuthUser;
            token?: string;
          }>('/api/v1/auth/firebase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });

          if (fbRes.ok && fbRes.data?.mfaRequired && fbRes.data.mfaChallenge) {
            setPendingMfa(fbRes.data.mfaChallenge);
            return { ok: true, configured: true };
          }

          if (fbRes.ok && fbRes.data?.user) {
            if (fbRes.data.token) storeBearerToken(fbRes.data.token);
            setPendingMfa(null);
            setAuthUser(fbRes.data.user);
            void refreshAuthState();
            pushToast({
              title: `Google Verified · ${fbRes.data.user.name}`,
              detail: 'Google identity verified for your isolated trading desk.',
              tone: 'positive',
            });
            return { ok: true, configured: true };
          }
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code ?? '';
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            return { ok: false, configured: true, error: 'Google sign-in popup was cancelled.' };
          }
          // Fall through cleanly to the Express OAuth Controller if Firebase provider is disabled in console
        }
      }

      try {
        const res = await fetch(`/api/v1/auth/oauth/${provider}/url`);
        const data = (await res.json()) as {
          configured?: boolean;
          url?: string;
          error?: string;
          callbackUrl?: string;
          devCallbackUrl?: string;
          sharedCallbackUrl?: string;
          missingEnvVars?: string[];
        };

        if (!res.ok || !data.configured || !data.url) {
          return {
            ok: false,
            configured: false,
            error: data.error ?? `${provider} OAuth is not configured.`,
            callbackUrl: data.callbackUrl,
            devCallbackUrl: data.devCallbackUrl,
            sharedCallbackUrl: data.sharedCallbackUrl,
            missingEnvVars: data.missingEnvVars,
          };
        }

        const popup = window.open(
          data.url,
          `meridian_oauth_${provider}`,
          'width=560,height=680,menubar=no,toolbar=no'
        );
        if (!popup) {
          return {
            ok: false,
            configured: true,
            error: 'Browser blocked the sign-in popup window. Please allow popups for this site and click again.',
          };
        }
        return { ok: true, configured: true };
      } catch {
        return { ok: false, error: 'Unable to contact OAuth controller.' };
      }
    },
    [pushToast, refreshAuthState]
  );

  const toggleRealMoneyMode = useCallback(
    async (enabled: boolean): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/auth/real-money', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        const data = (await res.json()) as {
          error?: string;
          user?: AuthUser;
        };
        if (!res.ok || !data.user) {
          const msg = data.error ?? 'Unable to update real-money custody mode.';
          pushToast({
            title: 'Real-Money Security Gate Blocked',
            detail: msg,
            tone: 'negative',
          });
          return { ok: false, error: msg };
        }
        setAuthUser(data.user);
        pushToast({
          title: data.user.realMoneyEnabled
            ? 'Real-Money Custody Mode Enabled'
            : 'Returned to Simulation Mode',
          detail: data.user.realMoneyEnabled
            ? '2+ independent MFA factors verified. Vault cleared for real-money custody routing.'
            : 'Workspace switched back to sandbox simulation mode.',
          tone: data.user.realMoneyEnabled ? 'positive' : 'info',
        });
        return { ok: true };
      } catch {
        const msg = 'Network error while updating real-money custody mode.';
        pushToast({
          title: 'Security Request Failed',
          detail: msg,
          tone: 'negative',
        });
        return { ok: false, error: msg };
      }
    },
    [pushToast]
  );

  const fetchAdminTelemetry = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/admin/overview');
      if (!res.ok) return false;
      const data = (await res.json()) as {
        overview?: AdminServerOverview;
        users?: AdminUserDirectoryEntry[];
        authEvents?: AuthAuditEvent[];
      };
      if (data.overview) setAdminOverview(data.overview);
      if (data.users) setAdminUsers(data.users);
      if (data.authEvents) setAdminAuthEvents(data.authEvents);
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchFounderAiTeam = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/admin/ai-team');
      if (!res.ok) return;
      const data = (await res.json()) as { teamState?: FounderAiTeamState };
      if (data.teamState) setFounderAiTeam(data.teamState);
    } catch {
      // ignore
    }
  }, []);

  const fetchAdminRewards = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/admin/rewards');
      if (!res.ok) return;
      const data = (await res.json()) as { overview?: AdminRewardsOverview };
      if (data.overview) setAdminRewards(data.overview);
    } catch {
      // ignore
    }
  }, []);

  const fetchRewardsAndSocial = useCallback(async () => {
    try {
      const [rewRes, socRes] = await Promise.all([
        authFetch('/api/v1/rewards/me'),
        authFetch('/api/v1/social/graph'),
      ]);
      if (rewRes.ok) {
        const d = (await rewRes.json()) as { rewardsState?: UserRewardsState };
        if (d.rewardsState) setRewardsState(d.rewardsState);
      }
      if (socRes.ok) {
        const d = (await socRes.json()) as { socialGraph?: SocialGraphState };
        if (d.socialGraph) setSocialGraph(d.socialGraph);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchBots = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/bots');
      if (!res.ok) return;
      const data = (await res.json()) as { bots?: TradingBotRecord[] };
      if (Array.isArray(data.bots)) setBots(data.bots);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const isFounder =
      authUser?.email.trim().toLowerCase() === 'vemulavankeswararao@gmail.com' &&
      Boolean(authUser?.isAdmin);
    if (authUser?.id) {
      void fetchRewardsAndSocial();
      void fetchBots();
      void authFetch('/api/v1/promo/me')
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as { profile?: ReferralPromoProfile };
          if (data.profile) setPromoProfile(data.profile);
        })
        .catch(() => {});
    } else {
      setPromoProfile(null);
      setBots([]);
      setRewardsState(null);
      setSocialGraph(null);
    }

    if (isFounder) {
      void fetchAdminTelemetry();
      void fetchFounderAiTeam();
      void fetchAdminRewards();
      void checkAuthServerHealth();
      void authFetch('/api/v1/auth/oauth/diagnostics')
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as OAuthDiagnostics;
          if (data.providers) setOauthDiagnostics(data);
        })
        .catch(() => {});
    } else {
      setAdminOverview(null);
      setAdminUsers([]);
      setAdminAuthEvents([]);
      setOauthDiagnostics(null);
      setFounderAiTeam(null);
      setAdminRewards(null);
    }
  }, [
    authUser?.id,
    authUser?.email,
    authUser?.isAdmin,
    fetchAdminTelemetry,
    fetchFounderAiTeam,
    fetchAdminRewards,
    fetchRewardsAndSocial,
    fetchBots,
    checkAuthServerHealth,
  ]);

  const revokeAdminUserSessions = useCallback(
    async (userId: string) => {
      try {
        const res = await authFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/revoke-sessions`, {
          method: 'POST',
        });
        const data = (await res.json()) as { error?: string; removed?: number };
        if (!res.ok) {
          pushToast({
            title: 'Admin Action Blocked',
            detail: data.error ?? 'Could not revoke sessions.',
            tone: 'negative',
          });
          return;
        }
        pushToast({
          title: 'Sessions Force-Revoked',
          detail: `Terminated ${data.removed ?? 0} active session(s).`,
          tone: 'info',
        });
        void fetchAdminTelemetry();
      } catch {
        // ignore
      }
    },
    [fetchAdminTelemetry, pushToast]
  );

  const toggleUserAdminRole = useCallback(
    async (userId: string, isAdmin: boolean) => {
      try {
        const res = await authFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/admin-role`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isAdmin }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          pushToast({
            title: 'Admin Role Update Failed',
            detail: data.error ?? 'Unable to update admin role.',
            tone: 'negative',
          });
          return;
        }
        pushToast({
          title: isAdmin ? 'Admin Role Granted' : 'Admin Role Revoked',
          detail: 'Directory and access privileges updated on server.',
          tone: 'positive',
        });
        void fetchAdminTelemetry();
      } catch {
        // ignore
      }
    },
    [fetchAdminTelemetry, pushToast]
  );

  const askAiAssistant = useCallback(
    async (payload: {
      message: string;
      symbol: string;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
    }): Promise<{ reply: string; poweredBy: string } | null> => {
      try {
        const res = await authFetch('/api/v1/ai/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { reply?: string; poweredBy?: string };
        return {
          reply: data.reply ?? 'No response returned.',
          poweredBy: data.poweredBy ?? 'Quantitative Engine',
        };
      } catch {
        return null;
      }
    },
    []
  );

  const runStressBenchmark = useCallback(
    async (concurrency = 250): Promise<StressTestResult | null> => {
      try {
        const res = await authFetch('/api/v1/engine/stress-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concurrency }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          result: StressTestResult;
          engineMetrics?: EngineMetrics;
        };
        setLastStressTest(data.result);
        if (data.engineMetrics) setEngineMetrics(data.engineMetrics);
        pushToast({
          title: `Stress Benchmark Complete (${data.result.concurrency} ops)`,
          detail: `${data.result.opsPerSec.toLocaleString()} ops/sec · p95 ${data.result.p95LatencyMs} ms`,
          tone: 'positive',
        });
        return data.result;
      } catch {
        return null;
      }
    },
    [pushToast]
  );

  const loginWithPrivateGitHubServer = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
    mfaRequired?: boolean;
  }> => {
    const res = await authJsonRequest<{
      ok?: boolean;
      error?: string;
      mfaRequired?: boolean;
      mfaChallenge?: MfaChallengePayload;
      user?: AuthUser;
      token?: string;
      githubOperator?: string;
    }>('/api/v1/auth/github/private-signin', { method: 'POST' });

    if (res.status === 0) {
      return { ok: false, error: 'Unable to reach Private GitHub Auth Server.' };
    }
    const data = res.data;
    if (res.ok && data?.mfaRequired && data.mfaChallenge) {
      setPendingMfa(data.mfaChallenge);
      return { ok: true, mfaRequired: true };
    }
    if (!res.ok || !data?.user) {
      return { ok: false, error: data?.error ?? `Private GitHub auth failed (HTTP ${res.status}).` };
    }
    if (data.token) storeBearerToken(data.token);
    setPendingMfa(null);
    setAuthUser(data.user);
    void refreshAuthState();
    pushToast({
      title: `GitHub Private Server Verified · @${data.githubOperator ?? data.user.name}`,
      detail: 'Authenticated via private GitHub server identity.',
      tone: 'positive',
    });
    return { ok: true };
  }, [pushToast, refreshAuthState]);

  const runPlatformSkill = useCallback(
    async (skillId: string): Promise<SkillExecutionResult | null> => {
      const res = await authJsonRequest<{ result?: SkillExecutionResult }>(
        `/api/v1/skills/${encodeURIComponent(skillId)}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: activeSymbol }),
        }
      );
      if (res.ok && res.data?.result) {
        return res.data.result;
      }
      return null;
    },
    [activeSymbol]
  );

  const fetchAgentLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/agents/leaderboard');
      if (!res.ok) return;
      const data = (await res.json()) as { agents?: AgentLivePerformance[] };
      if (Array.isArray(data.agents)) setAgentLeaderboard(data.agents);
    } catch {
      // ignore
    }
  }, []);

  const fetchGlobalMonitor = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/monitor/global');
      if (!res.ok) return;
      const data = (await res.json()) as GlobalMonitorSnapshot;
      if (data && Array.isArray(data.sessions)) setGlobalMonitor(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshConnectors = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/connectors/sync', { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as { connectors?: CcxtConnectorStatus[] };
      if (Array.isArray(data.connectors)) setConnectors(data.connectors);
    } catch {
      // ignore
    }
  }, []);

  const redeemPromoCode = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string; message?: string }> => {
      try {
        const res = await authFetch('/api/v1/promo/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          message?: string;
          profile?: ReferralPromoProfile;
          demoCashBalance?: number;
          cashBalance?: number;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error ?? 'Unable to apply promo code.' };
        }
        if (data.profile) setPromoProfile(data.profile);
        if (typeof data.demoCashBalance === 'number') setDemoCashBalance(data.demoCashBalance);
        if (typeof data.cashBalance === 'number') setCashBalance(data.cashBalance);
        pushToast({
          title: 'Promo Code Activated',
          detail: data.message ?? `Activated ${code}`,
          tone: 'positive',
        });
        return { ok: true, message: data.message };
      } catch {
        return { ok: false, error: 'Network error verifying promo code.' };
      }
    },
    [pushToast]
  );

  const recordPromoShare = useCallback(
    async (channel: string): Promise<{ ok: boolean; bonusAwardedUsd?: number }> => {
      try {
        const res = await authFetch('/api/v1/promo/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          bonusAwardedUsd?: number;
          profile?: ReferralPromoProfile;
          demoCashBalance?: number;
          cashBalance?: number;
        };
        if (res.ok && data.ok) {
          if (data.profile) setPromoProfile(data.profile);
          if (typeof data.demoCashBalance === 'number') setDemoCashBalance(data.demoCashBalance);
          if (typeof data.cashBalance === 'number') setCashBalance(data.cashBalance);
          if ((data.bonusAwardedUsd ?? 0) > 0) {
            pushToast({
              title: 'Referral Share Bonus Credited',
              detail: `+$${data.bonusAwardedUsd?.toLocaleString()} Demo bonus added for sharing Aurex.`,
              tone: 'positive',
            });
          }
          return { ok: true, bonusAwardedUsd: data.bonusAwardedUsd };
        }
        return { ok: false };
      } catch {
        return { ok: false };
      }
    },
    [pushToast]
  );

  const flushStorageToDisk = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await authFetch('/api/v1/engine/flush-storage', {
        method: 'POST',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; engineMetrics?: EngineMetrics };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error ?? 'Failed to flush persistent stores.' };
      }
      if (data.engineMetrics) setEngineMetrics(data.engineMetrics);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error flushing server stores.' };
    }
  }, []);

  const fetchKycStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/kyc/status');
      if (!res.ok) return;
      const data = (await res.json()) as { kyc?: KycVerificationRecord };
      if (data.kyc) setKycRecord(data.kyc);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (authUser?.id) {
      void fetchKycStatus();
    } else {
      setKycRecord(null);
    }
  }, [authUser?.id, fetchKycStatus]);

  const submitKyc = useCallback(
    async (payload: {
      country: string;
      fullName: string;
      docType: KycDocumentType;
      docNumber: string;
      proofOfAddressType: string;
      selfieLivenessToken: string;
      antiScamPledge: boolean;
    }): Promise<{ ok: boolean; error?: string; kyc?: KycVerificationRecord }> => {
      try {
        const envelopeHeader = await createEncryptedEnvelopeHeader('KYC_SUBMIT', payload);
        const res = await authFetch('/api/v1/kyc/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Aurex-Envelope': envelopeHeader,
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          kyc?: KycVerificationRecord;
          rewardsState?: UserRewardsState;
        };
        if (!res.ok || !data.ok || !data.kyc) {
          return { ok: false, error: data.error ?? 'KYC verification submission failed.' };
        }
        setKycRecord(data.kyc);
        if (data.rewardsState) setRewardsState(data.rewardsState);
        const profRes = await fetch('/api/v1/investors/profiles');
        if (profRes.ok) {
          const profData = (await profRes.json()) as { profiles?: InvestorProfile[] };
          if (Array.isArray(profData.profiles)) setInvestorProfiles(profData.profiles);
        }
        pushToast({
          title: 'Tier 2 KYC & Anti-Scam Shield Verified',
          detail: `Issued Badge ${data.kyc.badgeCode}`,
          tone: 'positive',
        });
        return { ok: true, kyc: data.kyc };
      } catch {
        return { ok: false, error: 'Network error submitting KYC.' };
      }
    },
    [pushToast]
  );

  const followInvestorProfile = useCallback(async (profileId: string) => {
    try {
      const res = await authFetch(`/api/v1/investors/profiles/${encodeURIComponent(profileId)}/follow`, {
        method: 'POST',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        profile?: InvestorProfile;
        socialGraph?: SocialGraphState;
        rewardsState?: UserRewardsState;
      };
      if (data.profile) {
        setInvestorProfiles((prev) =>
          prev.map((p) => (p.id === data.profile!.id ? data.profile! : p))
        );
      }
      if (data.socialGraph) setSocialGraph(data.socialGraph);
      if (data.rewardsState) setRewardsState(data.rewardsState);
    } catch {
      // ignore
    }
  }, []);

  const publishInvestorProfile = useCallback(
    async (payload: {
      title: string;
      style: string;
      country: string;
      focusMarkets: string[];
      bio: string;
    }): Promise<{ ok: boolean; error?: string; profile?: InvestorProfile }> => {
      try {
        const res = await authFetch('/api/v1/investors/profiles/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; profile?: InvestorProfile };
        if (!res.ok || !data.profile) {
          return { ok: false, error: data.error ?? 'Failed to publish profile.' };
        }
        setInvestorProfiles((prev) => {
          const exists = prev.some((p) => p.id === data.profile!.id);
          return exists
            ? prev.map((p) => (p.id === data.profile!.id ? data.profile! : p))
            : [data.profile!, ...prev];
        });
        pushToast({
          title: 'Investor Profile Published',
          detail: `${data.profile.handle} (${data.profile.verificationBadge}) is now live.`,
          tone: 'positive',
        });
        return { ok: true, profile: data.profile };
      } catch {
        return { ok: false, error: 'Network error publishing investor profile.' };
      }
    },
    [pushToast]
  );

  const submitScamReport = useCallback(
    async (payload: {
      suspectedHandle: string;
      channel: string;
      description: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/scam/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; report?: ScamReportRecord };
        if (!res.ok || !data.report) {
          return { ok: false, error: data.error ?? 'Could not submit scam report.' };
        }
        setScamReports((prev) => [data.report!, ...prev]);
        pushToast({
          title: 'Anti-Scam Report Logged',
          detail: `Flagged ${data.report.suspectedHandle} for impersonation review.`,
          tone: 'info',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error logging scam report.' };
      }
    },
    [pushToast]
  );

  const refreshNewsRadar = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/news/radar');
      if (!res.ok) return;
      const data = (await res.json()) as { news?: NewsItem[]; radar?: NextMoveInterestItem[] };
      if (Array.isArray(data.news)) setNews(data.news);
      if (Array.isArray(data.radar)) setNextMoveRadar(data.radar);
    } catch {
      // ignore
    }
  }, []);

  const fetchNetworkTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/network/telemetry');
      if (!res.ok) return;
      const data = (await res.json()) as { telemetry?: EncryptedNetworkTelemetry };
      if (data.telemetry) {
        setNetworkTelemetry(data.telemetry);
        if (data.telemetry.sessionKeyId) setActiveMeshKeyId(data.telemetry.sessionKeyId);
      }
    } catch {
      // ignore
    }
  }, []);

  const verifyNetworkEnvelope = useCallback(
    async (channel = 'SECURITY_AUDIT_PROBE'): Promise<{ ok: boolean; error?: string }> => {
      try {
        const body = { channel, clientTimestamp: Date.now() };
        const envelopeHeader = await createEncryptedEnvelopeHeader(channel, body);
        const res = await authFetch('/api/v1/network/verify-envelope', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Aurex-Envelope': envelopeHeader,
          },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          telemetry?: EncryptedNetworkTelemetry;
        };
        if (data.telemetry) setNetworkTelemetry(data.telemetry);
        if (!res.ok || !data.ok) {
          pushToast({
            title: 'Encrypted Tunnel Probe Rejected',
            detail: data.error ?? 'Envelope digest or anti-replay nonce rejected.',
            tone: 'negative',
          });
          return { ok: false, error: data.error };
        }
        pushToast({
          title: 'X25519 Encrypted Mesh Verified',
          detail: 'AES-256-GCM envelope digest & anti-replay nonce validated end-to-end.',
          tone: 'positive',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error testing encrypted mesh.' };
      }
    },
    [pushToast]
  );

  const fetchDiagnostics = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/diagnostics/status');
      if (!res.ok) return;
      const data = (await res.json()) as { report?: DiagnosticsReport };
      if (data.report) setDiagnosticsReport(data.report);
    } catch {
      // ignore
    }
  }, []);

  const solveDiagnosticIssue = useCallback(
    async (targetId = 'all'): Promise<{ ok: boolean; summary?: string }> => {
      try {
        const res = await authFetch('/api/v1/diagnostics/solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetId }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          summary?: string;
          fixedCount?: number;
          report?: DiagnosticsReport;
        };
        if (data.report) setDiagnosticsReport(data.report);
        if (!res.ok) {
          pushToast({
            title: 'Auto-Remediation Restricted',
            detail: data.error ?? data.summary ?? 'Action requires Founder privileges.',
            tone: 'negative',
          });
          return { ok: false, summary: data.error };
        }
        pushToast({
          title: 'Built-In Bug Solver Complete',
          detail: data.summary ?? `Repaired ${data.fixedCount ?? 0} diagnostic issue(s).`,
          tone: 'positive',
        });
        return { ok: true, summary: data.summary };
      } catch {
        return { ok: false, summary: 'Network error running diagnostics solver.' };
      }
    },
    [pushToast]
  );

  const fetchDefenseAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/security/defense-team');
      if (!res.ok) return;
      const data = (await res.json()) as { agents?: HackDefenseAgent[] };
      if (Array.isArray(data.agents)) setDefenseAgents(data.agents);
    } catch {
      // ignore
    }
  }, []);

  const createBot = useCallback(
    async (payload: {
      name: string;
      symbol: string;
      strategy: BotStrategyType;
      allocatedUsd: number;
      orderSizeUnits: number;
      gridLower?: number;
      gridUpper?: number;
      gridLevels?: number;
      intervalSec?: number;
      maxDrawdownPct?: number;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          error?: string;
          bot?: TradingBotRecord;
          bots?: TradingBotRecord[];
          rewardsState?: UserRewardsState;
        };
        if (!res.ok || !data.bot) {
          pushToast({
            title: 'Smart Bot Rejected',
            detail: data.error ?? 'Check bot capital allocation or parameters.',
            tone: 'negative',
          });
          return { ok: false, error: data.error };
        }
        if (Array.isArray(data.bots)) setBots(data.bots);
        if (data.rewardsState) setRewardsState(data.rewardsState);
        pushToast({
          title: `Smart Bot Deployed · ${data.bot.strategy}`,
          detail: `${data.bot.name} running on ${data.bot.symbol} (${data.bot.accountMode.toUpperCase()})`,
          tone: 'positive',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error creating trading bot.' };
      }
    },
    [pushToast]
  );

  const toggleBot = useCallback(
    async (botId: string) => {
      try {
        const res = await authFetch(`/api/v1/bots/${encodeURIComponent(botId)}/toggle`, {
          method: 'POST',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { bots?: TradingBotRecord[] };
        if (Array.isArray(data.bots)) setBots(data.bots);
      } catch {
        // ignore
      }
    },
    []
  );

  const deleteBot = useCallback(
    async (botId: string) => {
      try {
        const res = await authFetch(`/api/v1/bots/${encodeURIComponent(botId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { bots?: TradingBotRecord[] };
        if (Array.isArray(data.bots)) setBots(data.bots);
      } catch {
        // ignore
      }
    },
    []
  );

  const claimQuestReward = useCallback(
    async (questId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authFetch('/api/v1/rewards/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questId }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          rewardsState?: UserRewardsState;
          bonusDemoUsd?: number;
          demoCashBalance?: number;
          cashBalance?: number;
        };
        if (data.rewardsState) setRewardsState(data.rewardsState);
        if (!res.ok || !data.ok) {
          pushToast({
            title: 'Quest Not Ready',
            detail: data.error ?? 'Complete the quest requirements first.',
            tone: 'negative',
          });
          return { ok: false, error: data.error };
        }
        if (typeof data.demoCashBalance === 'number') setDemoCashBalance(data.demoCashBalance);
        if (typeof data.cashBalance === 'number') setCashBalance(data.cashBalance);
        pushToast({
          title: 'Quest Reward Claimed',
          detail: `+$${(data.bonusDemoUsd ?? 0).toLocaleString()} Demo Bonus & XP credited.`,
          tone: 'positive',
        });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error claiming quest.' };
      }
    },
    [pushToast]
  );

  const runFounderAiReview = useCallback(async () => {
    try {
      const res = await authFetch('/api/v1/admin/ai-team/review', { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as { teamState?: FounderAiTeamState };
      if (data.teamState) {
        setFounderAiTeam(data.teamState);
        pushToast({
          title: 'Founder AI Team Cycle Complete',
          detail: `Audited security & runtime telemetry for ${data.teamState.platformVersion}.`,
          tone: 'positive',
        });
      }
    } catch {
      // ignore
    }
  }, [pushToast]);

  const applyFounderAiProposal = useCallback(
    async (proposalId: string): Promise<{ ok: boolean }> => {
      try {
        const res = await authFetch(`/api/v1/admin/ai-team/proposals/${encodeURIComponent(proposalId)}/apply`, {
          method: 'POST',
        });
        const data = (await res.json()) as {
          ok?: boolean;
          summary?: string;
          teamState?: FounderAiTeamState;
        };
        if (data.teamState) setFounderAiTeam(data.teamState);
        if (res.ok && data.ok) {
          pushToast({
            title: `Platform Upgrade Deployed (${data.teamState?.platformVersion ?? 'v2.4'})`,
            detail: data.summary ?? 'Founder AI proposal executed on live server.',
            tone: 'positive',
          });
          void fetchAdminRewards();
          return { ok: true };
        }
        return { ok: false };
      } catch {
        return { ok: false };
      }
    },
    [fetchAdminRewards, pushToast]
  );

  const createAdminRewardCampaign = useCallback(
    async (payload: {
      code: string;
      title: string;
      bonusDemoUsd: number;
      xpReward: number;
      feeDiscountPct: number;
    }): Promise<{ ok: boolean }> => {
      try {
        const res = await authFetch('/api/v1/admin/rewards/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { overview?: AdminRewardsOverview };
        if (data.overview) setAdminRewards(data.overview);
        if (res.ok) {
          pushToast({
            title: `Reward Campaign Launched (${payload.code.toUpperCase()})`,
            detail: payload.title,
            tone: 'positive',
          });
          return { ok: true };
        }
        return { ok: false };
      } catch {
        return { ok: false };
      }
    },
    [pushToast]
  );

  const toggleAdminRewardCampaign = useCallback(async (campaignId: string) => {
    try {
      const res = await authFetch(`/api/v1/admin/rewards/campaigns/${encodeURIComponent(campaignId)}/toggle`, {
        method: 'POST',
      });
      const data = (await res.json()) as { overview?: AdminRewardsOverview };
      if (data.overview) setAdminRewards(data.overview);
    } catch {
      // ignore
    }
  }, []);

  const grantAdminReward = useCallback(
    async (payload: { targetUserId: string; xpAmount: number; bonusDemoUsd: number }) => {
      try {
        const res = await authFetch('/api/v1/admin/rewards/grant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { overview?: AdminRewardsOverview };
        if (data.overview) setAdminRewards(data.overview);
        if (res.ok) {
          pushToast({
            title: 'Founder Reward Grant Dispatched',
            detail: `+${payload.xpAmount} XP & +$${payload.bonusDemoUsd.toLocaleString()} credited.`,
            tone: 'positive',
          });
        }
      } catch {
        // ignore
      }
    },
    [pushToast]
  );

  return {
    connected,
    reconnecting,
    socketError,
    loading,
    authChecking,
    authUser,
    authSessions,
    passkeys,
    oauthProviders,
    oauthDiagnostics,
    authServerStatus,
    skills,
    pendingMfa,
    engineMetrics,
    lastStressTest,
    clientId,
    instruments,
    predictions,
    patterns,
    insights,
    news,
    activeSymbol,
    activeTimeframe,
    candles,
    orderBook,
    recentTrades,
    accountMode,
    cashBalance,
    demoCashBalance,
    realCashBalance,
    vaultBalanceUsd,
    orders,
    positions,
    alerts,
    deskMembers,
    apiKeys,
    setApiKeys,
    setNews,
    nexusReport,
    agentLeaderboard,
    globalMonitor,
    promoProfile,
    auditLogs,
    riskEvents,
    bankAccounts,
    vaultTransfers,
    firewallIncidents,
    securityStatus,
    socialPosts,
    contributors,
    adminOverview,
    adminUsers,
    adminAuthEvents,
    toasts,
    dismissToast,
    pushToast,
    selectSymbol,
    selectTimeframe,
    placeOrder,
    cancelOrder,
    createAlert,
    deleteAlert,
    updateDeskIdentity,
    resetPortfolio,
    evaluateNexusAgents,
    executeNexusTrade,
    toggleLockdown,
    verifyVaultChain,
    requestVaultChallenge,
    switchAccountMode,
    transferVaultShield,
    linkBankAccount,
    submitVaultTransfer,
    runWafProbe,
    publishSocialPost,
    toggleLikePost,
    toggleFollowContributor,
    loginAccount,
    verifyMfaCode,
    clearPendingMfa,
    registerNewAccount,
    logoutAccount,
    refreshSessions,
    revokeOtherSessions,
    updateUserPrefs,
    setupTotp,
    confirmTotp,
    disableTotp,
    enrollPasskey,
    removePasskey,
    loginWithPasskey,
    startOAuthLogin,
    checkAuthServerHealth,
    loginWithPrivateGitHubServer,
    runPlatformSkill,
    toggleRealMoneyMode,
    fetchAdminTelemetry,
    revokeAdminUserSessions,
    toggleUserAdminRole,
    askAiAssistant,
    runStressBenchmark,
    fetchAgentLeaderboard,
    fetchGlobalMonitor,
    connectors,
    refreshConnectors,
    redeemPromoCode,
    recordPromoShare,
    flushStorageToDisk,
    kycRecord,
    fetchKycStatus,
    submitKyc,
    investorProfiles,
    followInvestorProfile,
    publishInvestorProfile,
    scamReports,
    submitScamReport,
    countryGuidelines,
    bankDirectory,
    nextMoveRadar,
    refreshNewsRadar,
    networkTelemetry,
    fetchNetworkTelemetry,
    verifyNetworkEnvelope,
    diagnosticsReport,
    fetchDiagnostics,
    solveDiagnosticIssue,
    defenseAgents,
    fetchDefenseAgents,
    bots,
    fetchBots,
    createBot,
    toggleBot,
    deleteBot,
    rewardsState,
    socialGraph,
    fetchRewardsAndSocial,
    claimQuestReward,
    founderAiTeam,
    fetchFounderAiTeam,
    runFounderAiReview,
    applyFounderAiProposal,
    adminRewards,
    fetchAdminRewards,
    createAdminRewardCampaign,
    toggleAdminRewardCampaign,
    grantAdminReward,
  };
}
