import { useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Cpu,
  Database,
  Download,
  FileText,
  Gift,
  KeyRound,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import type {
  AdminRewardsOverview,
  AdminServerOverview,
  AdminUserDirectoryEntry,
  AuthAuditEvent,
  DiagnosticsReport,
  FounderAiTeamState,
  HackDefenseAgent,
} from '../types/market';
import { authFetch } from '../hooks/useMarketSocket';
import { downloadCsv, formatCurrency, formatTimeShort } from '../utils/format';

interface AdminConsoleViewProps {
  overview: AdminServerOverview | null;
  users: AdminUserDirectoryEntry[];
  authEvents: AuthAuditEvent[];
  founderAiTeam?: FounderAiTeamState | null;
  adminRewards?: AdminRewardsOverview | null;
  diagnosticsReport?: DiagnosticsReport | null;
  defenseAgents?: HackDefenseAgent[];
  onRefresh: () => Promise<boolean>;
  onRevokeUserSessions: (userId: string) => Promise<void>;
  onRunFounderAiReview?: () => Promise<void>;
  onApplyFounderProposal?: (proposalId: string) => Promise<{ ok: boolean }>;
  onCreateRewardCampaign?: (payload: {
    code: string;
    title: string;
    bonusDemoUsd: number;
    xpReward: number;
    feeDiscountPct: number;
  }) => Promise<{ ok: boolean }>;
  onToggleRewardCampaign?: (campaignId: string) => Promise<void>;
  onGrantReward?: (payload: {
    targetUserId: string;
    xpAmount: number;
    bonusDemoUsd: number;
  }) => Promise<void>;
  onSolveDiagnostics?: (targetId?: string) => Promise<{ ok: boolean; summary?: string }>;
}

type EventFilter = 'ALL' | 'REGISTRATIONS' | 'LOGINS' | 'MFA_PASSKEY' | 'FAILURES' | 'REAL_MONEY';
type AdminSubTab = 'telemetry' | 'ai_team' | 'defense_solver' | 'rewards';

export function AdminConsoleView({
  overview,
  users,
  authEvents,
  founderAiTeam = null,
  adminRewards = null,
  diagnosticsReport = null,
  defenseAgents = [],
  onRefresh,
  onRevokeUserSessions,
  onRunFounderAiReview,
  onApplyFounderProposal,
  onCreateRewardCampaign,
  onToggleRewardCampaign,
  onGrantReward,
  onSolveDiagnostics,
}: AdminConsoleViewProps) {
  const [adminTab, setAdminTab] = useState<AdminSubTab>('telemetry');
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const [query, setQuery] = useState('');
  const [busyRefresh, setBusyRefresh] = useState(false);
  const [busyExportGuide, setBusyExportGuide] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Campaign creation form state
  const [campCode, setCampCode] = useState('FOUNDER50');
  const [campTitle, setCampTitle] = useState('Founder VIP Liquidity Boost');
  const [campBonusUsd, setCampBonusUsd] = useState('50000');
  const [campXp, setCampXp] = useState('500');
  const [campFeePct, setCampFeePct] = useState('25');
  const [campBusy, setCampBusy] = useState(false);

  const handleRefresh = async () => {
    setBusyRefresh(true);
    await onRefresh();
    setBusyRefresh(false);
  };

  const handleExportGuide = async () => {
    setBusyExportGuide(true);
    setExportError(null);
    try {
      const res = await authFetch('/api/v1/admin/export/app-guide');
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setExportError(errData.error ?? `Export failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'APP_KEYS_AND_INFO.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Failed to download server architecture guide.');
    } finally {
      setBusyExportGuide(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return authEvents.filter((ev) => {
      if (filter === 'REGISTRATIONS' && !ev.eventType.startsWith('REGISTER')) return false;
      if (
        filter === 'LOGINS' &&
        ev.eventType !== 'LOGIN_SUCCESS' &&
        ev.eventType !== 'OAUTH_SIGNIN' &&
        ev.eventType !== 'SESSION_LOGOUT'
      ) {
        return false;
      }
      if (
        filter === 'MFA_PASSKEY' &&
        !ev.eventType.includes('MFA') &&
        !ev.eventType.includes('TOTP') &&
        !ev.eventType.includes('PASSKEY')
      ) {
        return false;
      }
      if (filter === 'FAILURES' && ev.outcome !== 'FAILED' && ev.outcome !== 'BLOCKED') {
        return false;
      }
      if (filter === 'REAL_MONEY' && !ev.eventType.startsWith('REAL_MONEY')) {
        return false;
      }

      if (!q) return true;
      return (
        ev.email.toLowerCase().includes(q) ||
        (ev.name ?? '').toLowerCase().includes(q) ||
        ev.eventType.toLowerCase().includes(q) ||
        ev.maskedIp.toLowerCase().includes(q) ||
        ev.detail.toLowerCase().includes(q)
      );
    });
  }, [authEvents, filter, query]);

  const handleExportEventsCsv = () => {
    downloadCsv(
      `aurex-founder-auth-telemetry-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredEvents.map((ev) => ({
        id: ev.id,
        timestamp: new Date(ev.createdAt).toISOString(),
        eventType: ev.eventType,
        outcome: ev.outcome,
        method: ev.method,
        userId: ev.userId ?? '',
        email: ev.email,
        name: ev.name ?? '',
        maskedIp: ev.maskedIp,
        userAgent: ev.userAgent,
        detail: ev.detail,
        entryHash: ev.entryHash,
      }))
    );
  };

  const handleExportUsersCsv = () => {
    downloadCsv(
      `aurex-founder-users-${new Date().toISOString().slice(0, 10)}.csv`,
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isAdmin: u.isAdmin ? 'Yes' : 'No',
        experienceMode: u.experienceMode,
        marketFocus: u.marketFocus,
        contactPhone: u.contactPhone ?? '',
        totpEnabled: u.totpEnabled ? 'Yes' : 'No',
        passkeysCount: u.passkeysCount,
        realMoneyEnabled: u.realMoneyEnabled ? 'Yes' : 'No',
        linkedProviders: u.linkedProviders.join('|'),
        activeSessions: u.activeSessions,
        cashBalanceUsd: u.cashBalance,
        createdAt: new Date(u.createdAt).toISOString(),
        lastLoginAt: new Date(u.lastLoginAt).toISOString(),
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Founder Admin Security Telemetry &amp; Authentication Server Ledger
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live HMAC-chained audit stream of every registration, sign-in, failed attempt, MFA challenge, OAuth flow, passkey binding, and Real-Money Custody activation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={busyRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busyRefresh ? 'animate-spin' : ''}`} />
              Sync Server Store
            </button>
            <button
              type="button"
              onClick={() => void handleExportGuide()}
              disabled={busyExportGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              {busyExportGuide ? 'Exporting...' : 'Download APP_KEYS_AND_INFO.md'}
            </button>
          </div>
        </div>
        {exportError && (
          <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
            {exportError}
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3" /> Registered Accounts
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
              {overview?.totalUsers ?? users.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Active Sessions
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {overview?.activeSessions ?? 0}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Auth Events Logged
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
              {overview?.totalAuthEvents ?? authEvents.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Failed / Blocked Logins
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-red-600 dark:text-red-400">
              {overview?.failedAuthEvents ?? 0}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Real-Money Custody Ready
            </div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-blue-600 dark:text-blue-400">
              {overview?.realMoneyEnabledUsers ?? 0} active · {overview?.dualMfaReadyUsers ?? 0} 2FA+
            </div>
          </div>
        </div>

        {/* Founder Admin Navigation Bar */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs">
          {(
            [
              { id: 'telemetry', label: 'Telemetry & Users', icon: Database },
              { id: 'ai_team', label: `Founder AI Team (${founderAiTeam?.platformVersion ?? 'v2.4'})`, icon: Bot },
              { id: 'defense_solver', label: `Bug Solver & Hack Defense (${diagnosticsReport?.healthScorePct ?? 100}%)`, icon: Wrench },
              { id: 'rewards', label: 'Rewards Governance', icon: Gift },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAdminTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  adminTab === t.id
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {adminTab === 'telemetry' && (
        <>

      {/* Live Authentication & Registration Telemetry Table */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Real-Time Login, Registration &amp; Authentication Feed ({filteredEvents.length})
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Persisted to <span className="font-mono">{overview?.storageFile ?? 'data/meridian-admin-store.json'}</span> · Passwords &amp; TOTP secrets are scrubbed before logging.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search email, IP, event..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white w-48"
              />
            </div>

            <button
              type="button"
              onClick={handleExportEventsCsv}
              disabled={filteredEvents.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Auth CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5 bg-slate-50/70 dark:bg-slate-900/40 text-xs">
          {(
            [
              { id: 'ALL', label: 'All Events' },
              { id: 'REGISTRATIONS', label: 'Registrations' },
              { id: 'LOGINS', label: 'Sign-Ins / OAuth' },
              { id: 'MFA_PASSKEY', label: 'MFA & Passkeys' },
              { id: 'FAILURES', label: 'Failed / Blocked' },
              { id: 'REAL_MONEY', label: 'Real-Money Custody' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">User / Email</th>
                <th className="py-2.5 px-3">Source IP &amp; Client</th>
                <th className="py-2.5 px-4">Telemetry Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No matching authentication events recorded yet.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatTimeShort(ev.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {ev.eventType}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-mono font-semibold whitespace-nowrap ${
                        ev.outcome === 'SUCCESS'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ev.outcome === 'CHALLENGE'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {ev.outcome}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 uppercase whitespace-nowrap">
                      {ev.method}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-slate-900 dark:text-white">{ev.email}</div>
                      {ev.name && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {ev.name} {ev.role ? `· ${ev.role}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <div>{ev.maskedIp}</div>
                      <div className="truncate max-w-[170px] font-sans text-[10px]">
                        {ev.userAgent}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-200 min-w-[240px]">
                      <div>{ev.detail}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        HMAC: {ev.entryHash.slice(0, 14)}…
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registered User Directory */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Registered Investor &amp; Desk Directory ({users.length})
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Complete profile, MFA security posture, linked OAuth providers, and custody ledger cash balances.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportUsersCsv}
            disabled={users.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Users CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-2.5 px-4">Investor / Email</th>
                <th className="py-2.5 px-3">Market Focus &amp; Mode</th>
                <th className="py-2.5 px-3">MFA &amp; OAuth Posture</th>
                <th className="py-2.5 px-3">Custody Mode</th>
                <th className="py-2.5 px-3 text-right">Cash Balance</th>
                <th className="py-2.5 px-3 text-right">Sessions</th>
                <th className="py-2.5 px-4 text-right">Admin Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {u.name}{' '}
                      {u.email.toLowerCase() === 'vemulavankeswararao@gmail.com' && u.isAdmin && (
                        <span className="ml-1 font-mono text-[10px] text-[#F0B90B]">
                          [FOUNDER ADMIN]
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {u.email}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {u.role}
                      {u.contactPhone ? ` · ${u.contactPhone}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-slate-800 dark:text-slate-200">{u.marketFocus}</div>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                      {u.experienceMode} · {u.ordersCount} orders
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px]">
                    <div className="text-slate-800 dark:text-slate-200">
                      TOTP: {u.totpEnabled ? 'YES' : 'NO'} · Keys: {u.passkeysCount}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      OAuth: {u.linkedProviders.length ? u.linkedProviders.join(', ') : 'None'}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] font-semibold whitespace-nowrap">
                    <span
                      className={
                        u.realMoneyEnabled
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {u.realMoneyEnabled ? 'REAL-MONEY' : 'SIMULATION'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(u.cashBalance)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {u.activeSessions}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void onRevokeUserSessions(u.id)}
                        disabled={u.activeSessions === 0}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 whitespace-nowrap"
                      >
                        <LogOut className="w-3 h-3" />
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Server Keys & Configuration Posture (Secret Values Never Exposed) */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Server Environment Keys &amp; Cryptographic Subsystems
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Operational readiness check for server-side secrets (raw values remain strictly isolated on the server).
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Uptime: {overview?.uptimeSec ?? 0}s · {overview?.storageBackend ?? 'Server Store'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {(overview?.keyStatus ?? []).map((item) => (
            <div
              key={item.keyName}
              className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-mono font-semibold text-slate-900 dark:text-white">
                  {item.keyName}
                </div>
                <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  {item.scope}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.purpose}
                </p>
              </div>
              <span
                className={`font-mono text-[11px] font-semibold shrink-0 ${
                  item.status === 'CONFIGURED'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : item.status === 'RUNTIME_EPHEMERAL'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* Tab 2: Founder-Only AI Admin & Platform Evolution Team */}
      {adminTab === 'ai_team' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F0B90B]" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Founder Executive AI Board ({founderAiTeam?.platformVersion ?? 'v2.4.0'})
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Exclusive 5-agent engineering, compliance, cyber, execution &amp; growth advisory board reporting solely to {founderAiTeam?.founderEmail ?? 'Founder'}.
                </p>
              </div>
              {onRunFounderAiReview && (
                <button
                  type="button"
                  onClick={() => void onRunFounderAiReview()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run AI Architecture Review
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
              {(founderAiTeam?.members ?? []).map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{m.name}</span>
                    <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {m.status}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#D9A70A] dark:text-[#F0B90B]">{m.role}</div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {m.lastInsight}
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Focus: {m.focusMetric}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Versioned Feature &amp; Security Upgrade Proposals
            </h3>
            <div className="space-y-2.5 text-xs">
              {(founderAiTeam?.proposals ?? []).map((prop) => (
                <div
                  key={prop.id}
                  className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="font-semibold text-[#F0B90B]">{prop.versionTag}</span>
                      <span className="text-slate-500">· {prop.priority}</span>
                      <span className="text-slate-500">· {prop.impactArea}</span>
                      <span className="text-slate-500">· {prop.authorRole}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{prop.title}</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{prop.rationale}</p>
                  </div>

                  <button
                    type="button"
                    disabled={prop.status === 'APPLIED'}
                    onClick={() => void onApplyFounderProposal?.(prop.id)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded whitespace-nowrap ${
                      prop.status === 'APPLIED'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {prop.status === 'APPLIED' ? 'Deployed' : 'Deploy Upgrade'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Built-In Self-Diagnostics Bug Solver & Hack Defense Squad */}
      {adminTab === 'defense_solver' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Autonomous Diagnostics &amp; Bug Solver ({diagnosticsReport?.healthScorePct ?? 100}%)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Real-time runtime invariants check with Founder one-click remediation.
                </p>
              </div>
              {onSolveDiagnostics && (
                <button
                  type="button"
                  onClick={() => void onSolveDiagnostics('all')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11]"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Execute Founder Auto-Remediation
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {(diagnosticsReport?.probes ?? []).map((probe) => (
                <div
                  key={probe.id}
                  className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {probe.name} · <span className="font-mono text-[10px] text-slate-500">{probe.category}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">{probe.summary}</div>
                    <div className="font-mono text-[10px] text-slate-500 mt-0.5">{probe.measuredValue}</div>
                  </div>
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      probe.status === 'PASS'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : probe.status === 'WARN'
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }`}
                  >
                    {probe.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Cpu className="w-4 h-4 text-emerald-500" />
              <span>6-Agent Hack Protection Command</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
              {defenseAgents.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-1"
                >
                  <div className="flex justify-between font-mono font-semibold">
                    <span className="text-slate-900 dark:text-white">{a.codename}</span>
                    <span className="text-emerald-500">{a.threatsNeutralized} blocked</span>
                  </div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400">{a.role}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{a.latestAction}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Founder Rewards Team & Anti-Sybil Governance */}
      {adminTab === 'rewards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 text-xs font-mono tabular-nums">
            <div>
              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">Total XP Distributed</div>
              <div className="text-base font-semibold text-[#F0B90B]">
                {(adminRewards?.totalXpDistributed ?? 0).toLocaleString()} XP
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">Demo Bonuses Issued</div>
              <div className="text-base font-semibold text-emerald-500">
                {formatCurrency(adminRewards?.totalBonusDemoGrantedUsd ?? 0)}
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">Quests Claimed</div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {adminRewards?.totalQuestsClaimed ?? 0}
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">Anti-Sybil Alerts</div>
              <div className="text-base font-semibold text-red-500">
                {adminRewards?.sybilFlagsCount ?? 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onCreateRewardCampaign) return;
                setCampBusy(true);
                await onCreateRewardCampaign({
                  code: campCode.trim().toUpperCase(),
                  title: campTitle.trim(),
                  bonusDemoUsd: Number.parseFloat(campBonusUsd) || 10000,
                  xpReward: Number.parseInt(campXp, 10) || 250,
                  feeDiscountPct: Number.parseFloat(campFeePct) || 10,
                });
                setCampBusy(false);
              }}
              className="lg:col-span-5 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 text-xs"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Launch Promo &amp; Reward Campaign
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={campCode}
                  onChange={(e) => setCampCode(e.target.value)}
                  placeholder="Code (e.g. AUREX50)"
                  className="px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
                <input
                  type="text"
                  required
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  placeholder="Campaign Title"
                  className="px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
                <input
                  type="number"
                  required
                  value={campBonusUsd}
                  onChange={(e) => setCampBonusUsd(e.target.value)}
                  placeholder="Demo Bonus ($)"
                  className="px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
                <input
                  type="number"
                  required
                  value={campXp}
                  onChange={(e) => setCampXp(e.target.value)}
                  placeholder="XP Reward"
                  className="px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <input
                type="number"
                required
                value={campFeePct}
                onChange={(e) => setCampFeePct(e.target.value)}
                placeholder="Fee Discount (%)"
                className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              <button
                type="submit"
                disabled={campBusy}
                className="w-full py-2 font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
              >
                {campBusy ? 'Launching...' : 'Activate Campaign'}
              </button>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                {(adminRewards?.campaigns ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{c.code}</span>{' '}
                      <span className="text-slate-500">· {c.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onToggleRewardCampaign?.(c.id)}
                      className={`px-2 py-0.5 font-mono rounded ${
                        c.active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {c.active ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </div>
                ))}
              </div>
            </form>

            <div className="lg:col-span-7 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white">
                Top Reward Holders &amp; Anti-Sybil Audit
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                      <th className="py-2 px-4">Investor</th>
                      <th className="py-2 px-3">Tier &amp; XP</th>
                      <th className="py-2 px-3">Sybil Risk</th>
                      <th className="py-2 px-4 text-right">Founder Grant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                    {(adminRewards?.topRewardHolders ?? []).map((h) => (
                      <tr key={h.userId}>
                        <td className="py-2.5 px-4 font-sans">
                          <div className="font-semibold text-slate-900 dark:text-white">{h.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{h.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {h.tierName} · {h.xpPoints} XP ({h.questsClaimed} quests)
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={h.flaggedSybil ? 'text-red-500 font-semibold' : 'text-emerald-500'}>
                            {h.flaggedSybil ? 'FLAGGED' : 'CLEAN'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-sans">
                          {onGrantReward && (
                            <button
                              type="button"
                              onClick={() =>
                                void onGrantReward({
                                  targetUserId: h.userId,
                                  xpAmount: 250,
                                  bonusDemoUsd: 10000,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold rounded border border-[#F0B90B]/50 text-[#B45309] dark:text-[#F0B90B] hover:bg-[#F0B90B]/10"
                            >
                              +250 XP / +$10K
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
