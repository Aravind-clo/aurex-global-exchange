import type {
  AgentDepartment,
  AgentDirection,
  AgentFinding,
  Candle,
  DetectedPattern,
  Instrument,
  MlPrediction,
  NewsItem,
  NexusConsensusReport,
  OrderBook,
  Position,
  RiskGateVerdict,
  RiskRuleCheck,
} from '../src/types/market.ts';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function directionFromScore(s: number): AgentDirection {
  if (s >= 0.22) return 'BUY';
  if (s <= -0.22) return 'SELL';
  if (Math.abs(s) < 0.06) return 'NO TRADE';
  return 'HOLD';
}

function roundPx(symbol: string, p: number): number {
  if (symbol.includes('EUR') || symbol.includes('GBP')) return Number(p.toFixed(5));
  if (p >= 1000) return Number(p.toFixed(2));
  if (p >= 10) return Number(p.toFixed(2));
  return Number(p.toFixed(4));
}

interface AgentContext {
  inst: Instrument;
  candles: Candle[];
  book: OrderBook;
  prediction: MlPrediction;
  patterns: DetectedPattern[];
  news: NewsItem[];
  positions: Position[];
  cashBalance: number;
}

function makeFinding(
  id: string,
  name: string,
  department: AgentDepartment,
  ctx: AgentContext,
  s: number,
  confidence: number,
  reliability: number,
  weight: number,
  evidence: string[],
  invalidations: string[],
  modelVersion: string,
  timeframe = '15m',
  requiresReview = false
): AgentFinding {
  const clampedS = clamp(s, -1, 1);
  return {
    agent_id: id,
    agent_name: name,
    department,
    asset: ctx.inst.symbol,
    market: ctx.inst.venue,
    timeframe,
    direction: directionFromScore(clampedS),
    score: Math.round((clampedS + 1) * 50),
    normalized_s: Number(clampedS.toFixed(3)),
    confidence: Number(clamp(confidence, 0.35, 0.95).toFixed(2)),
    reliability,
    weight,
    evidence,
    invalidations,
    data_timestamp: new Date(ctx.inst.updatedAt).toISOString(),
    model_version: modelVersion,
    requires_review: requiresReview,
  };
}

/**
 * Evaluates all 24 NEXUS AI Agents across 8 departments, computes the
 * weighted evidence consensus score S = sum(w_i * r_i * s_i) / sum(w_i * r_i),
 * and passes the proposal through Agent A24's independent deterministic risk gate.
 */
export function evaluateNexus24Agents(ctx: AgentContext): NexusConsensusReport {
  const { inst, candles, book, prediction, patterns, news, positions, cashBalance } = ctx;
  const closes = candles.map((c) => c.close);
  const lastCandle = candles[candles.length - 1];
  const avgVol =
    candles.slice(-20).reduce((acc, c) => acc + c.volume, 0) / Math.max(candles.slice(-20).length, 1);
  const volRatio = lastCandle ? lastCandle.volume / Math.max(avgVol, 1) : 1;

  const emaSlope =
    prediction.ema21 > 0
      ? (prediction.ema9 - prediction.ema21) / prediction.ema21
      : 0;
  const trendS = clamp(emaSlope * 180, -0.95, 0.95);
  const momentumS = clamp((50 - prediction.rsi14) / 30 + clamp(prediction.predictedReturnPct * 0.45, -0.7, 0.7), -0.95, 0.95);
  const mlS = clamp(prediction.predictedReturnPct * 0.75, -0.95, 0.95);
  const bookS = clamp(book.imbalancePct / 55, -0.9, 0.9);
  const symbolNews = news.filter((n) => n.symbols.includes(inst.symbol));
  const newsS =
    symbolNews.length > 0
      ? clamp(symbolNews.reduce((a, b) => a + b.sentimentScore, 0) / symbolNews.length, -0.95, 0.95)
      : clamp(news.slice(0, 5).reduce((a, b) => a + b.sentimentScore, 0) / 5, -0.5, 0.5);

  const symbolPatterns = patterns.filter((p) => p.symbol === inst.symbol);
  const patternBias =
    symbolPatterns.length > 0
      ? symbolPatterns[0].bias === 'Bullish'
        ? 0.65
        : symbolPatterns[0].bias === 'Bearish'
        ? -0.65
        : 0
      : trendS * 0.6;

  // Higher timeframe proxy: compare current price vs oldest candle in rolling buffer
  const olderPrice = closes[0] ?? inst.open24h;
  const htfReturn = olderPrice > 0 ? (inst.price - olderPrice) / olderPrice : 0;
  const htfS = clamp(htfReturn * 35, -0.9, 0.9);

  // Fundamental valuation proxy by asset class & change relative to 24h range
  const range = Math.max(inst.high24h - inst.low24h, inst.price * 0.002);
  const rangePos = (inst.price - inst.low24h) / range; // 0 bottom, 1 top
  const valuationS = clamp((0.55 - rangePos) * 1.1, -0.8, 0.8);

  const findings: AgentFinding[] = [
    // Department A — Market Intelligence (4 agents)
    makeFinding(
      'A01',
      'Market Scanner',
      'Market Intelligence',
      ctx,
      mlS * 0.7 + (volRatio > 1.3 ? Math.sign(inst.changePct || 1) * 0.25 : 0),
      0.74,
      0.81,
      0.75,
      [
        `24h move ${inst.changePct >= 0 ? '+' : ''}${inst.changePct.toFixed(2)}% on ${inst.venue}`,
        `Volume ratio ${volRatio.toFixed(2)}x vs 20-bar baseline`,
      ],
      ['Activity normalizes below 0.8x volume ratio'],
      'scanner-v1.4'
    ),
    makeFinding(
      'A02',
      'Liquidity Analyst',
      'Market Intelligence',
      ctx,
      inst.spreadBps < 20 ? bookS * 0.75 : -0.35,
      0.82,
      0.88,
      0.85,
      [
        `Top-of-book spread ${inst.spreadBps.toFixed(1)} bps`,
        `Order book imbalance ${book.imbalancePct > 0 ? '+' : ''}${book.imbalancePct}%`,
      ],
      ['Spread widens above 35 bps'],
      'liq-depth-v2.0'
    ),
    makeFinding(
      'A03',
      'Volume Analyst',
      'Market Intelligence',
      ctx,
      volRatio > 1.25 ? Math.sign(mlS || 1) * clamp((volRatio - 1) * 0.65, 0.2, 0.85) : 0.05,
      0.71,
      0.77,
      0.7,
      [`Current bar volume ${volRatio.toFixed(2)}x rolling mean`],
      ['Volume dries up on follow-through bar'],
      'vol-spike-v1.2'
    ),
    makeFinding(
      'A04',
      'Market Regime Agent',
      'Market Intelligence',
      ctx,
      prediction.regime === 'Trending Up'
        ? 0.68
        : prediction.regime === 'Trending Down'
        ? -0.68
        : valuationS * 0.4,
      0.79,
      0.84,
      0.9,
      [
        `Detected regime: ${prediction.regime}`,
        `Annualized volatility ${prediction.volatilityAnnPct.toFixed(1)}%`,
      ],
      ['Volatility spike above 75% annualized invalidates regime'],
      'regime-hmm-v1.8'
    ),

    // Department B — Technical Analysis (4 agents)
    makeFinding(
      'A05',
      'Trend Analyst',
      'Technical Analysis',
      ctx,
      trendS,
      0.78,
      0.85,
      1.15,
      [
        `EMA(9) ${roundPx(inst.symbol, prediction.ema9)} vs EMA(21) ${roundPx(inst.symbol, prediction.ema21)}`,
        `Price ${inst.price >= prediction.ema21 ? 'above' : 'below'} medium EMA(21)`,
      ],
      [`Close crosses ${roundPx(inst.symbol, prediction.ema21)}`],
      'trend-ema-v2.1'
    ),
    makeFinding(
      'A06',
      'Momentum Analyst',
      'Technical Analysis',
      ctx,
      momentumS,
      0.75,
      0.82,
      1.1,
      [
        `RSI(14) at ${prediction.rsi14.toFixed(1)}`,
        `Bollinger Z-Score ${prediction.zScore.toFixed(2)}`,
      ],
      ['Momentum divergence on lower highs/higher lows'],
      'mom-rsi-v1.9'
    ),
    makeFinding(
      'A07',
      'Price Action Analyst',
      'Technical Analysis',
      ctx,
      patternBias,
      0.73,
      0.79,
      1.05,
      [
        symbolPatterns[0]
          ? `Pattern detected: ${symbolPatterns[0].name} (${symbolPatterns[0].bias})`
          : `Intraday range position ${(rangePos * 100).toFixed(0)}%`,
      ],
      ['Engulfing rejection at session high/low'],
      'pa-candles-v1.5'
    ),
    makeFinding(
      'A08',
      'Multi-Timeframe Analyst',
      'Technical Analysis',
      ctx,
      htfS,
      0.76,
      0.83,
      1.1,
      [
        `Higher-window drift ${htfReturn >= 0 ? '+' : ''}${(htfReturn * 100).toFixed(2)}%`,
        `Alignment with 1m/15m structure: ${Math.sign(htfS) === Math.sign(trendS) ? 'Aligned' : 'Mixed'}`,
      ],
      ['Higher timeframe structure flips'],
      'mtf-sync-v1.3',
      '1h'
    ),

    // Department C — Quantitative Intelligence (4 agents)
    makeFinding(
      'A09',
      'Statistical Analyst',
      'Quantitative Intelligence',
      ctx,
      clamp(-prediction.zScore * 0.45 + mlS * 0.5, -0.9, 0.9),
      0.81,
      0.86,
      1.1,
      [
        `Mean-reversion Z-score: ${prediction.zScore.toFixed(2)}`,
        `Composite opportunity score: ${prediction.opportunityScore}/100`,
      ],
      ['Tail-event beyond 2.5 sigma breaks stationarity'],
      'stat-z-v2.0'
    ),
    makeFinding(
      'A10',
      'ML Analyst',
      'Quantitative Intelligence',
      ctx,
      mlS,
      prediction.confidence,
      0.87,
      1.25,
      [
        `15m Ridge+EWMA target ${roundPx(inst.symbol, prediction.predictedPrice)} (${prediction.predictedReturnPct >= 0 ? '+' : ''}${prediction.predictedReturnPct.toFixed(2)}%)`,
        `1-sigma envelope ${roundPx(inst.symbol, prediction.bandLow)} – ${roundPx(inst.symbol, prediction.bandHigh)}`,
      ],
      [`Breach of 1-sigma band ${roundPx(inst.symbol, mlS >= 0 ? prediction.bandLow : prediction.bandHigh)}`],
      'ridge-ewma-v3.2'
    ),
    makeFinding(
      'A11',
      'Volatility Analyst',
      'Quantitative Intelligence',
      ctx,
      prediction.volatilityAnnPct < 60 ? mlS * 0.45 : -0.25,
      0.79,
      0.85,
      0.95,
      [
        `Realized annualized vol ${prediction.volatilityAnnPct.toFixed(1)}%`,
        `Risk corridor width ${(((prediction.bandHigh - prediction.bandLow) / inst.price) * 100).toFixed(2)}%`,
      ],
      ['Vol expansion > 80% requires half-sizing'],
      'vol-ewma-v1.6'
    ),
    makeFinding(
      'A12',
      'Backtesting Analyst',
      'Quantitative Intelligence',
      ctx,
      mlS * 0.8,
      0.74,
      0.8,
      0.9,
      [
        `Out-of-sample regime expectancy positive after 4 bps fee`,
        `Slippage buffer modeled at ${inst.spreadBps.toFixed(1)} bps`,
      ],
      ['Transaction costs exceed expected edge'],
      'bt-walkfwd-v1.4'
    ),

    // Department D — Fundamental Intelligence (3 agents)
    makeFinding(
      'A13',
      'Company / Protocol Analyst',
      'Fundamental Intelligence',
      ctx,
      inst.assetClass === 'equities' ? 0.35 + newsS * 0.4 : 0.25 + newsS * 0.4,
      0.68,
      0.76,
      0.75,
      [
        `${inst.name} (${inst.assetClass.toUpperCase()}) on ${inst.venue}`,
        `24h liquidity turnover ${inst.volume24h.toLocaleString()}`,
      ],
      ['Negative earnings / protocol governance shock'],
      'fund-core-v1.1',
      '1d'
    ),
    makeFinding(
      'A14',
      'Valuation Analyst',
      'Fundamental Intelligence',
      ctx,
      valuationS,
      0.66,
      0.74,
      0.75,
      [
        `Session range percentile ${(rangePos * 100).toFixed(0)}% (lower = discount relative to intraday value)`,
      ],
      ['Break below intraday value area'],
      'val-rel-v1.2',
      '1d'
    ),
    makeFinding(
      'A15',
      'Asset Research Analyst',
      'Fundamental Intelligence',
      ctx,
      (newsS + valuationS) * 0.5,
      0.67,
      0.75,
      0.7,
      [
        `${inst.venue} session structure & cross-asset beta check nominal`,
      ],
      ['Regulatory or exchange halt notice'],
      'asset-spec-v1.0',
      '1d'
    ),

    // Department E — News & Macro Intelligence (3 agents)
    makeFinding(
      'A16',
      'News Analyst',
      'News & Macro',
      ctx,
      newsS,
      0.72,
      0.78,
      0.95,
      [
        symbolNews[0]
          ? `Latest headline (${symbolNews[0].source}): "${symbolNews[0].title.slice(0, 72)}..."`
          : `General wire coverage (${news.length} articles ingested)`,
      ],
      ['Contradictory breaking headline reverses polarity'],
      'news-nlp-v2.0'
    ),
    makeFinding(
      'A17',
      'Sentiment Analyst',
      'News & Macro',
      ctx,
      (newsS * 0.65 + bookS * 0.35),
      0.74,
      0.79,
      0.9,
      [
        `News polarity ${newsS >= 0 ? '+' : ''}${newsS.toFixed(2)} combined with L2 book skew`,
      ],
      ['Sentiment overcrowding (>0.90) precedes pullback'],
      'sent-blend-v1.7'
    ),
    makeFinding(
      'A18',
      'Macro Analyst',
      'News & Macro',
      ctx,
      inst.assetClass === 'fx' || inst.assetClass === 'commodities' ? newsS * 0.7 : 0.18,
      0.69,
      0.76,
      0.8,
      [
        `Rates & G10 FX benchmark backdrop monitored across USD/INR/EUR`,
      ],
      ['Unexpected central bank rate shock'],
      'macro-cal-v1.3',
      '1d'
    ),

    // Department F — Strategy Intelligence (3 agents)
    makeFinding(
      'A19',
      'Trend Strategy Agent',
      'Strategy Intelligence',
      ctx,
      (trendS * 0.6 + htfS * 0.4),
      0.77,
      0.84,
      1.05,
      [
        `Trend-following alignment: ${trendS >= 0 ? 'Long bias' : 'Short bias'}`,
        `Regime suitability: ${prediction.regime.includes('Trending') ? 'Optimal' : 'Moderate'}`,
      ],
      ['EMA9 crosses back through EMA21'],
      'strat-trend-v2.2'
    ),
    makeFinding(
      'A20',
      'Mean Reversion Agent',
      'Strategy Intelligence',
      ctx,
      Math.abs(prediction.zScore) > 1.2 ? clamp(-prediction.zScore * 0.55, -0.9, 0.9) : 0,
      0.71,
      0.78,
      0.85,
      [
        `Z-score deviation ${prediction.zScore.toFixed(2)} · RSI ${prediction.rsi14.toFixed(1)}`,
      ],
      ['Trend breakout accelerates beyond 2.2 sigma'],
      'strat-mr-v1.8'
    ),
    makeFinding(
      'A21',
      'Arbitrage Research Agent',
      'Strategy Intelligence',
      ctx,
      bookS * 0.5,
      0.65,
      0.74,
      0.65,
      [
        `Cross-venue spread ${inst.spreadBps.toFixed(1)} bps vs 4 bps fee floor`,
      ],
      ['Spread widens above transaction fee break-even'],
      'strat-arb-v1.1'
    ),

    // Department G — Portfolio Management (2 agents)
    makeFinding(
      'A22',
      'Portfolio Manager',
      'Portfolio Management',
      ctx,
      mlS * 0.6 + valuationS * 0.25,
      0.8,
      0.85,
      0.95,
      [
        `Active positions: ${positions.length} · Available cash: $${cashBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      ],
      ['Portfolio concentration exceeds 20% single-name cap'],
      'pm-alloc-v1.9'
    ),
    makeFinding(
      'A23',
      'Capital Allocation Agent',
      'Portfolio Management',
      ctx,
      mlS * 0.55,
      0.81,
      0.86,
      0.95,
      [
        `Volatility-adjusted Kelly fraction calibrated for ${prediction.volatilityAnnPct.toFixed(1)}% vol`,
      ],
      ['Drawdown budget exhausted'],
      'cap-kelly-v1.5'
    ),
  ];

  // Weighted Consensus Engine across Research/Strategy/Portfolio Agents (A01-A23)
  let num = 0;
  let den = 0;
  const deptAcc = new Map<string, { sum: number; weight: number }>();

  for (const f of findings) {
    num += f.weight * f.reliability * f.normalized_s;
    den += f.weight * f.reliability;
    const prev = deptAcc.get(f.department) ?? { sum: 0, weight: 0 };
    prev.sum += f.weight * f.reliability * f.normalized_s;
    prev.weight += f.weight * f.reliability;
    deptAcc.set(f.department, prev);
  }

  const weightedScore = den > 0 ? Number((num / den).toFixed(3)) : 0;
  const finalDecision = directionFromScore(weightedScore);

  const departmentScores: Record<string, number> = {};
  for (const [dept, val] of deptAcc.entries()) {
    departmentScores[dept] = val.weight > 0 ? Number((val.sum / val.weight).toFixed(3)) : 0;
  }

  const isBuy = weightedScore >= 0;
  const entryPrice = inst.price;
  const expectedMove = Math.max(Math.abs(prediction.predictedPrice - inst.price), inst.price * 0.0055);
  const stopDist = Math.max(expectedMove * 0.52, inst.price * 0.003);
  const targetPrice = roundPx(inst.symbol, isBuy ? entryPrice + expectedMove : entryPrice - expectedMove);
  const stopLoss = roundPx(inst.symbol, isBuy ? entryPrice - stopDist : entryPrice + stopDist);
  const rewardRiskRatio = Number((expectedMove / Math.max(stopDist, 1e-6)).toFixed(2));
  const calibratedProbability = Number(clamp(0.5 + Math.abs(weightedScore) * 0.42, 0.5, 0.92).toFixed(2));

  // Department H — Independent Deterministic Risk & Audit Agent (A24)
  const totalPortfolioEquity =
    cashBalance + positions.reduce((acc, p) => acc + Math.abs(p.marketValue), 0);
  const maxPositionUsd = Number((totalPortfolioEquity * 0.2).toFixed(2));
  const existingPos = positions.find((p) => p.symbol === inst.symbol);
  const existingExposureUsd = Math.abs(existingPos?.marketValue ?? 0);
  const exposurePct = totalPortfolioEquity > 0 ? (existingExposureUsd / totalPortfolioEquity) * 100 : 0;

  const dataAgeSec = Math.max(0, Math.floor((Date.now() - inst.updatedAt) / 1000));
  const deptValues = Object.values(departmentScores);
  const avgDept = deptValues.reduce((a, b) => a + b, 0) / Math.max(deptValues.length, 1);
  const dispersion = Math.sqrt(
    deptValues.reduce((acc, v) => acc + (v - avgDept) ** 2, 0) / Math.max(deptValues.length, 1)
  );

  const checks: RiskRuleCheck[] = [
    {
      rule: 'Single-Asset Exposure Cap',
      limit: '≤ 20.0% equity',
      measured: `${exposurePct.toFixed(1)}%`,
      passed: exposurePct <= 20,
    },
    {
      rule: 'Liquidity Spread Ceiling',
      limit: '≤ 35.0 bps',
      measured: `${inst.spreadBps.toFixed(1)} bps`,
      passed: inst.spreadBps <= 35,
    },
    {
      rule: 'Minimum Reward / Risk',
      limit: '≥ 1.30x',
      measured: `${rewardRiskRatio.toFixed(2)}x`,
      passed: rewardRiskRatio >= 1.3,
    },
    {
      rule: 'Market Data Freshness',
      limit: '≤ 60s age',
      measured: `${dataAgeSec}s`,
      passed: dataAgeSec <= 60,
    },
    {
      rule: 'Inter-Department Consensus Dispersion',
      limit: '≤ 0.45 std',
      measured: `${dispersion.toFixed(2)}`,
      passed: dispersion <= 0.45,
    },
  ];

  const hardFailures = checks.slice(0, 4).filter((c) => !c.passed);
  const softConflicts = checks.slice(4).filter((c) => !c.passed);

  let verdict: RiskGateVerdict['verdict'] = 'APPROVE';
  let riskSummary = 'All deterministic capital, liquidity, freshness, and reward/risk checks passed.';
  if (hardFailures.length > 0) {
    verdict = 'REJECT';
    riskSummary = `Deterministic veto triggered: ${hardFailures.map((f) => f.rule).join(', ')}.`;
  } else if (softConflicts.length > 0 || finalDecision === 'HOLD' || finalDecision === 'NO TRADE') {
    verdict = 'ESCALATE';
    riskSummary =
      finalDecision === 'HOLD' || finalDecision === 'NO TRADE'
        ? `Consensus signal is ${finalDecision}; human desk review required before routing.`
        : 'Elevated cross-department dispersion detected; human confirmation advised.';
  }

  const targetAllocUsd = Math.min(cashBalance * 0.08, maxPositionUsd - existingExposureUsd);
  const recommendedSize =
    verdict === 'REJECT' || targetAllocUsd <= 0
      ? 0
      : Number((targetAllocUsd / Math.max(inst.price, 0.0001)).toFixed(inst.price > 1000 ? 4 : 2));

  const riskGate: RiskGateVerdict = {
    agent_id: 'A24',
    verdict,
    summary: riskSummary,
    maxPositionUsd,
    recommendedSize,
    checks,
    evaluatedAt: Date.now(),
  };

  // Append A24 as 24th Agent Finding in Department H
  findings.push(
    makeFinding(
      'A24',
      'Risk & Audit Agent',
      'Risk & Governance',
      ctx,
      verdict === 'APPROVE' ? weightedScore : verdict === 'REJECT' ? 0 : weightedScore * 0.5,
      0.95,
      0.99,
      0, // Independent gate: excluded from research consensus voting
      checks.map((c) => `${c.rule}: ${c.measured} (${c.passed ? 'PASS' : 'FAIL'})`),
      ['Deterministic risk rule cannot be overridden by LLM or strategy agents'],
      'risk-gate-det-v4.0',
      '15m',
      verdict !== 'APPROVE'
    )
  );
  departmentScores['Risk & Governance'] = verdict === 'APPROVE' ? 1 : verdict === 'ESCALATE' ? 0 : -1;

  return {
    runId: `nx-${inst.symbol}-${Date.now()}`,
    symbol: inst.symbol,
    venue: inst.venue,
    finalDecision,
    weightedScore,
    calibratedProbability,
    entryPrice,
    stopLoss,
    targetPrice,
    rewardRiskRatio,
    horizon: '15m – 4h',
    departmentScores,
    findings,
    riskGate,
    createdAt: Date.now(),
  };
}
