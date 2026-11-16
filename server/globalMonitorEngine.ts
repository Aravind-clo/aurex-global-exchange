import type {
  GlobalExchangeSession,
  GlobalMonitorSnapshot,
  Instrument,
  MlPrediction,
  SecurityStatus,
} from '../src/types/market.ts';

interface ExchangeScheduleDef {
  id: string;
  name: string;
  code: string;
  region: string;
  timezone: string;
  benchmarkSymbol: string;
  alwaysOpen?: boolean;
  openMinutesUtcLocal: number; // minutes from midnight in local tz
  closeMinutesUtcLocal: number;
  preMinutesLocal: number;
}

const EXCHANGES: ExchangeScheduleDef[] = [
  {
    id: 'nyse-nasdaq',
    name: 'NYSE / NASDAQ',
    code: 'US',
    region: 'North America',
    timezone: 'America/New_York',
    benchmarkSymbol: 'SPY',
    openMinutesUtcLocal: 9 * 60 + 30,
    closeMinutesUtcLocal: 16 * 60,
    preMinutesLocal: 4 * 60,
  },
  {
    id: 'nse-bse',
    name: 'India NSE / BSE',
    code: 'IN',
    region: 'India',
    timezone: 'Asia/Kolkata',
    benchmarkSymbol: 'RELIANCE.NS',
    openMinutesUtcLocal: 9 * 60 + 15,
    closeMinutesUtcLocal: 15 * 60 + 30,
    preMinutesLocal: 9 * 60,
  },
  {
    id: 'lse',
    name: 'London Stock Exchange',
    code: 'UK',
    region: 'United Kingdom',
    timezone: 'Europe/London',
    benchmarkSymbol: 'SHEL.L',
    openMinutesUtcLocal: 8 * 60,
    closeMinutesUtcLocal: 16 * 60 + 30,
    preMinutesLocal: 7 * 60 + 50,
  },
  {
    id: 'xetra',
    name: 'Frankfurt XETRA / Euronext',
    code: 'EU',
    region: 'Europe',
    timezone: 'Europe/Berlin',
    benchmarkSymbol: 'SAP.DE',
    openMinutesUtcLocal: 9 * 60,
    closeMinutesUtcLocal: 17 * 60 + 30,
    preMinutesLocal: 8 * 60,
  },
  {
    id: 'tse',
    name: 'Tokyo Stock Exchange',
    code: 'JP',
    region: 'Japan',
    timezone: 'Asia/Tokyo',
    benchmarkSymbol: '7203.T',
    openMinutesUtcLocal: 9 * 60,
    closeMinutesUtcLocal: 15 * 60,
    preMinutesLocal: 8 * 60,
  },
  {
    id: 'hkex',
    name: 'Hong Kong Exchanges',
    code: 'HK',
    region: 'Asia-Pacific',
    timezone: 'Asia/Hong_Kong',
    benchmarkSymbol: '9988.HK',
    openMinutesUtcLocal: 9 * 60 + 30,
    closeMinutesUtcLocal: 16 * 60,
    preMinutesLocal: 9 * 60,
  },
  {
    id: 'crypto-global',
    name: 'Global Crypto & Spot FX',
    code: '24/7',
    region: 'Decentralized Worldwide',
    timezone: 'UTC',
    benchmarkSymbol: 'BTC-USD',
    alwaysOpen: true,
    openMinutesUtcLocal: 0,
    closeMinutesUtcLocal: 24 * 60,
    preMinutesLocal: 0,
  },
];

function computeExchangeClock(def: ExchangeScheduleDef, date: Date): {
  localTimeStr: string;
  status: 'OPEN' | 'PRE_MARKET' | 'CLOSED';
} {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: def.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
    const hour = Number.parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const minute = Number.parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const hh = String(hour % 24).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    const localTimeStr = `${weekday} ${hh}:${mm}`;

    if (def.alwaysOpen) {
      return { localTimeStr: `${hh}:${mm} UTC`, status: 'OPEN' };
    }

    if (weekday === 'Sat' || weekday === 'Sun') {
      return { localTimeStr, status: 'CLOSED' };
    }

    const totalMins = (hour % 24) * 60 + minute;
    if (totalMins >= def.openMinutesUtcLocal && totalMins < def.closeMinutesUtcLocal) {
      return { localTimeStr, status: 'OPEN' };
    }
    if (totalMins >= def.preMinutesLocal && totalMins < def.openMinutesUtcLocal) {
      return { localTimeStr, status: 'PRE_MARKET' };
    }
    return { localTimeStr, status: 'CLOSED' };
  } catch {
    return { localTimeStr: '--:--', status: def.alwaysOpen ? 'OPEN' : 'CLOSED' };
  }
}

export function buildGlobalMonitorSnapshot(params: {
  instrumentsMap: Map<string, Instrument>;
  predictionsMap: Map<string, MlPrediction>;
  securityStatus: SecurityStatus;
  activeLockdowns: number;
}): GlobalMonitorSnapshot {
  const now = new Date();
  const instruments = Array.from(params.instrumentsMap.values());

  const sessions: GlobalExchangeSession[] = EXCHANGES.map((def) => {
    const { localTimeStr, status } = computeExchangeClock(def, now);
    const benchmark =
      params.instrumentsMap.get(def.benchmarkSymbol) ?? instruments[0];
    return {
      id: def.id,
      name: def.name,
      code: def.code,
      region: def.region,
      timezone: def.timezone,
      localTimeStr,
      status,
      benchmarkSymbol: benchmark?.symbol ?? def.benchmarkSymbol,
      benchmarkPrice: benchmark?.price ?? 0,
      benchmarkChangePct: benchmark?.changePct ?? 0,
    };
  });

  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  for (const inst of instruments) {
    if (inst.changePct > 0.05) advancers += 1;
    else if (inst.changePct < -0.05) decliners += 1;
    else unchanged += 1;
  }

  const preds = Array.from(params.predictionsMap.values());
  const avgVol =
    preds.length > 0
      ? Number(
          (
            preds.reduce((acc, p) => acc + (p.volatilityAnnPct || 20), 0) / preds.length
          ).toFixed(1)
        )
      : 22.4;

  const volatilityRegime: GlobalMonitorSnapshot['volatilityRegime'] =
    avgVol >= 55 ? 'HIGH' : avgVol >= 38 ? 'ELEVATED' : avgVol >= 20 ? 'NORMAL' : 'CALM';

  const sortedByChange = [...instruments].sort((a, b) => b.changePct - a.changePct);
  const topGainers = sortedByChange.slice(0, 5).map((i) => ({
    symbol: i.symbol,
    name: i.name,
    venue: i.venue,
    price: i.price,
    changePct: i.changePct,
  }));
  const topLosers = sortedByChange
    .slice(-5)
    .reverse()
    .map((i) => ({
      symbol: i.symbol,
      name: i.name,
      venue: i.venue,
      price: i.price,
      changePct: i.changePct,
    }));

  return {
    sessions,
    totalMarkets: instruments.length,
    advancers,
    decliners,
    unchanged,
    volatilityRegime,
    avgVolatilityPct: avgVol,
    topGainers,
    topLosers,
    fxPulse: {
      usdInr: params.instrumentsMap.get('USD-INR')?.price ?? 84.42,
      eurUsd: params.instrumentsMap.get('EUR-USD')?.price ?? 1.08,
      gbpUsd: params.instrumentsMap.get('GBP-USD')?.price ?? 1.27,
      goldUsd: params.instrumentsMap.get('XAU-USD')?.price ?? 2645,
      btcUsd: params.instrumentsMap.get('BTC-USD')?.price ?? 91420,
    },
    blockedThreats: params.securityStatus.totalBlocked,
    activeLockdowns: params.activeLockdowns,
    updatedAt: now.getTime(),
  };
}
