import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Plus, Star, X } from 'lucide-react';
import type { Instrument, MlPrediction } from '../types/market';
import { formatCompactNumber, formatPrice } from '../utils/format';

interface MarketHeatmapProps {
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  watchlistSymbols: string[];
  onToggleWatchlist: (symbol: string) => void;
  onOpenTerminal: (symbol: string) => void;
}

function resolveHeatCellStyle(pct: number): {
  bg: string;
  border: string;
  text: string;
  subText: string;
  label: 'STRONG GAIN' | 'GAIN' | 'FLAT' | 'LOSS' | 'STEEP LOSS';
} {
  if (pct >= 2.5) {
    return {
      bg: '#047857',
      border: '#10B981',
      text: '#FFFFFF',
      subText: '#D1FAE5',
      label: 'STRONG GAIN',
    };
  }
  if (pct >= 0.25) {
    return {
      bg: '#064E3B',
      border: '#059669',
      text: '#ECFDF5',
      subText: '#A7F3D0',
      label: 'GAIN',
    };
  }
  if (pct <= -2.5) {
    return {
      bg: '#991B1B',
      border: '#EF4444',
      text: '#FFFFFF',
      subText: '#FEE2E2',
      label: 'STEEP LOSS',
    };
  }
  if (pct <= -0.25) {
    return {
      bg: '#7F1D1D',
      border: '#DC2626',
      text: '#FEF2F2',
      subText: '#FECACA',
      label: 'LOSS',
    };
  }
  return {
    bg: '#1E2329',
    border: '#363C46',
    text: '#EAECEF',
    subText: '#9CA3AF',
    label: 'FLAT',
  };
}

export function MarketHeatmap({
  instruments,
  predictions,
  watchlistSymbols,
  onToggleWatchlist,
  onOpenTerminal,
}: MarketHeatmapProps) {
  const [scope, setScope] = useState<'watchlist' | 'universe'>('watchlist');
  const [metric, setMetric] = useState<'session' | 'ml15m'>('session');
  const [symbolToAdd, setSymbolToAdd] = useState('');

  const watchlistItems = useMemo(() => {
    const instMap = new Map<string, Instrument>();
    for (const i of instruments) instMap.set(i.symbol, i);
    const items = watchlistSymbols
      .map((sym) => instMap.get(sym))
      .filter((x): x is Instrument => Boolean(x));
    return items.sort((a, b) => b.changePct - a.changePct);
  }, [instruments, watchlistSymbols]);

  const universeTopItems = useMemo(() => {
    return [...instruments]
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 16);
  }, [instruments]);

  const displayedItems = scope === 'watchlist' ? watchlistItems : universeTopItems;

  const availableToPin = useMemo(() => {
    const pinned = new Set(watchlistSymbols);
    return instruments.filter((i) => !pinned.has(i.symbol));
  }, [instruments, watchlistSymbols]);

  const stats = useMemo(() => {
    if (displayedItems.length === 0) {
      return { advancers: 0, decliners: 0, avgPct: 0, best: null as Instrument | null, worst: null as Instrument | null };
    }
    let advancers = 0;
    let decliners = 0;
    let sum = 0;
    let best = displayedItems[0];
    let worst = displayedItems[0];
    for (const item of displayedItems) {
      const val =
        metric === 'session'
          ? item.changePct
          : predictions[item.symbol]?.predictedReturnPct ?? item.changePct;
      sum += val;
      if (val >= 0) advancers += 1;
      else decliners += 1;
      const bestVal =
        metric === 'session'
          ? best.changePct
          : predictions[best.symbol]?.predictedReturnPct ?? best.changePct;
      const worstVal =
        metric === 'session'
          ? worst.changePct
          : predictions[worst.symbol]?.predictedReturnPct ?? worst.changePct;
      if (val > bestVal) best = item;
      if (val < worstVal) worst = item;
    }
    return {
      advancers,
      decliners,
      avgPct: sum / displayedItems.length,
      best,
      worst,
    };
  }, [displayedItems, metric, predictions]);

  const handleAddSymbol = () => {
    const target = symbolToAdd.trim();
    if (!target) return;
    if (!watchlistSymbols.includes(target)) {
      onToggleWatchlist(target);
    }
    setSymbolToAdd('');
  };

  return (
    <section className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3.5">
      {/* Heatmap Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Star className="w-4 h-4 text-[#F0B90B]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              Real-Time Watchlist Market Heatmap
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
              · {displayedItems.length} Symbols · {stats.advancers} Up / {stats.decliners} Down · Avg{' '}
              <span className={stats.avgPct >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>
                {stats.avgPct >= 0 ? '+' : ''}
                {stats.avgPct.toFixed(2)}%
              </span>
            </span>
          </div>
          {stats.best && stats.worst && (
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
              Leader: <span className="text-[#0ECB81] font-semibold">{stats.best.symbol}</span> ({stats.best.changePct >= 0 ? '+' : ''}
              {stats.best.changePct.toFixed(2)}%) · Laggard:{' '}
              <span className="text-[#F6465D] font-semibold">{stats.worst.symbol}</span> ({stats.worst.changePct >= 0 ? '+' : ''}
              {stats.worst.changePct.toFixed(2)}%)
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Switch */}
          <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]">
            <button
              type="button"
              onClick={() => setScope('watchlist')}
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                scope === 'watchlist'
                  ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Watchlist ({watchlistItems.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('universe')}
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                scope === 'universe'
                  ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Top Movers (16)
            </button>
          </div>

          {/* Metric Heat Source Switch */}
          <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]">
            <button
              type="button"
              onClick={() => setMetric('session')}
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                metric === 'session'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              24h % Change
            </button>
            <button
              type="button"
              onClick={() => setMetric('ml15m')}
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                metric === 'ml15m'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              ML 15m Drift
            </button>
          </div>

          {/* Quick Add Symbol to Watchlist */}
          {availableToPin.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                value={symbolToAdd}
                onChange={(e) => setSymbolToAdd(e.target.value)}
                aria-label="Select symbol to pin to watchlist heatmap"
                className="px-2 py-1.5 text-[11px] font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 max-w-[140px]"
              >
                <option value="">+ Pin symbol…</option>
                {availableToPin.slice(0, 60).map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol} ({inst.venue})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddSymbol}
                disabled={!symbolToAdd}
                aria-label="Pin selected symbol"
                className="p-1.5 rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap Tile Grid */}
      {displayedItems.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-md space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your watchlist is currently empty. Pin symbols from the dropdown above or the Screener table below.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-2">
          {displayedItems.map((inst) => {
            const pred = predictions[inst.symbol];
            const heatVal =
              metric === 'session'
                ? inst.changePct
                : pred?.predictedReturnPct ?? inst.changePct;
            const style = resolveHeatCellStyle(heatVal);
            const isPinned = watchlistSymbols.includes(inst.symbol);
            const isPositive = heatVal >= 0;

            return (
              <div
                key={inst.symbol}
                role="button"
                tabIndex={0}
                onClick={() => onOpenTerminal(inst.symbol)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenTerminal(inst.symbol);
                  }
                }}
                style={{
                  backgroundColor: style.bg,
                  borderColor: style.border,
                  color: style.text,
                }}
                className="group relative rounded-md border p-3 flex flex-col justify-between min-h-[104px] text-left cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0B90B]"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold tracking-tight truncate">
                      {inst.symbol}
                    </div>
                    <div
                      style={{ color: style.subText }}
                      className="text-[10px] truncate"
                    >
                      {inst.venue}
                    </div>
                  </div>

                  {isPinned && watchlistSymbols.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(inst.symbol);
                      }}
                      title={`Remove ${inst.symbol} from watchlist`}
                      aria-label={`Remove ${inst.symbol} from watchlist`}
                      className="opacity-70 group-hover:opacity-100 p-0.5 rounded hover:bg-black/25 transition-opacity shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="my-1.5 font-mono tabular-nums text-xs font-semibold">
                  {formatPrice(inst.price, inst.symbol)}
                </div>

                <div className="flex items-center justify-between gap-1 font-mono tabular-nums">
                  <span className="inline-flex items-center gap-0.5 text-sm font-bold">
                    {isPositive ? (
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {isPositive ? '+' : ''}
                    {heatVal.toFixed(2)}%
                  </span>
                  <span
                    style={{ color: style.subText }}
                    className="text-[9px] font-medium"
                  >
                    Vol {formatCompactNumber(inst.volume24h)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diverging Color Key Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#991B1B] border border-[#EF4444]" /> ≤ -2.5%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#7F1D1D] border border-[#DC2626]" /> -0.25% to -2.5%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#1E2329] border border-[#363C46]" /> Neutral
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#064E3B] border border-[#059669]" /> +0.25% to +2.5%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#047857] border border-[#10B981]" /> ≥ +2.5%
          </span>
        </div>
        <span>Click any tile to launch live Trading Terminal</span>
      </div>
    </section>
  );
}
