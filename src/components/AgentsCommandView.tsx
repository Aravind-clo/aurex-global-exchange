import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Code2,
  Cpu,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import type {
  AgentDepartment,
  AgentDirection,
  AgentLivePerformance,
  Instrument,
  NexusConsensusReport,
} from '../types/market';
import type { PlatformSkillInfo, SkillExecutionResult } from '../hooks/useMarketSocket';
import {
  computeWeightedConsensus,
  type MarketVerdictLabel,
} from '../utils/consensusEngine';
import { formatCurrency, formatPrice, formatTimeShort } from '../utils/format';
import { AgentReliabilityChart } from './AgentReliabilityChart';

interface AgentsCommandViewProps {
  instruments: Instrument[];
  activeSymbol: string;
  nexusReport: NexusConsensusReport | null;
  agentLeaderboard?: AgentLivePerformance[];
  skills?: PlatformSkillInfo[];
  guideMode?: boolean;
  onSelectSymbol?: (symbol: string) => void;
  onEvaluate: (symbol: string) => Promise<NexusConsensusReport | null>;
  onExecute: (symbol: string) => Promise<{ ok: boolean; error?: string }>;
  onRunSkill?: (skillId: string) => Promise<SkillExecutionResult | null>;
  onRefreshLeaderboard?: () => void;
  onOpenTerminal: (symbol: string) => void;
  onOpenRiskAudit: () => void;
}

const DEPARTMENTS: Array<'All' | AgentDepartment> = [
  'All',
  'Market Intelligence',
  'Technical Analysis',
  'Quantitative Intelligence',
  'Fundamental Intelligence',
  'News & Macro',
  'Strategy Intelligence',
  'Portfolio Management',
  'Risk & Governance',
];

function directionColor(dir: AgentDirection): string {
  if (dir === 'BUY') return 'text-emerald-600 dark:text-emerald-400';
  if (dir === 'SELL') return 'text-red-600 dark:text-red-400';
  if (dir === 'NO TRADE') return 'text-slate-500 dark:text-slate-400';
  return 'text-amber-600 dark:text-amber-400';
}

function verdictHeadlineColor(verdict: MarketVerdictLabel): string {
  if (verdict === 'STRONG BUY' || verdict === 'BUY') {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (verdict === 'STRONG SELL' || verdict === 'SELL') {
    return 'text-red-600 dark:text-red-400';
  }
  if (verdict === 'VETOED · NO TRADE') {
    return 'text-red-600 dark:text-red-400';
  }
  if (verdict === 'NO TRADE') {
    return 'text-slate-500 dark:text-slate-400';
  }
  return 'text-amber-600 dark:text-amber-400';
}

export function AgentsCommandView({
  instruments,
  activeSymbol,
  nexusReport,
  agentLeaderboard = [],
  skills = [],
  guideMode = false,
  onSelectSymbol,
  onEvaluate,
  onExecute,
  onRunSkill,
  onRefreshLeaderboard,
  onOpenTerminal,
  onOpenRiskAudit,
}: AgentsCommandViewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(
    activeSymbol || nexusReport?.symbol || 'NVDA'
  );
  const [deptFilter, setDeptFilter] = useState<'All' | AgentDepartment>('All');
  const [leaderboardFilter, setLeaderboardFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [runningSkillId, setRunningSkillId] = useState<string | null>(null);
  const [lastSkillResult, setLastSkillResult] = useState<SkillExecutionResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [expandedJsonId, setExpandedJsonId] = useState<string | null>(null);
  const [highlightedAgentIds, setHighlightedAgentIds] = useState<string[]>([]);
  const [excludedAgents, setExcludedAgents] = useState<Set<string>>(new Set());
  const [deptMultipliers, setDeptMultipliers] = useState<
    Partial<Record<AgentDepartment, number>>
  >({});
  const [gatewayNotice, setGatewayNotice] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const lastRequestedSymbolRef = useRef<string | null>(null);

  // Keep selectedSymbol synchronized with activeSymbol and auto-evaluate when activeSymbol changes
  useEffect(() => {
    if (!activeSymbol) return;
    setSelectedSymbol(activeSymbol);
    if (
      nexusReport?.symbol !== activeSymbol &&
      lastRequestedSymbolRef.current !== activeSymbol
    ) {
      lastRequestedSymbolRef.current = activeSymbol;
      setEvaluating(true);
      void onEvaluate(activeSymbol).finally(() => setEvaluating(false));
    }
  }, [activeSymbol, nexusReport?.symbol, onEvaluate]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedJsonId(null);
        setHighlightedAgentIds([]);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const handleRunConsensus = async (sym = selectedSymbol) => {
    lastRequestedSymbolRef.current = sym;
    setEvaluating(true);
    setGatewayNotice(null);
    await onEvaluate(sym);
    setEvaluating(false);
  };

  const handleRoutePaperOrder = async () => {
    const targetSym = nexusReport?.symbol ?? selectedSymbol;
    setExecuting(true);
    setGatewayNotice(null);
    const res = await onExecute(targetSym);
    setExecuting(false);
    setGatewayNotice({
      ok: res.ok,
      message: res.ok
        ? `Order routed through Paper Execution Gateway for ${targetSym}. Check Terminal Blotter or Risk & Audit Log.`
        : res.error ?? 'Blocked by Independent Risk Agent A24 or non-directional consensus.',
    });
  };

  const hasCustomWeights =
    excludedAgents.size > 0 ||
    Object.values(deptMultipliers).some((v) => v !== undefined && v !== 1);

  const resetConsensusWeights = () => {
    setExcludedAgents(new Set());
    setDeptMultipliers({});
  };

  const toggleAgentIncluded = (agentId: string) => {
    if (agentId === 'A24') return; // Independent risk gate cannot be muted
    setExcludedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const report = nexusReport;
  const activeInstrument = useMemo(
    () =>
      instruments.find((i) => i.symbol === (report?.symbol ?? selectedSymbol)) ??
      instruments.find((i) => i.symbol === selectedSymbol),
    [instruments, report?.symbol, selectedSymbol]
  );

  // Run weighted consensus engine across A01-A24 findings directly in AgentsCommandView
  const consensus = useMemo(() => {
    if (!report) return null;
    return computeWeightedConsensus(
      report.findings,
      report.riskGate,
      excludedAgents,
      deptMultipliers
    );
  }, [deptMultipliers, excludedAgents, report]);

  const filteredFindings = useMemo(() => {
    if (!report) return [];
    if (deptFilter === 'All') return report.findings;
    return report.findings.filter((f) => f.department === deptFilter);
  }, [deptFilter, report]);

  const filteredLeaderboard = useMemo(() => {
    if (leaderboardFilter === 'ALL') return agentLeaderboard;
    return agentLeaderboard.filter((a) => a.currentCall === leaderboardFilter);
  }, [agentLeaderboard, leaderboardFilter]);

  const handleExecuteSkill = async (skillId: string) => {
    if (!onRunSkill) return;
    setRunningSkillId(skillId);
    const res = await onRunSkill(skillId);
    setRunningSkillId(null);
    if (res) setLastSkillResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Live 24-Agent Real-Market Performance Leaderboard & Scoreboard */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-[#EAECEF] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#F0B90B]" />
              Live 24-Agent Real-Market Performance &amp; Scoreboard
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#848E9C]">
              Streaming mark-to-market performance across live Coinbase, NSE/BSE, NYSE/NASDAQ &amp; FX feeds ranked by Return %, Win Rate, Sharpe, and Composite Score (0–100).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px]">
              {(['ALL', 'BUY', 'SELL'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLeaderboardFilter(tab)}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                    leaderboardFilter === tab
                      ? 'bg-[#F0B90B] text-[#0B0E11]'
                      : 'text-slate-600 dark:text-[#848E9C]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {onRefreshLeaderboard && (
              <button
                type="button"
                onClick={onRefreshLeaderboard}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] hover:border-[#F0B90B] text-xs font-medium text-slate-700 dark:text-[#EAECEF]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync
              </button>
            )}
          </div>
        </div>

        {filteredLeaderboard.length === 0 ? (
          <div className="rounded border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] p-6 text-center text-xs text-slate-500 dark:text-[#848E9C]">
            Initializing real-market agent paper positions...
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-[#0B0E11] z-10">
                <tr className="border-b border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C]">
                  <th className="py-2 px-3">Rank</th>
                  <th className="py-2 px-3">AI Agent</th>
                  <th className="py-2 px-3">Live Call · Asset</th>
                  <th className="py-2 px-3 text-right">Live P&amp;L ($)</th>
                  <th className="py-2 px-3 text-right">Return %</th>
                  <th className="py-2 px-3 text-right">Win Rate</th>
                  <th className="py-2 px-3 text-right">Sharpe</th>
                  <th className="py-2 px-3 text-right">Score /100</th>
                  <th className="py-2 px-3 text-right">Terminal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139] font-mono tabular-nums">
                {filteredLeaderboard.map((ag) => {
                  const posPnl = ag.totalPnlUsd >= 0;
                  return (
                    <tr key={ag.agentId} className="hover:bg-slate-50 dark:hover:bg-[#0B0E11]/60">
                      <td className="py-2 px-3 font-bold text-[#B8860B] dark:text-[#F0B90B]">
                        #{ag.rank}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                          {ag.agentId} · {ag.agentName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-[#848E9C]">
                          {ag.department} · {ag.streak > 0 ? `${ag.streak}W streak` : `${ag.closedTrades} fills`}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-bold ${
                            ag.currentCall === 'BUY'
                              ? 'text-[#0ECB81]'
                              : ag.currentCall === 'SELL'
                              ? 'text-[#F6465D]'
                              : 'text-[#F0B90B]'
                          }`}
                        >
                          {ag.currentCall}
                        </span>{' '}
                        <span className="text-slate-700 dark:text-[#EAECEF]">{ag.activeSymbol}</span>
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${posPnl ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                        {posPnl ? '+' : ''}
                        {formatCurrency(ag.totalPnlUsd)}
                      </td>
                      <td className={`py-2 px-3 text-right ${posPnl ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                        {ag.returnPct >= 0 ? '+' : ''}
                        {ag.returnPct.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 dark:text-[#EAECEF]">
                        {ag.winRatePct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-[#B7BDC6]">
                        {ag.sharpe.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="font-bold text-slate-900 dark:text-[#EAECEF]">
                          {ag.liveScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenTerminal(ag.activeSymbol)}
                          className="inline-flex items-center gap-0.5 text-[11px] font-sans font-semibold text-[#B8860B] dark:text-[#F0B90B] hover:underline"
                        >
                          Chart
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 10 Interactive Quantitative & Security Platform Skills */}
      {skills.length > 0 && onRunSkill && (
        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0ECB81]" />
                Server-Executed Quant, Multi-Asset &amp; Security Skills ({skills.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#848E9C]">
                Run real-time quantitative stress tests, Monte Carlo VaR, cross-market arbitrage scans, whale orderflow, or Global UPI settlement estimators against {selectedSymbol}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {skills.map((sk) => (
              <div
                key={sk.id}
                className="p-3 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] flex flex-col justify-between gap-2.5"
              >
                <div>
                  <span className="text-[10px] font-mono text-[#B8860B] dark:text-[#F0B90B] block">
                    {sk.category}
                  </span>
                  <div className="text-xs font-bold text-slate-900 dark:text-[#EAECEF] mt-0.5">
                    {sk.name}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#848E9C] mt-1 leading-snug">
                    {sk.summary}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={runningSkillId === sk.id}
                  onClick={() => void handleExecuteSkill(sk.id)}
                  className="w-full py-1.5 rounded bg-[#F0B90B] hover:bg-[#d9a609] disabled:opacity-50 text-[#0B0E11] text-[11px] font-bold transition-colors"
                >
                  {runningSkillId === sk.id ? 'Computing...' : `Run on ${selectedSymbol}`}
                </button>
              </div>
            ))}
          </div>

          {lastSkillResult && (
            <div className="rounded-md border border-[#0ECB81]/40 bg-[#0ECB81]/5 p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-900 dark:text-[#EAECEF]">
                  {lastSkillResult.skillName} — {lastSkillResult.headline}
                </div>
                <span className="font-mono text-[11px] text-[#0ECB81]">
                  STATUS: {lastSkillResult.status}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
                {lastSkillResult.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-2 rounded border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20]"
                  >
                    <span className="text-[10px] font-sans text-slate-500 dark:text-[#848E9C] block">
                      {m.label}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-[#EAECEF]">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-[#B7BDC6]">
                <strong>Recommendation:</strong> {lastSkillResult.recommendation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3-Environment Architecture Pipeline Strip */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              NEXUS AI · 24-Agent Weighted Consensus Engine
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Aggregates A01–A24 structured signals across NSE/BSE India, NYSE/NASDAQ, Crypto & FX into a single Risk-Gated Market Verdict.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSymbol}
              onChange={(e) => {
                const sym = e.target.value;
                setSelectedSymbol(sym);
                onSelectSymbol?.(sym);
                void handleRunConsensus(sym);
              }}
              aria-label="Select asset for 24-agent consensus"
              className="px-3 py-1.5 text-xs font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              {instruments.map((inst) => (
                <option key={inst.symbol} value={inst.symbol}>
                  {inst.symbol} · {inst.venue} — {inst.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={evaluating}
              onClick={() => void handleRunConsensus(selectedSymbol)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {evaluating ? 'Aggregating A01–A24...' : 'Run 24-Agent Analysis'}
            </button>

            <button
              type="button"
              disabled={executing || !report}
              onClick={() => void handleRoutePaperOrder()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-900 dark:text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {executing ? 'Validating...' : 'Route via Paper Gateway'}
            </button>
          </div>
        </div>

        {/* 3-Environment Separation Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
              <span>1. Research Environment</span>
              <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                A01–A23 Active
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Statistical, technical, liquidity & news agents run locally without LLM API overhead per tick.
            </p>
          </div>

          <div className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
              <span>2. Weighted Consensus Engine</span>
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                S = Σ(w·r·s) / Σ(w·r)
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Aggregates all 24 agent findings by reliability and weight into a unified Market Verdict.
            </p>
          </div>

          <div className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
              <span>3. Execution & Risk Gate</span>
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                A24 Non-Overridable
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Deterministic rules enforce exposure, spread, R:R & freshness before Paper Gateway routing.
            </p>
          </div>
        </div>

        {guideMode && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
            <strong>Beginner Guide:</strong> Instead of trusting one indicator, 23 specialist agents vote using{' '}
            <span className="font-mono">S = sum(w · r · s) / sum(w · r)</span>. Then Agent <strong>A24 (Risk & Audit)</strong> independently checks safety limits and gates the final <strong>Market Verdict</strong>. You can adjust department weights below to test sensitivity.
          </div>
        )}

        {gatewayNotice && (
          <div
            className={`px-4 py-2.5 rounded-md border text-xs flex items-center justify-between gap-3 ${
              gatewayNotice.ok
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            <span>{gatewayNotice.message}</span>
            <button
              type="button"
              onClick={onOpenRiskAudit}
              className="underline whitespace-nowrap shrink-0 font-medium"
            >
              Inspect Audit Log
            </button>
          </div>
        )}
      </div>

      {report && consensus ? (
        <>
          {/* Unified Market Verdict Banner + Independent A24 Gate */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left 7 Cols: Market Verdict, Formula Aggregation & Department Weights */}
            <div className="xl:col-span-7 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    MARKET VERDICT · {report.symbol} ({report.venue})
                    {activeInstrument
                      ? ` · ${formatPrice(activeInstrument.price, activeInstrument.symbol)}`
                      : ''}
                    {' · '}
                    {formatTimeShort(report.createdAt)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-3">
                    <span
                      className={`text-2xl font-bold font-mono tracking-tight ${verdictHeadlineColor(
                        consensus.marketVerdict
                      )}`}
                    >
                      {consensus.marketVerdict}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {hasCustomWeights
                        ? 'Simulated Weight Override'
                        : `Canonical Run ${report.runId}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-5 font-mono tabular-nums text-right">
                  <div>
                    <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                      Consensus S
                    </div>
                    <div className="text-base font-semibold text-slate-900 dark:text-white">
                      {consensus.weightedScore >= 0 ? '+' : ''}
                      {consensus.weightedScore.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                      Calibrated Prob.
                    </div>
                    <div className="text-base font-semibold text-slate-900 dark:text-white">
                      {(consensus.calibratedProbability * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                      Horizon
                    </div>
                    <div className="text-base font-semibold text-slate-900 dark:text-white">
                      {report.horizon}
                    </div>
                  </div>
                </div>
              </div>

              {/* Plain-English Market Verdict Rationale + Formula Telemetry */}
              <div className="space-y-3">
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {consensus.verdictRationale}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  <span>
                    Formula: S = {consensus.numerator >= 0 ? '+' : ''}
                    {consensus.numerator.toFixed(3)} / {consensus.denominator.toFixed(3)} ={' '}
                    <strong className="text-slate-900 dark:text-white">
                      {consensus.weightedScore >= 0 ? '+' : ''}
                      {consensus.weightedScore.toFixed(3)}
                    </strong>
                  </span>
                  <span>
                    Active Voters: {consensus.activeAgentCount}/{consensus.totalAgentCount} · Avg Conf{' '}
                    {(consensus.avgConfidence * 100).toFixed(0)}% · Dispersion{' '}
                    {consensus.dispersion.toFixed(2)}
                  </span>
                </div>

                {/* A01-A24 Directional Vote Tally Bar */}
                <div className="space-y-1.5">
                  <div className="h-2 w-full rounded-sm overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                    {(['BUY', 'HOLD', 'NO TRADE', 'SELL'] as const).map((dir) => {
                      const count = consensus.voteCounts[dir] ?? 0;
                      if (count === 0 || consensus.totalAgentCount === 0) return null;
                      const widthPct = (count / consensus.totalAgentCount) * 100;
                      const barColor =
                        dir === 'BUY'
                          ? 'bg-emerald-500'
                          : dir === 'SELL'
                          ? 'bg-red-500'
                          : dir === 'HOLD'
                          ? 'bg-amber-500'
                          : 'bg-slate-400';
                      return (
                        <div
                          key={dir}
                          style={{ width: `${widthPct}%` }}
                          className={`${barColor} h-full`}
                          title={`${dir}: ${count} agents`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    <span>
                      A01–A24 Votes: {consensus.voteCounts.BUY} BUY · {consensus.voteCounts.HOLD} HOLD ·{' '}
                      {consensus.voteCounts.SELL} SELL · {consensus.voteCounts['NO TRADE']} NO TRADE
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Plan Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono tabular-nums text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Reference Entry
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {formatPrice(report.entryPrice, report.symbol)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Target Level
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatPrice(report.targetPrice, report.symbol)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Invalidation Stop
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-red-600 dark:text-red-400">
                    {formatPrice(report.stopLoss, report.symbol)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Reward / Risk
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {report.rewardRiskRatio.toFixed(2)}x
                  </div>
                </div>
              </div>

              {/* Department Weighted Contributions + Weight Simulation */}
              <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Department Weighted Contributions (Interactive Sensitivity)
                  </span>
                  <div className="flex items-center gap-3">
                    {hasCustomWeights && (
                      <button
                        type="button"
                        onClick={resetConsensusWeights}
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-medium"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset Weights
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenTerminal(report.symbol)}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Open {report.symbol} in Terminal
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {consensus.departmentBreakdown.map((dept) => {
                    const pct = Math.min(100, Math.round(Math.abs(dept.score) * 100));
                    const pos = dept.score >= 0;
                    const isRisk = dept.department === 'Risk & Governance';
                    const mult = deptMultipliers[dept.department] ?? 1;
                    return (
                      <div
                        key={dept.department}
                        className="grid grid-cols-12 items-center gap-2 text-xs"
                      >
                        <div className="col-span-4 text-slate-700 dark:text-slate-300 truncate">
                          {dept.department}
                          <span className="ml-1 text-[10px] font-mono text-slate-400">
                            ({dept.weightSharePct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="col-span-4 h-2 rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isRisk
                                ? dept.score >= 0
                                  ? 'bg-blue-500'
                                  : 'bg-red-500'
                                : pos
                                ? 'bg-emerald-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          {isRisk ? (
                            <span className="text-[10px] font-mono text-slate-400">
                              Gate
                            </span>
                          ) : (
                            <select
                              aria-label={`${dept.department} weight multiplier`}
                              value={mult}
                              onChange={(e) => {
                                const val = Number.parseFloat(e.target.value);
                                setDeptMultipliers((prev) => ({
                                  ...prev,
                                  [dept.department]: val,
                                }));
                              }}
                              className="px-1 py-0.5 text-[11px] font-mono rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              <option value={0}>0.0x</option>
                              <option value={0.5}>0.5x</option>
                              <option value={1}>1.0x</option>
                              <option value={1.5}>1.5x</option>
                              <option value={2}>2.0x</option>
                            </select>
                          )}
                        </div>
                        <div
                          className={`col-span-2 text-right font-mono tabular-nums ${
                            pos
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {dept.score >= 0 ? '+' : ''}
                          {dept.score.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Agent A24 Deterministic Risk Gate */}
            <div className="xl:col-span-5 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    AGENT A24 · INDEPENDENT GATE
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                    Deterministic Risk & Audit Verdict
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold ${
                    report.riskGate.verdict === 'APPROVE'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : report.riskGate.verdict === 'ESCALATE'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {report.riskGate.verdict === 'APPROVE' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                  {report.riskGate.verdict}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {report.riskGate.summary}
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums py-2 border-y border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Max Asset Cap (20%)
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {formatCurrency(report.riskGate.maxPositionUsd)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Recommended Size
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {report.riskGate.recommendedSize} units
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {report.riskGate.checks.map((chk) => (
                  <div
                    key={chk.rule}
                    className="flex items-center justify-between gap-2 text-xs py-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {chk.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                      )}
                      <span className="text-slate-700 dark:text-slate-200 truncate">
                        {chk.rule}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      {chk.measured} / {chk.limit}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={onOpenRiskAudit}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Open Full Risk & Audit Ledger
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {report.findings.length} Agents Reported
                </span>
              </div>
            </div>
          </div>

          {/* Conflict Detection Panel */}
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`w-4 h-4 ${
                    consensus.conflicts.length > 0
                      ? 'text-amber-500'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Conflict Detection ({consensus.conflicts.length}{' '}
                  {consensus.conflicts.length === 1 ? 'Contradiction' : 'Contradictions'} Flagged)
                </h3>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {highlightedAgentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHighlightedAgentIds([])}
                    className="font-sans text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Clear Focus
                  </button>
                )}
                <span>
                  Cross-Dept Dispersion: {consensus.dispersion.toFixed(2)}
                </span>
              </div>
            </div>

            {guideMode && (
              <div className="px-5 py-2 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                <strong>What this flags:</strong> Contradictions happen when agents reach opposite conclusions (for example, Trend Analyst says BUY while Momentum Analyst says SELL). Inspecting conflicting evidence helps you spot fragile setups before trading.
              </div>
            )}

            {consensus.conflicts.length === 0 ? (
              <div className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  No opposing BUY vs SELL contradictions detected across active agents for{' '}
                  <strong className="font-mono">{report.symbol}</strong>.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {consensus.conflicts.map((conflict) => (
                  <div key={conflict.id} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`font-mono font-bold ${
                            conflict.severity === 'HIGH'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {conflict.severity}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {conflict.scope}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {conflict.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        <span>Δs = {conflict.conflictDelta.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setDeptFilter('All');
                            setHighlightedAgentIds([
                              conflict.leftAgent.agent_id,
                              conflict.rightAgent.agent_id,
                            ]);
                          }}
                          className="font-sans text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          Locate Pair Below
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {conflict.explanation}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {[conflict.leftAgent, conflict.rightAgent].map((side) => (
                        <div
                          key={side.agent_id}
                          className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                              {side.agent_id} · {side.agent_name}
                            </span>
                            <span
                              className={`font-mono font-bold tabular-nums ${directionColor(
                                side.direction
                              )}`}
                            >
                              {side.direction} (s = {side.normalized_s >= 0 ? '+' : ''}
                              {side.normalized_s.toFixed(2)})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {side.department} · Weight {side.weight.toFixed(2)}
                          </div>
                          <div className="space-y-1 pt-1">
                            {side.evidence.map((ev, idx) => (
                              <div
                                key={idx}
                                className="text-slate-700 dark:text-slate-200 leading-snug"
                              >
                                • {ev}
                              </div>
                            ))}
                            {side.invalidations[0] && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Invalidated if: {side.invalidations[0]}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 30-Day Agent Reliability (r_i) Tracker */}
          <AgentReliabilityChart
            findings={report.findings}
            symbol={report.symbol}
            guideMode={guideMode}
          />

          {/* 24-Agent Matrix Table */}
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Structured Agent Findings ({filteredFindings.length} / {report.findings.length})
              </h3>

              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDeptFilter(dept)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                      deptFilter === dept
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {dept === 'All' ? 'All 24 Agents' : dept}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                    <th className="py-2.5 px-4">Vote</th>
                    <th className="py-2.5 px-3">Agent</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Signal</th>
                    <th className="py-2.5 px-3 text-right">Score / s</th>
                    <th className="py-2.5 px-3 text-right">Share · Contrib</th>
                    <th className="py-2.5 px-3">Evidence & Invalidation</th>
                    <th className="py-2.5 px-4 text-right">Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredFindings.map((f) => {
                    const expanded = expandedJsonId === f.agent_id;
                    const contrib = consensus.contributions[f.agent_id];
                    const isA24 = f.agent_id === 'A24';
                    const isHighlighted = highlightedAgentIds.includes(f.agent_id);
                    return (
                      <Fragment key={f.agent_id}>
                        <tr
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/35 align-top transition-colors ${
                            contrib && !contrib.included ? 'opacity-50' : ''
                          } ${isHighlighted ? 'bg-amber-500/10 dark:bg-amber-500/15' : ''}`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isA24 ? (
                              <span
                                className="text-[10px] font-mono text-blue-600 dark:text-blue-400"
                                title="Independent Risk Gate cannot be muted"
                              >
                                GATE
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={contrib?.included ?? true}
                                onChange={() => toggleAgentIncluded(f.agent_id)}
                                aria-label={`Include ${f.agent_id} ${f.agent_name} in weighted consensus`}
                                className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-mono font-semibold text-slate-900 dark:text-white">
                              {f.agent_id} · {f.agent_name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {f.model_version} · {f.timeframe}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {f.department}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-mono font-semibold">
                            <span className={directionColor(f.direction)}>{f.direction}</span>
                            {f.requires_review && (
                              <span className="block text-[10px] font-sans font-normal text-amber-600 dark:text-amber-400">
                                Review Flagged
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {f.score}/100
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              s = {f.normalized_s >= 0 ? '+' : ''}
                              {f.normalized_s.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <div className="text-slate-800 dark:text-slate-100">
                              {isA24
                                ? 'Gate Only'
                                : `${contrib?.sharePct.toFixed(1) ?? '0.0'}%`}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {isA24
                                ? `rel ${f.reliability.toFixed(2)}`
                                : `w·r·s = ${
                                    (contrib?.weightedVote ?? 0) >= 0 ? '+' : ''
                                  }${(contrib?.weightedVote ?? 0).toFixed(3)}`}
                            </div>
                          </td>
                          <td className="py-3 px-3 max-w-md space-y-1">
                            {f.evidence.map((ev, idx) => (
                              <div key={idx} className="text-slate-700 dark:text-slate-200">
                                • {ev}
                              </div>
                            ))}
                            {f.invalidations[0] && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Invalidated if: {f.invalidations[0]}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedJsonId((curr) =>
                                  curr === f.agent_id ? null : f.agent_id
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Code2 className="w-3 h-3" />
                              {expanded ? 'Hide JSON' : 'JSON'}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-slate-50 dark:bg-slate-900/70">
                            <td colSpan={8} className="px-4 py-3">
                              <pre className="text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed">
                                {JSON.stringify(f, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center text-xs text-slate-500 dark:text-slate-400">
          {evaluating
            ? `Aggregating A01–A24 signals for ${selectedSymbol}...`
            : 'Select an instrument above and click Run 24-Agent Analysis to compute weighted consensus and deterministic risk checks.'}
        </div>
      )}
    </div>
  );
}
