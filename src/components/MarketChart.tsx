import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  History,
  Maximize2,
  Minimize2,
  Minus,
  Ruler,
  Sliders,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import type { Candle, ChartTimeframe, Instrument, MlPrediction } from '../types/market';
import { formatCompactNumber, formatPrice } from '../utils/format';

interface MarketChartProps {
  symbol: string;
  instrument?: Instrument;
  candles: Candle[];
  timeframe: ChartTimeframe;
  onChangeTimeframe: (tf: ChartTimeframe) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  prediction?: MlPrediction;
  darkMode: boolean;
  guideMode?: boolean;
  onApplyAiTargets?: (takeProfit: number, stopLoss: number) => void;
}

type DrawingTool = 'cursor' | 'trendline' | 'ray' | 'fib' | 'measure';

interface ChartPoint {
  idx: number;
  price: number;
}

interface ChartDrawing {
  id: string;
  tool: Exclude<DrawingTool, 'cursor'>;
  p1: ChartPoint;
  p2: ChartPoint;
}

const ALL_TIMEFRAMES: ChartTimeframe[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '1D',
  '1W',
  '1M',
  'ALL',
];

function computeEmaSeries(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    out.push(closes[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function computeBollingerBands(closes: number[], period = 20, mult = 2) {
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  const mid: Array<number | null> = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
      mid.push(null);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    mid.push(mean);
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  }
  return { upper, mid, lower };
}

function computeVwapSeries(candles: Candle[]): number[] {
  let cumPV = 0;
  let cumV = 0;
  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumV += c.volume;
    return cumV > 0 ? cumPV / cumV : c.close;
  });
}

function computeRsiSeries(closes: number[], period = 14): number[] {
  if (closes.length === 0) return [];
  const out: number[] = [50];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (i < period) {
      out.push(50);
    } else if (avgLoss === 0) {
      out.push(100);
    } else {
      const rs = avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

function computeAtr14(candles: Candle[]): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    trs.push(tr);
  }
  const slice = trs.slice(-14);
  return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
}

export function MarketChart({
  symbol,
  instrument,
  candles,
  timeframe,
  onChangeTimeframe,
  fullscreen,
  onToggleFullscreen,
  prediction,
  darkMode,
  guideMode = false,
  onApplyAiTargets,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [chartMode, setChartMode] = useState<'candles' | 'hollow' | 'area'>('candles');
  const [forecastHorizon, setForecastHorizon] = useState<'15m' | '1h' | '4h'>('15m');
  const [showForecast, setShowForecast] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [showBb, setShowBb] = useState(false);
  const [showVwap, setShowVwap] = useState(false);
  const [showRsi, setShowRsi] = useState(true);
  const [showGenesis, setShowGenesis] = useState(false);

  const [drawingTool, setDrawingTool] = useState<DrawingTool>('cursor');
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [draftStart, setDraftStart] = useState<ChartPoint | null>(null);
  const [hoverPoint, setHoverPoint] = useState<ChartPoint | null>(null);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dims, setDims] = useState({ width: 820, height: 370 });

  useEffect(() => {
    setDrawings([]);
    setDraftStart(null);
  }, [symbol]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDims({
          width: Math.max(200, Math.floor(rect.width)),
          height: Math.max(180, Math.floor(rect.height)),
        });
      }
    };
    measure();
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.floor(entry.contentRect.width));
        const h = Math.max(180, Math.floor(entry.contentRect.height));
        setDims({ width: w, height: h });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fullscreen]);

  const visibleCandles = useMemo(() => candles.slice(-72), [candles]);
  const closes = useMemo(() => visibleCandles.map((c) => c.close), [visibleCandles]);
  const ema9 = useMemo(() => computeEmaSeries(closes, 9), [closes]);
  const ema21 = useMemo(() => computeEmaSeries(closes, 21), [closes]);
  const bollinger = useMemo(() => computeBollingerBands(closes, 20, 2), [closes]);
  const vwap = useMemo(() => computeVwapSeries(visibleCandles), [visibleCandles]);
  const rsiSeries = useMemo(() => computeRsiSeries(closes, 14), [closes]);
  const atr14 = useMemo(() => computeAtr14(visibleCandles), [visibleCandles]);

  const activeCandle =
    hoverIdx !== null && visibleCandles[hoverIdx]
      ? visibleCandles[hoverIdx]
      : visibleCandles[visibleCandles.length - 1];

  const latestRsi =
    hoverIdx !== null && rsiSeries[hoverIdx] !== undefined
      ? rsiSeries[hoverIdx]
      : rsiSeries[rsiSeries.length - 1] ?? 50;

  const activeTargetPrice = useMemo(() => {
    if (!prediction) return null;
    if (forecastHorizon === '1h') return prediction.predicted1hPrice ?? prediction.predictedPrice;
    if (forecastHorizon === '4h') return prediction.predicted4hPrice ?? prediction.predictedPrice;
    return prediction.predictedPrice;
  }, [forecastHorizon, prediction]);

  const activeTargetPct = useMemo(() => {
    if (!prediction) return 0;
    if (forecastHorizon === '1h') return prediction.predicted1hReturnPct ?? prediction.predictedReturnPct;
    if (forecastHorizon === '4h') return prediction.predicted4hReturnPct ?? prediction.predictedReturnPct;
    return prediction.predictedReturnPct;
  }, [forecastHorizon, prediction]);

  // Shared geometry helper so mouse-to-price & canvas-render stay 100% synced
  const geometry = useMemo(() => {
    const padLeft = 14;
    const padRight = 84;
    const padTop = 18;
    const padBottom = 26;
    const volHeight = 42;
    const rsiHeight = showRsi ? 54 : 0;
    const rsiGap = showRsi ? 10 : 0;
    const plotW = Math.max(120, dims.width - padLeft - padRight);
    const plotH = Math.max(90, dims.height - padTop - padBottom - volHeight - rsiHeight - rsiGap);
    const forecastSlots = showForecast && prediction ? 14 : 0;
    const totalSlots = Math.max(visibleCandles.length + forecastSlots, 1);
    const stepX = plotW / totalSlots;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
      if (showBb) {
        const up = bollinger.upper[i];
        const lo = bollinger.lower[i];
        if (up !== null && up > maxPrice) maxPrice = up;
        if (lo !== null && lo < minPrice) minPrice = lo;
      }
    }
    if (showForecast && prediction && activeTargetPrice !== null) {
      minPrice = Math.min(minPrice, prediction.bandLow, activeTargetPrice);
      maxPrice = Math.max(maxPrice, prediction.bandHigh, activeTargetPrice);
    }
    if (showLevels && prediction) {
      if (prediction.supportLevel) minPrice = Math.min(minPrice, prediction.supportLevel);
      if (prediction.resistanceLevel) maxPrice = Math.max(maxPrice, prediction.resistanceLevel);
    }
    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      minPrice = 0;
      maxPrice = 100;
    }
    const priceSpan = maxPrice - minPrice || 1;
    minPrice -= priceSpan * 0.08;
    maxPrice += priceSpan * 0.08;
    const adjustedSpan = maxPrice - minPrice || 1;

    return {
      padLeft,
      padRight,
      padTop,
      padBottom,
      volHeight,
      rsiHeight,
      rsiGap,
      plotW,
      plotH,
      forecastSlots,
      stepX,
      minPrice,
      maxPrice,
      adjustedSpan,
      maxVol,
    };
  }, [
    activeTargetPrice,
    bollinger.lower,
    bollinger.upper,
    dims.height,
    dims.width,
    prediction,
    showBb,
    showForecast,
    showLevels,
    showRsi,
    visibleCandles,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dims;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (visibleCandles.length === 0) return;

    const {
      padLeft,
      padRight,
      padTop,
      padBottom,
      volHeight,
      rsiHeight,
      rsiGap,
      plotH,
      forecastSlots,
      stepX,
      maxPrice,
      adjustedSpan,
      maxVol,
    } = geometry;

    const priceToY = (p: number) => padTop + ((maxPrice - p) / adjustedSpan) * plotH;
    const idxToX = (idx: number) => padLeft + (idx + 0.5) * stepX;

    const gridColor = darkMode ? 'rgba(132, 142, 156, 0.1)' : 'rgba(15, 23, 42, 0.07)';
    const axisText = darkMode ? '#848E9C' : '#64748B';
    const bullColor = '#0ECB81';
    const bearColor = '#F6465D';

    // Horizontal price grid + Y-axis labels
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const gridRows = 5;
    for (let i = 0; i <= gridRows; i++) {
      const y = padTop + (plotH * i) / gridRows;
      const p = maxPrice - (adjustedSpan * i) / gridRows;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = axisText;
      ctx.fillText(formatPrice(p, symbol), width - padRight + 8, y);
    }

    // Time axis vertical guides
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelEvery = Math.max(8, Math.floor(visibleCandles.length / 6));
    const showCalendarDate =
      timeframe === '1D' || timeframe === '1W' || timeframe === '1M' || timeframe === 'ALL';
    for (let i = 0; i < visibleCandles.length; i += labelEvery) {
      const x = idxToX(i);
      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();

      const dt = new Date(visibleCandles[i].time);
      const label =
        timeframe === 'ALL'
          ? dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          : showCalendarDate
          ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : dt.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      ctx.fillStyle = axisText;
      ctx.fillText(label, x, height - padBottom + 7);
    }

    // Bollinger Bands overlay
    if (showBb && visibleCandles.length >= 20) {
      const drawNullableCurve = (arr: Array<number | null>, color: string) => {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (v === null) continue;
          const x = idxToX(i);
          const y = priceToY(v);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      };
      drawNullableCurve(bollinger.upper, 'rgba(168, 85, 247, 0.72)');
      drawNullableCurve(bollinger.lower, 'rgba(168, 85, 247, 0.72)');
      drawNullableCurve(bollinger.mid, 'rgba(168, 85, 247, 0.35)');
    }

    // Support & Resistance Lines
    if (showLevels && prediction) {
      const drawLevel = (level: number, color: string, label: string) => {
        const y = priceToY(level);
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(width - padRight, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${label} ${formatPrice(level, symbol)}`, padLeft + 6, y - 2);
        ctx.restore();
      };

      if (prediction.resistanceLevel) {
        drawLevel(prediction.resistanceLevel, 'rgba(246, 70, 93, 0.72)', 'RES');
      }
      if (prediction.supportLevel) {
        drawLevel(prediction.supportLevel, 'rgba(14, 203, 129, 0.72)', 'SUP');
      }
    }

    // Volume bars
    const volTop = padTop + plotH + 6;
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const x = padLeft + i * stepX;
      const barW = Math.max(2, stepX * 0.65);
      const barH = maxVol > 0 ? (c.volume / maxVol) * (volHeight - 6) : 2;
      ctx.fillStyle =
        c.close >= c.open
          ? 'rgba(14, 203, 129, 0.28)'
          : 'rgba(246, 70, 93, 0.28)';
      ctx.fillRect(x + (stepX - barW) / 2, volTop + volHeight - barH, barW, barH);
    }

    // RSI (14) Sub-Pane
    if (showRsi && rsiHeight > 0) {
      const rsiTop = volTop + volHeight + rsiGap;
      const rsiBottom = rsiTop + rsiHeight;
      const rsiToY = (val: number) => rsiTop + ((100 - Math.min(100, Math.max(0, val))) / 100) * rsiHeight;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(padLeft, rsiTop, width - padLeft - padRight, rsiHeight);

      [70, 30].forEach((lvl) => {
        const ly = rsiToY(lvl);
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = lvl === 70 ? 'rgba(246, 70, 93, 0.45)' : 'rgba(14, 203, 129, 0.45)';
        ctx.beginPath();
        ctx.moveTo(padLeft, ly);
        ctx.lineTo(width - padRight, ly);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = axisText;
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(lvl), width - padRight + 8, ly);
      });

      ctx.beginPath();
      for (let i = 0; i < rsiSeries.length; i++) {
        const x = idxToX(i);
        const y = rsiToY(rsiSeries[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = '#A855F7';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`RSI(14) ${latestRsi.toFixed(1)}`, padLeft + 6, rsiTop + 3);
      ctx.textBaseline = 'middle';
      ctx.fillText(latestRsi.toFixed(0), width - padRight + 26, (rsiTop + rsiBottom) / 2);
    }

    // Candles, Hollow Candles, or Area
    if (chartMode === 'area') {
      ctx.beginPath();
      for (let i = 0; i < visibleCandles.length; i++) {
        const x = idxToX(i);
        const y = priceToY(visibleCandles[i].close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#F0B90B';
      ctx.lineWidth = 2;
      ctx.stroke();

      const lastX = idxToX(visibleCandles.length - 1);
      ctx.lineTo(lastX, padTop + plotH);
      ctx.lineTo(idxToX(0), padTop + plotH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
      grad.addColorStop(0, 'rgba(240, 185, 11, 0.22)');
      grad.addColorStop(1, 'rgba(240, 185, 11, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();
    } else {
      const bodyW = Math.max(2.5, stepX * 0.62);
      for (let i = 0; i < visibleCandles.length; i++) {
        const c = visibleCandles[i];
        const centerX = idxToX(i);
        const isBull = c.close >= c.open;
        const color = isBull ? bullColor : bearColor;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(centerX, priceToY(c.high));
        ctx.lineTo(centerX, priceToY(c.low));
        ctx.stroke();

        const openY = priceToY(c.open);
        const closeY = priceToY(c.close);
        const topY = Math.min(openY, closeY);
        const rectH = Math.max(1.5, Math.abs(closeY - openY));
        if (chartMode === 'hollow' && isBull) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.3;
          ctx.strokeRect(centerX - bodyW / 2, topY, bodyW, rectH);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(centerX - bodyW / 2, topY, bodyW, rectH);
        }
      }
    }

    // EMA 9 and EMA 21 overlays
    if (showEma && visibleCandles.length > 5) {
      const drawCurve = (series: number[], color: string) => {
        ctx.beginPath();
        for (let i = 0; i < series.length; i++) {
          const x = idxToX(i);
          const y = priceToY(series[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      };
      drawCurve(ema9, '#38BDF8');
      drawCurve(ema21, '#F0B90B');
    }

    // VWAP overlay
    if (showVwap && vwap.length > 2) {
      ctx.beginPath();
      for (let i = 0; i < vwap.length; i++) {
        const x = idxToX(i);
        const y = priceToY(vwap[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // AI Horizon Forecast Cone
    if (showForecast && prediction && activeTargetPrice !== null) {
      const startIdx = visibleCandles.length - 1;
      const startX = idxToX(startIdx);
      const startY = priceToY(visibleCandles[startIdx].close);
      const endX = idxToX(visibleCandles.length + forecastSlots - 1);
      const endMidY = priceToY(activeTargetPrice);
      const spreadRatio = forecastHorizon === '4h' ? 1.85 : forecastHorizon === '1h' ? 1.35 : 1;
      const bandOffset = ((prediction.bandHigh - prediction.bandLow) / 2) * spreadRatio;
      const endHighY = priceToY(activeTargetPrice + bandOffset);
      const endLowY = priceToY(activeTargetPrice - bandOffset);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endHighY);
      ctx.lineTo(endX, endLowY);
      ctx.closePath();
      ctx.fillStyle =
        activeTargetPct < 0
          ? 'rgba(246, 70, 93, 0.14)'
          : 'rgba(14, 203, 129, 0.14)';
      ctx.fill();

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = activeTargetPct < 0 ? bearColor : '#F0B90B';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endMidY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = activeTargetPct < 0 ? bearColor : '#F0B90B';
      ctx.beginPath();
      ctx.arc(endX, endMidY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = darkMode ? '#F0B90B' : '#B45309';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `AI ${forecastHorizon} ${formatPrice(activeTargetPrice, symbol)}`,
        width - padRight + 6,
        endMidY
      );
    }

    // User Technical Analysis Drawings (Trendline, Horizontal Ray, Fib Retracement, Measure %)
    const renderDrawing = (d: Pick<ChartDrawing, 'tool' | 'p1' | 'p2'>, isDraft = false) => {
      const x1 = idxToX(d.p1.idx);
      const y1 = priceToY(d.p1.price);
      const x2 = idxToX(d.p2.idx);
      const y2 = priceToY(d.p2.price);

      ctx.save();
      if (isDraft) ctx.setLineDash([4, 3]);

      if (d.tool === 'trendline') {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (d.tool === 'ray') {
        ctx.strokeStyle = '#F0B90B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(width - padRight, y1);
        ctx.stroke();
        ctx.fillStyle = '#F0B90B';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`RAY ${formatPrice(d.p1.price, symbol)}`, Math.max(padLeft + 4, x1), y1 - 3);
      } else if (d.tool === 'fib') {
        const levels = [0, 0.382, 0.5, 0.618, 1];
        const leftX = Math.min(x1, x2);
        const rightX = Math.max(Math.max(x1, x2), leftX + 110);
        levels.forEach((lvl) => {
          const p = d.p1.price + (d.p2.price - d.p1.price) * lvl;
          const ly = priceToY(p);
          ctx.strokeStyle = lvl === 0.618 ? '#F0B90B' : 'rgba(56, 189, 248, 0.72)';
          ctx.lineWidth = lvl === 0.618 ? 1.4 : 1;
          ctx.beginPath();
          ctx.moveTo(leftX, ly);
          ctx.lineTo(Math.min(width - padRight, rightX), ly);
          ctx.stroke();
          ctx.fillStyle = lvl === 0.618 ? '#F0B90B' : '#38BDF8';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${(lvl * 100).toFixed(1)}% · ${formatPrice(p, symbol)}`, leftX + 4, ly - 1);
        });
      } else if (d.tool === 'measure') {
        const leftX = Math.min(x1, x2);
        const topY = Math.min(y1, y2);
        const boxW = Math.abs(x2 - x1);
        const boxH = Math.abs(y2 - y1);
        const pctDiff = ((d.p2.price - d.p1.price) / Math.max(d.p1.price, 1e-8)) * 100;
        const bars = Math.abs(Math.round(d.p2.idx - d.p1.idx));
        ctx.fillStyle = pctDiff >= 0 ? 'rgba(14, 203, 129, 0.14)' : 'rgba(246, 70, 93, 0.14)';
        ctx.strokeStyle = pctDiff >= 0 ? '#0ECB81' : '#F6465D';
        ctx.lineWidth = 1.2;
        ctx.fillRect(leftX, topY, Math.max(boxW, 4), Math.max(boxH, 4));
        ctx.strokeRect(leftX, topY, Math.max(boxW, 4), Math.max(boxH, 4));
        ctx.fillStyle = pctDiff >= 0 ? '#0ECB81' : '#F6465D';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          `${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(2)}% · ${bars} bars`,
          leftX + 4,
          Math.max(padTop + 14, topY - 3)
        );
      }
      ctx.restore();
    };

    for (const d of drawings) renderDrawing(d, false);
    if (draftStart && hoverPoint && drawingTool !== 'cursor') {
      renderDrawing({ tool: drawingTool, p1: draftStart, p2: hoverPoint }, true);
    }

    // Current Price Horizontal Line
    const lastPrice = visibleCandles[visibleCandles.length - 1].close;
    const lastY = priceToY(lastPrice);
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = darkMode ? 'rgba(234, 236, 239, 0.45)' : 'rgba(15, 23, 42, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, lastY);
    ctx.lineTo(width - padRight, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = darkMode ? '#2B3139' : '#0F172A';
    ctx.fillRect(width - padRight + 4, lastY - 9, padRight - 8, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatPrice(lastPrice, symbol), width - padRight + 8, lastY);

    // Hover Crosshair
    if (hoverIdx !== null && visibleCandles[hoverIdx]) {
      const hx = idxToX(hoverIdx);
      const hy = hoverPoint ? priceToY(hoverPoint.price) : priceToY(visibleCandles[hoverIdx].close);
      ctx.strokeStyle = darkMode ? 'rgba(132, 142, 156, 0.5)' : 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, height - padBottom);
      ctx.moveTo(padLeft, hy);
      ctx.lineTo(width - padRight, hy);
      ctx.stroke();
    }
  }, [
    activeTargetPct,
    activeTargetPrice,
    bollinger.lower,
    bollinger.mid,
    bollinger.upper,
    candles,
    chartMode,
    darkMode,
    dims,
    draftStart,
    drawingTool,
    drawings,
    ema21,
    ema9,
    forecastHorizon,
    geometry,
    hoverIdx,
    hoverPoint,
    latestRsi,
    prediction,
    rsiSeries,
    showBb,
    showEma,
    showForecast,
    showLevels,
    showRsi,
    showVwap,
    symbol,
    timeframe,
    visibleCandles,
    vwap,
  ]);

  const coordsFromMouseEvent = (e: React.MouseEvent<HTMLCanvasElement>): ChartPoint | null => {
    if (visibleCandles.length === 0) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { padLeft, padTop, plotH, stepX, maxPrice, adjustedSpan } = geometry;
    const idx = Math.max(0, Math.min(visibleCandles.length - 1, Math.floor((x - padLeft) / stepX)));
    const clampedY = Math.max(padTop, Math.min(padTop + plotH, y));
    const price = maxPrice - ((clampedY - padTop) / plotH) * adjustedSpan;
    return { idx, price };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = coordsFromMouseEvent(e);
    if (!pt) {
      setHoverIdx(null);
      setHoverPoint(null);
      return;
    }
    setHoverIdx(pt.idx);
    setHoverPoint(pt);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingTool === 'cursor') return;
    const pt = coordsFromMouseEvent(e);
    if (!pt) return;

    if (drawingTool === 'ray') {
      setDrawings((prev) => [
        ...prev,
        { id: `drw-${Date.now()}`, tool: 'ray', p1: pt, p2: pt },
      ]);
      setDraftStart(null);
      setDrawingTool('cursor');
      return;
    }

    if (!draftStart) {
      setDraftStart(pt);
    } else {
      setDrawings((prev) => [
        ...prev,
        { id: `drw-${Date.now()}`, tool: drawingTool, p1: draftStart, p2: pt },
      ]);
      setDraftStart(null);
      setDrawingTool('cursor');
    }
  };

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#181A20] border-0 overflow-hidden'
          : 'flex flex-col h-full bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg overflow-hidden'
      }
    >
      {/* Chart Toolbar Row 1: OHLCV + Timeframes + Mode + Fullscreen */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-[#2B3139]">
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono tabular-nums">
          <span className="font-sans font-semibold text-slate-900 dark:text-[#EAECEF]">
            {symbol} · {timeframe}
          </span>
          {activeCandle && (
            <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-[#848E9C]">
              <span>O <strong className="text-slate-800 dark:text-[#EAECEF]">{formatPrice(activeCandle.open, symbol)}</strong></span>
              <span>H <strong className="text-slate-800 dark:text-[#EAECEF]">{formatPrice(activeCandle.high, symbol)}</strong></span>
              <span>L <strong className="text-slate-800 dark:text-[#EAECEF]">{formatPrice(activeCandle.low, symbol)}</strong></span>
              <span>C <strong className={activeCandle.close >= activeCandle.open ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>{formatPrice(activeCandle.close, symbol)}</strong></span>
              <span className="hidden sm:inline">Vol <strong className="text-slate-800 dark:text-[#EAECEF]">{formatCompactNumber(activeCandle.volume)}</strong></span>
              <span className="hidden md:inline text-[#F0B90B]">
                ATR(14) {formatPrice(atr14, symbol)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Chart Style Switcher */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-[#0B0E11] rounded-md">
            {(
              [
                { id: 'candles', label: 'Candles' },
                { id: 'hollow', label: 'Hollow' },
                { id: 'area', label: 'Area' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setChartMode(m.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded whitespace-nowrap transition-colors ${
                  chartMode === m.id
                    ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                    : 'text-slate-600 dark:text-[#848E9C]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Forecast Horizons */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-[#0B0E11] rounded-md">
            {(['15m', '1h', '4h'] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setForecastHorizon(h);
                  setShowForecast(true);
                }}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-colors ${
                  showForecast && forecastHorizon === h
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                AI {h}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={fullscreen ? 'Exit chart fullscreen (Esc)' : 'Expand chart fullscreen (F)'}
            aria-label={fullscreen ? 'Exit fullscreen chart' : 'Fullscreen chart'}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] text-slate-700 dark:text-[#EAECEF] hover:border-[#F0B90B] whitespace-nowrap shrink-0 transition-colors"
          >
            {fullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#F0B90B]" />
                <span>Exit (Esc)</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#F0B90B]" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chart Toolbar Row 2: All Timeframes + Indicators + Drawing Toolkit */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-slate-50/70 dark:bg-[#0B0E11]/60 border-b border-slate-200 dark:border-[#2B3139]">
        {/* Timeframe Selector (1m -> 1M) */}
        <div className="flex items-center gap-0.5 overflow-x-auto max-w-full">
          {ALL_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onChangeTimeframe(tf)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                timeframe === tf
                  ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                  : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Technical Studies & Drawing Tools */}
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setShowEma((v) => !v)}
            className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
              showEma
                ? 'border-[#F0B90B]/50 bg-[#F0B90B]/10 text-[#B45309] dark:text-[#F0B90B]'
                : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]'
            }`}
          >
            EMA 9/21
          </button>
          <button
            type="button"
            onClick={() => setShowBb((v) => !v)}
            className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
              showBb
                ? 'border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]'
            }`}
          >
            BB(20)
          </button>
          <button
            type="button"
            onClick={() => setShowVwap((v) => !v)}
            className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
              showVwap
                ? 'border-pink-500/50 bg-pink-500/10 text-pink-600 dark:text-pink-400'
                : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]'
            }`}
          >
            VWAP
          </button>
          <button
            type="button"
            onClick={() => setShowRsi((v) => !v)}
            className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
              showRsi
                ? 'border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]'
            }`}
          >
            RSI(14)
          </button>
          <button
            type="button"
            onClick={() => setShowLevels((v) => !v)}
            className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
              showLevels
                ? 'border-[#0ECB81]/50 bg-[#0ECB81]/10 text-[#059669] dark:text-[#0ECB81]'
                : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]'
            }`}
          >
            S/R
          </button>

          {instrument?.genesis && (
            <button
              type="button"
              onClick={() => setShowGenesis((v) => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border whitespace-nowrap ${
                showGenesis
                  ? 'border-[#F0B90B] bg-[#F0B90B]/15 text-[#B45309] dark:text-[#F0B90B] font-semibold'
                  : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]'
              }`}
            >
              <History className="w-3 h-3" />
              <span>Genesis ({instrument.genesis.foundedYear})</span>
            </button>
          )}

          <span className="h-3.5 w-px bg-slate-200 dark:bg-[#2B3139] mx-0.5" />

          {(
            [
              { id: 'cursor', label: 'Crosshair', icon: Crosshair },
              { id: 'trendline', label: 'Trend', icon: TrendingUp },
              { id: 'ray', label: 'H-Ray', icon: Minus },
              { id: 'fib', label: 'Fib', icon: Sliders },
              { id: 'measure', label: 'Measure', icon: Ruler },
            ] as const
          ).map((tool) => {
            const Icon = tool.icon;
            const active = drawingTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                title={tool.label}
                onClick={() => {
                  setDrawingTool(tool.id);
                  setDraftStart(null);
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border whitespace-nowrap transition-colors ${
                  active
                    ? 'border-[#F0B90B] bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden xl:inline">{tool.label}</span>
              </button>
            );
          })}

          {drawings.length > 0 && (
            <button
              type="button"
              title="Clear all chart drawings"
              onClick={() => {
                setDrawings([]);
                setDraftStart(null);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#F6465D]/40 text-[#F6465D] hover:bg-[#F6465D]/10 whitespace-nowrap"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear ({drawings.length})</span>
            </button>
          )}
        </div>
      </div>

      {drawingTool !== 'cursor' && (
        <div className="px-4 py-1 bg-[#F0B90B]/10 border-b border-[#F0B90B]/30 text-[11px] font-medium text-[#B45309] dark:text-[#F0B90B]">
          {drawingTool === 'ray'
            ? 'Click any price level on the chart to drop a horizontal ray.'
            : draftStart
            ? `First anchor placed at ${formatPrice(draftStart.price, symbol)} — click second point to finish ${drawingTool}.`
            : `Click start point on chart to draw ${drawingTool}.`}
        </div>
      )}

      {guideMode && drawingTool === 'cursor' && (
        <div className="px-4 py-1.5 bg-slate-50/80 dark:bg-[#0B0E11]/70 border-b border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C]">
          Green bars = rose · Red bars = fell · SUP/RES = floor &amp; ceiling · Gold cone = AI {forecastHorizon} · Switch to <strong className="text-[#B45309] dark:text-[#F0B90B]">ALL</strong> timeframe or click <strong className="text-[#B45309] dark:text-[#F0B90B]">Genesis</strong> to inspect historical data since launch.
        </div>
      )}

      {showGenesis && instrument?.genesis && (
        <div className="px-4 py-3 bg-slate-50/90 dark:bg-[#0B0E11]/90 border-b border-slate-200 dark:border-[#2B3139] text-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
              {instrument.name} ({instrument.symbol}) · Founded {instrument.genesis.foundedDate}
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
              <span className="text-[#0ECB81]">
                Since Inception: {instrument.genesis.lifetimeReturnPct >= 0 ? '+' : ''}
                {instrument.genesis.lifetimeReturnPct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
              </span>
              <span className="text-[#F0B90B]">
                CAGR: {instrument.genesis.historicalCagrPct.toFixed(1)}%
              </span>
              <button
                type="button"
                onClick={() => onChangeTimeframe('ALL')}
                className="px-2 py-0.5 rounded bg-[#F0B90B] text-[#0B0E11] font-semibold"
              >
                Load ALL Chart
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 font-mono tabular-nums text-[11px]">
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Launch Price</div>
              <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                {formatPrice(instrument.genesis.genesisPrice, instrument.symbol)}
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Market Cap</div>
              <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                {instrument.genesis.marketCapFormatted}
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">All-Time High</div>
              <div className="font-semibold text-[#0ECB81]">
                {formatPrice(instrument.genesis.allTimeHigh, instrument.symbol)} ({instrument.genesis.athYear})
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">All-Time Low</div>
              <div className="font-semibold text-[#F6465D]">
                {formatPrice(instrument.genesis.allTimeLow, instrument.symbol)} ({instrument.genesis.atlYear})
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Circulating</div>
              <div className="text-slate-700 dark:text-[#B7BDC6] truncate">
                {instrument.genesis.circulatingSupplyLabel}
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Max Supply</div>
              <div className="text-slate-700 dark:text-[#B7BDC6] truncate">
                {instrument.genesis.maxSupplyLabel}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
            {instrument.genesis.originStory}
          </p>

          <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 dark:text-[#848E9C]">
            {instrument.genesis.milestones.slice(0, 4).map((m) => (
              <span key={`${m.year}-${m.event}`}>
                <strong className="font-mono text-[#D9A70A] dark:text-[#F0B90B]">{m.year}:</strong> {m.event}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={`relative flex-1 min-w-0 min-h-0 overflow-hidden ${
          fullscreen ? 'min-h-[340px]' : 'min-h-[200px] sm:min-h-[260px] lg:min-h-[310px]'
        }`}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleCanvasClick}
          onMouseLeave={() => {
            setHoverIdx(null);
            setHoverPoint(null);
          }}
          className="block w-full h-full cursor-crosshair"
        />
      </div>

      {/* Plain-English Chart Prediction Strip */}
      {prediction && (
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span
                className={`font-semibold ${
                  prediction.direction === 'Bullish'
                    ? 'text-[#0ECB81]'
                    : prediction.direction === 'Bearish'
                    ? 'text-[#F6465D]'
                    : 'text-[#F0B90B]'
                }`}
              >
                AI PREDICTION ({forecastHorizon}): {prediction.direction.toUpperCase()} (
                {prediction.confidence <= 1
                  ? Math.round(prediction.confidence * 100)
                  : Math.round(prediction.confidence)}
                % conf)
              </span>
              <span className="text-slate-500 dark:text-[#848E9C]">
                · SUP {formatPrice(prediction.supportLevel, symbol)} · RES{' '}
                {formatPrice(prediction.resistanceLevel, symbol)}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#B7BDC6] truncate">
              {prediction.plainSummary}
            </p>
          </div>

          {onApplyAiTargets && (
            <button
              type="button"
              onClick={() =>
                onApplyAiTargets(prediction.suggestedTakeProfit, prediction.suggestedStopLoss)
              }
              className="px-2.5 py-1 text-[11px] font-semibold rounded border border-[#F0B90B]/50 bg-[#F0B90B]/10 text-[#B45309] dark:text-[#F0B90B] hover:bg-[#F0B90B]/20 whitespace-nowrap shrink-0 transition-colors"
            >
              Use AI Target {formatPrice(prediction.suggestedTakeProfit, symbol)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
