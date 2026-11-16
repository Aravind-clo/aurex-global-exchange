import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Gauge,
  GitBranch,
  HardDrive,
  Laptop,
  Monitor,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { EngineMetrics, StressTestResult } from '../types/market';
import type {
  GitHubPrivateServerStatusClient,
  PlatformSkillInfo,
  SkillExecutionResult,
} from '../hooks/useMarketSocket';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PerformanceDataViewProps {
  engineMetrics?: EngineMetrics;
  stressResult: StressTestResult | null;
  totalInstruments: number;
  connected: boolean;
  skills?: PlatformSkillInfo[];
  activeSymbol?: string;
  githubPrivateServer?: GitHubPrivateServerStatusClient;
  isFounder?: boolean;
  onRunSkill?: (skillId: string) => Promise<SkillExecutionResult | null>;
  onRunStressTest: (concurrency: number) => Promise<void>;
  onFlushStorage: () => Promise<{ ok: boolean; error?: string }>;
  onNotify: (msg: string) => void;
}

export const PerformanceDataView: React.FC<PerformanceDataViewProps> = ({
  engineMetrics,
  stressResult,
  totalInstruments,
  connected,
  skills = [],
  activeSymbol = 'NVDA',
  githubPrivateServer,
  isFounder = false,
  onRunSkill,
  onRunStressTest,
  onFlushStorage,
  onNotify,
}) => {
  const [runningLoad, setRunningLoad] = useState<number | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [runningSkillId, setRunningSkillId] = useState<string | null>(null);
  const [skillResult, setSkillResult] = useState<SkillExecutionResult | null>(null);
  const { canNativeInstall, isInstalled, platform, promptInstall } = usePWAInstall();

  const handleBenchmark = async (concurrency: number) => {
    setRunningLoad(concurrency);
    try {
      await onRunStressTest(concurrency);
      onNotify(`Completed ${concurrency}-op parallel engine stress benchmark.`);
    } finally {
      setRunningLoad(null);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const res = await onFlushStorage();
      if (res.ok) {
        onNotify('Flushed Auth Telemetry, User Workspaces, and 116-Market State atomically to disk.');
      } else {
        onNotify(res.error || 'Failed to flush storage checkpoints.');
      }
    } finally {
      setFlushing(false);
    }
  };

  const handleExecuteSkill = async (skillId: string) => {
    if (!onRunSkill) return;
    setRunningSkillId(skillId);
    try {
      const result = await onRunSkill(skillId);
      if (result) {
        setSkillResult(result);
        onNotify(`Executed skill: ${result.skillName}`);
      } else {
        onNotify('Skill execution unavailable right now.');
      }
    } finally {
      setRunningSkillId(null);
    }
  };

  const formatUptime = (sec = 0) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const rem = sec % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${rem}s`;
  };

  const stores = engineMetrics?.storageStores ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              High-Performance Engine, Persistent Storage & Cross-Platform Telemetry
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time O(1) WebSocket broadcast fanout, event-loop lag telemetry, atomic server disk ledgers, and Android / Apple / Windows / MacBook install readiness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={flushing}
            onClick={() => void handleFlush()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${flushing ? 'animate-spin' : ''}`} />
            <span>{flushing ? 'Flushing Ledgers...' : 'Flush Storage to Disk'}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">WS Connections</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
            {engineMetrics?.activeConnections ?? 0}
          </div>
          <div className="text-[10px] text-emerald-500 font-medium mt-0.5">
            {connected ? 'Live Fanout' : 'Reconnecting'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Global Markets</div>
          <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
            {engineMetrics?.totalInstruments ?? totalInstruments}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Crypto · Equities · FX</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Ticks Processed</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
            {(engineMetrics?.ticksProcessed ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Rotating Batch Stream</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Orders Matched</div>
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
            {(engineMetrics?.ordersMatched ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Atomic Fill Engine</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">API P95 Latency</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
            {engineMetrics?.p95ApiLatencyMs ?? 0}ms
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Express Router</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Event Loop Lag</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
            {engineMetrics?.eventLoopLagMs ?? 0}ms
          </div>
          <div className="text-[10px] text-emerald-500 mt-0.5">P95 Node Loop</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Cache Hit Ratio</div>
          <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
            {engineMetrics?.snapshotCacheHitRatePct ?? 0}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Snapshot Buffer</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">RSS / Uptime</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
            {engineMetrics?.memoryRssMb ?? 0}MB
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{formatUptime(engineMetrics?.uptimeSec)}</div>
        </div>
      </div>

      {/* Persistent Server Data Stores + Stress Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Atomic Persistent Data Stores (.tmp → renameSync)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Active Desks: {engineMetrics?.authenticatedUsers ?? 0} · Rooms: {engineMetrics?.subscribedRooms ?? 0}
            </span>
          </div>

          <div className="space-y-2">
            {stores.length === 0 ? (
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                Waiting for first telemetry heartbeat from storage monitor...
              </div>
            ) : (
              stores.map((store) => (
                <div
                  key={store.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {store.name}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                      {isFounder ? store.filePath : 'Encrypted Server Vault'} · {store.integrity} · {store.recordsCount} records
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {(store.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        store.sizeBytes > 0
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {store.sizeBytes > 0 ? 'PERSISTED' : 'PENDING FLUSH'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Engine Stress Benchmark */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              High-Traffic Engine Stress Benchmark
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Simulate concurrent institutional order evaluations, ML predictions, and snapshot cache hits directly on the server engine.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {[100, 250, 500, 1000].map((level) => (
              <button
                key={level}
                type="button"
                disabled={runningLoad !== null}
                onClick={() => void handleBenchmark(level)}
                className="py-2 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111E] hover:border-blue-500 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50"
              >
                {runningLoad === level ? '...' : `${level} ops`}
              </button>
            ))}
          </div>

          {stressResult ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Throughput</div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {stressResult.opsPerSec.toLocaleString()} ops/s
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">P95 Op Latency</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {stressResult.p95LatencyMs} ms
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Batch Duration</div>
                <div className="font-mono text-slate-700 dark:text-slate-300">
                  {stressResult.durationMs} ms ({stressResult.succeeded}/{stressResult.totalOperations})
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">WAF Interference</div>
                <div className="font-mono text-slate-700 dark:text-slate-300">
                  {stressResult.blockedByWaf} blocked
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>Run any concurrency load tier above to inspect live throughput & P95 latency.</span>
            </div>
          )}
        </div>
      </div>

      {/* Required Platform Skills Engine & Private GitHub Auth Server */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Required Platform &amp; Quant Execution Skills ({skills.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Active Context: {activeSymbol}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {skills.map((skill) => {
              const isRunning = runningSkillId === skill.id;
              return (
                <div
                  key={skill.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E] p-3 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {skill.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] shrink-0">
                        {skill.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {skill.summary}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 truncate">
                      {skill.inputsHint}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(runningSkillId) || !onRunSkill}
                      onClick={() => void handleExecuteSkill(skill.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-semibold shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      <span>{isRunning ? 'Running...' : 'Run Skill'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {skillResult && (
            <div
              className={`rounded-lg border p-3.5 space-y-2.5 text-xs ${
                skillResult.status === 'OK'
                  ? 'border-emerald-500/35 bg-emerald-500/5'
                  : 'border-amber-500/35 bg-amber-500/5'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {skillResult.skillName} · {skillResult.headline}
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                    skillResult.status === 'OK'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {skillResult.status}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
                {skillResult.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#131C2E] px-2.5 py-1.5"
                  >
                    <div className="text-[10px] font-sans text-slate-500">{m.label}</div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {skillResult.recommendation}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {isFounder ? 'Private GitHub Auth Server' : 'Identity & Session Shield'}
            </h3>
          </div>
          {isFounder ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Connect GitHub.com or a private GitHub Enterprise Server (<span className="font-mono">GITHUB_SERVER_BASE_URL</span>) with optional organization lock (<span className="font-mono">GITHUB_ALLOWED_ORG</span>) and server token (<span className="font-mono">GITHUB_PRIVATE_SERVER_TOKEN</span>).
              </p>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]">
                  <div className="text-[10px] font-sans text-slate-500 uppercase">Server Origin</div>
                  <div className="text-slate-900 dark:text-slate-100 truncate">
                    {githubPrivateServer?.serverBaseUrl ?? 'https://github.com'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]">
                  <div className="text-[10px] font-sans text-slate-500 uppercase">API Endpoint</div>
                  <div className="text-slate-900 dark:text-slate-100 truncate">
                    {githubPrivateServer?.apiBaseUrl ?? 'https://api.github.com'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]">
                    <div className="text-[10px] font-sans text-slate-500 uppercase">OAuth App</div>
                    <div
                      className={
                        githubPrivateServer?.oauthConfigured
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      {githubPrivateServer?.oauthConfigured ? 'Configured' : 'Unset'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]">
                    <div className="text-[10px] font-sans text-slate-500 uppercase">Private Token</div>
                    <div
                      className={
                        githubPrivateServer?.connected
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      {githubPrivateServer?.connected
                        ? `@${githubPrivateServer.identity?.login ?? 'verified'}`
                        : githubPrivateServer?.privateTokenConfigured
                        ? 'Error'
                        : 'Optional'}
                    </div>
                  </div>
                </div>
                {githubPrivateServer?.allowedOrg && (
                  <div className="p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-300">
                    Allowed Org: @{githubPrivateServer.allowedOrg}
                  </div>
                )}
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 leading-snug">
                  {githubPrivateServer?.reason ??
                    'Ready for GitHub.com or GitHub Enterprise OAuth / Private Server Token authentication.'}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <p>
                Authentication tokens, OAuth secrets, and server infrastructure configuration are isolated exclusively to the Founder Admin hardware vault.
              </p>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E] font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                Zero-Trust Session Isolation Active
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cross-Platform App & Native Client Readiness */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Cross-Platform Install & Native Client Matrix
            </h3>
          </div>
          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Running as Installed Standalone App
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void promptInstall()}
              disabled={!canNativeInstall}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{canNativeInstall ? 'Install Native App Now' : `Detected: ${platform.toUpperCase()}`}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E] space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <Smartphone className="w-4 h-4 text-emerald-500" />
              <span>Android Devices</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Installable WebAPK via Chrome/Edge with maskable 512px icon, biometric passkey lock, and mobile tabbed chart terminal.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E] space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <span>Apple iPhone & iPad</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              180px PNG Apple Touch Icon, black-translucent safe-area notch layout, Face ID WebAuthn, and Bearer session resilience.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E] space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <Laptop className="w-4 h-4 text-indigo-400" />
              <span>MacBook (macOS)</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Safari Add-to-Dock & Chrome PWA window, Touch ID passkey support, and keyboard execution shortcuts (B / S / Esc).
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E] space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <Monitor className="w-4 h-4 text-sky-500" />
              <span>Windows 10 / 11</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Edge/Chrome Desktop App pinning to Taskbar & Start Menu, Windows Hello hardware MFA, and multi-column L2 order book.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Zero-Trust WAF · AES-256-GCM Encrypted Banking Vault · SHA-256 + HMAC-SHA256 Audit Chain · TOTP + FIDO2 Passkey Enforcement</span>
        </div>
      </div>
    </div>
  );
};
