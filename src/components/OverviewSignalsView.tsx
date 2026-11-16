import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BellPlus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type {
  ActionableInsight,
  AiThesisBrief,
  DetectedPattern,
  Instrument,
  MlPrediction,
  NewsItem,
  Position,
} from '../types/market';
import { formatCurrency, formatPrice, formatRelativeTime } from '../utils/format';

interface OverviewSignalsViewProps {
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  insights: ActionableInsight[];
  patterns: DetectedPattern[];
  news: NewsItem[];
  positions: Position[];
  cashBalance: number;
  activeSymbol: string;
  guideMode: boolean;
  onOpenTerminal: (symbol: string) => void;
  onOpenGuide: () => void;
  onArmAlert: (symbol: string, condition: 'above' | 'below', targetPrice: number, note: string) => void;
}

export function OverviewSignalsView({
  instruments,
  predictions,
  insights,
  patterns,
  news,
  positions,
  cashBalance,
  activeSymbol,
  guideMode,
  onOpenTerminal,
  onOpenGuide,
  onArmAlert,
}: OverviewSignalsViewProps) {
  const [briefSymbol, setBriefSymbol] = useState(activeSymbol);
  const [brief, setBrief] = useState<AiThesisBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [showWelcomeStrip, setShowWelcomeStrip] = useState(true);
  const [wireSentimentFilter, setWireSentimentFilter] = useState<'all' | 'Bullish' | 'Bearish' | 'Neutral'>('all');

  useEffect(() => {
    setBriefSymbol(activeSymbol);
  }, [activeSymbol]);

  const filteredOverviewNews = useMemo(() => {
    if (wireSentimentFilter === 'all') return news;
    return news.filter((item) => item.sentiment === wireSentimentFilter);
  }, [news, wireSentimentFilter]);

  const overviewSentimentCounts = useMemo(() => {
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    for (const item of news) {
      if (item.sentiment === 'Bullish') bullish += 1;
      else if (item.sentiment === 'Bearish') bearish += 1;
      else neutral += 1;
    }
    return { all: news.length, Bullish: bullish, Bearish: bearish, Neutral: neutral };
  }, [news]);

  const portfolioMetrics = useMemo(() => {
    const marketValue = positions.reduce((acc, p) => acc + p.marketValue, 0);
    const unrealized = positions.reduce((acc, p) => acc + p.unrealizedPnl, 0);
    const realized = positions.reduce((acc, p) => acc + p.realizedPnl, 0);
    const totalEquity = cashBalance + marketValue;
    return { totalEquity, unrealized, realized, netPnl: unrealized + realized };
  }, [cashBalance, positions]);

  const topSignal = useMemo(() => {
    const list = Object.values(predictions).sort(
      (a, b) => b.opportunityScore - a.opportunityScore
    );
    return list[0];
  }, [predictions]);

  const newsSentimentSummary = useMemo(() => {
    if (news.length === 0) return { label: 'Neutral', avg: 0, bullishCount: 0 };
    const avg = news.reduce((acc, n) => acc + n.sentimentScore, 0) / news.length;
    const bullishCount = news.filter((n) => n.sentiment === 'Bullish').length;
    const label = avg >= 0.12 ? 'Constructive' : avg <= -0.12 ? 'Defensive' : 'Balanced';
    return { label, avg, bullishCount };
  }, [news]);

  const generateBrief = async (targetSym?: string) => {
    const sym = targetSym || briefSymbol;
    setBriefSymbol(sym);
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await fetch('/api/v1/ai/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      if (!res.ok) {
        const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errPayload.error ?? `Analysis request failed (${res.status})`);
      }
      const data = (await res.json()) as AiThesisBrief;
      setBrief(data);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Unable to generate thesis');
    } finally {
      setBriefLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Beginner Quick-Start Guide Strip */}
      {guideMode && showWelcomeStrip && (
        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                New to Trading? Here Is How Aurex Global Exchange Works
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                You are practicing with $1,000,000 in virtual paper money—zero real financial risk.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onOpenGuide}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Open Full Market Guide
              </button>
              <button
                type="button"
                onClick={() => setShowWelcomeStrip(false)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                1. Spot AI Signals Below
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Green numbers (<strong className="text-emerald-600 dark:text-emerald-400">Bullish</strong>) mean models expect prices to rise over 15 minutes; red (<strong className="text-red-600 dark:text-red-400">Bearish</strong>) means falling pressure.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                2. Read an AI Investment Brief
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Click <strong>Brief</strong> on any opportunity to get a plain-English summary of why it is moving, plus a suggested target and safety exit price.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                3. Practice Buying & Selling
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Click <strong>Trade</strong> to open the chart terminal. Press <strong>B</strong> to quick-buy, <strong>S</strong> to quick-sell, or <strong>Alert</strong> to get notified automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Desk Equity
          </div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(portfolioMetrics.totalEquity)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Cash {formatCurrency(cashBalance)} · {positions.length} active positions
          </div>
          {guideMode && (
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Your virtual cash plus current value of assets owned
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Net Session P&L
          </div>
          <div
            className={`mt-1.5 text-2xl font-semibold font-mono tabular-nums ${
              portfolioMetrics.netPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {portfolioMetrics.netPnl >= 0 ? '+' : ''}
            {formatCurrency(portfolioMetrics.netPnl)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Unrealized {formatCurrency(portfolioMetrics.unrealized)} · Realized{' '}
            {formatCurrency(portfolioMetrics.realized)}
          </div>
          {guideMode && (
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Total paper profit or loss across open & closed trades
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Highest ML Conviction
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              {topSignal ? topSignal.symbol : '—'}
            </span>
            {topSignal && (
              <span
                className={`text-sm font-mono tabular-nums font-medium ${
                  topSignal.predictedReturnPct >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {topSignal.predictedReturnPct >= 0 ? '+' : ''}
                {topSignal.predictedReturnPct.toFixed(2)}% (15m)
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {topSignal
              ? `Score ${topSignal.opportunityScore}/100 · Conf ${(topSignal.confidence * 100).toFixed(0)}% · ${topSignal.regime}`
              : 'Evaluating feeds'}
          </div>
          {guideMode && (
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Asset where price trend, buyers & news agree most
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            News Wire Sentiment
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 dark:text-white">
            {newsSentimentSummary.label}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {newsSentimentSummary.bullishCount}/{news.length} bullish headlines · Polarity{' '}
            {newsSentimentSummary.avg >= 0 ? '+' : ''}
            {newsSentimentSummary.avg.toFixed(2)}
          </div>
          {guideMode && (
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Overall mood of live financial headlines right now
            </div>
          )}
        </div>
      </div>

      {/* Main Split: Actionable Opportunities + On-Demand AI Brief */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Actionable ML Investment Opportunities */}
        <div className="lg:col-span-7 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Actionable ML Opportunities
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked across NASDAQ, NYSE, Crypto, FX & CME using 15-minute regression drift, book imbalance & news polarity
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {insights.map((ins) => {
              const inst = instruments.find((i) => i.symbol === ins.symbol);
              const isBull = ins.predictedReturnPct >= 0;
              return (
                <div
                  key={ins.id}
                  className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {ins.symbol}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ins.venue}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            isBull
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-red-600 dark:text-red-400 font-medium'
                          }
                        >
                          {ins.action}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ins.conviction} Conviction</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {ins.thesis}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        <span>
                          Spot{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {inst ? formatPrice(inst.price, ins.symbol) : '—'}
                          </strong>
                        </span>
                        <span>
                          15m Target{' '}
                          <strong
                            className={
                              isBull
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {formatPrice(ins.targetPrice, ins.symbol)} (
                            {isBull ? '+' : ''}
                            {ins.predictedReturnPct.toFixed(2)}%)
                          </strong>
                        </span>
                        <span>
                          Stop{' '}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {formatPrice(ins.stopLossPrice, ins.symbol)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => generateBrief(ins.symbol)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors"
                      >
                        Brief
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onArmAlert(
                            ins.symbol,
                            isBull ? 'above' : 'below',
                            ins.targetPrice,
                            `ML ${ins.horizon} target`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <BellPlus className="w-3.5 h-3.5" />
                        Alert
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTerminal(ins.symbol)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0 transition-colors"
                      >
                        Trade
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 cols: On-Demand Institutional AI Execution Brief */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Quantitative Investment Brief
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synthesize ML forecast, L2 imbalance & news catalysts
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={briefSymbol}
                onChange={(e) => setBriefSymbol(e.target.value)}
                aria-label="Select symbol for investment brief"
                className="px-2.5 py-1.5 text-xs font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {instruments.map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => generateBrief()}
                disabled={briefLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {briefLoading ? 'Synthesizing...' : 'Generate Brief'}
              </button>
            </div>
          </div>

          {briefError && (
            <div className="p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
              {briefError}
            </div>
          )}

          {brief ? (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {brief.symbol} · {brief.stance}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {brief.generatedBy} · {formatRelativeTime(brief.generatedAt)}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                {brief.headline}
              </h3>

              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {brief.rationale}
              </p>

              <div className="grid grid-cols-3 gap-3 py-2.5 border-y border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums">
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Entry Zone
                  </div>
                  <div className="mt-0.5 font-medium text-slate-900 dark:text-white">
                    {brief.entryZone}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Target
                  </div>
                  <div className="mt-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                    {brief.targetZone}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Invalidation
                  </div>
                  <div className="mt-0.5 font-medium text-red-600 dark:text-red-400">
                    {brief.invalidationLevel}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="font-medium text-slate-700 dark:text-slate-200">
                  Catalysts
                </div>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                  {brief.catalysts.map((c, idx) => (
                    <li key={idx}>• {c}</li>
                  ))}
                </ul>
                <div className="font-medium text-slate-700 dark:text-slate-200 pt-1">
                  Risk Parameters
                </div>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                  {brief.riskFactors.map((r, idx) => (
                    <li key={idx}>• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Select any equity, cryptocurrency, FX pair, or commodity and click{' '}
                <strong className="text-slate-700 dark:text-slate-200">Generate Brief</strong>{' '}
                to synthesize live ML drift, technical patterns, and news catalysts.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Split: Pattern Detector Feed + News Sentiment Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Live Technical Pattern Detections
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {patterns.length} recent signals
            </span>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {patterns.slice(0, 8).map((pat) => (
              <div
                key={pat.id}
                onClick={() => onOpenTerminal(pat.symbol)}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    {pat.bias === 'Bullish' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {pat.symbol}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {pat.name}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        pat.bias === 'Bullish'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {pat.bias}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {pat.summary}
                  </p>
                </div>
                <div className="text-right text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                  <div>{(pat.confidence * 100).toFixed(0)}% conf</div>
                  <div>{formatRelativeTime(pat.detectedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Ingested Financial News Wire
            </h2>
            <div
              role="group"
              aria-label="Filter financial news wire by sentiment"
              className="flex items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
            >
              {(
                [
                  { id: 'all', label: 'All', count: overviewSentimentCounts.all },
                  { id: 'Bullish', label: 'Bullish', count: overviewSentimentCounts.Bullish },
                  { id: 'Bearish', label: 'Bearish', count: overviewSentimentCounts.Bearish },
                  { id: 'Neutral', label: 'Neutral', count: overviewSentimentCounts.Neutral },
                ] as const
              ).map((tab) => {
                const active = wireSentimentFilter === tab.id;
                const activeTone =
                  tab.id === 'Bullish'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : tab.id === 'Bearish'
                    ? 'bg-red-600 text-white font-semibold'
                    : tab.id === 'Neutral'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold';
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setWireSentimentFilter((prev) =>
                        tab.id === 'all' ? 'all' : prev === tab.id ? 'all' : tab.id
                      )
                    }
                    className={`px-2 py-1 rounded whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? activeTone
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}{' '}
                    <span className="font-mono tabular-nums opacity-80">({tab.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {filteredOverviewNews.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <div>No {wireSentimentFilter === 'all' ? '' : wireSentimentFilter} headlines available right now.</div>
                {wireSentimentFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setWireSentimentFilter('all')}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Show all sentiments
                  </button>
                )}
              </div>
            ) : (
              filteredOverviewNews.slice(0, 8).map((item) => (
                <div key={item.id} className="px-5 py-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {item.source}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          item.sentiment === 'Bullish'
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : item.sentiment === 'Bearish'
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {item.sentiment}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.symbols.join(', ')}</span>
                    </div>
                    <span className="font-mono tabular-nums">
                      {formatRelativeTime(item.publishedAt)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 leading-snug">
                    {item.title}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
