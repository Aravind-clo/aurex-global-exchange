import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type {
  BotStrategyType,
  Instrument,
  TradingBotRecord,
} from '../types/market';
import { formatCurrency, formatPrice, formatTimeShort } from '../utils/format';

interface SmartBotsViewProps {
  accountMode: 'demo' | 'real';
  cashBalance: number;
  instruments: Instrument[];
  activeSymbol: string;
  bots: TradingBotRecord[];
  onRefreshBots: () => Promise<void>;
  onCreateBot: (payload: {
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
  }) => Promise<{ ok: boolean; error?: string }>;
  onToggleBot: (botId: string) => Promise<void>;
  onDeleteBot: (botId: string) => Promise<void>;
  onSelectSymbol: (symbol: string) => void;
}

const STRATEGY_PRESETS: Array<{
  id: BotStrategyType;
  label: string;
  patternSource: string;
  summary: string;
  defaultName: string;
}> = [
  {
    id: 'GRID',
    label: 'Neutral Grid Bot',
    patternSource: 'Open-Source Freqtrade / Hummingbot Grid Pattern',
    summary: 'Places systematic buy-low / sell-high orders across calibrated grid intervals inside a bounded price band.',
    defaultName: 'BTC Volatility Grid',
  },
  {
    id: 'DCA',
    label: 'Smart DCA Accumulator',
    patternSource: 'Open-Source Jessie / Dollar-Cost Engine',
    summary: 'Executes timed fixed-interval accumulation slices while enforcing hard capital & drawdown ceilings.',
    defaultName: 'Core DCA Accumulator',
  },
  {
    id: 'MOMENTUM_EMA',
    label: 'EMA 9/21 Trend Follower',
    patternSource: 'Open-Source Freqtrade EMA Crossover',
    summary: 'Follows short/medium exponential moving average crossovers with RSI momentum confirmation.',
    defaultName: 'EMA 9/21 Momentum Bot',
  },
  {
    id: 'MEAN_REVERSION_BB',
    label: 'Bollinger Mean Reversion',
    patternSource: 'Open-Source Backtrader BB(20, 2σ) Pattern',
    summary: 'Captures statistical snapbacks when price stretches beyond +/- 2 standard deviations from 20-bar VWAP.',
    defaultName: 'Bollinger Snapback Bot',
  },
  {
    id: 'TWAP_SMART',
    label: 'Institutional TWAP Slicer',
    patternSource: 'Open-Source OctoBot Execution Slicer',
    summary: 'Breaks large order allocations into uniform time-weighted slices to minimize market impact & slippage.',
    defaultName: 'TWAP Execution Slicer',
  },
];

export function SmartBotsView({
  accountMode,
  cashBalance,
  instruments,
  activeSymbol,
  bots,
  onRefreshBots,
  onCreateBot,
  onToggleBot,
  onDeleteBot,
  onSelectSymbol,
}: SmartBotsViewProps) {
  const [strategy, setStrategy] = useState<BotStrategyType>('GRID');
  const [symbol, setSymbol] = useState(activeSymbol || 'BTC-USD');
  const [name, setName] = useState('BTC Volatility Grid');
  const [allocatedUsd, setAllocatedUsd] = useState('5000');
  const [orderSizeUnits, setOrderSizeUnits] = useState('0.02');
  const [gridLower, setGridLower] = useState('');
  const [gridUpper, setGridUpper] = useState('');
  const [gridLevels, setGridLevels] = useState('8');
  const [intervalSec, setIntervalSec] = useState('12');
  const [maxDrawdownPct, setMaxDrawdownPct] = useState('12');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedInstrument = useMemo(
    () => instruments.find((i) => i.symbol === symbol) ?? instruments[0],
    [instruments, symbol]
  );

  useEffect(() => {
    void onRefreshBots();
    const timer = window.setInterval(() => {
      void onRefreshBots();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [onRefreshBots]);

  useEffect(() => {
    if (selectedInstrument) {
      const p = selectedInstrument.price;
      const dec = p < 0.01 ? 6 : p < 1 ? 4 : 2;
      setGridLower((p * 0.94).toFixed(dec));
      setGridUpper((p * 1.06).toFixed(dec));
      const unitGuess = p > 10000 ? '0.02' : p > 500 ? '0.5' : p > 10 ? '5' : '250';
      setOrderSizeUnits(unitGuess);
    }
  }, [selectedInstrument?.symbol]);

  const activePreset = STRATEGY_PRESETS.find((p) => p.id === strategy) ?? STRATEGY_PRESETS[0];

  const stats = useMemo(() => {
    let running = 0;
    let totalAllocated = 0;
    let totalPnl = 0;
    for (const b of bots) {
      if (b.status === 'RUNNING') running += 1;
      totalAllocated += b.allocatedUsd;
      totalPnl += b.realizedPnlUsd;
    }
    return { running, totalAllocated, totalPnl };
  }, [bots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const alloc = Number.parseFloat(allocatedUsd);
    const units = Number.parseFloat(orderSizeUnits);
    const dd = Number.parseFloat(maxDrawdownPct);
    if (!Number.isFinite(alloc) || alloc <= 0 || !Number.isFinite(units) || units <= 0) {
      setFormError('Enter valid positive capital allocation and order slice units.');
      return;
    }
    setBusy(true);
    const res = await onCreateBot({
      name: name.trim() || `${symbol} ${strategy}`,
      symbol,
      strategy,
      allocatedUsd: alloc,
      orderSizeUnits: units,
      gridLower: strategy === 'GRID' ? Number.parseFloat(gridLower) || undefined : undefined,
      gridUpper: strategy === 'GRID' ? Number.parseFloat(gridUpper) || undefined : undefined,
      gridLevels: strategy === 'GRID' ? Number.parseInt(gridLevels, 10) || 8 : undefined,
      intervalSec: Number.parseInt(intervalSec, 10) || 12,
      maxDrawdownPct: Number.isFinite(dd) && dd > 0 ? dd : 12,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Failed to deploy smart trading bot.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Bar */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-[#F0B90B] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-[#EAECEF]">
                Smart Algorithmic Trading Bots (GitHub Open-Quant Patterns)
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#848E9C] mt-0.5">
                Deploy server-side Grid, DCA, EMA Momentum, Bollinger Mean-Reversion, and TWAP bots with deterministic max-drawdown circuit breakers against your isolated {accountMode.toUpperCase()} ledger.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onRefreshBots()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139] text-slate-700 dark:text-[#EAECEF]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Bot Telemetry
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-200 dark:border-[#2B3139] text-xs">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-[#848E9C]">Active Execution Mode</div>
            <div className="mt-0.5 font-mono font-semibold text-[#D9A70A] dark:text-[#F0B90B] uppercase">
              {accountMode} ({formatCurrency(cashBalance)})
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-[#848E9C]">Running Bots</div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-[#0ECB81]">
              {stats.running} / {bots.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-[#848E9C]">Allocated Capital</div>
            <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              {formatCurrency(stats.totalAllocated)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-[#848E9C]">Cumulative Bot P&amp;L</div>
            <div
              className={`mt-0.5 font-mono tabular-nums text-sm font-semibold ${
                stats.totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
              }`}
            >
              {stats.totalPnl >= 0 ? '+' : ''}
              {formatCurrency(stats.totalPnl)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Bot Deployment Form */}
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-5 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4 text-xs"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-[#2B3139]">
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-[#EAECEF]">
              <Plus className="w-4 h-4 text-[#0ECB81]" />
              <span>Deploy Quantitative Bot</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500 dark:text-[#848E9C]">
              AES/HMAC Ledger Guarded
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-slate-500 dark:text-[#848E9C]">
              Algorithmic Strategy Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {STRATEGY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setStrategy(p.id);
                    setName(`${symbol} ${p.label.split(' ')[0]}`);
                  }}
                  className={`p-2 text-left rounded-md border transition-colors ${
                    strategy === p.id
                      ? 'border-[#F0B90B] bg-[#F0B90B]/10 text-slate-900 dark:text-[#EAECEF]'
                      : 'border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#848E9C] hover:border-slate-400'
                  }`}
                >
                  <div className="font-semibold text-[11px]">{p.label}</div>
                  <div className="font-mono text-[9px] text-[#D9A70A] dark:text-[#F0B90B] truncate">
                    {p.id}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px] space-y-1">
              <div className="font-mono text-[10px] text-[#0ECB81]">{activePreset.patternSource}</div>
              <p className="text-slate-600 dark:text-[#B7BDC6] leading-relaxed">{activePreset.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Target Market
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              >
                {instruments.map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol} ({formatPrice(inst.price, inst.symbol)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Bot Instance Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Capital Allocation (USD)
              </label>
              <input
                type="number"
                step="any"
                min="50"
                required
                value={allocatedUsd}
                onChange={(e) => setAllocatedUsd(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Order Slice Size ({symbol})
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={orderSizeUnits}
                onChange={(e) => setOrderSizeUnits(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            {strategy === 'GRID' && (
              <>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Grid Lower Band
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={gridLower}
                    onChange={(e) => setGridLower(e.target.value)}
                    className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Grid Upper Band
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={gridUpper}
                    onChange={(e) => setGridUpper(e.target.value)}
                    className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                    Grid Levels
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="40"
                    value={gridLevels}
                    onChange={(e) => setGridLevels(e.target.value)}
                    className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Execution Cadence (sec)
              </label>
              <input
                type="number"
                min="4"
                max="3600"
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Max Drawdown Stop (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="50"
                value={maxDrawdownPct}
                onChange={(e) => setMaxDrawdownPct(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C] flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-[#F0B90B] mt-0.5 shrink-0" />
            <span>
              Auto-halt protection engages immediately if cumulative realized drawdown hits {maxDrawdownPct}%, preventing runaway losses during volatile spikes.
            </span>
          </div>

          {formError && <div className="text-[#F6465D] font-medium">{formError}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 font-semibold rounded-md bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11] disabled:opacity-50"
          >
            {busy ? 'Deploying Bot...' : `Launch ${strategy} Bot (${accountMode.toUpperCase()})`}
          </button>
        </form>

        {/* Active Bots & Execution Stream */}
        <div className="xl:col-span-7 space-y-4">
          {bots.length === 0 ? (
            <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-10 text-center space-y-2">
              <Activity className="w-6 h-6 text-[#F0B90B] mx-auto" />
              <div className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                No Smart Bots Deployed Yet
              </div>
              <p className="text-xs text-slate-500 dark:text-[#848E9C] max-w-md mx-auto">
                Configure any algorithmic template on the left—such as a BTC Volatility Grid or EMA 9/21 Momentum Bot—to automate risk-guarded execution.
              </p>
            </div>
          ) : (
            bots.map((bot) => (
              <div
                key={bot.id}
                className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                        {bot.name}
                      </h3>
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          bot.status === 'RUNNING'
                            ? 'text-[#0ECB81]'
                            : bot.status === 'PAUSED'
                            ? 'text-[#F0B90B]'
                            : 'text-[#F6465D]'
                        }`}
                      >
                        {bot.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
                      <button
                        type="button"
                        onClick={() => onSelectSymbol(bot.symbol)}
                        className="text-blue-600 dark:text-[#F0B90B] hover:underline font-semibold"
                      >
                        {bot.symbol}
                      </button>{' '}
                      · {bot.strategy} · {bot.accountMode.toUpperCase()} · Max DD {bot.maxDrawdownPct}%
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void onToggleBot(bot.id)}
                      disabled={bot.status === 'STOPPED_DRAWDOWN'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-[#2B3139] hover:border-[#F0B90B] disabled:opacity-40"
                    >
                      {bot.status === 'RUNNING' ? (
                        <>
                          <Pause className="w-3 h-3 text-[#F0B90B]" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-[#0ECB81]" />
                          Resume
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteBot(bot.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-[#F6465D]/40 text-[#F6465D] hover:bg-[#F6465D]/10"
                    >
                      <Trash2 className="w-3 h-3" />
                      Stop
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-[#2B3139] text-xs font-mono tabular-nums">
                  <div>
                    <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Allocated</div>
                    <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {formatCurrency(bot.allocatedUsd)}
                    </div>
                  </div>
                  <div>
                    <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Slice Size</div>
                    <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {bot.orderSizeUnits} {bot.symbol}
                    </div>
                  </div>
                  <div>
                    <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Executed Fills</div>
                    <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {bot.tradesCount}
                    </div>
                  </div>
                  <div>
                    <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Realized P&amp;L</div>
                    <div
                      className={`font-semibold ${
                        bot.realizedPnlUsd >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                      }`}
                    >
                      {bot.realizedPnlUsd >= 0 ? '+' : ''}
                      {formatCurrency(bot.realizedPnlUsd)}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-600 dark:text-[#B7BDC6] bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] rounded px-3 py-1.5">
                  Signal: {bot.lastSignalText}
                </div>

                {bot.logs.length > 0 && (
                  <div className="overflow-x-auto max-h-36 overflow-y-auto border-t border-slate-200 dark:border-[#2B3139] pt-2">
                    <table className="w-full text-left text-[11px] font-mono tabular-nums">
                      <thead>
                        <tr className="text-slate-500 dark:text-[#848E9C]">
                          <th className="py-1 pr-2">Time</th>
                          <th className="py-1 pr-2">Side</th>
                          <th className="py-1 pr-2 text-right">Price</th>
                          <th className="py-1 pr-2 text-right">Units</th>
                          <th className="py-1 pr-2">Trigger</th>
                          <th className="py-1 text-right">Net P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139]">
                        {bot.logs.slice(0, 6).map((log) => (
                          <tr key={log.id}>
                            <td className="py-1 pr-2 text-slate-500">{formatTimeShort(log.createdAt)}</td>
                            <td
                              className={`py-1 pr-2 font-semibold ${
                                log.side === 'buy' ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                              }`}
                            >
                              {log.side.toUpperCase()}
                            </td>
                            <td className="py-1 pr-2 text-right">
                              {formatPrice(log.price, log.symbol)}
                            </td>
                            <td className="py-1 pr-2 text-right">{log.size}</td>
                            <td className="py-1 pr-2 font-sans text-slate-600 dark:text-[#B7BDC6] truncate max-w-[160px]">
                              {log.reason}
                            </td>
                            <td
                              className={`py-1 text-right ${
                                log.pnlImpactUsd >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                              }`}
                            >
                              {log.pnlImpactUsd >= 0 ? '+' : ''}
                              {formatCurrency(log.pnlImpactUsd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
