import { useMemo, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, BellPlus, LayoutGrid, Search, Star, Table2 } from 'lucide-react';
import type { Instrument, MlPrediction } from '../types/market';
import { formatCompactNumber, formatPrice } from '../utils/format';
import { Sparkline } from './Sparkline';
import { MarketHeatmap } from './MarketHeatmap';

interface ScreenerViewProps {
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  watchlistSymbols?: string[];
  onToggleWatchlist?: (symbol: string) => void;
  guideMode?: boolean;
  onOpenTerminal: (symbol: string) => void;
  onArmAlert: (symbol: string, condition: 'above' | 'below', targetPrice: number, note: string) => void;
}

type SortField = 'symbol' | 'price' | 'changePct' | 'predictedReturnPct' | 'opportunityScore' | 'rsi14' | 'spreadBps';

type ScreenerFilter =
  | 'all'
  | 'crypto'
  | 'india'
  | 'us'
  | 'europe'
  | 'asia'
  | 'fx'
  | 'commodities';

type ModeFilter = 'all' | 'spot' | 'futures' | 'options';

const DEFAULT_HEATMAP_WATCHLIST = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'XRP-USD',
  'NVDA',
  'RELIANCE.NS',
  'EUR-USD',
  'XAU-USD',
];

export function ScreenerView({
  instruments,
  predictions,
  watchlistSymbols = DEFAULT_HEATMAP_WATCHLIST,
  onToggleWatchlist,
  guideMode = false,
  onOpenTerminal,
  onArmAlert,
}: ScreenerViewProps) {
  const [assetFilter, setAssetFilter] = useState<ScreenerFilter>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [screenerLayout, setScreenerLayout] = useState<'both' | 'heatmap' | 'table'>('both');
  const [localWatchlist, setLocalWatchlist] = useState<string[]>(watchlistSymbols);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('opportunityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const effectiveWatchlist = onToggleWatchlist ? watchlistSymbols : localWatchlist;
  const handleToggleWatchlist = (symbol: string) => {
    if (onToggleWatchlist) {
      onToggleWatchlist(symbol);
      return;
    }
    setLocalWatchlist((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [symbol, ...prev]
    );
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const matchesFilter = (inst: Instrument, filter: ScreenerFilter): boolean => {
    if (filter === 'all') return true;
    if (filter === 'crypto') return inst.assetClass === 'crypto';
    if (filter === 'fx') return inst.assetClass === 'fx';
    if (filter === 'commodities') return inst.assetClass === 'commodities';
    if (filter === 'india') {
      return inst.region === 'india' || inst.venue === 'NSE' || inst.venue === 'BSE' || inst.symbol === 'USD-INR';
    }
    if (filter === 'us') {
      return inst.region === 'us' && inst.assetClass === 'equities';
    }
    if (filter === 'europe') {
      return inst.region === 'europe' || inst.venue === 'LSE' || inst.venue === 'XETRA' || inst.venue === 'EURONEXT' || inst.venue === 'SIX';
    }
    if (filter === 'asia') {
      return inst.region === 'asia' || inst.venue === 'TSE' || inst.venue === 'HKEX' || inst.venue === 'TWSE';
    }
    return true;
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<ScreenerFilter, number> = {
      all: instruments.length,
      crypto: 0,
      india: 0,
      us: 0,
      europe: 0,
      asia: 0,
      fx: 0,
      commodities: 0,
    };
    for (const inst of instruments) {
      if (matchesFilter(inst, 'crypto')) counts.crypto += 1;
      if (matchesFilter(inst, 'india')) counts.india += 1;
      if (matchesFilter(inst, 'us')) counts.us += 1;
      if (matchesFilter(inst, 'europe')) counts.europe += 1;
      if (matchesFilter(inst, 'asia')) counts.asia += 1;
      if (matchesFilter(inst, 'fx')) counts.fx += 1;
      if (matchesFilter(inst, 'commodities')) counts.commodities += 1;
    }
    return counts;
  }, [instruments]);

  const modeCounts = useMemo(() => {
    let spot = 0;
    let futures = 0;
    let options = 0;
    for (const inst of instruments) {
      const m = inst.instrumentType ?? 'spot';
      if (m === 'futures') futures += 1;
      else if (m === 'options') options += 1;
      else spot += 1;
    }
    return { all: instruments.length, spot, futures, options };
  }, [instruments]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instruments
      .filter((inst) => {
        if (!matchesFilter(inst, assetFilter)) return false;
        const instMode = inst.instrumentType ?? 'spot';
        if (modeFilter !== 'all' && instMode !== modeFilter) return false;
        if (
          q &&
          !inst.symbol.toLowerCase().includes(q) &&
          !inst.name.toLowerCase().includes(q) &&
          !(inst.sector ?? '').toLowerCase().includes(q) &&
          !inst.venue.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .map((inst) => ({
        inst,
        pred: predictions[inst.symbol],
      }))
      .sort((a, b) => {
        const dir = sortDir === 'desc' ? -1 : 1;
        if (sortBy === 'symbol') return a.inst.symbol.localeCompare(b.inst.symbol) * -dir;
        if (sortBy === 'price') return (a.inst.price - b.inst.price) * dir;
        if (sortBy === 'changePct') return (a.inst.changePct - b.inst.changePct) * dir;
        if (sortBy === 'spreadBps') return (a.inst.spreadBps - b.inst.spreadBps) * dir;
        if (sortBy === 'predictedReturnPct') {
          return ((a.pred?.predictedReturnPct ?? 0) - (b.pred?.predictedReturnPct ?? 0)) * dir;
        }
        if (sortBy === 'rsi14') {
          return ((a.pred?.rsi14 ?? 50) - (b.pred?.rsi14 ?? 50)) * dir;
        }
        return ((a.pred?.opportunityScore ?? 0) - (b.pred?.opportunityScore ?? 0)) * dir;
      });
  }, [assetFilter, instruments, modeFilter, predictions, query, sortBy, sortDir]);

  const filterTabs: Array<{ id: ScreenerFilter; label: string }> = [
    { id: 'all', label: `All Markets (${categoryCounts.all})` },
    { id: 'crypto', label: `Crypto Coins (${categoryCounts.crypto})` },
    { id: 'india', label: `India NSE/BSE (${categoryCounts.india})` },
    { id: 'us', label: `US Stocks (${categoryCounts.us})` },
    { id: 'europe', label: `Europe & UK (${categoryCounts.europe})` },
    { id: 'asia', label: `Asia-Pacific (${categoryCounts.asia})` },
    { id: 'fx', label: `Global Forex (${categoryCounts.fx})` },
    { id: 'commodities', label: `Commodities (${categoryCounts.commodities})` },
  ];

  const watchlistSet = useMemo(() => new Set(effectiveWatchlist), [effectiveWatchlist]);

  return (
    <div className="space-y-4">
      {/* Integrated Real-Time Watchlist Market Heatmap */}
      {screenerLayout !== 'table' && (
        <MarketHeatmap
          instruments={instruments}
          predictions={predictions}
          watchlistSymbols={effectiveWatchlist}
          onToggleWatchlist={handleToggleWatchlist}
          onOpenTerminal={onOpenTerminal}
        />
      )}

      {screenerLayout !== 'heatmap' && (
        <div className="bg-white dark:bg-[#111215] border border-slate-200 dark:border-[#24262C] rounded-lg overflow-hidden">
          {/* Screener Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-[#24262C]">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#08080A] rounded-lg">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAssetFilter(tab.id)}
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 transition-colors font-mono tabular-nums ${
                    assetFilter === tab.id
                      ? 'bg-white dark:bg-[#1C1E24] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Layout Mode */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#08080A] rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setScreenerLayout('both')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded whitespace-nowrap transition-colors ${
                    screenerLayout === 'both'
                      ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" /> Both
                </button>
                <button
                  type="button"
                  onClick={() => setScreenerLayout('heatmap')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                >
                  Heatmap
                </button>
                <button
                  type="button"
                  onClick={() => setScreenerLayout('table')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                >
                  <Table2 className="w-3 h-3" /> Table
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#08080A] rounded-lg">
                {(
                  [
                    { id: 'all', label: `All (${modeCounts.all})` },
                    { id: 'spot', label: `Spot (${modeCounts.spot})` },
                    { id: 'futures', label: `Futures (${modeCounts.futures})` },
                    { id: 'options', label: `Options (${modeCounts.options})` },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModeFilter(m.id)}
                    className={`px-2 py-1 text-[11px] font-mono rounded whitespace-nowrap transition-colors ${
                      modeFilter === m.id
                        ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter symbol, sector, venue..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-[#08080A] border border-slate-200 dark:border-[#24262C] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F0B90B]"
                />
              </div>
            </div>
          </div>

          {guideMode && (
            <div className="px-5 py-2 bg-slate-50/80 dark:bg-[#08080A] border-b border-slate-200 dark:border-[#24262C] text-[11px] text-slate-500 dark:text-slate-400">
              How to read this table: <strong>Pin Star</strong> adds/removes symbols on the Watchlist Heatmap · <strong>ML 15m Drift</strong> = predicted short-term move · <strong>Opp Score</strong> = signal strength out of 100 · Click any row to trade.
            </div>
          )}

          {/* High-Density Market Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#24262C] text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#08080A]/60">
                  <th className="py-2.5 px-4">
                    <button type="button" onClick={() => toggleSort('symbol')} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                      Instrument <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button type="button" onClick={() => toggleSort('price')} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                      Last Price <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button type="button" onClick={() => toggleSort('changePct')} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                      Session % <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Intraday Curve</th>
                  <th className="py-2.5 px-3 text-right">
                    <button type="button" onClick={() => toggleSort('predictedReturnPct')} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                      ML 15m Drift <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button type="button" onClick={() => toggleSort('opportunityScore')} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                      Opp Score <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button type="button" onClick={() => toggleSort('rsi14')} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                      RSI (14) <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">Volume</th>
                  <th className="py-2.5 px-3 text-right">
                    <button type="button" onClick={() => toggleSort('spreadBps')} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                      Spread <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#24262C] text-xs">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      No instruments matched your filter.
                    </td>
                  </tr>
                ) : (
                  rows.map(({ inst, pred }) => {
                    const posChange = inst.changePct >= 0;
                    const posPred = (pred?.predictedReturnPct ?? 0) >= 0;
                    const pinned = watchlistSet.has(inst.symbol);
                    return (
                      <tr
                        key={inst.symbol}
                        onClick={() => onOpenTerminal(inst.symbol)}
                        className="hover:bg-slate-50 dark:hover:bg-[#1C1E24]/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-900 dark:text-white">
                            <span>{inst.symbol}</span>
                            {inst.instrumentType && inst.instrumentType !== 'spot' && (
                              <span className="text-[10px] font-semibold text-[#D9A70A] dark:text-[#F0B90B]">
                                · {inst.instrumentType.toUpperCase()}
                                {inst.contractSpec?.maxLeverage ? ` ${inst.contractSpec.maxLeverage}x` : ''}
                                {inst.contractSpec?.optionRight ? ` ${inst.contractSpec.optionRight}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[230px]">
                            {inst.name} · {inst.venue}
                            {inst.genesis ? ` · Est. ${inst.genesis.foundedYear} · Cap ${inst.genesis.marketCapFormatted}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                          {formatPrice(inst.price, inst.symbol)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${
                            posChange
                              ? 'text-[#0ECB81]'
                              : 'text-[#F6465D]'
                          }`}
                        >
                          {posChange ? '+' : ''}
                          {inst.changePct.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3">
                          <Sparkline data={inst.sparkline} positive={posChange} width={84} height={22} />
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${
                            posPred
                              ? 'text-[#0ECB81]'
                              : 'text-[#F6465D]'
                          }`}
                        >
                          {pred
                            ? `${posPred ? '+' : ''}${pred.predictedReturnPct.toFixed(2)}%`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {pred ? `${pred.opportunityScore}/100` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {pred ? pred.rsi14.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatCompactNumber(inst.volume24h)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {inst.spreadBps.toFixed(1)} bps
                        </td>
                        <td
                          className="py-2.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleWatchlist(inst.symbol)}
                              title={pinned ? 'Remove from Watchlist Heatmap' : 'Pin to Watchlist Heatmap'}
                              aria-label={pinned ? 'Remove from Watchlist Heatmap' : 'Pin to Watchlist Heatmap'}
                              className={`p-1.5 rounded border transition-colors ${
                                pinned
                                  ? 'border-[#F0B90B]/60 bg-[#F0B90B]/15 text-[#F0B90B]'
                                  : 'border-slate-200 dark:border-[#24262C] text-slate-500 dark:text-slate-400 hover:text-[#F0B90B]'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${pinned ? 'fill-[#F0B90B]' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onArmAlert(
                                  inst.symbol,
                                  posPred ? 'above' : 'below',
                                  pred?.predictedPrice ?? inst.price,
                                  'Screener ML Target'
                                )
                              }
                              title="Arm ML target alert"
                              className="p-1.5 rounded border border-slate-200 dark:border-[#24262C] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C1E24] transition-colors"
                            >
                              <BellPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenTerminal(inst.symbol)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] whitespace-nowrap shrink-0 transition-colors"
                            >
                              Trade
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {screenerLayout === 'heatmap' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setScreenerLayout('both')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-[#24262C] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#1C1E24]"
          >
            <Table2 className="w-3.5 h-3.5" /> Show Full Screener Table
          </button>
        </div>
      )}
    </div>
  );
}

