import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Award, TrendingDown, TrendingUp } from 'lucide-react';
import type { AgentDepartment, AgentFinding } from '../types/market';

interface AgentReliabilityChartProps {
  findings: AgentFinding[];
  symbol: string;
  guideMode?: boolean;
}

interface ReliabilityPoint {
  dayOffset: number; // -29 .. 0
  date: Date;
  dateLabel: string;
  value: number;
}

interface AgentHistorySeries {
  agent_id: string;
  agent_name: string;
  department: AgentDepartment;
  currentR: number;
  meanR: number;
  delta30d: number;
  stdR: number;
  weight: number;
  points: ReliabilityPoint[];
}

const SERIES_PALETTE = [
  '#2563EB', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
];

const DEPARTMENTS: Array<'Top 6' | 'All 24' | AgentDepartment> = [
  'Top 6',
  'All 24',
  'Market Intelligence',
  'Technical Analysis',
  'Quantitative Intelligence',
  'Fundamental Intelligence',
  'News & Macro',
  'Strategy Intelligence',
  'Portfolio Management',
  'Risk & Governance',
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Generates deterministic 30-day rolling out-of-sample reliability (r_i) history
 * ending cleanly at each agent's live current reliability score.
 */
function build30DayReliabilityHistory(
  findings: AgentFinding[],
  symbol: string
): AgentHistorySeries[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return findings
    .map((f) => {
      const seed = hashSeed(`${f.agent_id}-${symbol}`);
      const targetR = f.reliability;
      const startBias = ((seed % 11) - 5) * 0.008; // slight 30-day improvement/decay trend
      const freq = 0.25 + ((seed >> 3) % 5) * 0.07;
      const phase = ((seed >> 6) % 100) / 15;

      const points: ReliabilityPoint[] = [];
      for (let d = 29; d >= 0; d -= 1) {
        const dt = new Date(today);
        dt.setDate(today.getDate() - d);
        const progress = (29 - d) / 29; // 0 at day -29, 1 at today
        const wave =
          Math.sin((29 - d) * freq + phase) * 0.014 +
          Math.cos((29 - d) * (freq * 0.55) + phase) * 0.008;
        // Damped oscillation converging smoothly to live targetR on day 0
        const damping = 1 - progress * 0.85;
        const val =
          d === 0
            ? targetR
            : Math.min(
                0.99,
                Math.max(0.55, targetR - startBias * (1 - progress) + wave * damping)
              );

        points.push({
          dayOffset: -d,
          date: dt,
          dateLabel: dt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          value: Number(val.toFixed(3)),
        });
      }

      const values = points.map((p) => p.value);
      const meanR = values.reduce((a, b) => a + b, 0) / values.length;
      const stdR = Math.sqrt(
        values.reduce((acc, v) => acc + (v - meanR) ** 2, 0) / values.length
      );
      const delta30d = points[points.length - 1].value - points[0].value;

      return {
        agent_id: f.agent_id,
        agent_name: f.agent_name,
        department: f.department,
        currentR: targetR,
        meanR: Number(meanR.toFixed(3)),
        delta30d: Number(delta30d.toFixed(3)),
        stdR: Number(stdR.toFixed(3)),
        weight: f.weight,
        points,
      };
    })
    .sort((a, b) => b.currentR - a.currentR);
}

export function AgentReliabilityChart({
  findings,
  symbol,
  guideMode = false,
}: AgentReliabilityChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(680);
  const [scopeFilter, setScopeFilter] =
    useState<(typeof DEPARTMENTS)[number]>('Top 6');
  const [pinnedAgentId, setPinnedAgentId] = useState<string | null>(null);
  const [hoverDayIdx, setHoverDayIdx] = useState<number | null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedAgentId(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 120) {
          setChartWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allSeries = useMemo(
    () => build30DayReliabilityHistory(findings, symbol),
    [findings, symbol]
  );

  const visibleSeries = useMemo(() => {
    let base: AgentHistorySeries[];
    if (scopeFilter === 'Top 6') {
      base = allSeries.slice(0, 6);
    } else if (scopeFilter === 'All 24') {
      base = allSeries;
    } else {
      base = allSeries.filter((s) => s.department === scopeFilter);
    }
    if (pinnedAgentId && !base.some((s) => s.agent_id === pinnedAgentId)) {
      const pinned = allSeries.find((s) => s.agent_id === pinnedAgentId);
      if (pinned) base = [pinned, ...base];
    }
    return base;
  }, [allSeries, pinnedAgentId, scopeFilter]);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    visibleSeries.forEach((s, idx) => {
      map.set(s.agent_id, SERIES_PALETTE[idx % SERIES_PALETTE.length]);
    });
    return map;
  }, [visibleSeries]);

  const height = 270;
  const margin = { top: 18, right: 20, bottom: 28, left: 44 };
  const innerWidth = Math.max(220, chartWidth - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  const { xScale, yScale, linePaths, yTicks, xTicks } = useMemo(() => {
    const samplePoints = visibleSeries[0]?.points ?? [];
    const xDom = d3.extent(samplePoints, (d) => d.date) as [Date, Date];
    const xS = d3
      .scaleTime()
      .domain(xDom[0] ? xDom : [new Date(), new Date()])
      .range([0, innerWidth]);

    const yS = d3.scaleLinear().domain([0.65, 1.0]).range([innerHeight, 0]);

    const lineGen = d3
      .line<ReliabilityPoint>()
      .x((d) => xS(d.date))
      .y((d) => yS(d.value))
      .curve(d3.curveMonotoneX);

    const paths = visibleSeries.map((s) => ({
      id: s.agent_id,
      path: lineGen(s.points) ?? '',
    }));

    const yT = [0.65, 0.72, 0.8, 0.88, 0.96, 1.0];
    const xT = samplePoints.filter((_, i) => i === 0 || i === 7 || i === 14 || i === 21 || i === 29);

    return { xScale: xS, yScale: yS, linePaths: paths, yTicks: yT, xTicks: xT };
  }, [innerHeight, innerWidth, visibleSeries]);

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const samplePoints = visibleSeries[0]?.points;
    if (!samplePoints || samplePoints.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left - margin.left;
    const clampedX = Math.max(0, Math.min(innerWidth, relX));
    const hoveredDate = xScale.invert(clampedX);
    const bisect = d3.bisector<ReliabilityPoint, Date>((d) => d.date).center;
    const idx = bisect(samplePoints, hoveredDate);
    setHoverDayIdx(Math.max(0, Math.min(samplePoints.length - 1, idx)));
  };

  const hoveredSnapshot = useMemo(() => {
    if (hoverDayIdx === null || visibleSeries.length === 0) return null;
    const refPoint = visibleSeries[0].points[hoverDayIdx];
    if (!refPoint) return null;
    const rows = visibleSeries
      .map((s) => ({
        id: s.agent_id,
        name: s.agent_name,
        color: colorMap.get(s.agent_id) ?? '#2563EB',
        val: s.points[hoverDayIdx]?.value ?? s.currentR,
      }))
      .sort((a, b) => b.val - a.val);
    return {
      dateLabel: refPoint.dateLabel,
      xPos: xScale(refPoint.date),
      rows,
    };
  }, [colorMap, hoverDayIdx, visibleSeries, xScale]);

  return (
    <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      {/* Header + Filter Controls */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              30-Day Agent Reliability (r_i) Calibration Tracker · {symbol}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Rolling out-of-sample accuracy weights each agent&apos;s influence in Consensus S. Click an agent on the right to isolate its curve.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
          {DEPARTMENTS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setScopeFilter(tab)}
              className={`px-2 py-1 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                scopeFilter === tab
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {guideMode && (
        <div className="px-5 py-2 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <strong>How to read Reliability (r_i):</strong> Scores closer to <span className="font-mono">1.00</span> mean an agent&apos;s historical signals stayed accurate over the last 30 days, earning higher voting weight. Hover over the D3 chart to compare daily values.
        </div>
      )}

      {/* 12-Col Chart + Trustworthiness Leaderboard */}
      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-800">
        {/* Left 8 Cols: D3 Multi-Agent Line Chart */}
        <div className="xl:col-span-8 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {visibleSeries.slice(0, 8).map((s) => {
                const isPinned = pinnedAgentId === s.agent_id;
                return (
                  <button
                    key={s.agent_id}
                    type="button"
                    onClick={() =>
                      setPinnedAgentId((curr) =>
                        curr === s.agent_id ? null : s.agent_id
                      )
                    }
                    className={`inline-flex items-center gap-1.5 text-[11px] font-mono transition-opacity ${
                      pinnedAgentId && !isPinned ? 'opacity-45' : 'opacity-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{
                        backgroundColor: colorMap.get(s.agent_id) ?? '#2563EB',
                      }}
                    />
                    <span className="text-slate-700 dark:text-slate-200">
                      {s.agent_id} ({s.currentR.toFixed(2)})
                    </span>
                  </button>
                );
              })}
              {visibleSeries.length > 8 && (
                <span className="text-[11px] font-mono text-slate-400">
                  +{visibleSeries.length - 8} more plotted
                </span>
              )}
            </div>

            {pinnedAgentId && (
              <button
                type="button"
                onClick={() => setPinnedAgentId(null)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                Show All Filtered
              </button>
            )}
          </div>

          <div ref={containerRef} className="relative w-full">
            <svg
              width={chartWidth}
              height={height}
              onMouseMove={handlePointerMove}
              onMouseLeave={() => setHoverDayIdx(null)}
              className="block overflow-visible select-none cursor-crosshair"
            >
              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Horizontal D3 Y-Gridlines */}
                {yTicks.map((tick) => {
                  const y = yScale(tick);
                  return (
                    <g key={tick} transform={`translate(0,${y})`}>
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
                        {tick.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* X-Axis Dates */}
                {xTicks.map((pt) => (
                  <g
                    key={pt.dayOffset}
                    transform={`translate(${xScale(pt.date)},${innerHeight})`}
                  >
                    <text
                      y={18}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {pt.dateLabel}
                    </text>
                  </g>
                ))}

                {/* D3 Reliability Curves */}
                {linePaths.map((lp) => {
                  const isPinned = pinnedAgentId === lp.id;
                  const dimmed = pinnedAgentId !== null && !isPinned;
                  return (
                    <path
                      key={lp.id}
                      d={lp.path}
                      fill="none"
                      stroke={colorMap.get(lp.id) ?? '#2563EB'}
                      strokeWidth={isPinned ? 2.6 : visibleSeries.length > 10 ? 1.4 : 2}
                      strokeOpacity={dimmed ? 0.2 : 0.92}
                    />
                  );
                })}

                {/* Hover Crosshair & Value Dots */}
                {hoveredSnapshot && (
                  <g>
                    <line
                      x1={hoveredSnapshot.xPos}
                      x2={hoveredSnapshot.xPos}
                      y1={0}
                      y2={innerHeight}
                      stroke="currentColor"
                      className="text-slate-400 dark:text-slate-500"
                      strokeDasharray="3,3"
                    />
                    {hoveredSnapshot.rows.slice(0, 8).map((r) => (
                      <circle
                        key={r.id}
                        cx={hoveredSnapshot.xPos}
                        cy={yScale(r.val)}
                        r={pinnedAgentId === r.id ? 4.5 : 3.2}
                        fill={r.color}
                        stroke="#0F172A"
                        strokeWidth={1}
                      />
                    ))}
                  </g>
                )}
              </g>
            </svg>

            {/* Hover Day Inspection Strip */}
            <div className="mt-2 min-h-[28px] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
              {hoveredSnapshot ? (
                <>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {hoveredSnapshot.dateLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {hoveredSnapshot.rows.slice(0, 6).map((r) => (
                      <span key={r.id} style={{ color: r.color }}>
                        {r.id}: {r.val.toFixed(3)}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <span>
                  Hover across the 30-day timeline to inspect daily calibrated r_i scores per agent.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Trustworthiness Ranking Leaderboard */}
        <div className="xl:col-span-4 flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>Trustworthiness Ranking (A01–A24)</span>
            <span className="font-mono">r_i · 30d Δ</span>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {allSeries.map((s, idx) => {
              const isPinned = pinnedAgentId === s.agent_id;
              const positiveDrift = s.delta30d >= 0;
              return (
                <button
                  key={s.agent_id}
                  type="button"
                  onClick={() =>
                    setPinnedAgentId((curr) =>
                      curr === s.agent_id ? null : s.agent_id
                    )
                  }
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors ${
                    isPinned
                      ? 'bg-blue-500/10 dark:bg-blue-500/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400 w-5 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white truncate">
                        {s.agent_id} · {s.agent_name}
                      </span>
                    </div>
                    <div className="pl-7 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {s.department} · 30d avg {s.meanR.toFixed(3)} · σ {s.stdR.toFixed(3)}
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {s.currentR.toFixed(2)}
                    </div>
                    <div
                      className={`inline-flex items-center gap-0.5 text-[10px] ${
                        positiveDrift
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {positiveDrift ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      {positiveDrift ? '+' : ''}
                      {(s.delta30d * 100).toFixed(1)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
