import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  ArrowUpRight,
  Download,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import type {
  Instrument,
  MlPrediction,
  PortfolioAllocationSlice,
  PortfolioAnalyticsReport,
  Position,
} from '../types/market';
import { computePortfolioAnalyticsReport } from '../utils/quantPortfolioEngine';
import { downloadCsv, formatCurrency, formatTimeShort } from '../utils/format';

interface PortfolioAnalyticsViewProps {
  positions: Position[];
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  cashBalance: number;
  vaultBalanceUsd: number;
  accountMode: 'demo' | 'real';
  darkMode: boolean;
  onOpenTerminal: (symbol: string) => void;
  onFetchServerAnalytics?: (riskFreeRatePct: number) => Promise<PortfolioAnalyticsReport | null>;
}

export function PortfolioAnalyticsView({
  positions,
  instruments,
  predictions,
  cashBalance,
  vaultBalanceUsd,
  accountMode,
  darkMode,
  onOpenTerminal,
  onFetchServerAnalytics,
}: PortfolioAnalyticsViewProps) {
  const [allocationView, setAllocationView] = useState<'holding' | 'class'>('holding');
  const [riskFreeRatePct, setRiskFreeRatePct] = useState<number>(4.25);
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);
  const [hoveredScatterSymbol, setHoveredScatterSymbol] = useState<string | null>(null);
  const [serverReport, setServerReport] = useState<PortfolioAnalyticsReport | null>(null);
  const [syncingServer, setSyncingServer] = useState(false);

  const donutSvgRef = useRef<SVGSVGElement | null>(null);
  const scatterSvgRef = useRef<SVGSVGElement | null>(null);

  // Real-time client-side Float64Array quant calculation on live WebSocket ticks
  const liveReport = useMemo(
    () =>
      computePortfolioAnalyticsReport({
        positions,
        instruments,
        predictions,
        cashBalance,
        vaultBalanceUsd,
        accountMode,
        riskFreeRatePct,
      }),
    [accountMode, cashBalance, instruments, positions, predictions, riskFreeRatePct, vaultBalanceUsd]
  );

  // Sync canonical server-side portfolio analytics report on demand or rate change
  const handleSyncServer = async () => {
    if (!onFetchServerAnalytics) return;
    setSyncingServer(true);
    const res = await onFetchServerAnalytics(riskFreeRatePct);
    if (res) setServerReport(res);
    setSyncingServer(false);
  };

  useEffect(() => {
    void handleSyncServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountMode, riskFreeRatePct]);

  const activeSlices: PortfolioAllocationSlice[] = useMemo(
    () =>
      allocationView === 'holding'
        ? liveReport.byHoldingSlices
        : liveReport.byAssetClassSlices,
    [allocationView, liveReport.byAssetClassSlices, liveReport.byHoldingSlices]
  );

  const focusedSlice = useMemo(() => {
    if (hoveredSliceId) {
      const found = activeSlices.find((s) => s.id === hoveredSliceId);
      if (found) return found;
    }
    return activeSlices[0] ?? null;
  }, [activeSlices, hoveredSliceId]);

  // ---------------------------------------------------------------------------
  // D3.js Interactive Asset Allocation Donut Visualization
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const svgEl = donutSvgRef.current;
    if (!svgEl) return;

    const width = 320;
    const height = 320;
    const radius = Math.min(width, height) / 2 - 18;
    const innerRadius = radius * 0.62;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const rootG = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    if (activeSlices.length === 0) {
      rootG
        .append('circle')
        .attr('r', (radius + innerRadius) / 2)
        .attr('fill', 'none')
        .attr('stroke', darkMode ? '#2B3139' : '#E2E8F0')
        .attr('stroke-width', radius - innerRadius);
      return;
    }

    const pie = d3
      .pie<PortfolioAllocationSlice>()
      .value((d) => Math.max(0.01, d.valueUsd))
      .sort(null)
      .padAngle(activeSlices.length > 1 ? 0.018 : 0);

    const arcBase = d3
      .arc<d3.PieArcDatum<PortfolioAllocationSlice>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(4);

    const arcExpanded = d3
      .arc<d3.PieArcDatum<PortfolioAllocationSlice>>()
      .innerRadius(innerRadius - 2)
      .outerRadius(radius + 7)
      .cornerRadius(5);

    const arcs = pie(activeSlices);

    rootG
      .selectAll('path.alloc-arc')
      .data(arcs)
      .join('path')
      .attr('class', 'alloc-arc')
      .attr('d', (d) =>
        d.data.id === hoveredSliceId ? arcExpanded(d) ?? '' : arcBase(d) ?? ''
      )
      .attr('fill', (d) => d.data.color)
      .attr('stroke', darkMode ? '#181A20' : '#FFFFFF')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .style('opacity', (d) =>
        hoveredSliceId && hoveredSliceId !== d.data.id ? 0.48 : 1
      )
      .style('transition', 'opacity 160ms ease')
      .on('mouseenter', (_event, d) => {
        setHoveredSliceId(d.data.id);
      })
      .on('mouseleave', () => {
        setHoveredSliceId(null);
      })
      .on('click', (_event, d) => {
        if (d.data.category !== 'cash' && allocationView === 'holding') {
          onOpenTerminal(d.data.id);
        }
      });

    // Subtle outer guide ring
    rootG
      .append('circle')
      .attr('r', radius + 11)
      .attr('fill', 'none')
      .attr('stroke', darkMode ? '#2B3139' : '#E2E8F0')
      .attr('stroke-dasharray', '2,4')
      .attr('stroke-width', 1);
  }, [activeSlices, allocationView, darkMode, hoveredSliceId, onOpenTerminal]);

  // ---------------------------------------------------------------------------
  // D3.js Risk-Return Frontier & Portfolio Bubble Chart
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const svgEl = scatterSvgRef.current;
    if (!svgEl) return;

    const width = 560;
    const height = 290;
    const margin = { top: 20, right: 24, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const attrs = liveReport.attributions;
    const axisStroke = darkMode ? '#2B3139' : '#CBD5E1';
    const textFill = darkMode ? '#848E9C' : '#64748B';
    const gridStroke = darkMode ? 'rgba(43,49,57,0.55)' : 'rgba(203,213,225,0.6)';

    if (attrs.length === 0) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', textFill)
        .attr('font-size', '12px')
        .text('Open at least one market position to plot Risk vs Return attribution.');
      return;
    }

    const maxVol = Math.max(
      35,
      d3.max(attrs, (d) => d.annualizedVolatilityPct) ?? 35,
      liveReport.portfolioVolatilityPct + 8
    );
    const minRet = Math.min(
      -10,
      (d3.min(attrs, (d) => d.annualizedReturnPct) ?? 0) - 5,
      liveReport.annualizedReturnPct - 5
    );
    const maxRet = Math.max(
      25,
      (d3.max(attrs, (d) => d.annualizedReturnPct) ?? 25) + 6,
      liveReport.annualizedReturnPct + 6
    );

    const xScale = d3.scaleLinear().domain([0, maxVol * 1.08]).range([0, innerW]).nice();
    const yScale = d3.scaleLinear().domain([minRet, maxRet]).range([innerH, 0]).nice();
    const rScale = d3.scaleSqrt().domain([0, 100]).range([6, 22]);

    // Grid lines
    g.append('g')
      .selectAll('line.hgrid')
      .data(yScale.ticks(5))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', gridStroke)
      .attr('stroke-dasharray', '2,3');

    g.append('g')
      .selectAll('line.vgrid')
      .data(xScale.ticks(6))
      .join('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', gridStroke)
      .attr('stroke-dasharray', '2,3');

    // Zero return line
    if (minRet < 0 && maxRet > 0) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yScale(0))
        .attr('y2', yScale(0))
        .attr('stroke', axisStroke)
        .attr('stroke-width', 1.2);
    }

    // Capital Market Reference Line for Sharpe = 1.0 (Return = Rf + 1.0 * Vol)
    const cmlPoints: Array<[number, number]> = [
      [0, riskFreeRatePct],
      [Math.min(maxVol, maxRet - riskFreeRatePct), Math.min(maxRet, riskFreeRatePct + maxVol)],
    ];
    const lineGen = d3
      .line<[number, number]>()
      .x((p) => xScale(p[0]))
      .y((p) => yScale(p[1]));

    g.append('path')
      .datum(cmlPoints)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', '#F0B90B')
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', 1.25)
      .attr('stroke-dasharray', '4,4');

    g.append('text')
      .attr('x', xScale(cmlPoints[1][0]) - 4)
      .attr('y', Math.max(12, yScale(cmlPoints[1][1]) - 6))
      .attr('text-anchor', 'end')
      .attr('fill', '#F0B90B')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text('Sharpe = 1.0 Benchmark');

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat((d) => `${Number(d)}%`);
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${Number(d)}%`);

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0, ${innerH})`)
      .call(xAxis);
    xAxisG.selectAll('path, line').attr('stroke', axisStroke);
    xAxisG.selectAll('text').attr('fill', textFill).attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace');

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.selectAll('path, line').attr('stroke', axisStroke);
    yAxisG.selectAll('text').attr('fill', textFill).attr('font-size', '10px').attr('font-family', 'JetBrains Mono, monospace');

    // Axis labels
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', textFill)
      .attr('font-size', '10px')
      .text('Annualized Asset Volatility (σ)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', textFill)
      .attr('font-size', '10px')
      .text('Expected Annual Return');

    // Individual holding bubbles
    const colorMap = new Map<string, string>(
      liveReport.byHoldingSlices.map((s) => [s.id, s.color])
    );

    const nodes = g
      .selectAll('g.scatter-node')
      .data(attrs)
      .join('g')
      .attr('class', 'scatter-node')
      .attr(
        'transform',
        (d) =>
          `translate(${xScale(d.annualizedVolatilityPct)}, ${yScale(d.annualizedReturnPct)})`
      )
      .style('cursor', 'pointer')
      .on('mouseenter', (_e, d) => setHoveredScatterSymbol(d.symbol))
      .on('mouseleave', () => setHoveredScatterSymbol(null))
      .on('click', (_e, d) => onOpenTerminal(d.symbol));

    nodes
      .append('circle')
      .attr('r', (d) => rScale(d.weightPct))
      .attr('fill', (d) => colorMap.get(d.symbol) ?? '#3B82F6')
      .attr('fill-opacity', (d) =>
        hoveredScatterSymbol && hoveredScatterSymbol !== d.symbol ? 0.32 : 0.78
      )
      .attr('stroke', (d) =>
        hoveredScatterSymbol === d.symbol ? '#F0B90B' : darkMode ? '#0B0E11' : '#FFFFFF'
      )
      .attr('stroke-width', (d) => (hoveredScatterSymbol === d.symbol ? 2.5 : 1.5));

    nodes
      .append('text')
      .attr('dy', (d) => -rScale(d.weightPct) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', darkMode ? '#EAECEF' : '#0F172A')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text((d) => d.symbol);

    // Composite Portfolio Diamond Marker
    const portX = xScale(liveReport.portfolioVolatilityPct);
    const portY = yScale(liveReport.annualizedReturnPct);
    const portGroup = g
      .append('g')
      .attr('transform', `translate(${portX}, ${portY})`);

    portGroup
      .append('path')
      .attr('d', d3.symbol().type(d3.symbolDiamond).size(150)())
      .attr('fill', '#F0B90B')
      .attr('stroke', darkMode ? '#0B0E11' : '#0F172A')
      .attr('stroke-width', 1.5);

    portGroup
      .append('text')
      .attr('dx', 10)
      .attr('dy', 4)
      .attr('fill', '#F0B90B')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text(`PORTFOLIO (SR ${liveReport.sharpeRatio.toFixed(2)})`);
  }, [darkMode, hoveredScatterSymbol, liveReport, onOpenTerminal, riskFreeRatePct]);

  const hoveredAssetAttr = useMemo(
    () => liveReport.attributions.find((a) => a.symbol === hoveredScatterSymbol) ?? null,
    [hoveredScatterSymbol, liveReport.attributions]
  );

  const uniqueSymbols = useMemo(
    () => liveReport.attributions.map((a) => a.symbol),
    [liveReport.attributions]
  );

  const corrLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of liveReport.correlations) {
      map.set(`${c.rowSymbol}|${c.colSymbol}`, c.correlation);
    }
    return map;
  }, [liveReport.correlations]);

  const sharpeLabel =
    liveReport.sharpeRatio >= 1.5
      ? 'Strong Risk-Adjusted Edge'
      : liveReport.sharpeRatio >= 0.75
      ? 'Balanced Return / Risk'
      : liveReport.attributions.length === 0
      ? 'Cash-Only Posture'
      : 'Sub-Optimal Risk Compensation';

  const handleExportCsv = () => {
    downloadCsv(
      `aurex-portfolio-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      liveReport.attributions.map((a) => ({
        Symbol: a.symbol,
        AssetClass: a.assetClass,
        Venue: a.venue,
        PositionSize: a.size,
        MarketValueUSD: a.marketValueUsd,
        WeightPct: a.weightPct,
        UnrealizedPnlUSD: a.unrealizedPnlUsd,
        AnnualizedReturnPct: a.annualizedReturnPct,
        AnnualizedVolatilityPct: a.annualizedVolatilityPct,
        MarginalRiskPct: a.marginalRiskPct,
        RiskContributionPct: a.riskContributionPct,
        AssetSharpe: a.assetSharpe,
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold text-slate-900 dark:text-[#EAECEF]">
              Portfolio Analytics &amp; D3 Quantitative Risk Engine
            </h1>
            <span className="font-mono text-[11px] text-slate-500 dark:text-[#848E9C]">
              · {accountMode.toUpperCase()} DESK · Float64Array Covariance Model
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#848E9C]">
            Real-time asset allocation, wᵀΣw portfolio volatility, Sharpe &amp; Sortino ratios, parametric 95% VaR, and asset correlation matrix.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px] font-mono">
            <span className="px-2 text-slate-500 dark:text-[#848E9C]">Rf:</span>
            {[0, 4.25, 5.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setRiskFreeRatePct(rate)}
                className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                  riskFreeRatePct === rate
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
                }`}
              >
                {rate.toFixed(2)}%
              </button>
            ))}
          </div>

          {onFetchServerAnalytics && (
            <button
              type="button"
              onClick={() => void handleSyncServer()}
              disabled={syncingServer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#2B3139] whitespace-nowrap shrink-0 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingServer ? 'animate-spin' : ''}`} />
              Sync Quant Audit
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={liveReport.attributions.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#2B3139] disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Key Quantitative Risk & Performance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C]">
            <span>Total Portfolio Equity</span>
            <TrendingUp className="w-4 h-4 text-[#F0B90B]" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-[#EAECEF]">
            {formatCurrency(liveReport.totalEquityUsd)}
          </div>
          <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
            Invested {formatCurrency(liveReport.investedValueUsd)} · Cash {liveReport.cashWeightPct.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C]">
            <span>Annualized Sharpe Ratio</span>
            <Activity className="w-4 h-4 text-[#0ECB81]" />
          </div>
          <div
            className={`mt-2 text-xl font-bold font-mono tabular-nums ${
              liveReport.sharpeRatio >= 1
                ? 'text-[#0ECB81]'
                : liveReport.sharpeRatio >= 0
                ? 'text-[#F0B90B]'
                : 'text-[#F6465D]'
            }`}
          >
            {liveReport.sharpeRatio.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-[#848E9C] font-mono tabular-nums">
            {sharpeLabel} · Sortino {liveReport.sortinoRatio.toFixed(2)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C]">
            <span>Overall Portfolio Volatility (σ)</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-[#EAECEF]">
            {liveReport.portfolioVolatilityPct.toFixed(2)}%
          </div>
          <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
            Daily σ {liveReport.dailyVolatilityPct.toFixed(2)}% · Beta {liveReport.portfolioBeta.toFixed(2)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#848E9C]">
            <span>Parametric 95% VaR (1-Day)</span>
            <ShieldAlert className="w-4 h-4 text-[#F6465D]" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono tabular-nums text-[#F6465D]">
            -{formatCurrency(liveReport.parametricVar95Usd)}
          </div>
          <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
            {liveReport.parametricVar95Pct.toFixed(2)}% Equity · Diversification {liveReport.diversificationScorePct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Main D3.js Visualization Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left 6 Cols: D3.js Asset Allocation Donut & Interactive Breakdown */}
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                D3.js Asset Allocation Breakdown
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                Hover any slice to inspect capital weight &amp; covariance risk share; click a holding to open chart.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px]">
              <button
                type="button"
                onClick={() => setAllocationView('holding')}
                className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                  allocationView === 'holding'
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-600 dark:text-[#848E9C]'
                }`}
              >
                By Holding
              </button>
              <button
                type="button"
                onClick={() => setAllocationView('class')}
                className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
                  allocationView === 'class'
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-600 dark:text-[#848E9C]'
                }`}
              >
                By Asset Class
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center flex-1">
            <div className="md:col-span-6 relative flex items-center justify-center">
              <svg
                ref={donutSvgRef}
                className="w-full max-w-[280px] h-auto select-none"
                role="img"
                aria-label="D3.js portfolio asset allocation chart"
              />
              {/* Center Readout Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
                <span className="text-[11px] font-medium text-slate-500 dark:text-[#848E9C] truncate max-w-[130px]">
                  {focusedSlice ? focusedSlice.label : 'Portfolio'}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-[#EAECEF]">
                  {focusedSlice ? `${focusedSlice.weightPct.toFixed(1)}%` : '0%'}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
                  {focusedSlice ? formatCurrency(focusedSlice.valueUsd) : '$0.00'}
                </span>
              </div>
            </div>

            <div className="md:col-span-6 divide-y divide-slate-200 dark:divide-[#2B3139] text-xs max-h-[260px] overflow-y-auto pr-1">
              {activeSlices.map((slice) => {
                const isActive = hoveredSliceId === slice.id;
                return (
                  <button
                    key={slice.id}
                    type="button"
                    onMouseEnter={() => setHoveredSliceId(slice.id)}
                    onMouseLeave={() => setHoveredSliceId(null)}
                    onClick={() => {
                      if (slice.category !== 'cash' && allocationView === 'holding') {
                        onOpenTerminal(slice.id);
                      }
                    }}
                    className={`w-full py-2 px-2 flex items-center justify-between gap-2 text-left transition-colors rounded ${
                      isActive ? 'bg-slate-100 dark:bg-[#2B3139]/60' : 'hover:bg-slate-50 dark:hover:bg-[#2B3139]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold font-mono text-slate-900 dark:text-[#EAECEF] truncate">
                          {slice.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-[#848E9C] truncate">
                          {slice.subLabel}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                        {slice.weightPct.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-[#848E9C]">
                        Risk {slice.riskContributionPct.toFixed(1)}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 6 Cols: D3.js Risk-Return Frontier & Bubble Scatter */}
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                D3.js Risk-Return Efficiency Frontier
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                Asset annualized volatility (σ) vs expected return relative to the Sharpe = 1.0 capital market benchmark.
              </p>
            </div>
            {hoveredAssetAttr ? (
              <div className="text-right font-mono tabular-nums text-[11px]">
                <span className="font-semibold text-[#F0B90B]">{hoveredAssetAttr.symbol}</span>{' '}
                <span className="text-slate-600 dark:text-[#EAECEF]">
                  Ret {hoveredAssetAttr.annualizedReturnPct >= 0 ? '+' : ''}
                  {hoveredAssetAttr.annualizedReturnPct.toFixed(1)}% · Vol {hoveredAssetAttr.annualizedVolatilityPct.toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
                Exp. Portfolio Return: {liveReport.annualizedReturnPct >= 0 ? '+' : ''}
                {liveReport.annualizedReturnPct.toFixed(2)}%
              </div>
            )}
          </div>

          <div className="w-full overflow-hidden">
            <svg
              ref={scatterSvgRef}
              className="w-full h-auto select-none"
              role="img"
              aria-label="D3.js risk vs return efficiency plot"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C] font-mono tabular-nums">
            <span>
              Unrealized P&amp;L: {liveReport.totalUnrealizedPnlUsd >= 0 ? '+' : ''}
              {formatCurrency(liveReport.totalUnrealizedPnlUsd)} · Realized: {formatCurrency(liveReport.totalRealizedPnlUsd)}
            </span>
            <span>
              {serverReport
                ? `Server Quant Audit Verified · ${formatTimeShort(serverReport.computedAt)}`
                : `Live Client Quant Compute · ${formatTimeShort(liveReport.computedAt)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Pairwise Correlation Matrix + Holdings Risk Attribution Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Holdings Risk Attribution Table */}
        <div className="xl:col-span-8 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2B3139] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              Position Risk &amp; Sharpe Attribution ({liveReport.attributions.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
              HHI Concentration: {liveReport.concentrationHhi.toFixed(3)}
            </span>
          </div>

          {liveReport.attributions.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-[#848E9C]">
                Your {accountMode.toUpperCase()} account currently holds 100% liquid cash reserve ({formatCurrency(liveReport.cashBalanceUsd)}). Open positions in the Terminal to compute live covariance and Sharpe attribution.
              </p>
              <button
                type="button"
                onClick={() => onOpenTerminal(instruments[0]?.symbol ?? 'BTC-USD')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
              >
                Open Trading Terminal
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2B3139] text-[11px] font-medium text-slate-500 dark:text-[#848E9C] bg-slate-50/70 dark:bg-[#0B0E11]/50">
                    <th className="py-2.5 px-4">Asset</th>
                    <th className="py-2.5 px-3 text-right">Market Value</th>
                    <th className="py-2.5 px-3 text-right">Weight</th>
                    <th className="py-2.5 px-3 text-right">Unrealized P&amp;L</th>
                    <th className="py-2.5 px-3 text-right">Asset Vol</th>
                    <th className="py-2.5 px-3 text-right">Risk Share</th>
                    <th className="py-2.5 px-3 text-right">Sharpe</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139] font-mono tabular-nums">
                  {liveReport.attributions.map((attr) => (
                    <tr
                      key={attr.symbol}
                      onMouseEnter={() => setHoveredSliceId(attr.symbol)}
                      onMouseLeave={() => setHoveredSliceId(null)}
                      className="hover:bg-slate-50 dark:hover:bg-[#2B3139]/35 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                          {attr.symbol}
                        </div>
                        <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">
                          {attr.size} units · {attr.venue}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900 dark:text-[#EAECEF]">
                        {formatCurrency(attr.marketValueUsd)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-[#EAECEF]">
                        {attr.weightPct.toFixed(1)}%
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-medium ${
                          attr.unrealizedPnlUsd >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                        }`}
                      >
                        {attr.unrealizedPnlUsd >= 0 ? '+' : ''}
                        {formatCurrency(attr.unrealizedPnlUsd)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-[#B7BDC6]">
                        {attr.annualizedVolatilityPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[#F0B90B]">
                        {attr.riskContributionPct.toFixed(1)}%
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold ${
                          attr.assetSharpe >= 1
                            ? 'text-[#0ECB81]'
                            : attr.assetSharpe >= 0
                            ? 'text-slate-900 dark:text-[#EAECEF]'
                            : 'text-[#F6465D]'
                        }`}
                      >
                        {attr.assetSharpe.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => onOpenTerminal(attr.symbol)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#2B3139] whitespace-nowrap"
                        >
                          Trade <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cross-Asset Correlation Matrix */}
        <div className="xl:col-span-4 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-3">
          <div className="pb-2.5 border-b border-slate-200 dark:border-[#2B3139]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              Pairwise Asset Correlation Matrix (ρ)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
              Lower or negative correlation improves portfolio diversification and lowers aggregate volatility.
            </p>
          </div>

          {uniqueSymbols.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-[#848E9C]">
              Correlation pairs appear automatically when holding 1+ assets.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse font-mono tabular-nums text-[11px]">
                <thead>
                  <tr>
                    <th className="py-1.5 px-2 text-left text-slate-500 dark:text-[#848E9C]">Sym</th>
                    {uniqueSymbols.slice(0, 6).map((sym) => (
                      <th key={sym} className="py-1.5 px-1.5 text-slate-700 dark:text-[#EAECEF] font-semibold">
                        {sym.replace('-USD', '').replace('.NS', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueSymbols.slice(0, 6).map((rowSym) => (
                    <tr key={rowSym} className="border-t border-slate-200 dark:border-[#2B3139]">
                      <td className="py-2 px-2 text-left font-semibold text-slate-800 dark:text-[#EAECEF]">
                        {rowSym.replace('-USD', '').replace('.NS', '')}
                      </td>
                      {uniqueSymbols.slice(0, 6).map((colSym) => {
                        const val = corrLookup.get(`${rowSym}|${colSym}`) ?? (rowSym === colSym ? 1 : 0);
                        const bgStyle =
                          rowSym === colSym
                            ? 'bg-slate-200/70 dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                            : val >= 0.6
                            ? 'bg-[#F6465D]/15 text-[#F6465D]'
                            : val <= -0.15
                            ? 'bg-[#0ECB81]/15 text-[#0ECB81]'
                            : 'bg-slate-100/60 dark:bg-[#0B0E11] text-slate-700 dark:text-[#B7BDC6]';
                        return (
                          <td key={`${rowSym}-${colSym}`} className="p-1">
                            <div className={`py-1.5 px-1 rounded ${bgStyle}`}>
                              {val.toFixed(2)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
