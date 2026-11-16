import { useState } from 'react';
import type { OrderBook, TradeTapeItem } from '../types/market';
import { formatPrice, formatTimeShort } from '../utils/format';

interface OrderBookPanelProps {
  symbol: string;
  orderBook: OrderBook | null;
  recentTrades: TradeTapeItem[];
  guideMode?: boolean;
  onSelectPrice: (price: number) => void;
}

export function OrderBookPanel({
  symbol,
  orderBook,
  recentTrades,
  guideMode = false,
  onSelectPrice,
}: OrderBookPanelProps) {
  const [tab, setTab] = useState<'book' | 'tape'>('book');

  const asks = orderBook ? [...orderBook.asks].slice(0, 9).reverse() : [];
  const bids = orderBook ? orderBook.bids.slice(0, 9) : [];
  const maxTotal = Math.max(
    asks[0]?.total ?? 1,
    bids[bids.length - 1]?.total ?? 1,
    1
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-md">
          <button
            type="button"
            onClick={() => setTab('book')}
            className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
              tab === 'book'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Order Book
          </button>
          <button
            type="button"
            onClick={() => setTab('tape')}
            className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
              tab === 'tape'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Time & Sales
          </button>
        </div>

        {orderBook && (
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Imb{' '}
            <strong
              className={
                orderBook.imbalancePct >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {orderBook.imbalancePct > 0 ? '+' : ''}
              {orderBook.imbalancePct}%
            </strong>
          </span>
        )}
      </div>

      {guideMode && (
        <div className="px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          {tab === 'book'
            ? 'Red = sellers asking higher · Green = buyers bidding lower · Click any row to copy its price into a Limit order.'
            : 'Live feed of completed trades happening right now across the market.'}
        </div>
      )}

      {tab === 'book' ? (
        <div className="flex-1 flex flex-col text-xs font-mono tabular-nums overflow-hidden">
          <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/70">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Depth</span>
          </div>

          {/* Asks */}
          <div className="flex-1 flex flex-col justify-end overflow-hidden">
            {asks.map((level, idx) => {
              const pct = Math.min(100, (level.total / maxTotal) * 100);
              return (
                <button
                  key={`ask-${idx}-${level.price}`}
                  type="button"
                  onClick={() => onSelectPrice(level.price)}
                  className="relative grid grid-cols-3 items-center px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition-colors"
                >
                  <div
                    className="absolute inset-y-0 right-0 bg-red-500/10 pointer-events-none"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative text-red-600 dark:text-red-400">
                    {formatPrice(level.price, symbol)}
                  </span>
                  <span className="relative text-right text-slate-700 dark:text-slate-300">
                    {level.size.toFixed(2)}
                  </span>
                  <span className="relative text-right text-slate-500 dark:text-slate-400">
                    {level.total.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Spread Separator */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-900/70 border-y border-slate-200 dark:border-slate-800 text-[11px]">
            <span className="font-sans text-slate-500 dark:text-slate-400">Mid / Spread</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {orderBook ? `${formatPrice(orderBook.mid, symbol)} · ${formatPrice(orderBook.spread, symbol)}` : '—'}
            </span>
          </div>

          {/* Bids */}
          <div className="flex-1 flex flex-col justify-start overflow-hidden">
            {bids.map((level, idx) => {
              const pct = Math.min(100, (level.total / maxTotal) * 100);
              return (
                <button
                  key={`bid-${idx}-${level.price}`}
                  type="button"
                  onClick={() => onSelectPrice(level.price)}
                  className="relative grid grid-cols-3 items-center px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition-colors"
                >
                  <div
                    className="absolute inset-y-0 right-0 bg-emerald-500/10 pointer-events-none"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative text-emerald-600 dark:text-emerald-400">
                    {formatPrice(level.price, symbol)}
                  </span>
                  <span className="relative text-right text-slate-700 dark:text-slate-300">
                    {level.size.toFixed(2)}
                  </span>
                  <span className="relative text-right text-slate-500 dark:text-slate-400">
                    {level.total.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col text-xs font-mono tabular-nums overflow-y-auto">
          <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/70">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>
          {recentTrades.map((trade, idx) => (
            <div
              key={`${trade.id}-${idx}`}
              className="grid grid-cols-3 items-center px-3 py-1.5 border-b border-slate-100/60 dark:border-slate-800/40"
            >
              <span
                className={
                  trade.side === 'buy'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                {formatPrice(trade.price, symbol)}
              </span>
              <span className="text-right text-slate-700 dark:text-slate-300">
                {trade.size.toFixed(3)}
              </span>
              <span className="text-right text-slate-500 dark:text-slate-400">
                {formatTimeShort(trade.time)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
