import type {
  BotStrategyType,
  Candle,
  Instrument,
  MlPrediction,
  Order,
  TradingBotRecord,
} from '../src/types/market.ts';

const botsByUser = new Map<string, TradingBotRecord[]>();

export function listUserTradingBots(userId: string): TradingBotRecord[] {
  return (botsByUser.get(userId) ?? []).map((b) => ({
    ...b,
    logs: b.logs.slice(0, 12),
  }));
}

export function listAllActiveBotsCount(): number {
  let count = 0;
  for (const list of botsByUser.values()) {
    for (const b of list) {
      if (b.status === 'RUNNING') count += 1;
    }
  }
  return count;
}

export function createTradingBot(input: {
  userId: string;
  name: string;
  symbol: string;
  strategy: BotStrategyType;
  accountMode: 'demo' | 'real';
  allocatedUsd: number;
  orderSizeUnits: number;
  gridLower?: number;
  gridUpper?: number;
  gridLevels?: number;
  intervalSec?: number;
  maxDrawdownPct?: number;
  currentPrice: number;
}): { ok: boolean; bot?: TradingBotRecord; reason?: string } {
  const existing = botsByUser.get(input.userId) ?? [];
  if (existing.length >= 12) {
    return { ok: false, reason: 'Maximum 12 smart trading bots per account.' };
  }

  if (!Number.isFinite(input.allocatedUsd) || input.allocatedUsd <= 0) {
    return { ok: false, reason: 'Allocation must be a valid positive USD amount.' };
  }
  if (!Number.isFinite(input.orderSizeUnits) || input.orderSizeUnits <= 0) {
    return { ok: false, reason: 'Order size must be a valid positive unit quantity.' };
  }

  const price = Number.isFinite(input.currentPrice) ? Math.max(input.currentPrice, 1e-8) : 100;
  const allocatedUsd = Math.max(100, Math.min(250_000, input.allocatedUsd));
  const orderSizeUnits = Math.max(0.001, Math.min(10_000, input.orderSizeUnits));
  const rawGridLower = Number(input.gridLower);
  const rawGridUpper = Number(input.gridUpper);
  const rawGridLevels = Number(input.gridLevels);
  const rawIntervalSec = Number(input.intervalSec);
  const rawMaxDrawdownPct = Number(input.maxDrawdownPct);

  const gridLower =
    Number.isFinite(rawGridLower) && rawGridLower > 0
      ? rawGridLower
      : Number((price * 0.94).toPrecision(5));
  const gridUpper =
    Number.isFinite(rawGridUpper) && rawGridUpper > gridLower
      ? rawGridUpper
      : Number((Math.max(price * 1.06, gridLower * 1.02)).toPrecision(5));

  const bot: TradingBotRecord = {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: input.userId,
    name: input.name.trim().slice(0, 48) || `${input.strategy} ${input.symbol}`,
    symbol: input.symbol,
    strategy: input.strategy,
    accountMode: input.accountMode,
    status: 'RUNNING',
    allocatedUsd,
    orderSizeUnits,
    gridLower,
    gridUpper,
    gridLevels: Math.max(3, Math.min(20, Number.isFinite(rawGridLevels) ? Math.round(rawGridLevels) : 6)),
    intervalSec: Math.max(4, Math.min(300, Number.isFinite(rawIntervalSec) ? Math.round(rawIntervalSec) : 8)),
    maxDrawdownPct: Math.max(2, Math.min(50, Number.isFinite(rawMaxDrawdownPct) ? rawMaxDrawdownPct : 12)),
    tradesCount: 0,
    realizedPnlUsd: 0,
    lastSignalText: `Armed ${input.strategy} engine on ${input.symbol}`,
    createdAt: Date.now(),
    logs: [],
  };

  existing.unshift(bot);
  botsByUser.set(input.userId, existing);
  return { ok: true, bot };
}

export function toggleTradingBotStatus(userId: string, botId: string): TradingBotRecord | null {
  const list = botsByUser.get(userId) ?? [];
  const bot = list.find((b) => b.id === botId);
  if (!bot) return null;
  bot.status = bot.status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
  bot.lastSignalText = bot.status === 'RUNNING' ? 'Bot resumed live signal monitoring' : 'Bot paused by trader';
  return { ...bot, logs: bot.logs.slice(0, 12) };
}

export function deleteTradingBot(userId: string, botId: string): boolean {
  const list = botsByUser.get(userId) ?? [];
  const next = list.filter((b) => b.id !== botId);
  if (next.length === list.length) return false;
  botsByUser.set(userId, next);
  return true;
}

export interface BotTickExecutor {
  getWorkspace: (userId: string) => {
    lockdownMode: boolean;
    accountMode: 'demo' | 'real';
    demoCashBalance: number;
    realCashBalance: number;
    positions: Array<{ symbol: string; size: number; avgEntry: number }>;
    realPositions: Array<{ symbol: string; size: number; avgEntry: number }>;
  } | null;
  getInstrument: (symbol: string) => Instrument | undefined;
  getPrediction: (symbol: string) => MlPrediction | undefined;
  getCandles: (symbol: string) => Candle[];
  executeFill: (
    userId: string,
    order: Order,
    fillPrice: number,
    mode: 'demo' | 'real'
  ) => void;
  onUserBotUpdated: (userId: string, bots: TradingBotRecord[]) => void;
}

export function tickAllTradingBots(executor: BotTickExecutor) {
  const now = Date.now();

  for (const [userId, bots] of botsByUser.entries()) {
    const ws = executor.getWorkspace(userId);
    if (!ws || ws.lockdownMode) continue;

    let anyUpdated = false;

    for (const bot of bots) {
      if (bot.status !== 'RUNNING') continue;

      const cadenceMs = (bot.intervalSec ?? 8) * 1000;
      if (bot.lastExecutedAt && now - bot.lastExecutedAt < cadenceMs) continue;

      // Enforce drawdown circuit breaker
      const maxLossUsd = -((bot.allocatedUsd * bot.maxDrawdownPct) / 100);
      if (bot.realizedPnlUsd <= maxLossUsd) {
        bot.status = 'STOPPED_DRAWDOWN';
        bot.lastSignalText = `Auto-halted: drawdown exceeded -${bot.maxDrawdownPct}% limit`;
        anyUpdated = true;
        continue;
      }

      const inst = executor.getInstrument(bot.symbol);
      if (!inst) continue;
      const pred = executor.getPrediction(bot.symbol);
      const candles = executor.getCandles(bot.symbol);
      const price = inst.price;

      const availableCash =
        bot.accountMode === 'real' ? ws.realCashBalance : ws.demoCashBalance;
      const activePositions =
        bot.accountMode === 'real' ? ws.realPositions : ws.positions;
      const heldPos = activePositions.find((p) => p.symbol === bot.symbol);
      const heldSize = heldPos?.size ?? 0;

      let signalSide: 'buy' | 'sell' | null = null;
      let reason = '';

      if (bot.strategy === 'GRID') {
        const lower = bot.gridLower ?? price * 0.94;
        const upper = bot.gridUpper ?? price * 1.06;
        const mid = (lower + upper) / 2;
        if (price <= mid * 0.9985 && heldSize < bot.orderSizeUnits * 3) {
          signalSide = 'buy';
          reason = `Grid Buy zone (${price.toFixed(2)} <= mid ${mid.toFixed(2)})`;
        } else if (price >= mid * 1.0015 && heldSize >= bot.orderSizeUnits) {
          signalSide = 'sell';
          reason = `Grid Take-Profit zone (${price.toFixed(2)} >= mid ${mid.toFixed(2)})`;
        } else {
          bot.lastSignalText = `Grid holding between ${lower.toFixed(2)} – ${upper.toFixed(2)}`;
        }
      } else if (bot.strategy === 'DCA') {
        if (availableCash >= price * bot.orderSizeUnits * 1.01) {
          signalSide = 'buy';
          reason = `Scheduled SIP/DCA accumulation clip`;
        }
      } else if (bot.strategy === 'MOMENTUM_EMA') {
        const ema9 = pred?.ema9 ?? price;
        const ema21 = pred?.ema21 ?? price;
        if (ema9 > ema21 && heldSize <= 0) {
          signalSide = 'buy';
          reason = `EMA9 (${ema9.toFixed(2)}) crossed above EMA21 (${ema21.toFixed(2)})`;
        } else if (ema9 < ema21 && heldSize >= bot.orderSizeUnits) {
          signalSide = 'sell';
          reason = `EMA9 (${ema9.toFixed(2)}) dropped below EMA21 (${ema21.toFixed(2)})`;
        } else {
          bot.lastSignalText = `EMA spread ${((ema9 - ema21) / Math.max(price, 1e-8) * 100).toFixed(2)}%`;
        }
      } else if (bot.strategy === 'MEAN_REVERSION_BB') {
        const rsi = pred?.rsi14 ?? 50;
        const z = pred?.zScore ?? 0;
        if ((rsi < 44 || z < -0.7) && heldSize < bot.orderSizeUnits * 2) {
          signalSide = 'buy';
          reason = `Bollinger/RSI oversold reversion (RSI ${rsi.toFixed(1)}, Z ${z.toFixed(2)})`;
        } else if ((rsi > 56 || z > 0.7) && heldSize >= bot.orderSizeUnits) {
          signalSide = 'sell';
          reason = `Bollinger upper reversion exit (RSI ${rsi.toFixed(1)}, Z ${z.toFixed(2)})`;
        } else {
          bot.lastSignalText = `Mean-Reversion watching (RSI ${rsi.toFixed(1)})`;
        }
      } else if (bot.strategy === 'TWAP_SMART') {
        const avgVol =
          candles.length > 5
            ? candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5
            : inst.volume24h;
        if (avgVol > 0 && availableCash >= price * bot.orderSizeUnits * 1.01) {
          signalSide = 'buy';
          reason = `TWAP sliced fill (${bot.orderSizeUnits} units @ ${inst.spreadBps.toFixed(1)} bps spread)`;
        }
      }

      if (!signalSide) {
        anyUpdated = true;
        bot.lastExecutedAt = now;
        continue;
      }

      const notional = price * bot.orderSizeUnits;
      if (signalSide === 'buy' && availableCash < notional * 1.005) {
        bot.lastSignalText = `Waiting: insufficient ${bot.accountMode} cash balance`;
        bot.lastExecutedAt = now;
        anyUpdated = true;
        continue;
      }
      if (signalSide === 'sell' && heldSize < bot.orderSizeUnits) {
        bot.lastSignalText = `Waiting for open inventory before selling`;
        bot.lastExecutedAt = now;
        anyUpdated = true;
        continue;
      }

      const fillPrice = signalSide === 'buy' ? inst.ask : inst.bid;
      const order: Order = {
        id: `bot-ord-${now}-${Math.random().toString(36).slice(2, 6)}`,
        clientId: bot.id,
        traderName: `Bot:${bot.name}`,
        symbol: bot.symbol,
        side: signalSide,
        type: 'market',
        price: fillPrice,
        size: bot.orderSizeUnits,
        filledSize: bot.orderSizeUnits,
        status: 'filled',
        createdAt: now,
        updatedAt: now,
        notional: fillPrice * bot.orderSizeUnits,
      };

      const pnlDelta =
        signalSide === 'sell' && heldPos
          ? (fillPrice - heldPos.avgEntry) * bot.orderSizeUnits
          : 0;

      executor.executeFill(userId, order, fillPrice, bot.accountMode);

      bot.tradesCount += 1;
      bot.realizedPnlUsd = Number((bot.realizedPnlUsd + pnlDelta).toFixed(2));
      bot.lastExecutedAt = now;
      bot.lastSignalText = reason;
      bot.logs.unshift({
        id: `blog-${now}-${Math.random().toString(36).slice(2, 5)}`,
        botId: bot.id,
        symbol: bot.symbol,
        side: signalSide,
        price: fillPrice,
        size: bot.orderSizeUnits,
        reason,
        pnlImpactUsd: Number(pnlDelta.toFixed(2)),
        createdAt: now,
      });
      if (bot.logs.length > 25) bot.logs.pop();
      anyUpdated = true;
    }

    if (anyUpdated) {
      executor.onUserBotUpdated(userId, listUserTradingBots(userId));
    }
  }
}
