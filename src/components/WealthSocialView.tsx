import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  ArrowUpRight,
  Cpu,
  MessageSquarePlus,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  CommunityContributor,
  Instrument,
  MlPrediction,
  SocialPost,
} from '../types/market';
import { formatPrice, formatRelativeTime } from '../utils/format';

interface WealthSocialViewProps {
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  socialPosts: SocialPost[];
  contributors: CommunityContributor[];
  clientId: string;
  guideMode?: boolean;
  onPublishPost: (payload: {
    author: string;
    role: string;
    symbol: string;
    bias: SocialPost['bias'];
    title: string;
    thesis: string;
    targetPrice?: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  onLikePost: (postId: string) => Promise<void>;
  onFollowContributor: (contributorId: string) => Promise<void>;
  onOpenTerminal: (symbol: string) => void;
  onEvaluateWithAgents: (symbol: string) => void;
}

type RiskTier = 'conservative' | 'balanced' | 'alpha';

interface ProjectionPoint {
  year: number;
  contributed: number;
  conservative: number;
  aiExpected: number;
  upside: number;
}

const RISK_PROFILES: Record<
  RiskTier,
  {
    label: string;
    annualRate: number;
    upsideRate: number;
    conservativeRate: number;
    weights: Array<{ symbol: string; pct: number; role: string }>;
  }
> = {
  conservative: {
    label: 'Conservative · Capital Preservation',
    annualRate: 0.085,
    upsideRate: 0.115,
    conservativeRate: 0.055,
    weights: [
      { symbol: 'SPY', pct: 35, role: 'US Broad Index Core' },
      { symbol: 'XAU-USD', pct: 25, role: 'Gold Macro Hedge' },
      { symbol: 'HDFCBANK.NS', pct: 20, role: 'India Banking Compounder' },
      { symbol: 'MSFT', pct: 20, role: 'Defensive Mega-Cap Tech' },
    ],
  },
  balanced: {
    label: 'Balanced · Multi-Market Growth',
    annualRate: 0.135,
    upsideRate: 0.185,
    conservativeRate: 0.075,
    weights: [
      { symbol: 'NVDA', pct: 25, role: 'AI Compute Leader' },
      { symbol: 'RELIANCE.NS', pct: 20, role: 'India Infrastructure & Energy' },
      { symbol: 'TCS.NS', pct: 15, role: 'India IT Cash-Flow Anchor' },
      { symbol: 'SPY', pct: 20, role: 'S&P 500 Diversifier' },
      { symbol: 'BTC-USD', pct: 10, role: 'Digital Asset Asymmetric Sleeve' },
      { symbol: 'XAU-USD', pct: 10, role: 'Inflation Hedge' },
    ],
  },
  alpha: {
    label: 'Aggressive Alpha · AI High-Conviction',
    annualRate: 0.185,
    upsideRate: 0.26,
    conservativeRate: 0.08,
    weights: [
      { symbol: 'NVDA', pct: 30, role: 'Momentum Alpha Core' },
      { symbol: 'BTC-USD', pct: 20, role: 'High-Beta Crypto Sleeve' },
      { symbol: 'ETH-USD', pct: 15, role: 'Smart-Contract Ecosystem' },
      { symbol: 'RELIANCE.NS', pct: 20, role: 'NSE Growth Leader' },
      { symbol: 'TSLA', pct: 15, role: 'High-Volatility Breakout Sleeve' },
    ],
  },
};

export function WealthSocialView({
  instruments,
  predictions,
  socialPosts,
  contributors,
  clientId,
  guideMode = false,
  onPublishPost,
  onLikePost,
  onFollowContributor,
  onOpenTerminal,
  onEvaluateWithAgents,
}: WealthSocialViewProps) {
  // Wealth Growth Planner State
  const [riskTier, setRiskTier] = useState<RiskTier>('balanced');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [monthlySip, setMonthlySip] = useState(750);
  const [horizonYears, setHorizonYears] = useState(5);

  // Social Post Composer State
  const [authorName, setAuthorName] = useState('Desk Investor');
  const [postSymbol, setPostSymbol] = useState('NVDA');
  const [postBias, setPostBias] = useState<SocialPost['bias']>('Bullish');
  const [postTitle, setPostTitle] = useState('');
  const [postThesis, setPostThesis] = useState('');
  const [postTarget, setPostTarget] = useState('');
  const [postFilter, setPostFilter] = useState<'ALL' | 'Bullish' | 'Bearish'>('ALL');
  const [posting, setPosting] = useState(false);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(640);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 120) setChartWidth(Math.floor(entry.contentRect.width));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const profile = RISK_PROFILES[riskTier];
  const currencySymbol = currency === 'INR' ? '₹' : '$';

  // Monthly compounding projection across horizonYears
  const projection = useMemo<ProjectionPoint[]>(() => {
    const pts: ProjectionPoint[] = [];
    const years = Math.max(1, Math.min(10, horizonYears));
    const simulate = (annualRate: number, yr: number) => {
      const mRate = annualRate / 12;
      const months = yr * 12;
      const fvInitial = initialCapital * Math.pow(1 + mRate, months);
      const fvSip =
        mRate > 0 ? monthlySip * ((Math.pow(1 + mRate, months) - 1) / mRate) : monthlySip * months;
      return Math.round(fvInitial + fvSip);
    };

    for (let y = 0; y <= years; y += 1) {
      pts.push({
        year: y,
        contributed: Math.round(initialCapital + monthlySip * y * 12),
        conservative: simulate(profile.conservativeRate, y),
        aiExpected: simulate(profile.annualRate, y),
        upside: simulate(profile.upsideRate, y),
      });
    }
    return pts;
  }, [horizonYears, initialCapital, monthlySip, profile]);

  const finalPoint = projection[projection.length - 1];

  // D3 Curve Calculation
  const height = 220;
  const margin = { top: 14, right: 18, bottom: 26, left: 56 };
  const innerWidth = Math.max(200, chartWidth - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  const { xScale, yScale, expectedPath, contribPath, areaPath, yTicks } = useMemo(() => {
    const maxY = Math.max(...projection.map((p) => p.upside), 100);
    const xS = d3.scaleLinear().domain([0, horizonYears]).range([0, innerWidth]);
    const yS = d3.scaleLinear().domain([0, maxY * 1.08]).range([innerHeight, 0]);

    const lineExp = d3
      .line<ProjectionPoint>()
      .x((d) => xS(d.year))
      .y((d) => yS(d.aiExpected))
      .curve(d3.curveMonotoneX);

    const lineContrib = d3
      .line<ProjectionPoint>()
      .x((d) => xS(d.year))
      .y((d) => yS(d.contributed))
      .curve(d3.curveMonotoneX);

    const areaBand = d3
      .area<ProjectionPoint>()
      .x((d) => xS(d.year))
      .y0((d) => yS(d.conservative))
      .y1((d) => yS(d.upside))
      .curve(d3.curveMonotoneX);

    return {
      xScale: xS,
      yScale: yS,
      expectedPath: lineExp(projection) ?? '',
      contribPath: lineContrib(projection) ?? '',
      areaPath: areaBand(projection) ?? '',
      yTicks: yS.ticks(4),
    };
  }, [horizonYears, innerHeight, innerWidth, projection]);

  const filteredPosts = useMemo(() => {
    if (postFilter === 'ALL') return socialPosts;
    return socialPosts.filter((p) => p.bias === postFilter);
  }, [postFilter, socialPosts]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postThesis.trim()) return;
    setPosting(true);
    const parsedTarget = Number.parseFloat(postTarget);
    const res = await onPublishPost({
      author: authorName.trim() || 'Desk Investor',
      role: 'Community Strategist',
      symbol: postSymbol,
      bias: postBias,
      title: postTitle.trim(),
      thesis: postThesis.trim(),
      targetPrice: Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : undefined,
    });
    setPosting(false);
    if (res.ok) {
      setPostTitle('');
      setPostThesis('');
      setPostTarget('');
    }
  };

  const formatWealth = (val: number) => {
    if (val >= 1_000_000) return `${currencySymbol}${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${currencySymbol}${(val / 1_000).toFixed(1)}K`;
    return `${currencySymbol}${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Section 1: AI Wealth Growth & Compounding Builder */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-2.5">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                AI Wealth Growth & Automated Allocation Builder
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Build a diversified multi-market plan backed by live 24-agent scores across US Tech, India NSE, Digital Assets & Gold.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            {(
              [
                { id: 'conservative', label: 'Conservative' },
                { id: 'balanced', label: 'Balanced AI' },
                { id: 'alpha', label: 'High-Conviction Alpha' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRiskTier(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  riskTier === t.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {guideMode && (
          <div className="px-4 py-2.5 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
            <strong>Newbie Wealth Tip:</strong> Regular monthly investing (known as <strong>SIP</strong> or Dollar-Cost Averaging) automatically buys more shares when prices dip and fewer when prices spike. Projections below are illustrative models—never guaranteed returns.
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Inputs + D3 Compounding Curve */}
          <div className="xl:col-span-7 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value === 'INR' ? 'INR' : 'USD')}
                  className="w-full px-2.5 py-1.5 font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Starting Capital
                </label>
                <input
                  type="number"
                  min={100}
                  step={500}
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Monthly Contribution
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={monthlySip}
                  onChange={(e) => setMonthlySip(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Horizon ({horizonYears} yrs)
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={horizonYears}
                  onChange={(e) => setHorizonYears(Number(e.target.value))}
                  className="w-full mt-2 accent-blue-600"
                />
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-3 gap-4 py-2 border-y border-slate-200 dark:border-slate-800 font-mono tabular-nums text-xs">
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                  Total Principal Invested
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {formatWealth(finalPoint.contributed)}
                </div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                  AI Model Projection ({(profile.annualRate * 100).toFixed(1)}% est./yr)
                </div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatWealth(finalPoint.aiExpected)}
                </div>
              </div>
              <div>
                <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                  Projected Compounding Gain
                </div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                  +{formatWealth(Math.max(0, finalPoint.aiExpected - finalPoint.contributed))}
                </div>
              </div>
            </div>

            {/* D3 Compounding SVG */}
            <div ref={chartRef} className="w-full">
              <svg width={chartWidth} height={height} className="block overflow-visible">
                <g transform={`translate(${margin.left},${margin.top})`}>
                  {yTicks.map((t) => (
                    <g key={t} transform={`translate(0,${yScale(t)})`}>
                      <line
                        x1={0}
                        x2={innerWidth}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3,3"
                      />
                      <text
                        x={-8}
                        dy="0.32em"
                        textAnchor="end"
                        className="fill-slate-400 text-[10px] font-mono tabular-nums"
                      >
                        {formatWealth(t)}
                      </text>
                    </g>
                  ))}

                  {projection.map((pt) => (
                    <text
                      key={pt.year}
                      x={xScale(pt.year)}
                      y={innerHeight + 18}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      Y{pt.year}
                    </text>
                  ))}

                  <path d={areaPath} fill="#10B981" fillOpacity={0.12} />
                  <path
                    d={contribPath}
                    fill="none"
                    stroke="#64748B"
                    strokeWidth={1.6}
                    strokeDasharray="4,4"
                  />
                  <path d={expectedPath} fill="none" stroke="#10B981" strokeWidth={2.4} />
                </g>
              </svg>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500" />
                  AI Expected Growth Curve
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-500" />
                  Principal Contributed
                </span>
                <span>Shaded band = conservative-to-upside scenario range (not guaranteed)</span>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Live Multi-Asset AI Allocation Basket */}
          <div className="xl:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {profile.label}
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {profile.weights.map((item) => {
                const inst = instruments.find((i) => i.symbol === item.symbol);
                const pred = predictions[item.symbol];
                const sliceAmt = Math.round((initialCapital * item.pct) / 100);
                return (
                  <div
                    key={item.symbol}
                    className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/35"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {item.symbol}
                        </span>
                        <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                          {item.pct}% ({formatWealth(sliceAmt)})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.role} · Live {inst ? formatPrice(inst.price, inst.symbol) : '—'} · ML Score{' '}
                        {pred ? `${pred.opportunityScore}/100` : '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEvaluateWithAgents(item.symbol)}
                        title="Run 24-Agent Analysis"
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTerminal(item.symbol)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
                      >
                        Invest
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Real-Time Social Investing Community & Analysts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Community Thesis Stream + Composer */}
        <div className="xl:col-span-8 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Global Community Thesis Feed ({filteredPosts.length})
              </h3>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              {(['ALL', 'Bullish', 'Bearish'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPostFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    postFilter === f
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {f === 'ALL' ? 'All Ideas' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Publish New Community Idea */}
          <form
            onSubmit={handlePublish}
            className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3 text-xs"
          >
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <MessageSquarePlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Share a Market Thesis with the Desk
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your Name / Handle"
                className="px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              <select
                value={postSymbol}
                onChange={(e) => setPostSymbol(e.target.value)}
                className="px-3 py-1.5 font-mono rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.symbol} ({i.venue})
                  </option>
                ))}
              </select>
              <select
                value={postBias}
                onChange={(e) => setPostBias(e.target.value as SocialPost['bias'])}
                className="px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <option value="Bullish">Bullish Bias</option>
                <option value="Neutral">Neutral Watch</option>
                <option value="Bearish">Bearish Bias</option>
              </select>
              <input
                type="number"
                step="any"
                value={postTarget}
                onChange={(e) => setPostTarget(e.target.value)}
                placeholder="Target Price (Optional)"
                className="px-3 py-1.5 font-mono rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <input
              type="text"
              required
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              placeholder="Headline (e.g., Volume breakout confirms EMA upward cross)"
              className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                required
                value={postThesis}
                onChange={(e) => setPostThesis(e.target.value)}
                placeholder="Supporting rationale, risk level, or catalyst..."
                className="flex-1 px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              <button
                type="submit"
                disabled={posting}
                className="px-4 py-1.5 font-medium rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white whitespace-nowrap shrink-0"
              >
                {posting ? 'Posting...' : 'Publish Thesis'}
              </button>
            </div>
          </form>

          {/* Feed Items */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredPosts.map((post) => {
              const liked = post.likedByClientIds.includes(clientId);
              return (
                <div key={post.id} className="p-5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {post.author}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 dark:text-slate-400">{post.role}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {post.symbol}
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          post.bias === 'Bullish'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : post.bias === 'Bearish'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {post.bias}
                      </span>
                      {post.targetPrice && (
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          Target {formatPrice(post.targetPrice, post.symbol)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {post.title}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {post.thesis}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => void onLikePost(post.id)}
                      className={`inline-flex items-center gap-1.5 font-mono transition-colors ${
                        liked
                          ? 'text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {post.likes}
                    </button>

                    <button
                      type="button"
                      onClick={() => onEvaluateWithAgents(post.symbol)}
                      className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      Verify with 24 Agents
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenTerminal(post.symbol)}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Trade {post.symbol}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 4 Cols: Top Community Analysts */}
        <div className="xl:col-span-4 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Verified Community Strategists
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Follow top analysts across India NSE, US Tech & Crypto desks.
            </p>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {contributors.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {c.handle}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {c.role} · {c.specialty}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onFollowContributor(c.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                      c.following
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {c.following ? (
                      <>
                        <UserCheck className="w-3 h-3" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        Follow
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {c.winRatePct.toFixed(1)}% Idea Win Rate
                  </span>
                  <span>
                    {c.followers.toLocaleString()} followers · {c.ideasCount} ideas
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
