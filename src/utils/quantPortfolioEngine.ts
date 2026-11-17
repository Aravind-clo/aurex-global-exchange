import type {
  AssetClass,
  AssetRiskAttribution,
  Instrument,
  MlPrediction,
  PortfolioAllocationSlice,
  PortfolioAnalyticsReport,
  PortfolioCorrelationCell,
  Position,
} from '../types/market';

const TRADING_DAYS_PER_YEAR = 252;
const Z_SCORE_95 = 1.6448536269514722;

const HOLDING_PALETTE = [
  '#F0B90B',
  '#0ECB81',
  '#3B82F6',
  '#A855F7',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#EAB308',
  '#22C55E',
];

const CLASS_COLORS: Record<AssetClass | 'cash', string> = {
  crypto: '#F0B90B',
  equities: '#3B82F6',
  fx: '#14B8A6',
  commodities: '#F97316',
  cash: '#64748B',
};

const CLASS_LABELS: Record<AssetClass | 'cash', string> = {
  crypto: 'Digital Assets (Crypto)',
  equities: 'Global Equities',
  fx: 'Foreign Exchange',
  commodities: 'Commodities & Metals',
  cash: 'Cash Reserve (Dry Powder)',
};

function clampFinite(value: number, min: number, max: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function deterministicJitter(seed: string, idx: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= idx * 2654435761;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h >>> 0) / 0xffffffff) - 0.5;
}

/**
 * Extracts a fixed-length daily-equivalent log-return vector using Float64Array
 * from live instrument sparklines, scaled by realized/predicted volatility.
 */
function buildReturnVector(
  inst: Instrument | undefined,
  pred: MlPrediction | undefined,
  symbol: string,
  targetLength = 24
): Float64Array {
  const vec = new Float64Array(targetLength);
  const spark = inst?.sparkline ?? [];
  const annVolDecimal = clampFinite((pred?.volatilityAnnPct ?? 26) / 100, 0.05, 1.4, 0.26);
  const dailySigma = annVolDecimal / Math.sqrt(TRADING_DAYS_PER_YEAR);
  const dailyDrift = clampFinite((inst?.changePct ?? 0) / 100, -0.15, 0.15, 0) * 0.25;

  if (spark.length >= 6) {
    const rawReturns: number[] = [];
    for (let i = 1; i < spark.length; i += 1) {
      const prev = spark[i - 1];
      const curr = spark[i];
      if (prev > 0 && curr > 0) {
        rawReturns.push(Math.log(curr / prev));
      }
    }
    if (rawReturns.length >= 4) {
      // Scale intraday sparkline steps into daily volatility regime while preserving correlation shape
      let rawVar = 0;
      let rawMean = 0;
      for (let i = 0; i < rawReturns.length; i += 1) rawMean += rawReturns[i];
      rawMean /= rawReturns.length;
      for (let i = 0; i < rawReturns.length; i += 1) {
        const d = rawReturns[i] - rawMean;
        rawVar += d * d;
      }
      const rawStd = Math.sqrt(rawVar / Math.max(1, rawReturns.length - 1)) || 1e-4;
      const scale = dailySigma / rawStd;

      for (let t = 0; t < targetLength; t += 1) {
        const srcIdx = Math.floor((t / targetLength) * rawReturns.length);
        const centered = rawReturns[Math.min(srcIdx, rawReturns.length - 1)] - rawMean;
        vec[t] = clampFinite(dailyDrift + centered * scale, -0.25, 0.25, 0);
      }
      return vec;
    }
  }

  for (let t = 0; t < targetLength; t += 1) {
    vec[t] = clampFinite(dailyDrift + deterministicJitter(symbol, t) * dailySigma * 2.1, -0.2, 0.2, 0);
  }
  return vec;
}

export interface ComputePortfolioInput {
  positions: Position[];
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  cashBalance: number;
  vaultBalanceUsd: number;
  accountMode: 'demo' | 'real';
  riskFreeRatePct?: number;
}

/**
 * High-precision TypedArray Quantitative Portfolio Risk & Allocation Engine.
 * Evaluates w^T * Sigma * w quadratic portfolio variance, Sharpe & Sortino ratios,
 * Parametric 95% 1-Day VaR, Marginal Contribution to Risk (MCTR), and asset correlations.
 */
export function computePortfolioAnalyticsReport(
  input: ComputePortfolioInput
): PortfolioAnalyticsReport {
  const riskFreeRatePct = clampFinite(input.riskFreeRatePct ?? 4.25, 0, 15, 4.25);
  const cashBalanceUsd = Math.max(0, Number.isFinite(input.cashBalance) ? input.cashBalance : 0);
  const vaultBalanceUsd = Math.max(0, Number.isFinite(input.vaultBalanceUsd) ? input.vaultBalanceUsd : 0);

  const instMap = new Map<string, Instrument>();
  for (const inst of input.instruments) {
    instMap.set(inst.symbol, inst);
  }

  const activePositions = input.positions
    .filter((p) => Math.abs(p.size) > 1e-8)
    .map((pos) => {
      const inst = instMap.get(pos.symbol);
      const mv =
        Math.abs(pos.marketValue) > 0
          ? Math.abs(pos.marketValue)
          : Math.abs(pos.size * (inst?.price ?? pos.avgEntry));
      return {
        pos,
        inst,
        pred: input.predictions[pos.symbol],
        absMarketValue: mv,
      };
    })
    .sort((a, b) => b.absMarketValue - a.absMarketValue);

  const investedValueUsd = activePositions.reduce((s, item) => s + item.absMarketValue, 0);
  const totalEquityUsd = Math.max(1, investedValueUsd + cashBalanceUsd);
  const cashWeight = cashBalanceUsd / totalEquityUsd;

  const n = activePositions.length;
  const seriesLen = 24;

  // Empty / cash-only portfolio fallback
  if (n === 0) {
    const cashSlice: PortfolioAllocationSlice = {
      id: 'CASH',
      label: 'Cash Reserve',
      subLabel: 'USD Liquidity',
      category: 'cash',
      valueUsd: cashBalanceUsd,
      weightPct: cashBalanceUsd > 0 ? 100 : 0,
      riskContributionPct: 0,
      color: CLASS_COLORS.cash,
    };
    return {
      accountMode: input.accountMode,
      totalEquityUsd: investedValueUsd + cashBalanceUsd,
      investedValueUsd: 0,
      cashBalanceUsd,
      vaultBalanceUsd,
      cashWeightPct: cashBalanceUsd > 0 ? 100 : 0,
      totalUnrealizedPnlUsd: 0,
      totalRealizedPnlUsd: 0,
      riskFreeRatePct,
      annualizedReturnPct: riskFreeRatePct,
      portfolioVolatilityPct: 0,
      dailyVolatilityPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      parametricVar95Usd: 0,
      parametricVar95Pct: 0,
      diversificationScorePct: 0,
      concentrationHhi: cashBalanceUsd > 0 ? 1 : 0,
      portfolioBeta: 0,
      byHoldingSlices: cashBalanceUsd > 0 ? [cashSlice] : [],
      byAssetClassSlices: cashBalanceUsd > 0 ? [cashSlice] : [],
      attributions: [],
      correlations: [],
      computedAt: Date.now(),
    };
  }

  // Typed Float64Array buffers for return vectors, portfolio weights, and N x N covariance matrix
  const returnMatrix: Float64Array[] = new Array(n);
  const weights = new Float64Array(n);
  const assetMeans = new Float64Array(n);
  const assetDailyStds = new Float64Array(n);
  const assetAnnReturns = new Float64Array(n);
  const assetAnnVols = new Float64Array(n);

  for (let i = 0; i < n; i += 1) {
    const item = activePositions[i];
    const sign = item.pos.size >= 0 ? 1 : -1;
    weights[i] = (item.absMarketValue / totalEquityUsd) * sign;
    const vec = buildReturnVector(item.inst, item.pred, item.pos.symbol, seriesLen);
    returnMatrix[i] = vec;

    let sum = 0;
    for (let t = 0; t < seriesLen; t += 1) sum += vec[t];
    const mean = sum / seriesLen;
    assetMeans[i] = mean;

    let sq = 0;
    for (let t = 0; t < seriesLen; t += 1) {
      const d = vec[t] - mean;
      sq += d * d;
    }
    const dailyStd = Math.sqrt(sq / Math.max(1, seriesLen - 1));
    assetDailyStds[i] = dailyStd;
    assetAnnVols[i] = clampFinite(
      item.pred?.volatilityAnnPct ?? dailyStd * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100,
      2,
      150,
      24
    );

    // Annualized asset expected return blends unrealized return & ML annualized drift
    const costBasis = Math.max(1e-6, Math.abs(item.pos.size * item.pos.avgEntry));
    const holdingReturnPct = (item.pos.unrealizedPnl / costBasis) * 100;
    const sessionAnnualized = (item.inst?.changePct ?? 0) * 12;
    const mlAnnualized = (item.pred?.predictedReturnPct ?? 0) * 28;
    const blendedReturnPct = clampFinite(
      holdingReturnPct * 1.4 + sessionAnnualized * 0.45 + mlAnnualized * 0.55 + riskFreeRatePct,
      -45,
      85,
      8.5
    );
    assetAnnReturns[i] = blendedReturnPct;
  }

  // Compute N x N Covariance Matrix (Sigma) & Correlation Matrix in flat Float64Array
  const covMatrix = new Float64Array(n * n);
  const corrMatrix = new Float64Array(n * n);
  const correlations: PortfolioCorrelationCell[] = [];

  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      let covSum = 0;
      const vecI = returnMatrix[i];
      const vecJ = returnMatrix[j];
      const meanI = assetMeans[i];
      const meanJ = assetMeans[j];

      for (let t = 0; t < seriesLen; t += 1) {
        covSum += (vecI[t] - meanI) * (vecJ[t] - meanJ);
      }
      const cov = covSum / Math.max(1, seriesLen - 1);
      const denom = Math.max(1e-10, assetDailyStds[i] * assetDailyStds[j]);
      const corr = i === j ? 1 : clampFinite(cov / denom, -0.98, 0.98, 0);

      // Ensure diagonal covariance aligns with assetAnnVols
      const volI = (assetAnnVols[i] / 100) / Math.sqrt(TRADING_DAYS_PER_YEAR);
      const volJ = (assetAnnVols[j] / 100) / Math.sqrt(TRADING_DAYS_PER_YEAR);
      const calibratedCov = corr * volI * volJ;

      covMatrix[i * n + j] = calibratedCov;
      covMatrix[j * n + i] = calibratedCov;
      corrMatrix[i * n + j] = corr;
      corrMatrix[j * n + i] = corr;
    }
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      correlations.push({
        rowSymbol: activePositions[i].pos.symbol,
        colSymbol: activePositions[j].pos.symbol,
        correlation: Number(corrMatrix[i * n + j].toFixed(2)),
      });
    }
  }

  // Quadratic form: Sigma * w and w^T * Sigma * w
  const sigmaW = new Float64Array(n);
  let portfolioDailyVar = 0;
  for (let i = 0; i < n; i += 1) {
    let rowDot = 0;
    for (let j = 0; j < n; j += 1) {
      rowDot += covMatrix[i * n + j] * weights[j];
    }
    sigmaW[i] = rowDot;
    portfolioDailyVar += weights[i] * rowDot;
  }

  const dailyVolDecimal = Math.sqrt(Math.max(0, portfolioDailyVar));
  const dailyVolatilityPct = dailyVolDecimal * 100;
  const portfolioVolatilityPct = dailyVolDecimal * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

  // Portfolio daily return series for Sortino downside semi-deviation
  const portDailySeries = new Float64Array(seriesLen);
  for (let t = 0; t < seriesLen; t += 1) {
    let r = cashWeight * (riskFreeRatePct / 100 / TRADING_DAYS_PER_YEAR);
    for (let i = 0; i < n; i += 1) {
      r += weights[i] * returnMatrix[i][t];
    }
    portDailySeries[t] = r;
  }

  const rfDaily = riskFreeRatePct / 100 / TRADING_DAYS_PER_YEAR;
  let downsideSqSum = 0;
  for (let t = 0; t < seriesLen; t += 1) {
    const excess = portDailySeries[t] - rfDaily;
    if (excess < 0) {
      downsideSqSum += excess * excess;
    }
  }
  const downsideDailyStd = Math.sqrt(downsideSqSum / Math.max(1, seriesLen));
  const downsideAnnVolPct = Math.max(
    portfolioVolatilityPct * 0.55,
    downsideDailyStd * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100
  );

  // Portfolio Expected Annualized Return = sum(w_i * R_i) + w_cash * Rf
  let weightedAssetReturn = 0;
  for (let i = 0; i < n; i += 1) {
    weightedAssetReturn += Math.abs(weights[i]) * assetAnnReturns[i];
  }
  const annualizedReturnPct = weightedAssetReturn + cashWeight * riskFreeRatePct;

  const sharpeRatio =
    portfolioVolatilityPct > 0.05
      ? clampFinite((annualizedReturnPct - riskFreeRatePct) / portfolioVolatilityPct, -5, 8, 0)
      : 0;

  const sortinoRatio =
    downsideAnnVolPct > 0.05
      ? clampFinite((annualizedReturnPct - riskFreeRatePct) / downsideAnnVolPct, -6, 10, 0)
      : sharpeRatio;

  const parametricVar95Usd = Z_SCORE_95 * dailyVolDecimal * totalEquityUsd;
  const parametricVar95Pct = Z_SCORE_95 * dailyVolatilityPct;

  // Concentration (HHI over normalized asset + cash weights)
  let hhi = cashWeight * cashWeight;
  for (let i = 0; i < n; i += 1) {
    const w = Math.abs(weights[i]);
    hhi += w * w;
  }
  const diversificationScorePct = clampFinite((1 - hhi) * 100, 0, 100, 0);

  // Per-asset attribution, Marginal Risk Contribution & Allocation Slices
  const attributions: AssetRiskAttribution[] = [];
  const byHoldingSlices: PortfolioAllocationSlice[] = [];
  const classTotals = new Map<AssetClass | 'cash', { valueUsd: number; riskPct: number }>();

  let totalUnrealizedPnlUsd = 0;
  let totalRealizedPnlUsd = 0;
  let weightedBetaSum = 0;

  for (let i = 0; i < n; i += 1) {
    const item = activePositions[i];
    const assetClass: AssetClass = item.inst?.assetClass ?? 'equities';
    const wAbs = Math.abs(weights[i]);
    const mctrDecimal = dailyVolDecimal > 1e-8 ? sigmaW[i] / dailyVolDecimal : 0;
    const riskContribPct =
      dailyVolDecimal > 1e-8
        ? clampFinite(((weights[i] * sigmaW[i]) / portfolioDailyVar) * 100, 0, 100, 0)
        : 0;

    const betaEst = clampFinite(
      assetClass === 'crypto' ? 1.45 : assetClass === 'fx' ? 0.35 : assetClass === 'commodities' ? 0.55 : 1.08,
      0.1,
      2.5,
      1.0
    );
    weightedBetaSum += wAbs * betaEst;

    const assetSharpe =
      assetAnnVols[i] > 0.1
        ? clampFinite((assetAnnReturns[i] - riskFreeRatePct) / assetAnnVols[i], -4, 6, 0)
        : 0;

    totalUnrealizedPnlUsd += item.pos.unrealizedPnl;
    totalRealizedPnlUsd += item.pos.realizedPnl;

    attributions.push({
      symbol: item.pos.symbol,
      name: item.inst?.name ?? item.pos.symbol,
      venue: item.inst?.venue ?? 'GLOBAL',
      assetClass,
      size: item.pos.size,
      marketValueUsd: Number(item.absMarketValue.toFixed(2)),
      weightPct: Number((wAbs * 100).toFixed(2)),
      unrealizedPnlUsd: Number(item.pos.unrealizedPnl.toFixed(2)),
      realizedPnlUsd: Number(item.pos.realizedPnl.toFixed(2)),
      annualizedReturnPct: Number(assetAnnReturns[i].toFixed(2)),
      annualizedVolatilityPct: Number(assetAnnVols[i].toFixed(2)),
      marginalRiskPct: Number((mctrDecimal * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100).toFixed(2)),
      riskContributionPct: Number(riskContribPct.toFixed(2)),
      assetSharpe: Number(assetSharpe.toFixed(2)),
      betaEstimate: betaEst,
    });

    byHoldingSlices.push({
      id: item.pos.symbol,
      label: item.pos.symbol,
      subLabel: item.inst?.name ?? item.pos.symbol,
      category: assetClass,
      valueUsd: Number(item.absMarketValue.toFixed(2)),
      weightPct: Number((wAbs * 100).toFixed(2)),
      riskContributionPct: Number(riskContribPct.toFixed(2)),
      color: HOLDING_PALETTE[i % HOLDING_PALETTE.length],
    });

    const prevClass = classTotals.get(assetClass) ?? { valueUsd: 0, riskPct: 0 };
    classTotals.set(assetClass, {
      valueUsd: prevClass.valueUsd + item.absMarketValue,
      riskPct: prevClass.riskPct + riskContribPct,
    });
  }

  if (cashBalanceUsd > 0.01) {
    byHoldingSlices.push({
      id: 'CASH',
      label: 'Cash Reserve',
      subLabel: 'USD Liquid Buying Power',
      category: 'cash',
      valueUsd: Number(cashBalanceUsd.toFixed(2)),
      weightPct: Number((cashWeight * 100).toFixed(2)),
      riskContributionPct: 0,
      color: CLASS_COLORS.cash,
    });
    classTotals.set('cash', {
      valueUsd: cashBalanceUsd,
      riskPct: 0,
    });
  }

  const byAssetClassSlices: PortfolioAllocationSlice[] = Array.from(classTotals.entries())
    .map(([category, info]) => ({
      id: category,
      label: CLASS_LABELS[category],
      subLabel: category.toUpperCase(),
      category,
      valueUsd: Number(info.valueUsd.toFixed(2)),
      weightPct: Number(((info.valueUsd / totalEquityUsd) * 100).toFixed(2)),
      riskContributionPct: Number(info.riskPct.toFixed(2)),
      color: CLASS_COLORS[category],
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  return {
    accountMode: input.accountMode,
    totalEquityUsd: Number((investedValueUsd + cashBalanceUsd).toFixed(2)),
    investedValueUsd: Number(investedValueUsd.toFixed(2)),
    cashBalanceUsd: Number(cashBalanceUsd.toFixed(2)),
    vaultBalanceUsd: Number(vaultBalanceUsd.toFixed(2)),
    cashWeightPct: Number((cashWeight * 100).toFixed(2)),
    totalUnrealizedPnlUsd: Number(totalUnrealizedPnlUsd.toFixed(2)),
    totalRealizedPnlUsd: Number(totalRealizedPnlUsd.toFixed(2)),
    riskFreeRatePct,
    annualizedReturnPct: Number(annualizedReturnPct.toFixed(2)),
    portfolioVolatilityPct: Number(portfolioVolatilityPct.toFixed(2)),
    dailyVolatilityPct: Number(dailyVolatilityPct.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    sortinoRatio: Number(sortinoRatio.toFixed(2)),
    parametricVar95Usd: Number(parametricVar95Usd.toFixed(2)),
    parametricVar95Pct: Number(parametricVar95Pct.toFixed(2)),
    diversificationScorePct: Number(diversificationScorePct.toFixed(1)),
    concentrationHhi: Number(hhi.toFixed(3)),
    portfolioBeta: Number(weightedBetaSum.toFixed(2)),
    byHoldingSlices,
    byAssetClassSlices,
    attributions,
    correlations,
    computedAt: Date.now(),
  };
}
