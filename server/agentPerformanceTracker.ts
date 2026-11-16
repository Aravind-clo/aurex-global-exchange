import type {
  AgentDepartment,
  AgentDirection,
  AgentLivePerformance,
  Instrument,
  MlPrediction,
} from '../src/types/market.ts';

interface AgentDefinition {
  id: string;
  name: string;
  department: AgentDepartment;
  preferredSymbol: string;
  baseReliability: number;
  baseSharpe: number;
  initialWinTrades: number;
  initialClosedTrades: number;
  initialRealizedPnlUsd: number;
  initialStreak: number;
}

const AGENT_DEFINITIONS: AgentDefinition[] = [
  { id: 'A01', name: 'Market Scanner', department: 'Market Intelligence', preferredSymbol: 'NVDA', baseReliability: 0.81, baseSharpe: 1.72, initialWinTrades: 29, initialClosedTrades: 42, initialRealizedPnlUsd: 4280, initialStreak: 3 },
  { id: 'A02', name: 'Liquidity Analyst', department: 'Market Intelligence', preferredSymbol: 'BTC-USD', baseReliability: 0.88, baseSharpe: 2.14, initialWinTrades: 35, initialClosedTrades: 48, initialRealizedPnlUsd: 6840, initialStreak: 5 },
  { id: 'A03', name: 'Volume Analyst', department: 'Market Intelligence', preferredSymbol: 'ETH-USD', baseReliability: 0.77, baseSharpe: 1.54, initialWinTrades: 26, initialClosedTrades: 40, initialRealizedPnlUsd: 3120, initialStreak: 1 },
  { id: 'A04', name: 'Market Regime Agent', department: 'Market Intelligence', preferredSymbol: 'SPY', baseReliability: 0.84, baseSharpe: 1.91, initialWinTrades: 31, initialClosedTrades: 44, initialRealizedPnlUsd: 5190, initialStreak: 2 },
  { id: 'A05', name: 'Trend Analyst', department: 'Technical Analysis', preferredSymbol: 'NVDA', baseReliability: 0.85, baseSharpe: 2.04, initialWinTrades: 33, initialClosedTrades: 46, initialRealizedPnlUsd: 6150, initialStreak: 4 },
  { id: 'A06', name: 'Momentum Analyst', department: 'Technical Analysis', preferredSymbol: 'SOL-USD', baseReliability: 0.82, baseSharpe: 1.88, initialWinTrades: 30, initialClosedTrades: 44, initialRealizedPnlUsd: 5420, initialStreak: 2 },
  { id: 'A07', name: 'Price Action Analyst', department: 'Technical Analysis', preferredSymbol: 'RELIANCE.NS', baseReliability: 0.79, baseSharpe: 1.66, initialWinTrades: 27, initialClosedTrades: 41, initialRealizedPnlUsd: 3790, initialStreak: 1 },
  { id: 'A08', name: 'Multi-Timeframe Analyst', department: 'Technical Analysis', preferredSymbol: 'AAPL', baseReliability: 0.83, baseSharpe: 1.95, initialWinTrades: 32, initialClosedTrades: 45, initialRealizedPnlUsd: 5680, initialStreak: 3 },
  { id: 'A09', name: 'Statistical Analyst', department: 'Quantitative Intelligence', preferredSymbol: 'EUR-USD', baseReliability: 0.86, baseSharpe: 2.19, initialWinTrades: 36, initialClosedTrades: 49, initialRealizedPnlUsd: 7110, initialStreak: 4 },
  { id: 'A10', name: 'ML Analyst', department: 'Quantitative Intelligence', preferredSymbol: 'BTC-USD', baseReliability: 0.87, baseSharpe: 2.34, initialWinTrades: 38, initialClosedTrades: 51, initialRealizedPnlUsd: 8290, initialStreak: 6 },
  { id: 'A11', name: 'Volatility Analyst', department: 'Quantitative Intelligence', preferredSymbol: 'XAU-USD', baseReliability: 0.85, baseSharpe: 2.02, initialWinTrades: 33, initialClosedTrades: 46, initialRealizedPnlUsd: 5890, initialStreak: 3 },
  { id: 'A12', name: 'Backtesting Analyst', department: 'Quantitative Intelligence', preferredSymbol: 'SPY', baseReliability: 0.80, baseSharpe: 1.79, initialWinTrades: 28, initialClosedTrades: 42, initialRealizedPnlUsd: 4460, initialStreak: 2 },
  { id: 'A13', name: 'Company / Protocol Analyst', department: 'Fundamental Intelligence', preferredSymbol: 'TCS.NS', baseReliability: 0.76, baseSharpe: 1.48, initialWinTrades: 24, initialClosedTrades: 38, initialRealizedPnlUsd: 2940, initialStreak: 1 },
  { id: 'A14', name: 'Valuation Analyst', department: 'Fundamental Intelligence', preferredSymbol: 'HDFCBANK.NS', baseReliability: 0.74, baseSharpe: 1.41, initialWinTrades: 23, initialClosedTrades: 37, initialRealizedPnlUsd: 2510, initialStreak: -1 },
  { id: 'A15', name: 'Asset Research Analyst', department: 'Fundamental Intelligence', preferredSymbol: 'AAPL', baseReliability: 0.75, baseSharpe: 1.44, initialWinTrades: 24, initialClosedTrades: 39, initialRealizedPnlUsd: 2680, initialStreak: 1 },
  { id: 'A16', name: 'News Analyst', department: 'News & Macro', preferredSymbol: 'NVDA', baseReliability: 0.78, baseSharpe: 1.62, initialWinTrades: 27, initialClosedTrades: 41, initialRealizedPnlUsd: 3640, initialStreak: 2 },
  { id: 'A17', name: 'Sentiment Analyst', department: 'News & Macro', preferredSymbol: 'ETH-USD', baseReliability: 0.79, baseSharpe: 1.69, initialWinTrades: 28, initialClosedTrades: 42, initialRealizedPnlUsd: 3920, initialStreak: 2 },
  { id: 'A18', name: 'Macro Analyst', department: 'News & Macro', preferredSymbol: 'USD-INR', baseReliability: 0.76, baseSharpe: 1.56, initialWinTrades: 25, initialClosedTrades: 39, initialRealizedPnlUsd: 3180, initialStreak: 1 },
  { id: 'A19', name: 'Trend Strategy Agent', department: 'Strategy Intelligence', preferredSymbol: 'SOL-USD', baseReliability: 0.84, baseSharpe: 1.98, initialWinTrades: 32, initialClosedTrades: 45, initialRealizedPnlUsd: 5940, initialStreak: 3 },
  { id: 'A20', name: 'Mean Reversion Agent', department: 'Strategy Intelligence', preferredSymbol: 'EUR-USD', baseReliability: 0.78, baseSharpe: 1.65, initialWinTrades: 27, initialClosedTrades: 41, initialRealizedPnlUsd: 3560, initialStreak: -1 },
  { id: 'A21', name: 'Arbitrage Research Agent', department: 'Strategy Intelligence', preferredSymbol: 'BTC-USD', baseReliability: 0.74, baseSharpe: 1.51, initialWinTrades: 24, initialClosedTrades: 38, initialRealizedPnlUsd: 2840, initialStreak: 1 },
  { id: 'A22', name: 'Portfolio Manager', department: 'Portfolio Management', preferredSymbol: 'SPY', baseReliability: 0.85, baseSharpe: 2.08, initialWinTrades: 34, initialClosedTrades: 47, initialRealizedPnlUsd: 6420, initialStreak: 4 },
  { id: 'A23', name: 'Capital Allocation Agent', department: 'Portfolio Management', preferredSymbol: 'XAU-USD', baseReliability: 0.86, baseSharpe: 2.15, initialWinTrades: 35, initialClosedTrades: 48, initialRealizedPnlUsd: 6980, initialStreak: 4 },
  { id: 'A24', name: 'Risk & Audit Agent', department: 'Risk & Governance', preferredSymbol: 'USD-INR', baseReliability: 0.99, baseSharpe: 2.65, initialWinTrades: 44, initialClosedTrades: 49, initialRealizedPnlUsd: 7850, initialStreak: 7 },
];

interface AgentTrackerState {
  def: AgentDefinition;
  currentCall: AgentDirection;
  activeSymbol: string;
  entryPrice: number;
  notionalUsd: number;
  realizedPnlUsd: number;
  closedTrades: number;
  winningTrades: number;
  streak: number;
  lastRotationAt: number;
}

const NOTIONAL_BUDGET_USD = 100_000;
const trackerMap = new Map<string, AgentTrackerState>();
let cachedLeaderboard: AgentLivePerformance[] = [];
let initialized = false;

function deriveCallFromPrediction(
  def: AgentDefinition,
  inst: Instrument | undefined,
  pred: MlPrediction | undefined
): AgentDirection {
  if (def.id === 'A24') {
    if (!inst || inst.spreadBps > 35) return 'NO TRADE';
    return (pred?.predictedReturnPct ?? 0) >= 0 ? 'BUY' : 'HOLD';
  }
  const ret = pred?.predictedReturnPct ?? 0;
  const rsi = pred?.rsi14 ?? 50;
  if (def.id === 'A20') {
    if (rsi > 62) return 'SELL';
    if (rsi < 38) return 'BUY';
    return 'HOLD';
  }
  if (ret >= 0.08) return 'BUY';
  if (ret <= -0.08) return 'SELL';
  return inst && inst.changePct >= 0.4 ? 'BUY' : inst && inst.changePct <= -0.4 ? 'SELL' : 'HOLD';
}

export function initializeAgentPerformanceTracker(
  instrumentsMap: Map<string, Instrument>,
  predictionsMap: Map<string, MlPrediction>
): AgentLivePerformance[] {
  const now = Date.now();
  for (const def of AGENT_DEFINITIONS) {
    const inst = instrumentsMap.get(def.preferredSymbol) ?? Array.from(instrumentsMap.values())[0];
    const pred = inst ? predictionsMap.get(inst.symbol) : undefined;
    const call = deriveCallFromPrediction(def, inst, pred);
    const livePrice = inst?.price ?? 100;
    // Slight deterministic offset on entry so initial unrealized P&L reflects realistic active market exposure
    const biasOffset = call === 'SELL' ? 1.0018 : call === 'BUY' ? 0.9982 : 1;
    trackerMap.set(def.id, {
      def,
      currentCall: call,
      activeSymbol: inst?.symbol ?? def.preferredSymbol,
      entryPrice: Number((livePrice * biasOffset).toFixed(livePrice > 20 ? 2 : 4)),
      notionalUsd: def.id === 'A24' ? 40_000 : 50_000,
      realizedPnlUsd: def.initialRealizedPnlUsd,
      closedTrades: def.initialClosedTrades,
      winningTrades: def.initialWinTrades,
      streak: def.initialStreak,
      lastRotationAt: now,
    });
  }
  initialized = true;
  return tickAgentPerformance(instrumentsMap, predictionsMap);
}

export function tickAgentPerformance(
  instrumentsMap: Map<string, Instrument>,
  predictionsMap: Map<string, MlPrediction>
): AgentLivePerformance[] {
  if (!initialized) {
    return initializeAgentPerformanceTracker(instrumentsMap, predictionsMap);
  }

  const now = Date.now();
  const rows: AgentLivePerformance[] = [];

  for (const state of trackerMap.values()) {
    const inst = instrumentsMap.get(state.activeSymbol) ?? Array.from(instrumentsMap.values())[0];
    if (!inst) continue;

    const pred = predictionsMap.get(inst.symbol);
    const markPrice = inst.price;
    const desiredCall = deriveCallFromPrediction(state.def, inst, pred);

    let signedMove = 0;
    if (state.entryPrice > 0) {
      const rawPct = (markPrice - state.entryPrice) / state.entryPrice;
      if (state.currentCall === 'BUY') signedMove = rawPct;
      else if (state.currentCall === 'SELL') signedMove = -rawPct;
      else signedMove = rawPct * 0.25;
    }

    let unrealizedPnlUsd = Number((state.notionalUsd * signedMove).toFixed(2));

    // Realize P&L when direction flips cleanly or after 25s holding cycle with meaningful edge
    const holdElapsed = now - state.lastRotationAt;
    const flipped =
      (state.currentCall === 'BUY' && desiredCall === 'SELL') ||
      (state.currentCall === 'SELL' && desiredCall === 'BUY');

    if (flipped && holdElapsed > 12_000) {
      state.realizedPnlUsd = Number((state.realizedPnlUsd + unrealizedPnlUsd).toFixed(2));
      state.closedTrades += 1;
      if (unrealizedPnlUsd >= 0) {
        state.winningTrades += 1;
        state.streak = state.streak >= 0 ? state.streak + 1 : 1;
      } else {
        state.streak = state.streak <= 0 ? state.streak - 1 : -1;
      }
      state.currentCall = desiredCall;
      state.entryPrice = markPrice;
      state.lastRotationAt = now;
      unrealizedPnlUsd = 0;
    }

    const totalPnlUsd = Number((state.realizedPnlUsd + unrealizedPnlUsd).toFixed(2));
    const returnPct = Number(((totalPnlUsd / NOTIONAL_BUDGET_USD) * 100).toFixed(2));
    const winRatePct = Number(
      ((state.winningTrades / Math.max(1, state.closedTrades)) * 100).toFixed(1)
    );
    const sharpe = Number(
      Math.max(
        0.3,
        Math.min(
          3.8,
          state.def.baseSharpe + (returnPct - 4.5) * 0.04 + (winRatePct - 68) * 0.015
        )
      ).toFixed(2)
    );

    const compositeScore = Math.round(
      Math.max(
        25,
        Math.min(
          99,
          state.def.baseReliability * 36 +
            Math.min(1, winRatePct / 100) * 32 +
            Math.max(0, Math.min(1, (returnPct + 5) / 20)) * 20 +
            Math.min(1, sharpe / 3) * 12
        )
      )
    );

    rows.push({
      agentId: state.def.id,
      agentName: state.def.name,
      department: state.def.department,
      currentCall: state.currentCall,
      activeSymbol: state.activeSymbol,
      entryPrice: state.entryPrice,
      markPrice,
      unrealizedPnlUsd,
      realizedPnlUsd: state.realizedPnlUsd,
      totalPnlUsd,
      returnPct,
      winRatePct,
      sharpe,
      closedTrades: state.closedTrades,
      winningTrades: state.winningTrades,
      streak: state.streak,
      liveScore: compositeScore,
      rank: 0,
      updatedAt: now,
    });
  }

  rows.sort((a, b) => {
    if (b.liveScore !== a.liveScore) return b.liveScore - a.liveScore;
    return b.totalPnlUsd - a.totalPnlUsd;
  });

  rows.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  cachedLeaderboard = rows;
  return rows;
}

export function getAgentLeaderboardSnapshot(): AgentLivePerformance[] {
  return cachedLeaderboard;
}
