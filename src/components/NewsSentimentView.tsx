import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ExternalLink,
  Flame,
  Minus,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Instrument, NewsItem, NextMoveInterestItem } from '../types/market';
import { formatRelativeTime } from '../utils/format';

interface NewsSentimentViewProps {
  news: NewsItem[];
  instruments: Instrument[];
  nextMoveRadar?: NextMoveInterestItem[];
  onRefreshRadar?: () => void;
  onOpenTerminal: (symbol: string) => void;
}

type RegionFilter = 'all' | 'India' | 'US' | 'Europe' | 'Asia' | 'Crypto' | 'Macro' | 'Global';
type SentimentFilter = 'all' | 'Bullish' | 'Bearish' | 'Neutral';

export function NewsSentimentView({
  news,
  instruments,
  nextMoveRadar = [],
  onRefreshRadar,
  onOpenTerminal,
}: NewsSentimentViewProps) {
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [headlineInput, setHeadlineInput] = useState('');
  const [headlineSymbol, setHeadlineSymbol] = useState('NVDA');
  const [submitting, setSubmitting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const regionAndSearchNews = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return news.filter((item) => {
      const itemRegion = item.region ?? 'Global';
      if (regionFilter !== 'all' && itemRegion !== regionFilter) return false;
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.source.toLowerCase().includes(q) &&
        !item.symbols.some((s) => s.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [news, regionFilter, searchText]);

  const sentimentCounts = useMemo(() => {
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    for (const item of regionAndSearchNews) {
      if (item.sentiment === 'Bullish') bullish += 1;
      else if (item.sentiment === 'Bearish') bearish += 1;
      else neutral += 1;
    }
    return {
      all: regionAndSearchNews.length,
      Bullish: bullish,
      Bearish: bearish,
      Neutral: neutral,
    };
  }, [regionAndSearchNews]);

  const filteredNews = useMemo(() => {
    if (sentimentFilter === 'all') return regionAndSearchNews;
    return regionAndSearchNews.filter((item) => item.sentiment === sentimentFilter);
  }, [regionAndSearchNews, sentimentFilter]);

  const toggleSentiment = (target: SentimentFilter) => {
    if (target === 'all') {
      setSentimentFilter('all');
      return;
    }
    setSentimentFilter((prev) => (prev === target ? 'all' : target));
  };

  const resetAllFilters = () => {
    setSentimentFilter('all');
    setRegionFilter('all');
    setSearchText('');
  };

  const handleIngestHeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headlineInput.trim()) return;
    setSubmitting(true);
    setIngestError(null);
    try {
      const res = await fetch('/api/v1/news/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: headlineInput.trim(),
          source: 'Analyst Wire',
          symbols: [headlineSymbol],
        }),
      });
      if (!res.ok) {
        let message = `Unable to ingest headline (HTTP ${res.status}).`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // ignore non-json
        }
        setIngestError(message);
        return;
      }
      setHeadlineInput('');
      onRefreshRadar?.();
    } catch {
      setIngestError('Network error while ingesting market headline.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Where Investors Are Looking Next — Live Heat Radar */}
      {nextMoveRadar.length > 0 && (
        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#F0B90B]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Where Investors Are Looking Next — Live Capital Interest Radar
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#848E9C] mt-0.5">
                Combines national &amp; international breaking news velocity, ML opportunity scores, and intraday breadth across Equities, Crypto, Futures &amp; Options.
              </p>
            </div>
            {onRefreshRadar && (
              <button
                type="button"
                onClick={onRefreshRadar}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:border-[#F0B90B] whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Radar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {nextMoveRadar.slice(0, 8).map((item) => {
              const bull = item.direction === 'Bullish';
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => onOpenTerminal(item.symbol)}
                  className="text-left p-3.5 rounded-lg border border-slate-200 dark:border-[#2B3139] bg-slate-50/60 dark:bg-[#0B0E11]/60 hover:border-[#F0B90B] transition-colors flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-[#EAECEF]">
                      {item.symbol}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] font-semibold text-[#F0B90B]">
                      Heat {item.heatScore}/100
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#848E9C] truncate">
                    {item.name} · {item.region}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-[#B7BDC6] line-clamp-2">
                    {item.reason}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-[#2B3139] text-[11px] font-mono tabular-nums">
                    <span className={bull ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>
                      {item.direction} ({item.predictedReturnPct >= 0 ? '+' : ''}
                      {item.predictedReturnPct.toFixed(2)}%)
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-slate-700 dark:text-[#EAECEF]">
                      Trade <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Wire Ingestion + National/International Filter Controls */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              National &amp; International Market News Wire
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#848E9C]">
              Live CryptoCompare &amp; multi-region Yahoo Finance RSS dispatches scored for directional AI impact. Click any sentiment toggle to filter.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter market news by AI sentiment"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] rounded-lg"
          >
            {(
              [
                { id: 'all', label: 'All', count: sentimentCounts.all },
                { id: 'Bullish', label: 'Bullish', count: sentimentCounts.Bullish },
                { id: 'Bearish', label: 'Bearish', count: sentimentCounts.Bearish },
                { id: 'Neutral', label: 'Neutral', count: sentimentCounts.Neutral },
              ] as const
            ).map((tab) => {
              const active = sentimentFilter === tab.id;
              const activeClass =
                tab.id === 'Bullish'
                  ? 'bg-[#0ECB81] text-[#0B0E11] font-semibold'
                  : tab.id === 'Bearish'
                  ? 'bg-[#F6465D] text-white font-semibold'
                  : tab.id === 'Neutral'
                  ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                  : 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF] font-semibold';

              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSentiment(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? activeClass
                      : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
                  }`}
                >
                  {tab.id === 'Bullish' && <TrendingUp className="w-3.5 h-3.5 shrink-0" />}
                  {tab.id === 'Bearish' && <TrendingDown className="w-3.5 h-3.5 shrink-0" />}
                  {tab.id === 'Neutral' && <Minus className="w-3.5 h-3.5 shrink-0" />}
                  <span>{tab.label}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-80">
                    ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Region Filter Strip */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#0B0E11] rounded-lg text-xs">
          {(['all', 'India', 'US', 'Europe', 'Asia', 'Crypto', 'Macro', 'Global'] as const).map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => setRegionFilter(reg)}
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap shrink-0 transition-colors ${
                regionFilter === reg
                  ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                  : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
              }`}
            >
              {reg === 'all' ? 'All Regions' : reg}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-200 dark:border-[#2B3139]">
          <div className="lg:col-span-4 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search ticker, region, or keyword..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF] focus:outline-none focus:ring-2 focus:ring-[#F0B90B]"
            />
          </div>

          <form onSubmit={handleIngestHeadline} className="lg:col-span-8 flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              value={headlineSymbol}
              onChange={(e) => setHeadlineSymbol(e.target.value)}
              aria-label="Target symbol for headline scoring"
              className="px-2.5 py-2 text-xs font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF]"
            >
              {instruments.map((inst) => (
                <option key={inst.symbol} value={inst.symbol}>
                  {inst.symbol}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={headlineInput}
              onChange={(e) => setHeadlineInput(e.target.value)}
              placeholder="Inject market headline to test real-time NLP sentiment & ML re-scoring..."
              className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF] focus:outline-none focus:ring-2 focus:ring-[#F0B90B]"
            />
            <button
              type="submit"
              disabled={submitting || !headlineInput.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ingest &amp; Score
            </button>
          </form>
          {ingestError && (
            <div role="alert" className="lg:col-span-12 text-xs font-medium text-[#F6465D]">
              {ingestError}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#848E9C]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0ECB81] shrink-0" />
            <span>
              Open-Data Fair-Use Attribution: Headlines link directly to original publishers; zero full copyrighted articles are stored or republished.
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span>
              Showing {filteredNews.length} of {news.length} dispatches
            </span>
            {(sentimentFilter !== 'all' || regionFilter !== 'all' || searchText.trim() !== '') && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="font-sans font-medium text-blue-600 dark:text-[#F0B90B] hover:underline whitespace-nowrap"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* News List */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg divide-y divide-slate-200 dark:divide-[#2B3139]">
        {filteredNews.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-slate-500 dark:text-[#848E9C] space-y-3">
            <Newspaper className="w-6 h-6 mx-auto opacity-40" />
            <div>
              No AI-scored headlines match{' '}
              {sentimentFilter !== 'all' ? `${sentimentFilter} sentiment` : 'the current filters'}.
            </div>
            {(sentimentFilter !== 'all' || regionFilter !== 'all' || searchText.trim() !== '') && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] transition-colors"
              >
                Show All Market News
              </button>
            )}
          </div>
        ) : (
          filteredNews.map((item) => (
            <div key={item.id} className="p-5 hover:bg-slate-50 dark:hover:bg-[#2B3139]/30 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#848E9C]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-[#EAECEF]">
                    {item.source}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-[#B45309] dark:text-[#F0B90B]">
                    {item.region ?? 'Global'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => toggleSentiment(item.sentiment)}
                    title={`Toggle ${item.sentiment} sentiment filter`}
                    className={`inline-flex items-center gap-1 font-medium hover:underline ${
                      item.sentiment === 'Bullish'
                        ? 'text-[#0ECB81]'
                        : item.sentiment === 'Bearish'
                        ? 'text-[#F6465D]'
                        : 'text-slate-500 dark:text-[#848E9C]'
                    }`}
                  >
                    {item.sentiment} ({item.sentimentScore >= 0 ? '+' : ''}
                    {item.sentimentScore.toFixed(2)})
                  </button>
                  <span aria-hidden="true">·</span>
                  <div className="inline-flex items-center gap-2">
                    {item.symbols.map((sym, idx) => (
                      <button
                        key={`${item.id}-${sym}-${idx}`}
                        type="button"
                        onClick={() => onOpenTerminal(sym)}
                        className="font-mono text-blue-600 dark:text-[#F0B90B] hover:underline"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="font-mono tabular-nums">
                  {formatRelativeTime(item.publishedAt)}
                </span>
              </div>

              <h3 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                {item.title}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
                {item.summary}
              </p>

              {item.url && item.url !== '#' && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-[#F0B90B] hover:underline"
                >
                  Read original publisher dispatch
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
