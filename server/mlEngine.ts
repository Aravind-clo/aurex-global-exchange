import type {
  ActionableInsight,
  Candle,
  DetectedPattern,
  Instrument,
  MlPrediction,
  NewsItem,
  OrderBook,
} from '../src/types/market.ts';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function calcEma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  const start = closes.length - period;
  for (let i = start; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 85;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Exponentially-weighted ridge linear regression over recent log-prices
 * combined with Bollinger Z-score mean-reversion damping and volatility scaling.
 */
export function runShortTermMlPrediction(
  instrument: Instrument,
  candles: Candle[],
  newsItems: NewsItem[],
  orderBook?: OrderBook
): MlPrediction {
  const closes = candles.map((c) => c.close);
  if (closes.length < 15) {
    return {
      symbol: instrument.symbol,
      horizonLabel: '15m / 1h / 4h Forecast',
      currentPrice: instrument.price,
      predictedPrice: instrument.price,
      predictedReturnPct: 0,
      predicted1hPrice: instrument.price,
      predicted1hReturnPct: 0,
      predicted4hPrice: instrument.price,
      predicted4hReturnPct: 0,
      supportLevel: instrument.price * 0.992,
      resistanceLevel: instrument.price * 1.008,
      suggestedStopLoss: instrument.price * 0.99,
      suggestedTakeProfit: instrument.price * 1.015,
      plainSummary: 'Neutral consolidation while gathering initial live market candles.',
      bandLow: instrument.price * 0.995,
      bandHigh: instrument.price * 1.005,
      direction: 'Neutral',
      confidence: 0.52,
      rsi14: 50,
      ema9: instrument.price,
      ema21: instrument.price,
      volatilityAnnPct: 18,
      realizedVol24hPct: 1.12,
      atr24h: Number((instrument.price * 0.012).toFixed(instrument.price < 1 ? 5 : 2)),
      atrPct: 1.2,
      zScore: 0,
      opportunityScore: 50,
      regime: 'Mean Reverting',
      updatedAt: Date.now(),
    };
  }

  const window = closes.slice(-30);
  const n = window.length;

  // Exponentially weighted linear regression on log prices
  let sumW = 0;
  let sumWX = 0;
  let sumWY = 0;
  let sumWXX = 0;
  let sumWXY = 0;

  for (let i = 0; i < n; i++) {
    const w = Math.exp((i - (n - 1)) * 0.08);
    const y = Math.log(Math.max(window[i], 1e-9));
    sumW += w;
    sumWX += w * i;
    sumWY += w * y;
    sumWXX += w * i * i;
    sumWXY += w * i * y;
  }

  const meanX = sumWX / sumW;
  const meanY = sumWY / sumW;
  const denom = sumWXX - sumW * meanX * meanX + 1e-6;
  const slope = (sumWXY - sumW * meanX * meanY) / denom;

  // Log-returns for EWMA volatility & Z-score
  const logReturns: number[] = [];
  for (let i = 1; i < window.length; i++) {
    logReturns.push(Math.log(window[i] / Math.max(window[i - 1], 1e-9)));
  }

  const meanRet =
    logReturns.reduce((acc, r) => acc + r, 0) / Math.max(logReturns.length, 1);
  const variance =
    logReturns.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) /
    Math.max(logReturns.length - 1, 1);
  const sigmaPerBar = Math.sqrt(Math.max(variance, 1e-10));

  // Annualized volatility estimate & 24h realized volatility
  const volFactor = instrument.assetClass === 'crypto' ? 420 : 280;
  const volatilityAnnPct = clamp(sigmaPerBar * volFactor * 100, 6, 140);
  const barsPerDay = instrument.assetClass === 'equities' ? 390 : 1440;
  const realizedVol24hPct = Number(
    clamp(sigmaPerBar * Math.sqrt(barsPerDay) * 100, 0.25, 24).toFixed(2)
  );

  // 14-period Wilder True Range -> 24h ATR estimate blending intraday range & bar ATR
  const trSlice = candles.slice(-15);
  let trSum = 0;
  let trCount = 0;
  for (let i = 1; i < trSlice.length; i++) {
    const cur = trSlice[i];
    const prevClose = trSlice[i - 1].close;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose)
    );
    trSum += tr;
    trCount += 1;
  }
  const avgBarTr = trCount > 0 ? trSum / trCount : instrument.price * 0.002;
  const sessionSpan = Math.max(0, (instrument.high24h || instrument.price) - (instrument.low24h || instrument.price));
  const scaledBarAtr24h = avgBarTr * Math.sqrt(Math.min(barsPerDay, 390) / 8);
  const rawAtr24h = Math.max(sessionSpan * 0.72 + scaledBarAtr24h * 0.28, instrument.price * 0.0015);
  const atr24h = Number(rawAtr24h.toFixed(instrument.price < 0.01 ? 6 : instrument.price < 10 ? 4 : 2));
  const atrPct = Number(clamp((rawAtr24h / Math.max(instrument.price, 1e-8)) * 100, 0.08, 35).toFixed(2));

  const sma20 =
    window.slice(-20).reduce((a, b) => a + b, 0) / Math.min(window.length, 20);
  const std20 = Math.sqrt(
    window
      .slice(-20)
      .reduce((acc, p) => acc + (p - sma20) ** 2, 0) /
      Math.min(window.length, 20)
  );
  const zScore = std20 > 0 ? (instrument.price - sma20) / std20 : 0;

  const ema9 = calcEma(closes.slice(-25), 9);
  const ema21 = calcEma(closes.slice(-35), 21);
  const rsi14 = calcRsi(closes, 14);

  // News sentiment feature for this symbol
  const relevantNews = newsItems.filter((item) =>
    item.symbols.includes(instrument.symbol)
  );
  const newsBias =
    relevantNews.length > 0
      ? relevantNews.reduce((acc, item) => acc + item.sentimentScore, 0) /
        relevantNews.length
      : 0;

  // Order book imbalance feature (-1 to +1)
  const bookBias = orderBook ? clamp(orderBook.imbalancePct / 100, -0.5, 0.5) : 0;

  // Multi-factor short-term forecast (15-bar horizon damped by mean reversion at extreme Z)
  const trendComponent = slope * 10; // projected 10-bar trend
  const reversionComponent = Math.abs(zScore) > 1.8 ? -zScore * 0.0018 : 0;
  const catalystComponent = newsBias * 0.0022 + bookBias * 0.0016;

  const rawPredictedReturn = clamp(
    trendComponent + reversionComponent + catalystComponent,
    -0.032,
    0.032
  );
  const predictedPrice = instrument.price * Math.exp(rawPredictedReturn);
  const predictedReturnPct = ((predictedPrice - instrument.price) / instrument.price) * 100;

  const raw1hReturn = clamp(
    rawPredictedReturn * 1.85 + newsBias * 0.002,
    -0.06,
    0.06
  );
  const predicted1hPrice = instrument.price * Math.exp(raw1hReturn);
  const predicted1hReturnPct = ((predicted1hPrice - instrument.price) / instrument.price) * 100;

  const raw4hReturn = clamp(
    rawPredictedReturn * 2.9 + newsBias * 0.004,
    -0.11,
    0.11
  );
  const predicted4hPrice = instrument.price * Math.exp(raw4hReturn);
  const predicted4hReturnPct = ((predicted4hPrice - instrument.price) / instrument.price) * 100;

  const recentLow =
    candles.length > 0
      ? Math.min(...candles.slice(-24).map((c) => c.low), instrument.low24h || instrument.price)
      : instrument.price * 0.985;
  const recentHigh =
    candles.length > 0
      ? Math.max(...candles.slice(-24).map((c) => c.high), instrument.high24h || instrument.price)
      : instrument.price * 1.015;

  const horizonSigma = Math.max(sigmaPerBar * Math.sqrt(15), 0.0018);
  const bandLow = predictedPrice * Math.exp(-1.15 * horizonSigma);
  const bandHigh = predictedPrice * Math.exp(1.15 * horizonSigma);

  const supportLevel = Math.min(instrument.price * 0.996, (recentLow + bandLow) / 2);
  const resistanceLevel = Math.max(instrument.price * 1.004, (recentHigh + bandHigh) / 2);

  // Directional agreement across features determines model confidence
  const signals = [
    Math.sign(trendComponent),
    Math.sign(ema9 - ema21),
    Math.sign(newsBias || trendComponent),
    Math.sign(bookBias || trendComponent),
  ];
  const agreement =
    Math.abs(signals.reduce((a, b) => a + b, 0)) / signals.length;
  const confidence = clamp(0.54 + agreement * 0.31 + Math.min(Math.abs(zScore) * 0.03, 0.08), 0.51, 0.92);

  let direction: MlPrediction['direction'] = 'Neutral';
  if (predictedReturnPct > 0.08) direction = 'Bullish';
  else if (predictedReturnPct < -0.08) direction = 'Bearish';

  const suggestedTakeProfit =
    direction === 'Bearish'
      ? Math.min(predicted1hPrice, supportLevel)
      : Math.max(predicted1hPrice, resistanceLevel);
  const suggestedStopLoss =
    direction === 'Bearish'
      ? Math.max(bandHigh, resistanceLevel)
      : Math.min(bandLow, supportLevel);

  let regime: MlPrediction['regime'] = 'Mean Reverting';
  if (volatilityAnnPct > 55) regime = 'High Volatility';
  else if (ema9 > ema21 * 1.0015 && slope > 0) regime = 'Trending Up';
  else if (ema9 < ema21 * 0.9985 && slope < 0) regime = 'Trending Down';

  const opportunityScore = Math.round(
    clamp(
      50 +
        Math.abs(predictedReturnPct) * 28 +
        confidence * 22 +
        Math.abs(newsBias) * 12 +
        (rsi14 < 34 || rsi14 > 66 ? 9 : 0),
      35,
      98
    )
  );

  const reasonParts: string[] = [];
  if (ema9 > ema21) reasonParts.push('short-term trend (EMA 9) is above long trend (EMA 21)');
  else if (ema9 < ema21) reasonParts.push('short-term trend (EMA 9) is below long trend (EMA 21)');
  if (bookBias > 0.1) reasonParts.push('more buyers are waiting in the order book');
  else if (bookBias < -0.1) reasonParts.push('more sellers are queued in the order book');
  if (rsi14 < 35) reasonParts.push('RSI shows oversold bounce potential');
  else if (rsi14 > 68) reasonParts.push('RSI is near overbought resistance');

  const plainSummary =
    reasonParts.length > 0
      ? `${direction} bias (${(confidence * 100).toFixed(0)}% confidence) because ${reasonParts.slice(0, 2).join(' and ')}.`
      : `${direction} range expected near current price (${(confidence * 100).toFixed(0)}% model confidence).`;

  return {
    symbol: instrument.symbol,
    horizonLabel: '15m / 1h / 4h Forecast',
    currentPrice: instrument.price,
    predictedPrice,
    predictedReturnPct,
    predicted1hPrice,
    predicted1hReturnPct,
    predicted4hPrice,
    predicted4hReturnPct,
    supportLevel,
    resistanceLevel,
    suggestedStopLoss,
    suggestedTakeProfit,
    plainSummary,
    bandLow,
    bandHigh,
    direction,
    confidence,
    rsi14,
    ema9,
    ema21,
    volatilityAnnPct,
    realizedVol24hPct,
    atr24h,
    atrPct,
    zScore,
    opportunityScore,
    regime,
    updatedAt: Date.now(),
  };
}

export function detectTechnicalPatterns(
  instrument: Instrument,
  candles: Candle[],
  prediction: MlPrediction
): DetectedPattern[] {
  if (candles.length < 25) return [];
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const recentVolAvg =
    candles.slice(-20, -1).reduce((acc, c) => acc + c.volume, 0) / 19;

  const detected: DetectedPattern[] = [];
  const now = Date.now();

  // 1. EMA 9/21 Crossover
  const prevCloses = candles.slice(0, -1).map((c) => c.close);
  const prevEma9 = calcEma(prevCloses.slice(-25), 9);
  const prevEma21 = calcEma(prevCloses.slice(-35), 21);

  if (prevEma9 <= prevEma21 && prediction.ema9 > prediction.ema21) {
    detected.push({
      id: `pat-${instrument.symbol}-ema-bull-${Math.floor(now / 60000)}`,
      symbol: instrument.symbol,
      name: 'EMA 9/21 Bullish Cross',
      bias: 'Bullish',
      timeframe: '1m',
      confidence: 0.78,
      detectedAt: now,
      priceAtDetection: instrument.price,
      summary: `Short-term EMA(9) crossed above EMA(21) on ${instrument.venue} confirming upward momentum shift.`,
    });
  } else if (prevEma9 >= prevEma21 && prediction.ema9 < prediction.ema21) {
    detected.push({
      id: `pat-${instrument.symbol}-ema-bear-${Math.floor(now / 60000)}`,
      symbol: instrument.symbol,
      name: 'EMA 9/21 Bearish Cross',
      bias: 'Bearish',
      timeframe: '1m',
      confidence: 0.76,
      detectedAt: now,
      priceAtDetection: instrument.price,
      summary: `Short-term EMA(9) crossed below EMA(21) signaling distribution pressure.`,
    });
  }

  // 2. Bullish / Bearish Engulfing Bar
  const prevRed = prev.close < prev.open;
  const lastGreen = last.close > last.open;
  if (prevRed && lastGreen && last.close > prev.open && last.open <= prev.close) {
    detected.push({
      id: `pat-${instrument.symbol}-engulf-bull-${Math.floor(now / 60000)}`,
      symbol: instrument.symbol,
      name: 'Bullish Engulfing',
      bias: 'Bullish',
      timeframe: '1m',
      confidence: 0.74,
      detectedAt: now,
      priceAtDetection: instrument.price,
      summary: `Buyer absorption engulfed prior session range at ${instrument.price.toFixed(2)}.`,
    });
  }

  // 3. Volume Surge Breakout
  if (last.volume > recentVolAvg * 1.65 && Math.abs(prediction.zScore) > 1.3) {
    const bullish = last.close >= last.open;
    detected.push({
      id: `pat-${instrument.symbol}-vol-surge-${Math.floor(now / 60000)}`,
      symbol: instrument.symbol,
      name: bullish ? 'Institutional Volume Breakout' : 'High-Volume Flush',
      bias: bullish ? 'Bullish' : 'Bearish',
      timeframe: '1m',
      confidence: 0.83,
      detectedAt: now,
      priceAtDetection: instrument.price,
      summary: `Volume spiked ${(last.volume / Math.max(recentVolAvg, 1)).toFixed(1)}x above 20-bar baseline.`,
    });
  }

  // 4. RSI Extremes / Mean Reversion Setup
  if (prediction.rsi14 <= 33) {
    detected.push({
      id: `pat-${instrument.symbol}-rsi-os-${Math.floor(now / 120000)}`,
      symbol: instrument.symbol,
      name: 'RSI Oversold Compression',
      bias: 'Bullish',
      timeframe: '1m',
      confidence: 0.71,
      detectedAt: now,
      priceAtDetection: instrument.price,
      summary: `RSI(14) compressed to ${prediction.rsi14.toFixed(1)}; mean-reversion bounce probability elevated.`,
    });
  } else if (prediction.rsi14 >= 69) {
    detected.push({
      id: `pat-${instrument.symbol}-rsi-ob-${Math.floor(now / 120000)}`,
      symbol: instrument.symbol,
      name: 'RSI Overbought Extension',
      bias: 'Bearish',
      timeframe: '1m',
      confidence: 0.7,
      detectedAt: now,
      priceAtDetection: instrument.price,
      summary: `RSI(14) extended to ${prediction.rsi14.toFixed(1)} with stretched Bollinger Z-score (${prediction.zScore.toFixed(2)}).`,
    });
  }

  return detected;
}

export function generateActionableInsights(
  instruments: Instrument[],
  predictions: Record<string, MlPrediction>,
  patterns: DetectedPattern[],
  news: NewsItem[]
): ActionableInsight[] {
  const ranked = [...instruments]
    .map((inst) => ({
      inst,
      pred: predictions[inst.symbol],
    }))
    .filter((entry) => Boolean(entry.pred))
    .sort((a, b) => b.pred.opportunityScore - a.pred.opportunityScore)
    .slice(0, 6);

  return ranked.map(({ inst, pred }) => {
    const matchedPattern = patterns.find((p) => p.symbol === inst.symbol);
    const matchedNews = news.find((n) => n.symbols.includes(inst.symbol));

    let action: ActionableInsight['action'] = 'Watch Breakout';
    if (pred.direction === 'Bullish' && pred.rsi14 < 38) {
      action = 'Mean Reversion Long';
    } else if (pred.direction === 'Bullish') {
      action = 'Accumulate';
    } else if (pred.direction === 'Bearish') {
      action = 'Trim / Hedge';
    }

    const isBull = pred.predictedReturnPct >= 0;
    const stopDist = Math.max(Math.abs(pred.bandHigh - pred.bandLow) * 0.45, inst.price * 0.004);
    const targetPrice = pred.predictedPrice;
    const stopLossPrice = isBull ? inst.price - stopDist : inst.price + stopDist;

    const patternNote = matchedPattern
      ? `${matchedPattern.name} detected`
      : `${pred.regime} regime (RSI ${pred.rsi14.toFixed(1)})`;
    const newsNote = matchedNews
      ? ` · News sentiment ${matchedNews.sentiment} (${matchedNews.source})`
      : '';

    return {
      id: `ins-${inst.symbol}-${Math.floor(pred.updatedAt / 60000)}`,
      symbol: inst.symbol,
      venue: inst.venue,
      title: `${inst.symbol}: ${action} (${pred.predictedReturnPct >= 0 ? '+' : ''}${pred.predictedReturnPct.toFixed(2)}% 15m model target)`,
      thesis: `${patternNote}${newsNote}. Regression + book-imbalance model projects ${pred.direction.toLowerCase()} drift with ${(pred.confidence * 100).toFixed(0)}% directional confidence.`,
      action,
      conviction: pred.opportunityScore >= 72 ? 'High' : 'Medium',
      predictedReturnPct: pred.predictedReturnPct,
      horizon: '15m',
      targetPrice,
      stopLossPrice,
      createdAt: pred.updatedAt,
    };
  });
}
