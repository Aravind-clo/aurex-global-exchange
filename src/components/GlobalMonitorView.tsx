import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Globe,
  Lock,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  CcxtConnectorStatus,
  FirewallIncident,
  GlobalMonitorSnapshot,
  SecurityStatus,
} from '../types/market';

interface GlobalMonitorViewProps {
  monitor: GlobalMonitorSnapshot | null;
  connectors?: CcxtConnectorStatus[];
  securityStatus: SecurityStatus;
  firewallIncidents: FirewallIncident[];
  onRefresh: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export const GlobalMonitorView: React.FC<GlobalMonitorViewProps> = ({
  monitor,
  connectors = [],
  securityStatus,
  firewallIncidents,
  onRefresh,
  onSelectSymbol,
}) => {
  if (!monitor) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-6 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-[#EAECEF]">
            Synchronizing real-time global exchange clocks & breadth telemetry...
          </p>
        </div>
      </div>
    );
  }

  const advPct = monitor.totalMarkets > 0 ? Math.round((monitor.advancers / monitor.totalMarkets) * 100) : 50;
  const decPct = monitor.totalMarkets > 0 ? Math.round((monitor.decliners / monitor.totalMarkets) * 100) : 50;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg border border-slate-200 dark:border-[#2B3139] bg-slate-100 dark:bg-[#0B0E11] flex items-center justify-center text-[#0ECB81]">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-[#EAECEF]">
              Real-Time Global Exchange & Threat Monitor
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#848E9C]">
              Live session clocks across 7 global venues, 116-market breadth, volatility regime, macro FX pulse, and Zero-Trust WAF telemetry.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
            Updated {new Date(monitor.updatedAt).toLocaleTimeString([], { hour12: false })}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] hover:border-[#F0B90B] text-xs font-semibold text-slate-700 dark:text-[#EAECEF] transition-colors"
          >
            Sync Feed
          </button>
        </div>
      </div>

      {/* Top KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C] mb-1">
            <span>Global Market Breadth</span>
            <Activity className="w-3.5 h-3.5 text-[#0ECB81]" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-[#EAECEF]">
            <span className="text-[#0ECB81]">{monitor.advancers}↑</span>
            <span className="mx-1.5 text-slate-400">/</span>
            <span className="text-[#F6465D]">{monitor.decliners}↓</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded bg-slate-200 dark:bg-[#0B0E11] overflow-hidden flex">
            <div style={{ width: `${advPct}%` }} className="bg-[#0ECB81]" />
            <div style={{ width: `${decPct}%` }} className="bg-[#F6465D]" />
          </div>
          <p className="mt-1 text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
            {monitor.totalMarkets} tracked assets · {monitor.unchanged} flat
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C] mb-1">
            <span>Global Volatility Regime</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#F0B90B]" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-[#EAECEF]">
            {monitor.volatilityRegime}
          </div>
          <p className="mt-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
            Mean 24h dispersion: ±{monitor.avgVolatilityPct.toFixed(2)}%
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C] mb-1">
            <span>Zero-Trust Threat Shield</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#0ECB81]" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-[#EAECEF]">
            {monitor.blockedThreats} Blocked
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
            {securityStatus.cipherSuite}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C] mb-1">
            <span>Custody Lockdowns</span>
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-[#EAECEF]">
            {monitor.activeLockdowns} Active
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
            Ledger Chain: {securityStatus.ledgerChainValid ? 'Verified HMAC' : 'Check Needed'}
          </p>
        </div>
      </div>

      {/* 7 Global Exchange Session Clocks */}
      <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#EAECEF] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#F0B90B]" />
            Global Exchange Hours & Benchmarks
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-[#848E9C]">
            Click any benchmark to open chart & order ticket
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {monitor.sessions.map((sess) => {
            const isOpen = sess.status === 'OPEN';
            const isPre = sess.status === 'PRE_MARKET';
            return (
              <button
                key={sess.id}
                type="button"
                onClick={() => onSelectSymbol(sess.benchmarkSymbol)}
                className="text-left rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] hover:border-[#F0B90B] p-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-[#EAECEF] truncate">
                    {sess.code}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold ${
                      isOpen
                        ? 'text-[#0ECB81]'
                        : isPre
                        ? 'text-[#F0B90B]'
                        : 'text-slate-400 dark:text-[#848E9C]'
                    }`}
                  >
                    {sess.status === 'PRE_MARKET' ? 'PRE-MKT' : sess.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#848E9C] truncate mt-0.5">
                  {sess.region}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#2B3139] flex items-baseline justify-between gap-1 font-mono tabular-nums">
                  <span className="text-[11px] text-slate-600 dark:text-[#EAECEF]">
                    {sess.localTimeStr}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      sess.benchmarkChangePct >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                    }`}
                  >
                    {sess.benchmarkChangePct >= 0 ? '+' : ''}
                    {sess.benchmarkChangePct.toFixed(2)}%
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-500 dark:text-[#848E9C] mt-0.5 truncate">
                  {sess.benchmarkSymbol}: {sess.benchmarkPrice.toLocaleString()}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Macro FX / Gold / BTC Pulse */}
      <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-[#EAECEF] mb-3">
          Macro FX, Gold & Digital Benchmark Pulse
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono tabular-nums">
          {[
            { label: 'USD / INR', sym: 'USD-INR', val: monitor.fxPulse.usdInr.toFixed(2) },
            { label: 'EUR / USD', sym: 'EUR-USD', val: monitor.fxPulse.eurUsd.toFixed(4) },
            { label: 'GBP / USD', sym: 'GBP-USD', val: monitor.fxPulse.gbpUsd.toFixed(4) },
            { label: 'Gold (XAU)', sym: 'XAU-USD', val: `$${monitor.fxPulse.goldUsd.toLocaleString()}` },
            { label: 'Bitcoin (BTC)', sym: 'BTC-USD', val: `$${monitor.fxPulse.btcUsd.toLocaleString()}` },
          ].map((item) => (
            <button
              key={item.sym}
              type="button"
              onClick={() => onSelectSymbol(item.sym)}
              className="text-left rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] hover:border-[#F0B90B] p-3 transition-colors"
            >
              <span className="text-[11px] text-slate-500 dark:text-[#848E9C] block">{item.label}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-[#EAECEF] mt-0.5 block">
                {item.val}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Top Gainers / Losers + Live WAF Defense Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAECEF] flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#0ECB81]" />
            Top Global Gainers
          </h3>
          <div className="space-y-2">
            {monitor.topGainers.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectSymbol(item.symbol)}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-slate-100 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] hover:border-[#0ECB81] text-left transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold font-mono text-slate-900 dark:text-[#EAECEF]">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-[#848E9C]">{item.venue}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#848E9C] truncate">{item.name}</p>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0 ml-2">
                  <div className="text-xs font-semibold text-slate-900 dark:text-[#EAECEF]">
                    {item.price.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-[#0ECB81] flex items-center justify-end gap-0.5">
                    +{item.changePct.toFixed(2)}%
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAECEF] flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-[#F6465D]" />
            Top Global Decliners
          </h3>
          <div className="space-y-2">
            {monitor.topLosers.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelectSymbol(item.symbol)}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-slate-100 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] hover:border-[#F6465D] text-left transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold font-mono text-slate-900 dark:text-[#EAECEF]">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-[#848E9C]">{item.venue}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#848E9C] truncate">{item.name}</p>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0 ml-2">
                  <div className="text-xs font-semibold text-slate-900 dark:text-[#EAECEF]">
                    {item.price.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-[#F6465D]">
                    {item.changePct.toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAECEF] flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[#F0B90B]" />
            Live Zero-Trust Firewall Defense Log
          </h3>
          {firewallIncidents.length === 0 ? (
            <div className="rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] p-4 text-xs text-slate-500 dark:text-[#848E9C]">
              Zero suspicious payloads detected. CSP headers, prototype-pollution guards, and HMAC chain verification are actively protecting all endpoints.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {firewallIncidents.slice(0, 10).map((inc) => (
                <div
                  key={inc.id}
                  className="p-2.5 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] text-xs"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span
                      className={
                        inc.severity === 'CRITICAL'
                          ? 'text-[#F6465D] font-bold'
                          : 'text-[#F0B90B] font-semibold'
                      }
                    >
                      {inc.severity} · {inc.action}
                    </span>
                    <span className="text-slate-400 dark:text-[#848E9C]">
                      {new Date(inc.createdAt).toLocaleTimeString([], { hour12: false })}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-[#EAECEF] font-medium mt-0.5">
                    {inc.ruleTriggered}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-[#848E9C] mt-0.5">
                    {inc.method} {inc.path} · Origin {inc.maskedIp}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CCXT Multi-Exchange Live Adapters (Binance & KuCoin) */}
      {connectors.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAECEF]">
              CCXT Exchange Connectors · Binance &amp; KuCoin Live Streams
            </h3>
            <span className="text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
              Normalized WS + CCXT Spot Feed
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {connectors.map((c) => (
              <div
                key={c.exchange}
                className="rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-[#EAECEF]">
                      {c.exchange} Spot Adapter
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        c.connected ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
                      }`}
                    >
                      {c.connected ? c.transport.toUpperCase() : 'RECONNECTING'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-[#848E9C] mt-0.5">
                    {c.pairsCount} pairs · {c.ticksReceived.toLocaleString()} live ticks
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums text-[11px] text-slate-500 dark:text-[#848E9C]">
                  {c.lastTickAt
                    ? new Date(c.lastTickAt).toLocaleTimeString([], { hour12: false })
                    : 'Syncing'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
