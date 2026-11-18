import crypto from 'node:crypto';
import type {
  CardProfile,
  ExchangeFeaturesState,
  Instrument,
  PredictionBet,
  PredictionContract,
  StakingPool,
  StakingPosition,
} from '../src/types/market.ts';

export const STAKING_POOLS: StakingPool[] = [
  {
    id: 'pool-sol',
    symbol: 'SOL-USD',
    assetName: 'Solana',
    apyPct: 6.0,
    lockTermLabel: 'Flexible · Daily Payout',
    minStakeUsd: 25,
    tvlUsd: 482_400_000,
    accentColor: '#14F195',
  },
  {
    id: 'pool-eth',
    symbol: 'ETH-USD',
    assetName: 'Ethereum',
    apyPct: 4.2,
    lockTermLabel: 'Validator Liquid Stake',
    minStakeUsd: 50,
    tvlUsd: 1_240_000_000,
    accentColor: '#627EEA',
  },
  {
    id: 'pool-btc',
    symbol: 'BTC-USD',
    assetName: 'Bitcoin Yield Vault',
    apyPct: 2.8,
    lockTermLabel: 'Insured Custody Yield',
    minStakeUsd: 100,
    tvlUsd: 890_500_000,
    accentColor: '#F7931A',
  },
  {
    id: 'pool-usdt',
    symbol: 'EUR-USD',
    assetName: 'USD / Treasury Cash Yield',
    apyPct: 5.5,
    lockTermLabel: 'Instant Redemption',
    minStakeUsd: 10,
    tvlUsd: 2_110_000_000,
    accentColor: '#0ECB81',
  },
];

export const PREDICTION_CONTRACTS: PredictionContract[] = [
  {
    id: 'pred-xrp-5m',
    title: 'XRP Up or Down - 5 min',
    symbol: 'XRP-USD',
    horizonLabel: '5 min',
    durationSec: 300,
    upOddsMultiplier: 1.92,
    downOddsMultiplier: 1.92,
    category: 'Crypto',
  },
  {
    id: 'pred-btc-15m',
    title: 'BTC Up or Down - 15 min',
    symbol: 'BTC-USD',
    horizonLabel: '15 min',
    durationSec: 900,
    upOddsMultiplier: 1.9,
    downOddsMultiplier: 1.94,
    category: 'Crypto',
  },
  {
    id: 'pred-sol-5m',
    title: 'SOL Up or Down - 5 min',
    symbol: 'SOL-USD',
    horizonLabel: '5 min',
    durationSec: 300,
    upOddsMultiplier: 1.95,
    downOddsMultiplier: 1.88,
    category: 'Crypto',
  },
  {
    id: 'pred-nvda-1h',
    title: 'NVDA Up or Down - 1 hour',
    symbol: 'NVDA',
    horizonLabel: '1 hour',
    durationSec: 3600,
    upOddsMultiplier: 1.86,
    downOddsMultiplier: 1.98,
    category: 'Equities',
  },
];

interface StoredUserExchangeExtras {
  stakingPositions: StakingPosition[];
  predictionBets: PredictionBet[];
  cardProfile: CardProfile;
}

const userExtrasMap = new Map<string, StoredUserExchangeExtras>();

function ensureExtras(
  userId: string,
  holderName: string,
  priceLookup: (symbol: string) => number
): StoredUserExchangeExtras {
  const existing = userExtrasMap.get(userId);
  if (existing) return existing;

  const xrpPrice = priceLookup('XRP-USD') || 2.38;
  const btcPrice = priceLookup('BTC-USD') || 91420;
  const now = Date.now();

  const initial: StoredUserExchangeExtras = {
    stakingPositions: [
      {
        id: `stk-${userId}-1`,
        poolId: 'pool-sol',
        symbol: 'SOL-USD',
        assetName: 'Solana',
        amountUsd: 3450.1,
        apyPct: 6.0,
        accruedRewardUsd: 18.42,
        stakedAt: now - 1000 * 60 * 60 * 72,
      },
      {
        id: `stk-${userId}-2`,
        poolId: 'pool-eth',
        symbol: 'ETH-USD',
        assetName: 'Ethereum',
        amountUsd: 4850.57,
        apyPct: 4.2,
        accruedRewardUsd: 24.15,
        stakedAt: now - 1000 * 60 * 60 * 96,
      },
    ],
    predictionBets: [
      {
        id: `pb-${userId}-1`,
        contractId: 'pred-xrp-5m',
        title: 'XRP Up or Down - 5 min',
        symbol: 'XRP-USD',
        horizonLabel: '5 min',
        direction: 'UP',
        stakeUsd: 50.44,
        entryPrice: Number((xrpPrice * 0.996).toFixed(4)),
        currentPrice: xrpPrice,
        unrealizedPnlUsd: 2.03,
        unrealizedPnlPct: 7.68,
        expiresAt: now + 300_000,
        status: 'OPEN',
        createdAt: now - 120_000,
      },
      {
        id: `pb-${userId}-2`,
        contractId: 'pred-btc-15m',
        title: 'BTC Up or Down - 15 min',
        symbol: 'BTC-USD',
        horizonLabel: '15 min',
        direction: 'UP',
        stakeUsd: 351.92,
        entryPrice: Number((btcPrice * 0.998).toFixed(2)),
        currentPrice: btcPrice,
        unrealizedPnlUsd: 14.8,
        unrealizedPnlPct: 4.21,
        expiresAt: now + 600_000,
        status: 'OPEN',
        createdAt: now - 180_000,
      },
    ],
    cardProfile: {
      cardNumberMasked: '•••• 4829',
      holderName: holderName || 'Nuvra Member',
      tier: 'Amber Sovereign',
      frozen: false,
      dailyLimitUsd: 15000,
      spentTodayUsd: 284.5,
      cashbackAsset: 'BTC',
      cashbackRatePct: 2.5,
      totalCashbackEarnedUsd: 142.85,
      transactions: [
        {
          id: `ctx-${now}-1`,
          merchant: 'AWS Cloud Compute',
          category: 'Infrastructure',
          amountUsd: 184.5,
          cashbackUsd: 4.61,
          cashbackAsset: 'BTC',
          status: 'COMPLETED',
          createdAt: now - 1000 * 60 * 60 * 4,
        },
        {
          id: `ctx-${now}-2`,
          merchant: 'Singapore Changi Lounge',
          category: 'Travel',
          amountUsd: 100.0,
          cashbackUsd: 2.5,
          cashbackAsset: 'BTC',
          status: 'COMPLETED',
          createdAt: now - 1000 * 60 * 60 * 19,
        },
      ],
    },
  };

  userExtrasMap.set(userId, initial);
  return initial;
}

export function getExchangeFeaturesState(
  userId: string,
  holderName: string,
  instrumentsMap: Map<string, Instrument>
): ExchangeFeaturesState {
  const lookup = (sym: string) => instrumentsMap.get(sym)?.price ?? 100;
  const extras = ensureExtras(userId, holderName, lookup);
  const now = Date.now();

  // Recompute live staking yield & live prediction mark-to-market against WebSocket prices
  const stakingPositions = extras.stakingPositions.map((sp) => {
    const days = Math.max(0.01, (now - sp.stakedAt) / (1000 * 60 * 60 * 24));
    const liveAccrued = Number((sp.amountUsd * (sp.apyPct / 100) * (days / 365)).toFixed(2));
    return {
      ...sp,
      accruedRewardUsd: Math.max(sp.accruedRewardUsd, liveAccrued),
    };
  });

  const predictionBets = extras.predictionBets.map((bet) => {
    if (bet.status !== 'OPEN') return bet;
    const livePx = instrumentsMap.get(bet.symbol)?.price ?? bet.currentPrice;
    const rawReturn = (livePx - bet.entryPrice) / Math.max(1e-8, bet.entryPrice);
    const directionalReturn = bet.direction === 'UP' ? rawReturn : -rawReturn;
    // Short-horizon binary option leverage scaling (x18 sensitivity for 5m/15m marks)
    const markPct = Math.max(-95, Math.min(92, directionalReturn * 1800));
    const markUsd = Number(((bet.stakeUsd * markPct) / 100).toFixed(2));
    return {
      ...bet,
      currentPrice: livePx,
      unrealizedPnlPct: Number(markPct.toFixed(2)),
      unrealizedPnlUsd: markUsd,
    };
  });

  return {
    stakingPools: STAKING_POOLS,
    stakingPositions,
    predictionContracts: PREDICTION_CONTRACTS,
    predictionBets,
    cardProfile: {
      ...extras.cardProfile,
      transactions: extras.cardProfile.transactions.slice(0, 20),
    },
  };
}

export function stakeIntoPool(
  userId: string,
  holderName: string,
  poolId: string,
  amountUsd: number,
  instrumentsMap: Map<string, Instrument>,
  availableCash: number
): { ok: boolean; error?: string; deductedUsd?: number } {
  const pool = STAKING_POOLS.find((p) => p.id === poolId);
  if (!pool) return { ok: false, error: 'Staking pool not found.' };
  if (!Number.isFinite(amountUsd) || amountUsd < pool.minStakeUsd) {
    return { ok: false, error: `Minimum stake for ${pool.assetName} is $${pool.minStakeUsd}.` };
  }
  if (amountUsd > availableCash) {
    return { ok: false, error: 'Insufficient active cash balance for this stake.' };
  }
  const extras = ensureExtras(userId, holderName, (s) => instrumentsMap.get(s)?.price ?? 100);
  const existing = extras.stakingPositions.find((s) => s.poolId === pool.id);
  if (existing) {
    existing.amountUsd = Number((existing.amountUsd + amountUsd).toFixed(2));
  } else {
    extras.stakingPositions.unshift({
      id: `stk-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      poolId: pool.id,
      symbol: pool.symbol,
      assetName: pool.assetName,
      amountUsd: Number(amountUsd.toFixed(2)),
      apyPct: pool.apyPct,
      accruedRewardUsd: 0,
      stakedAt: Date.now(),
    });
  }
  return { ok: true, deductedUsd: Number(amountUsd.toFixed(2)) };
}

export function unstakePosition(
  userId: string,
  holderName: string,
  positionId: string,
  instrumentsMap: Map<string, Instrument>
): { ok: boolean; error?: string; creditedUsd?: number } {
  const extras = ensureExtras(userId, holderName, (s) => instrumentsMap.get(s)?.price ?? 100);
  const idx = extras.stakingPositions.findIndex((p) => p.id === positionId);
  if (idx === -1) return { ok: false, error: 'Staking position not found.' };
  const [removed] = extras.stakingPositions.splice(idx, 1);
  const days = Math.max(0.01, (Date.now() - removed.stakedAt) / (1000 * 60 * 60 * 24));
  const reward = Math.max(
    removed.accruedRewardUsd,
    removed.amountUsd * (removed.apyPct / 100) * (days / 365)
  );
  const totalCredit = Number((removed.amountUsd + reward).toFixed(2));
  return { ok: true, creditedUsd: totalCredit };
}

export function placePredictionBet(
  userId: string,
  holderName: string,
  contractId: string,
  direction: 'UP' | 'DOWN',
  stakeUsd: number,
  instrumentsMap: Map<string, Instrument>,
  availableCash: number
): { ok: boolean; error?: string; bet?: PredictionBet; deductedUsd?: number } {
  const contract = PREDICTION_CONTRACTS.find((c) => c.id === contractId);
  if (!contract) return { ok: false, error: 'Prediction contract not found.' };
  if (!Number.isFinite(stakeUsd) || stakeUsd < 5 || stakeUsd > 50_000) {
    return { ok: false, error: 'Prediction stake must be between $5 and $50,000.' };
  }
  if (stakeUsd > availableCash) {
    return { ok: false, error: 'Insufficient active cash balance for prediction stake.' };
  }
  const extras = ensureExtras(userId, holderName, (s) => instrumentsMap.get(s)?.price ?? 100);
  const entryPrice = instrumentsMap.get(contract.symbol)?.price ?? 100;
  const now = Date.now();
  const bet: PredictionBet = {
    id: `pb-${now}-${crypto.randomBytes(2).toString('hex')}`,
    contractId: contract.id,
    title: contract.title,
    symbol: contract.symbol,
    horizonLabel: contract.horizonLabel,
    direction,
    stakeUsd: Number(stakeUsd.toFixed(2)),
    entryPrice,
    currentPrice: entryPrice,
    unrealizedPnlUsd: 0,
    unrealizedPnlPct: 0,
    expiresAt: now + contract.durationSec * 1000,
    status: 'OPEN',
    createdAt: now,
  };
  extras.predictionBets.unshift(bet);
  return { ok: true, bet, deductedUsd: bet.stakeUsd };
}

export function settlePredictionBet(
  userId: string,
  holderName: string,
  betId: string,
  instrumentsMap: Map<string, Instrument>
): { ok: boolean; error?: string; creditedUsd?: number; bet?: PredictionBet } {
  const extras = ensureExtras(userId, holderName, (s) => instrumentsMap.get(s)?.price ?? 100);
  const bet = extras.predictionBets.find((b) => b.id === betId);
  if (!bet) return { ok: false, error: 'Prediction position not found.' };
  if (bet.status !== 'OPEN') return { ok: false, error: 'Prediction already settled.' };

  const livePx = instrumentsMap.get(bet.symbol)?.price ?? bet.currentPrice;
  const rawReturn = (livePx - bet.entryPrice) / Math.max(1e-8, bet.entryPrice);
  const directional = bet.direction === 'UP' ? rawReturn : -rawReturn;
  const markPct = Math.max(-95, Math.min(92, directional * 1800));
  const pnlUsd = Number(((bet.stakeUsd * markPct) / 100).toFixed(2));
  const payout = Math.max(0, Number((bet.stakeUsd + pnlUsd).toFixed(2)));

  bet.currentPrice = livePx;
  bet.unrealizedPnlPct = Number(markPct.toFixed(2));
  bet.unrealizedPnlUsd = pnlUsd;
  bet.status = pnlUsd >= 0 ? 'SETTLED_WIN' : 'SETTLED_LOSS';

  return { ok: true, creditedUsd: payout, bet: { ...bet } };
}

export function toggleCardFreeze(
  userId: string,
  holderName: string,
  frozen: boolean,
  instrumentsMap: Map<string, Instrument>
): CardProfile {
  const extras = ensureExtras(userId, holderName, (s) => instrumentsMap.get(s)?.price ?? 100);
  extras.cardProfile.frozen = frozen;
  return { ...extras.cardProfile };
}

export function updateCardConfig(
  userId: string,
  holderName: string,
  input: { cashbackAsset?: 'BTC' | 'SOL' | 'USDT'; dailyLimitUsd?: number },
  instrumentsMap: Map<string, Instrument>
): CardProfile {
  const extras = ensureExtras(userId, holderName, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (input.cashbackAsset && ['BTC', 'SOL', 'USDT'].includes(input.cashbackAsset)) {
    extras.cardProfile.cashbackAsset = input.cashbackAsset;
    extras.cardProfile.cashbackRatePct =
      input.cashbackAsset === 'SOL' ? 3.0 : input.cashbackAsset === 'BTC' ? 2.5 : 2.0;
  }
  if (
    typeof input.dailyLimitUsd === 'number' &&
    Number.isFinite(input.dailyLimitUsd) &&
    input.dailyLimitUsd >= 250 &&
    input.dailyLimitUsd <= 100_000
  ) {
    extras.cardProfile.dailyLimitUsd = Math.round(input.dailyLimitUsd);
  }
  return { ...extras.cardProfile };
}

export function executeCardSpend(
  userId: string,
  holderName: string,
  merchant: string,
  category: string,
  amountUsd: number,
  availableCash: number,
  instrumentsMap: Map<string, Instrument>
): { ok: boolean; error?: string; netDebitUsd?: number; cardProfile: CardProfile } {
  const extras = ensureExtras(userId, holderName, (s) => instrumentsMap.get(s)?.price ?? 100);
  if (extras.cardProfile.frozen) {
    extras.cardProfile.transactions.unshift({
      id: `ctx-${Date.now()}`,
      merchant: merchant.slice(0, 48) || 'Merchant Terminal',
      category: category || 'Retail',
      amountUsd: Number(amountUsd.toFixed(2)),
      cashbackUsd: 0,
      cashbackAsset: extras.cardProfile.cashbackAsset,
      status: 'DECLINED_FROZEN',
      createdAt: Date.now(),
    });
    return { ok: false, error: 'Card is currently frozen. Unfreeze before charging.', cardProfile: extras.cardProfile };
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > extras.cardProfile.dailyLimitUsd) {
    return {
      ok: false,
      error: `Charge must be between $0.01 and your $${extras.cardProfile.dailyLimitUsd.toLocaleString()} daily limit.`,
      cardProfile: extras.cardProfile,
    };
  }
  if (amountUsd > availableCash) {
    return {
      ok: false,
      error: 'Insufficient cash balance backing the card.',
      cardProfile: extras.cardProfile,
    };
  }

  const cashbackUsd = Number(((amountUsd * extras.cardProfile.cashbackRatePct) / 100).toFixed(2));
  extras.cardProfile.spentTodayUsd = Number((extras.cardProfile.spentTodayUsd + amountUsd).toFixed(2));
  extras.cardProfile.totalCashbackEarnedUsd = Number(
    (extras.cardProfile.totalCashbackEarnedUsd + cashbackUsd).toFixed(2)
  );
  extras.cardProfile.transactions.unshift({
    id: `ctx-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    merchant: merchant.slice(0, 48) || 'Global Merchant',
    category: category || 'Commerce',
    amountUsd: Number(amountUsd.toFixed(2)),
    cashbackUsd,
    cashbackAsset: extras.cardProfile.cashbackAsset,
    status: 'COMPLETED',
    createdAt: Date.now(),
  });
  return {
    ok: true,
    netDebitUsd: Number(amountUsd.toFixed(2)),
    cardProfile: { ...extras.cardProfile },
  };
}
