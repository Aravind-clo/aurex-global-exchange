import ccxt from 'ccxt';
import WebSocket from 'ws';
import type { CcxtConnectorStatus } from '../src/types/market.ts';

export interface CcxtLiveTick {
  symbol: string;
  exchange: 'Binance' | 'KuCoin';
  pair: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  timestamp: number;
}

export interface CcxtStreamOptions {
  cryptoAssets: Array<{ symbol: string; cryptoTicker?: string }>;
  onTick: (tick: CcxtLiveTick) => void;
  pollIntervalMs?: number;
}

export interface CcxtAdapterHandle {
  getStatuses: () => CcxtConnectorStatus[];
  refreshSnapshots: () => Promise<void>;
  stop: () => void;
}

function normalizeTickerToCcxtPair(cryptoTicker: string): string {
  const clean = cryptoTicker.trim().toUpperCase();
  return `${clean}/USDT`;
}

export function createCcxtExchangeAdapters(options: CcxtStreamOptions): CcxtAdapterHandle {
  const pollIntervalMs = options.pollIntervalMs ?? 25_000;
  let closed = false;

  // Map internal platform symbols (e.g. BTC-USD) <-> exchange pairs (BTC/USDT, BTCUSDT, BTC-USDT)
  const ccxtPairToSymbol = new Map<string, string>();
  const binanceStreamToSymbol = new Map<string, string>();
  const kucoinPairToSymbol = new Map<string, string>();
  const trackedPairs: string[] = [];

  for (const item of options.cryptoAssets) {
    const ticker = (item.cryptoTicker || item.symbol.split('-')[0] || '').trim().toUpperCase();
    if (!ticker || ticker === 'USDT' || ticker === 'USDC') continue;
    const ccxtPair = normalizeTickerToCcxtPair(ticker);
    if (ccxtPairToSymbol.has(ccxtPair)) continue;
    ccxtPairToSymbol.set(ccxtPair, item.symbol);
    binanceStreamToSymbol.set(`${ticker.toLowerCase()}usdt`, item.symbol);
    kucoinPairToSymbol.set(`${ticker}-USDT`, item.symbol);
    trackedPairs.push(ccxtPair);
  }

  const binanceClient = new ccxt.binance({
    enableRateLimit: true,
    timeout: 7000,
    options: { defaultType: 'spot' },
  });

  const kucoinClient = new ccxt.kucoin({
    enableRateLimit: true,
    timeout: 7000,
  });

  const statusMap: Record<'Binance' | 'KuCoin', CcxtConnectorStatus> = {
    Binance: {
      exchange: 'Binance',
      transport: 'standby',
      connected: false,
      pairsCount: trackedPairs.length,
      ticksReceived: 0,
      lastTickAt: null,
    },
    KuCoin: {
      exchange: 'KuCoin',
      transport: 'standby',
      connected: false,
      pairsCount: trackedPairs.length,
      ticksReceived: 0,
      lastTickAt: null,
    },
  };

  let binanceWs: WebSocket | null = null;
  let kucoinWs: WebSocket | null = null;
  let binanceReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let kucoinReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let kucoinPingTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const emitTick = (tick: CcxtLiveTick, viaWs: boolean) => {
    const st = statusMap[tick.exchange];
    st.connected = true;
    st.transport = viaWs ? 'ws+ccxt' : st.transport === 'ws+ccxt' ? 'ws+ccxt' : 'ccxt-rest';
    st.ticksReceived += 1;
    st.lastTickAt = tick.timestamp;
    st.lastError = undefined;
    options.onTick(tick);
  };

  // 1. Binance Combined Spot MiniTicker WebSocket
  const connectBinanceWs = () => {
    if (closed) return;
    const streamNames = Array.from(binanceStreamToSymbol.keys())
      .slice(0, 28)
      .map((s) => `${s}@miniTicker`);
    if (streamNames.length === 0) return;

    try {
      const url = `wss://stream.binance.com:9443/stream?streams=${streamNames.join('/')}`;
      binanceWs = new WebSocket(url);

      binanceWs.on('open', () => {
        statusMap.Binance.connected = true;
        statusMap.Binance.transport = 'ws+ccxt';
        statusMap.Binance.lastError = undefined;
      });

      binanceWs.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString()) as {
            stream?: string;
            data?: {
              s?: string; // e.g. BTCUSDT
              c?: string; // close/last price
              o?: string; // open price
              h?: string;
              l?: string;
              v?: string; // base volume
            };
          };
          const d = parsed.data;
          if (!d?.s || !d?.c) return;
          const symbol = binanceStreamToSymbol.get(d.s.toLowerCase());
          const price = Number.parseFloat(d.c);
          if (!symbol || !Number.isFinite(price) || price <= 0) return;

          const open = Number.parseFloat(d.o ?? d.c);
          const side: 'buy' | 'sell' = Number.isFinite(open) && price < open ? 'sell' : 'buy';
          const volume24h = Number.parseFloat(d.v ?? '0');

          emitTick(
            {
              symbol,
              exchange: 'Binance',
              pair: `${symbol.split('-')[0]}/USDT`,
              price,
              size: Math.max(0.01, Number.isFinite(volume24h) ? Math.min(25, volume24h / 50_000) : 0.15),
              side,
              volume24h: Number.isFinite(volume24h) && volume24h > 0 ? volume24h : undefined,
              high24h: Number.parseFloat(d.h ?? '') || undefined,
              low24h: Number.parseFloat(d.l ?? '') || undefined,
              timestamp: Date.now(),
            },
            true
          );
        } catch {
          // ignore malformed binance stream frame
        }
      });

      binanceWs.on('error', (err) => {
        statusMap.Binance.lastError = err.message.slice(0, 120);
      });

      binanceWs.on('close', () => {
        if (!closed) {
          if (statusMap.Binance.transport === 'ws+ccxt' && !statusMap.Binance.lastTickAt) {
            statusMap.Binance.connected = false;
            statusMap.Binance.transport = 'standby';
          }
          binanceReconnectTimer = setTimeout(connectBinanceWs, 18_000);
        }
      });
    } catch (err) {
      statusMap.Binance.lastError = err instanceof Error ? err.message : 'Binance WS init error';
      if (!closed) {
        binanceReconnectTimer = setTimeout(connectBinanceWs, 25_000);
      }
    }
  };

  // 2. KuCoin Public Token + Market Ticker WebSocket
  const connectKucoinWs = async () => {
    if (closed) return;
    try {
      const bulletRes = await fetch('https://api.kucoin.com/api/v1/bullet-public', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      if (!bulletRes.ok) {
        statusMap.KuCoin.lastError = `Bullet HTTP ${bulletRes.status}`;
        if (!closed) kucoinReconnectTimer = setTimeout(() => void connectKucoinWs(), 25_000);
        return;
      }

      const bulletJson = (await bulletRes.json()) as {
        data?: {
          token?: string;
          instanceServers?: Array<{ endpoint?: string; pingInterval?: number }>;
        };
      };
      const token = bulletJson.data?.token;
      const endpoint = bulletJson.data?.instanceServers?.[0]?.endpoint;
      const pingMs = bulletJson.data?.instanceServers?.[0]?.pingInterval ?? 18_000;
      if (!token || !endpoint) {
        if (!closed) kucoinReconnectTimer = setTimeout(() => void connectKucoinWs(), 25_000);
        return;
      }

      const connectId = `aurex-${Date.now()}`;
      kucoinWs = new WebSocket(`${endpoint}?token=${encodeURIComponent(token)}&connectId=${connectId}`);

      kucoinWs.on('open', () => {
        statusMap.KuCoin.connected = true;
        statusMap.KuCoin.transport = 'ws+ccxt';
        statusMap.KuCoin.lastError = undefined;

        const pairsList = Array.from(kucoinPairToSymbol.keys()).slice(0, 28).join(',');
        if (pairsList) {
          kucoinWs?.send(
            JSON.stringify({
              id: connectId,
              type: 'subscribe',
              topic: `/market/ticker:${pairsList}`,
              response: true,
            })
          );
        }

        if (kucoinPingTimer) clearInterval(kucoinPingTimer);
        kucoinPingTimer = setInterval(() => {
          if (kucoinWs && kucoinWs.readyState === WebSocket.OPEN) {
            kucoinWs.send(JSON.stringify({ id: String(Date.now()), type: 'ping' }));
          }
        }, Math.max(8_000, Math.min(25_000, pingMs - 2_000)));
      });

      kucoinWs.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            type?: string;
            topic?: string;
            data?: {
              price?: string;
              size?: string;
              bestBid?: string;
              bestAsk?: string;
              time?: number;
            };
          };
          if (msg.type !== 'message' || !msg.topic || !msg.data?.price) return;
          const pair = msg.topic.replace('/market/ticker:', '').trim().toUpperCase();
          const symbol = kucoinPairToSymbol.get(pair);
          const price = Number.parseFloat(msg.data.price);
          if (!symbol || !Number.isFinite(price) || price <= 0) return;

          const size = Number.parseFloat(msg.data.size ?? '0.12') || 0.12;
          const bid = Number.parseFloat(msg.data.bestBid ?? '0');
          const ask = Number.parseFloat(msg.data.bestAsk ?? '0');
          const side: 'buy' | 'sell' =
            Number.isFinite(bid) && Number.isFinite(ask) && price <= bid ? 'sell' : 'buy';

          emitTick(
            {
              symbol,
              exchange: 'KuCoin',
              pair: pair.replace('-', '/'),
              price,
              size,
              side,
              timestamp: msg.data.time ?? Date.now(),
            },
            true
          );
        } catch {
          // ignore malformed KuCoin frame
        }
      });

      kucoinWs.on('error', (err) => {
        statusMap.KuCoin.lastError = err.message.slice(0, 120);
      });

      kucoinWs.on('close', () => {
        if (kucoinPingTimer) {
          clearInterval(kucoinPingTimer);
          kucoinPingTimer = null;
        }
        if (!closed) {
          kucoinReconnectTimer = setTimeout(() => void connectKucoinWs(), 20_000);
        }
      });
    } catch (err) {
      statusMap.KuCoin.lastError = err instanceof Error ? err.message : 'KuCoin WS init error';
      if (!closed) {
        kucoinReconnectTimer = setTimeout(() => void connectKucoinWs(), 25_000);
      }
    }
  };

  // 3. CCXT REST Ticker Poll (Binance + KuCoin normalized OHLCV/24h ticker snapshots)
  const pollViaCcxt = async (
    exchangeName: 'Binance' | 'KuCoin',
    client: InstanceType<typeof ccxt.binance> | InstanceType<typeof ccxt.kucoin>
  ) => {
    try {
      const symbolsSubset = trackedPairs.slice(0, 28);
      if (symbolsSubset.length === 0) return;
      const tickers = await client.fetchTickers(symbolsSubset);
      let updated = 0;
      for (const [pair, ticker] of Object.entries(tickers)) {
        const internalSym = ccxtPairToSymbol.get(pair);
        const last = typeof ticker.last === 'number' ? ticker.last : ticker.close;
        if (!internalSym || typeof last !== 'number' || !Number.isFinite(last) || last <= 0) {
          continue;
        }
        updated += 1;
        emitTick(
          {
            symbol: internalSym,
            exchange: exchangeName,
            pair,
            price: last,
            size: Math.max(0.02, Math.min(30, (ticker.baseVolume ?? 100) / 80_000)),
            side: (ticker.percentage ?? 0) >= 0 ? 'buy' : 'sell',
            volume24h: typeof ticker.baseVolume === 'number' ? ticker.baseVolume : undefined,
            high24h: typeof ticker.high === 'number' ? ticker.high : undefined,
            low24h: typeof ticker.low === 'number' ? ticker.low : undefined,
            timestamp: ticker.timestamp ?? Date.now(),
          },
          false
        );
      }
      if (updated > 0) {
        statusMap[exchangeName].connected = true;
      }
    } catch (err) {
      statusMap[exchangeName].lastError =
        err instanceof Error ? err.message.slice(0, 120) : `${exchangeName} CCXT poll skipped`;
    }
  };

  const refreshSnapshots = async () => {
    if (closed) return;
    await Promise.allSettled([
      pollViaCcxt('Binance', binanceClient),
      pollViaCcxt('KuCoin', kucoinClient),
    ]);
  };

  connectBinanceWs();
  void connectKucoinWs();
  void refreshSnapshots();
  pollTimer = setInterval(() => void refreshSnapshots(), pollIntervalMs);

  return {
    getStatuses: () => [
      { ...statusMap.Binance },
      { ...statusMap.KuCoin },
    ],
    refreshSnapshots,
    stop: () => {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (binanceReconnectTimer) clearTimeout(binanceReconnectTimer);
      if (kucoinReconnectTimer) clearTimeout(kucoinReconnectTimer);
      if (kucoinPingTimer) clearInterval(kucoinPingTimer);
      try {
        binanceWs?.close();
      } catch {
        // ignore
      }
      try {
        kucoinWs?.close();
      } catch {
        // ignore
      }
    },
  };
}
