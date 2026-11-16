import { Fragment, useEffect, useMemo, useState } from 'react';
import { Code2, Download, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { AuditLogEntry, RiskEventEntry } from '../types/market';
import { downloadCsv, formatTimeShort } from '../utils/format';

interface RiskAuditViewProps {
  auditLogs: AuditLogEntry[];
  riskEvents: RiskEventEntry[];
  guideMode?: boolean;
  onOpenTerminal: (symbol: string) => void;
}

const DETERMINISTIC_RULES = [
  {
    rule: 'Single-Asset Exposure Cap',
    threshold: '≤ 20.0% of total equity',
    enforcement: 'Hard Veto (REJECT)',
    detail: 'Prevents concentrated over-allocation into any single ticker or exchange.',
  },
  {
    rule: 'Liquidity Spread Ceiling',
    threshold: '≤ 35.0 bps top-of-book',
    enforcement: 'Hard Veto (REJECT)',
    detail: 'Blocks execution during illiquid wide-spread market conditions.',
  },
  {
    rule: 'Minimum Reward / Risk Ratio',
    threshold: '≥ 1.30x projected R:R',
    enforcement: 'Hard Veto (REJECT)',
    detail: 'Requires expected target move to exceed invalidation stop distance by ≥ 30%.',
  },
  {
    rule: 'Market Data Freshness Window',
    threshold: '≤ 60s tick age',
    enforcement: 'Hard Veto (REJECT)',
    detail: 'Halts routing if market feed timestamps go stale.',
  },
  {
    rule: 'Inter-Department Dispersion',
    threshold: '≤ 0.45 cross-dept std dev',
    enforcement: 'Desk Escalation (ESCALATE)',
    detail: 'Flags conflicting signals across Technical, Quant, News, and Fundamental agents.',
  },
];

export function RiskAuditView({
  auditLogs,
  riskEvents,
  guideMode = false,
  onOpenTerminal,
}: RiskAuditViewProps) {
  const [eventFilter, setEventFilter] = useState<
    'ALL' | AuditLogEntry['eventType']
  >('ALL');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedAuditId(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const filteredLogs = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (eventFilter !== 'ALL' && entry.eventType !== eventFilter) return false;
      if (
        q &&
        !entry.symbol.toLowerCase().includes(q) &&
        !entry.actor.toLowerCase().includes(q) &&
        !entry.summary.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [auditLogs, eventFilter, symbolQuery]);

  const handleExportAudit = () => {
    downloadCsv(
      `nexus_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`,
      filteredLogs.map((l) => ({
        id: l.id,
        timestamp: new Date(l.createdAt).toISOString(),
        eventType: l.eventType,
        actor: l.actor,
        symbol: l.symbol,
        summary: l.summary,
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Independent Deterministic Risk Gate Policy */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Agent A24 · Non-Overridable Risk & Governance Controls
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Runs independently outside Research & Strategy consensus so AI hallucinations cannot bypass capital limits.
              </p>
            </div>
          </div>

          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
            Engine: risk-gate-det-v4.0
          </span>
        </div>

        {guideMode && (
          <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <strong>Why this matters:</strong> Even if 23 AI research agents vote to buy, Agent A24 checks pure mathematical guardrails below. Any hard failure triggers an automatic veto before an order enters the paper gateway.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-2.5 px-4">Deterministic Rule</th>
                <th className="py-2.5 px-3">Threshold</th>
                <th className="py-2.5 px-3">On Breach</th>
                <th className="py-2.5 px-4">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {DETERMINISTIC_RULES.map((r) => (
                <tr key={r.rule}>
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {r.rule}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {r.threshold}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs whitespace-nowrap">
                    <span
                      className={
                        r.enforcement.includes('REJECT')
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : 'text-amber-600 dark:text-amber-400 font-semibold'
                      }
                    >
                      {r.enforcement}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Risk Gate Verdicts Feed */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Risk Gate Events ({riskEvents.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Real-Time Compliance Stream
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">A24 Verdict</th>
                <th className="py-2.5 px-4">Assessment Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {riskEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No risk events recorded yet. Run a 24-agent evaluation to record A24 checks.
                  </td>
                </tr>
              ) : (
                riskEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatTimeShort(ev.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenTerminal(ev.symbol)}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {ev.symbol}
                      </button>
                    </td>
                    <td
                      className={`py-2.5 px-3 font-mono font-semibold whitespace-nowrap ${
                        ev.severity === 'HIGH'
                          ? 'text-red-600 dark:text-red-400'
                          : ev.severity === 'MEDIUM'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {ev.severity}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-mono font-semibold whitespace-nowrap ${
                        ev.verdict === 'APPROVE'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ev.verdict === 'ESCALATE'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {ev.verdict}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-200">
                      {ev.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Audit Trail */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Immutable Audit Ledger ({filteredLogs.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              {(
                ['ALL', 'CONSENSUS_RUN', 'RISK_VETO', 'ORDER_ROUTED'] as const
              ).map((evt) => (
                <button
                  key={evt}
                  type="button"
                  onClick={() => setEventFilter(evt)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    eventFilter === evt
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {evt === 'ALL' ? 'All Events' : evt}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={symbolQuery}
              onChange={(e) => setSymbolQuery(e.target.value)}
              placeholder="Filter symbol or actor..."
              className="px-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 w-44"
            />

            <button
              type="button"
              disabled={filteredLogs.length === 0}
              onClick={handleExportAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Audit CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Decision Summary</th>
                <th className="py-2.5 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No audit records matched your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const open = expandedAuditId === log.id;
                  let formattedJson = log.payloadJson;
                  try {
                    formattedJson = JSON.stringify(JSON.parse(log.payloadJson), null, 2);
                  } catch {
                    // keep raw string
                  }
                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatTimeShort(log.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          <span
                            className={
                              log.eventType === 'RISK_VETO'
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : log.eventType === 'ORDER_ROUTED'
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-blue-600 dark:text-blue-400 font-semibold'
                            }
                          >
                            {log.eventType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {log.actor}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenTerminal(log.symbol)}
                            className="hover:underline text-slate-900 dark:text-white"
                          >
                            {log.symbol}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                          {log.summary}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAuditId((curr) => (curr === log.id ? null : log.id))
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Code2 className="w-3 h-3" />
                            {open ? 'Hide' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50 dark:bg-slate-900/70">
                          <td colSpan={6} className="px-4 py-3">
                            <pre className="text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed">
                              {formattedJson}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
