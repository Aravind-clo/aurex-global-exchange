import WebSocket from 'ws';
import type { NewsItem } from '../src/types/market.ts';

const BULLISH_TERMS = [
  'surge',
  'rally',
  'beat',
  'beats',
  'record',
  'growth',
  'upgrade',
  'bullish',
  'inflow',
  'inflows',
  'breakout',
  'soar',
  'soars',
  'approve',
  'approval',
  'partnership',
  'strong',
  'outperform',
  'gain',
  'gains',
  'higher',
  'adoption',
];

const BEARISH_TERMS = [
  'drop',
  'drops',
  'fall',
  'falls',
  'miss',
  'misses',
  'downgrade',
  'bearish',
  'outflow',
  'outflows',
  'selloff',
  'slump',
  'crash',
  'probe',
  'lawsuit',
  'cut',
  'cuts',
  'warning',
  'decline',
  'declines',
  'lower',
  'risk',
  'inflation',
];

export function scoreHeadlineSentiment(text: string): {
  sentiment: NewsItem['sentiment'];
  sentimentScore: number;
} {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of BULLISH_TERMS) {
    if (lower.includes(term)) score += 0.25;
  }
  for (const term of BEARISH_TERMS) {
    if (lower.includes(term)) score -= 0.25;
  }
  const clamped = Math.max(-0.95, Math.min(0.95, score));
  if (clamped >= 0.15) return { sentiment: 'Bullish', sentimentScore: clamped };
  if (clamped <= -0.15) return { sentiment: 'Bearish', sentimentScore: clamped };
  return { sentiment: 'Neutral', sentimentScore: clamped };
}

const KNOWN_SYMBOL_MAP: Array<{ match: RegExp; symbol: string }> = [
  { match: /\b(bitcoin|btc)\b/i, symbol: 'BTC-USD' },
  { match: /\b(ethereum|eth|ether)\b/i, symbol: 'ETH-USD' },
  { match: /\b(solana|sol)\b/i, symbol: 'SOL-USD' },
  { match: /\b(bnb|binance coin)\b/i, symbol: 'BNB-USD' },
  { match: /\b(ripple|xrp)\b/i, symbol: 'XRP-USD' },
  { match: /\b(cardano|ada)\b/i, symbol: 'ADA-USD' },
  { match: /\b(avalanche|avax)\b/i, symbol: 'AVAX-USD' },
  { match: /\b(dogecoin|doge)\b/i, symbol: 'DOGE-USD' },
  { match: /\b(chainlink|link)\b/i, symbol: 'LINK-USD' },
  { match: /\b(toncoin)\b/i, symbol: 'TON-USD' },
  { match: /\b(sui)\b/i, symbol: 'SUI-USD' },
  { match: /\b(nvidia|nvda)\b/i, symbol: 'NVDA' },
  { match: /\b(apple|aapl)\b/i, symbol: 'AAPL' },
  { match: /\b(microsoft|msft)\b/i, symbol: 'MSFT' },
  { match: /\b(amazon|amzn)\b/i, symbol: 'AMZN' },
  { match: /\b(google|alphabet|googl)\b/i, symbol: 'GOOGL' },
  { match: /\b(meta|facebook)\b/i, symbol: 'META' },
  { match: /\b(tesla|tsla)\b/i, symbol: 'TSLA' },
  { match: /\b(broadcom|avgo)\b/i, symbol: 'AVGO' },
  { match: /\b(amd)\b/i, symbol: 'AMD' },
  { match: /\b(s&p\s*500|spy|equities|stocks|nasdaq|nyse)\b/i, symbol: 'SPY' },
  { match: /\b(jpmorgan|jpm|bank)\b/i, symbol: 'JPM' },
  { match: /\b(reliance|ril)\b/i, symbol: 'RELIANCE.NS' },
  { match: /\b(tcs|tata consultancy)\b/i, symbol: 'TCS.NS' },
  { match: /\b(hdfc|hdfcbank)\b/i, symbol: 'HDFCBANK.NS' },
  { match: /\b(infosys|infy)\b/i, symbol: 'INFY.NS' },
  { match: /\b(nifty|nifty 50)\b/i, symbol: 'NIFTY50.NS' },
  { match: /\b(sensex|bse)\b/i, symbol: 'SENSEX.BO' },
  { match: /\b(rupee|inr|rbi)\b/i, symbol: 'USD-INR' },
  { match: /\b(euro|eur\/usd|ecb)\b/i, symbol: 'EUR-USD' },
  { match: /\b(pound|gbp|boe|sterling)\b/i, symbol: 'GBP-USD' },
  { match: /\b(yen|jpy|boj)\b/i, symbol: 'USD-JPY' },
  { match: /\b(gold|xau|bullion)\b/i, symbol: 'XAU-USD' },
  { match: /\b(silver|xag)\b/i, symbol: 'XAG-USD' },
  { match: /\b(oil|crude|wti|brent|opec)\b/i, symbol: 'WTI-USD' },
  { match: /\b(asml|tsmc|semiconductor)\b/i, symbol: 'ASML.AS' },
];

export function extractSymbols(text: string): string[] {
  const found = new Set<string>();
  for (const rule of KNOWN_SYMBOL_MAP) {
    if (rule.match.test(text)) {
      found.add(rule.symbol);
    }
  }
  if (found.size === 0) found.add('SPY');
  return Array.from(found);
}

export function inferNewsRegion(text: string, symbols: string[]): NewsItem['region'] {
  const lower = text.toLowerCase();
  if (
    symbols.some((s) => s.endsWith('.NS') || s.endsWith('.BO') || s === 'USD-INR') ||
    /\b(india|rbi|sebi|nifty|sensex|rupee|mumbai|reliance|tcs|hdfc|upi)\b/i.test(lower)
  ) {
    return 'India';
  }
  if (
    symbols.some((s) => s.endsWith('-USD') && !['EUR-USD', 'GBP-USD', 'XAU-USD', 'XAG-USD', 'WTI-USD'].includes(s)) ||
    /\b(bitcoin|ethereum|solana|crypto|defi|token|binance|coinbase)\b/i.test(lower)
  ) {
    return 'Crypto';
  }
  if (
    symbols.some((s) => s.endsWith('.L') || s.endsWith('.DE') || s.endsWith('.PA') || s.endsWith('.AS')) ||
    /\b(europe|ecb|boe|london|frankfurt|ftse|dax|eurozone)\b/i.test(lower)
  ) {
    return 'Europe';
  }
  if (
    symbols.some((s) => s.endsWith('.T') || s.endsWith('.HK') || s.endsWith('.TW')) ||
    /\b(tokyo|japan|boj|hong kong|taiwan|tsmc|nikkei|asia)\b/i.test(lower)
  ) {
    return 'Asia';
  }
  if (/\b(fed|treasury|forex|fx|dollar|gold|crude|oil|opec|inflation|yield)\b/i.test(lower)) {
    return 'Macro';
  }
  return 'US';
}

export async function fetchLiveNews(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];

  // 1. CryptoCompare Public News API
  try {
    const res = await fetch(
      'https://min-api.cryptocompare.com/data/v2/news/?lang=EN',
      { signal: AbortSignal.timeout(4500) }
    );
    if (res.ok) {
      const json = (await res.json()) as {
        Data?: Array<{
          id?: string;
          title?: string;
          body?: string;
          url?: string;
          published_on?: number;
          source_info?: { name?: string };
        }>;
      };
      if (Array.isArray(json.Data)) {
        for (const row of json.Data.slice(0, 8)) {
          const title = (row.title ?? '').trim();
          if (!title) continue;
          const body = (row.body ?? '').slice(0, 220).trim();
          const combined = `${title} ${body}`;
          const { sentiment, sentimentScore } = scoreHeadlineSentiment(combined);
          const syms = extractSymbols(combined);
          items.push({
            id: `cc-${row.id ?? Math.random().toString(36).slice(2, 9)}`,
            title,
            source: row.source_info?.name ?? 'CryptoCompare Wire',
            url: row.url ?? '#',
            publishedAt: (row.published_on ?? Math.floor(Date.now() / 1000)) * 1000,
            symbols: syms,
            region: 'Crypto',
            sentiment,
            sentimentScore,
            summary: body || title,
          });
        }
      }
    }
  } catch {
    // Outbound network may be restricted; fall through to RSS or baseline
  }

  // 2. Yahoo Finance Multi-Region RSS Feeds (US Equities + India NSE + FX/Gold/Global)
  const rssFeeds = [
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=NVDA,AAPL,MSFT,SPY,JPM,TSLA&region=US&lang=en-US',
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=RELIANCE.NS,TCS.NS,HDFCBANK.NS,EURUSD=X,GC=F,INR=X&region=IN&lang=en-IN',
  ];
  for (const feedUrl of rssFeeds) {
    try {
      const res = await fetch(feedUrl, {
        signal: AbortSignal.timeout(4500),
        headers: { 'User-Agent': 'AurexMarkets/1.0' },
      });
      if (res.ok) {
        const xml = await res.text();
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
        for (const rawItem of itemMatches.slice(0, 6)) {
          const titleMatch = rawItem.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
          const linkMatch = rawItem.match(/<link>([\s\S]*?)<\/link>/);
          const pubMatch = rawItem.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
          const descMatch = rawItem.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);

          const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? '')
            .replace(/<[^>]+>/g, '')
            .trim();
          if (!title) continue;
          const summary = (descMatch?.[1] ?? descMatch?.[2] ?? title)
            .replace(/<[^>]+>/g, '')
            .slice(0, 220)
            .trim();
          const combined = `${title} ${summary}`;
          const { sentiment, sentimentScore } = scoreHeadlineSentiment(combined);
          const parsedTime = pubMatch?.[1] ? Date.parse(pubMatch[1]) : Date.now();
          const syms = extractSymbols(combined);

          items.push({
            id: `yf-${Buffer.from(title).toString('base64').slice(0, 12)}`,
            title,
            source: 'Yahoo Finance',
            url: (linkMatch?.[1] ?? '#').trim(),
            publishedAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
            symbols: syms,
            region: inferNewsRegion(combined, syms),
            sentiment,
            sentimentScore,
            summary,
          });
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  items.sort((a, b) => b.publishedAt - a.publishedAt);
  return items;
}

export interface LiveTickCallback {
  (symbol: string, price: number, size: number, side: 'buy' | 'sell', venue: string): void;
}

export function startCoinbaseWebSocket(
  productIds: string[],
  onTick: LiveTickCallback
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    try {
      ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      ws.on('open', () => {
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            product_ids: productIds,
            channels: ['ticker'],
          })
        );
      });
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            type?: string;
            product_id?: string;
            price?: string;
            last_size?: string;
            side?: string;
          };
          if (msg.type === 'ticker' && msg.product_id && msg.price) {
            const price = Number.parseFloat(msg.price);
            const size = Number.parseFloat(msg.last_size ?? '0.05') || 0.05;
            if (Number.isFinite(price) && price > 0) {
              const side = msg.side === 'sell' ? 'sell' : 'buy';
              onTick(msg.product_id, price, size, side, 'Coinbase');
            }
          }
        } catch {
          // Ignore malformed exchange frame
        }
      });
      ws.on('error', () => {
        // Handled on close
      });
      ws.on('close', () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 10000);
        }
      });
    } catch {
      if (!closed) {
        reconnectTimer = setTimeout(connect, 15000);
      }
    }
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      ws?.close();
    } catch {
      // ignore
    }
  };
}

let yahooBatchCursor = 0;

export async function fetchMultiCryptoSnapshots(
  cryptoAssets: Array<{ symbol: string; cryptoTicker?: string }>
): Promise<Record<string, { price: number; open: number; high: number; low: number; volume: number }>> {
  const out: Record<
    string,
    { price: number; open: number; high: number; low: number; volume: number }
  > = {};

  const tickerToSymbol = new Map<string, string>();
  const tickers: string[] = [];
  for (const item of cryptoAssets) {
    if (!item.cryptoTicker) continue;
    tickerToSymbol.set(item.cryptoTicker.toUpperCase(), item.symbol);
    tickers.push(item.cryptoTicker.toUpperCase());
  }
  if (tickers.length === 0) return out;

  try {
    const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${encodeURIComponent(
      tickers.join(',')
    )}&tsyms=USD`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return out;
    const json = (await res.json()) as {
      RAW?: Record<
        string,
        {
          USD?: {
            PRICE?: number;
            OPEN24HOUR?: number;
            HIGH24HOUR?: number;
            LOW24HOUR?: number;
            VOLUME24HOUR?: number;
          };
        }
      >;
    };
    const raw = json.RAW ?? {};
    for (const [ticker, pairObj] of Object.entries(raw)) {
      const sym = tickerToSymbol.get(ticker.toUpperCase());
      const usd = pairObj?.USD;
      if (!sym || !usd || !usd.PRICE || usd.PRICE <= 0) continue;
      out[sym] = {
        price: usd.PRICE,
        open: usd.OPEN24HOUR ?? usd.PRICE,
        high: usd.HIGH24HOUR ?? usd.PRICE,
        low: usd.LOW24HOUR ?? usd.PRICE,
        volume: usd.VOLUME24HOUR ?? 100_000,
      };
    }
  } catch {
    // Graceful reference-feed fallback
  }

  return out;
}

export async function fetchEquityAndFxSnapshots(
  symbols: Array<{ symbol: string; yahooSymbol: string }>
): Promise<Record<string, { price: number; open: number; high: number; low: number; volume: number }>> {
  const out: Record<
    string,
    { price: number; open: number; high: number; low: number; volume: number }
  > = {};

  // Rotate through slices of 18 global equity/commodity symbols per cycle so 100+ instruments stay fresh without rate-limit spikes
  const batchSize = 18;
  const slice: Array<{ symbol: string; yahooSymbol: string }> = [];
  if (symbols.length > 0) {
    for (let i = 0; i < Math.min(batchSize, symbols.length); i++) {
      slice.push(symbols[(yahooBatchCursor + i) % symbols.length]);
    }
    yahooBatchCursor = (yahooBatchCursor + batchSize) % symbols.length;
  }

  await Promise.all(
    slice.map(async ({ symbol, yahooSymbol }) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            yahooSymbol
          )}?range=1d&interval=1m`,
          {
            signal: AbortSignal.timeout(4000),
            headers: { 'User-Agent': 'MeridianMarkets/1.0' },
          }
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          chart?: {
            result?: Array<{
              meta?: {
                regularMarketPrice?: number;
                chartPreviousClose?: number;
                regularMarketDayHigh?: number;
                regularMarketDayLow?: number;
                regularMarketVolume?: number;
              };
            }>;
          };
        };
        const meta = json.chart?.result?.[0]?.meta;
        if (meta && typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0) {
          out[symbol] = {
            price: meta.regularMarketPrice,
            open: meta.chartPreviousClose ?? meta.regularMarketPrice,
            high: meta.regularMarketDayHigh ?? meta.regularMarketPrice,
            low: meta.regularMarketDayLow ?? meta.regularMarketPrice,
            volume: meta.regularMarketVolume ?? 1_000_000,
          };
        }
      } catch {
        // Fallback smoothly if blocked
      }
    })
  );

  // Comprehensive Frankfurter FX basket (derives all G10 & INR crosses in one request)
  try {
    const fxRes = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD,CAD,NZD,INR,CNY,SGD,MXN,ZAR',
      { signal: AbortSignal.timeout(3500) }
    );
    if (fxRes.ok) {
      const fx = (await fxRes.json()) as { rates?: Record<string, number> };
      const r = fx.rates ?? {};
      const setFx = (sym: string, val: number, vol: number) => {
        if (Number.isFinite(val) && val > 0 && !out[sym]) {
          out[sym] = { price: val, open: val, high: val * 1.0018, low: val * 0.9982, volume: vol };
        }
      };
      if (r.EUR) setFx('EUR-USD', Number((1 / r.EUR).toFixed(5)), 485_000_000);
      if (r.GBP) setFx('GBP-USD', Number((1 / r.GBP).toFixed(5)), 295_000_000);
      if (r.JPY) setFx('USD-JPY', Number(r.JPY.toFixed(3)), 410_000_000);
      if (r.CHF) setFx('USD-CHF', Number(r.CHF.toFixed(5)), 185_000_000);
      if (r.AUD) setFx('AUD-USD', Number((1 / r.AUD).toFixed(5)), 215_000_000);
      if (r.CAD) setFx('USD-CAD', Number(r.CAD.toFixed(5)), 198_000_000);
      if (r.NZD) setFx('NZD-USD', Number((1 / r.NZD).toFixed(5)), 112_000_000);
      if (r.INR) setFx('USD-INR', Number(r.INR.toFixed(4)), 310_000_000);
      if (r.CNY) setFx('USD-CNH', Number(r.CNY.toFixed(4)), 260_000_000);
      if (r.SGD) setFx('USD-SGD', Number(r.SGD.toFixed(4)), 142_000_000);
      if (r.MXN) setFx('USD-MXN', Number(r.MXN.toFixed(4)), 188_000_000);
      if (r.ZAR) setFx('USD-ZAR', Number(r.ZAR.toFixed(4)), 96_000_000);
      if (r.EUR && r.GBP) setFx('EUR-GBP', Number((r.GBP / r.EUR).toFixed(5)), 164_000_000);
      if (r.EUR && r.JPY) setFx('EUR-JPY', Number((r.JPY / r.EUR).toFixed(3)), 205_000_000);
      if (r.GBP && r.JPY) setFx('GBP-JPY', Number((r.JPY / r.GBP).toFixed(3)), 176_000_000);
      if (r.EUR && r.CHF) setFx('EUR-CHF', Number((r.CHF / r.EUR).toFixed(5)), 132_000_000);
      if (r.AUD && r.JPY) setFx('AUD-JPY', Number((r.JPY / r.AUD).toFixed(3)), 124_000_000);
      if (r.EUR && r.INR) setFx('EUR-INR', Number((r.INR / r.EUR).toFixed(4)), 92_000_000);
      if (r.GBP && r.INR) setFx('GBP-INR', Number((r.INR / r.GBP).toFixed(4)), 74_000_000);
      if (r.JPY && r.INR) setFx('JPY-INR', Number((r.INR / r.JPY).toFixed(4)), 48_000_000);
    }
  } catch {
    // ignore
  }

  return out;
}
