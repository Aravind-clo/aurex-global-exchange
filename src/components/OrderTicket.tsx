import { useEffect, useRef, useState } from 'react';
import { BellPlus, Calculator, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { Instrument, MlPrediction, Position } from '../types/market';
import { formatCurrency, formatPrice } from '../utils/format';

interface OrderTicketProps {
  instrument: Instrument | undefined;
  cashBalance: number;
  accountMode: 'demo' | 'real';
  realMoneyEnabled?: boolean;
  prediction?: MlPrediction;
  position: Position | undefined;
  selectedBookPrice: number | null;
  shortcutTrigger?: { side: 'buy' | 'sell'; nonce: number } | null;
  aiTargetTrigger?: { takeProfit: number; stopLoss: number; nonce: number } | null;
  guideMode?: boolean;
  onSwitchAccountMode?: (mode: 'demo' | 'real') => Promise<{ ok: boolean; error?: string }>;
  onOpenVault?: () => void;
  onPlaceOrder: (payload: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop';
    size: number;
    price?: number;
    stopPrice?: number;
  }) => void;
  onQuickAlert: (symbol: string, targetPrice: number) => void;
}

export function OrderTicket({
  instrument,
  cashBalance,
  accountMode,
  prediction,
  position,
  selectedBookPrice,
  shortcutTrigger,
  aiTargetTrigger,
  guideMode = false,
  onSwitchAccountMode,
  onOpenVault,
  onPlaceOrder,
  onQuickAlert,
}: OrderTicketProps) {
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop' | 'oco' | 'trailing'>('market');
  const [sizeInput, setSizeInput] = useState('10');
  const [limitPriceInput, setLimitPriceInput] = useState('');
  const [stopPriceInput, setStopPriceInput] = useState('');
  const [trailPct, setTrailPct] = useState(2);

  // What-If Profit Simulator state
  const [simOpen, setSimOpen] = useState(true);
  const [simSizeInput, setSimSizeInput] = useState('10');
  const [simExitInput, setSimExitInput] = useState('');
  const [leverage, setLeverage] = useState(1);

  const priceDecimalsFor = (p: number) => (p < 0.001 ? 8 : p < 0.1 ? 6 : p >= 10 ? 2 : 4);

  useEffect(() => {
    setLeverage(instrument?.instrumentType === 'futures' ? Math.min(5, instrument.contractSpec?.maxLeverage ?? 5) : 1);
  }, [instrument?.symbol, instrument?.instrumentType, instrument?.contractSpec?.maxLeverage]);

  useEffect(() => {
    if (instrument) {
      const defaultQty =
        instrument.price < 0.001
          ? '5000000'
          : instrument.price < 0.05
          ? '10000'
          : instrument.assetClass === 'crypto' && instrument.price > 5000
          ? '0.25'
          : '25';
      setLimitPriceInput(String(instrument.price));
      setStopPriceInput(String(instrument.price));
      setSizeInput(defaultQty);
      setSimSizeInput(defaultQty);
      const targetMult = side === 'buy' ? 1.04 : 0.96;
      setSimExitInput(
        (instrument.price * targetMult).toFixed(priceDecimalsFor(instrument.price))
      );
    }
  }, [instrument?.symbol]);

  const switchSide = (nextSide: 'buy' | 'sell') => {
    setSide(nextSide);
    if (!instrument) return;
    const base =
      orderType === 'market'
        ? nextSide === 'buy'
          ? instrument.ask
          : instrument.bid
        : Number.parseFloat(limitPriceInput) || instrument.price;
    const targetMult = nextSide === 'buy' ? 1.04 : 0.96;
    setSimExitInput((base * targetMult).toFixed(priceDecimalsFor(base)));
  };

  useEffect(() => {
    if (selectedBookPrice !== null) {
      setOrderType('limit');
      setLimitPriceInput(String(selectedBookPrice));
    }
  }, [selectedBookPrice]);

  useEffect(() => {
    if (!aiTargetTrigger || !instrument) return;
    setSimOpen(true);
    setSimExitInput(aiTargetTrigger.takeProfit.toFixed(priceDecimalsFor(instrument.price)));
    setStopPriceInput(aiTargetTrigger.stopLoss.toFixed(priceDecimalsFor(instrument.price)));
  }, [aiTargetTrigger, instrument]);

  useEffect(() => {
    if (!shortcutTrigger) return;
    setSide(shortcutTrigger.side);
    if (instrument) {
      const base =
        orderType === 'market'
          ? shortcutTrigger.side === 'buy'
            ? instrument.ask
            : instrument.bid
          : Number.parseFloat(limitPriceInput) || instrument.price;
      const targetMult = shortcutTrigger.side === 'buy' ? 1.04 : 0.96;
      setSimExitInput((base * targetMult).toFixed(priceDecimalsFor(base)));
    }
    const frame = requestAnimationFrame(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [shortcutTrigger]);

  if (!instrument) {
    return (
      <div className="h-full bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4 text-sm text-slate-500">
        Select an instrument to trade.
      </div>
    );
  }

  const parsedSize = Number.parseFloat(sizeInput) || 0;
  const parsedLimit = Number.parseFloat(limitPriceInput);
  const parsedStop = Number.parseFloat(stopPriceInput);
  const trailingTriggerPrice = Number(
    (side === 'buy'
      ? instrument.price * (1 + trailPct / 100)
      : instrument.price * (1 - trailPct / 100)
    ).toFixed(priceDecimalsFor(instrument.price))
  );
  const priceInvalid =
    (orderType === 'limit' && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) ||
    (orderType === 'stop' && (!Number.isFinite(parsedStop) || parsedStop <= 0)) ||
    (orderType === 'oco' &&
      (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || !Number.isFinite(parsedStop) || parsedStop <= 0));

  const execPrice =
    orderType === 'market'
      ? side === 'buy'
        ? instrument.ask
        : instrument.bid
      : orderType === 'limit' && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : orderType === 'stop' && Number.isFinite(parsedStop) && parsedStop > 0
      ? parsedStop
      : orderType === 'oco' && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : orderType === 'trailing'
      ? trailingTriggerPrice
      : instrument.price;

  const isFutures = instrument.instrumentType === 'futures';
  const isOptions = instrument.instrumentType === 'options';
  const effectiveLeverage = isFutures ? Math.max(1, leverage) : 1;
  const estNotional = parsedSize * execPrice;
  const marginRequired = estNotional / effectiveLeverage;
  const heldLongQty = position && position.size > 0 ? position.size : 0;
  const shortOpenedQty = side === 'sell' ? Math.max(0, parsedSize - heldLongQty) : parsedSize;
  const sellShortMargin = (shortOpenedQty * execPrice * 0.5) / effectiveLeverage;
  const insufficientRealCash =
    accountMode === 'real' &&
    (side === 'buy' ? cashBalance < marginRequired : shortOpenedQty > 0 && cashBalance < sellShortMargin);
  const estFee = estNotional * 0.0004;

  // What-If Simulator Calculations
  const simSize = Math.max(0, Number.parseFloat(simSizeInput) || 0);
  const simExit = Math.max(1e-8, Number.parseFloat(simExitInput) || execPrice);
  const simMinExit = Math.max(1e-8, execPrice * 0.85);
  const simMaxExit = execPrice * 1.15;
  const simSliderStep = Math.max(1e-8, (simMaxExit - simMinExit) / 120);

  const simEntryNotional = simSize * execPrice;
  const simRoundTripFee = simEntryNotional * 0.0004 + simSize * simExit * 0.0004;
  const simGrossPnl =
    side === 'buy' ? (simExit - execPrice) * simSize : (execPrice - simExit) * simSize;
  const simNetPnl = simGrossPnl - simRoundTripFee;
  const simRoiPct = simEntryNotional > 0 ? (simNetPnl / simEntryNotional) * 100 : 0;
  const simBreakEven =
    side === 'buy' ? execPrice * (1 + 0.0008) : execPrice * (1 - 0.0008);

  const currentPosSize = position?.size ?? 0;
  const signedOrderDelta = side === 'buy' ? simSize : -simSize;
  const projectedPosSize = Number((currentPosSize + signedOrderDelta).toFixed(4));

  const applyAllocationPct = (pct: number) => {
    let nextQtyStr = '0';
    if (side === 'buy') {
      const budget = cashBalance * pct;
      const qty = budget / Math.max(execPrice, 1e-8);
      nextQtyStr = instrument.price > 1000 ? qty.toFixed(4) : instrument.price < 0.05 ? String(Math.round(qty)) : qty.toFixed(2);
    } else if (position && position.size > 0) {
      const qty = position.size * pct;
      nextQtyStr = instrument.price > 1000 ? qty.toFixed(4) : instrument.price < 0.05 ? String(Math.round(qty)) : qty.toFixed(2);
    } else {
      const qty = (cashBalance * 0.1 * pct) / Math.max(execPrice, 1e-8);
      nextQtyStr = instrument.price > 1000 ? qty.toFixed(4) : instrument.price < 0.05 ? String(Math.round(qty)) : qty.toFixed(2);
    }
    setSizeInput(nextQtyStr);
    setSimSizeInput(nextQtyStr);
  };

  const applyExitPct = (pctDelta: number) => {
    const next = execPrice * (1 + pctDelta);
    setSimExitInput(next.toFixed(priceDecimalsFor(execPrice)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedSize <= 0 || priceInvalid) return;
    if (orderType === 'oco') {
      onPlaceOrder({
        symbol: instrument.symbol,
        side,
        type: 'limit',
        size: parsedSize,
        price: parsedLimit,
      });
      onPlaceOrder({
        symbol: instrument.symbol,
        side,
        type: 'stop',
        size: parsedSize,
        stopPrice: parsedStop,
      });
      return;
    }
    if (orderType === 'trailing') {
      onPlaceOrder({
        symbol: instrument.symbol,
        side,
        type: 'stop',
        size: parsedSize,
        stopPrice: trailingTriggerPrice,
      });
      return;
    }
    onPlaceOrder({
      symbol: instrument.symbol,
      side,
      type: orderType,
      size: parsedSize,
      price: orderType === 'limit' ? parsedLimit : undefined,
      stopPrice: orderType === 'stop' ? parsedStop : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col h-full bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4 gap-3"
    >
      {/* Account Mode Bar: Demo vs Real */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2B3139]">
        <div className="flex items-center gap-1 p-0.5 rounded bg-slate-100 dark:bg-[#0B0E11] text-[11px]">
          <button
            type="button"
            onClick={() => void onSwitchAccountMode?.('demo')}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              accountMode === 'demo'
                ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                : 'text-slate-500 dark:text-[#848E9C]'
            }`}
          >
            Demo Account
          </button>
          <button
            type="button"
            onClick={() => void onSwitchAccountMode?.('real')}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              accountMode === 'real'
                ? 'bg-[#F0B90B] text-[#0B0E11]'
                : 'text-slate-500 dark:text-[#848E9C]'
            }`}
          >
            Real Account
          </button>
        </div>

        <button
          type="button"
          onClick={() => onQuickAlert(instrument.symbol, execPrice)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#D9A70A] dark:text-[#F0B90B] hover:underline whitespace-nowrap shrink-0"
        >
          <BellPlus className="w-3.5 h-3.5" />
          Alert
        </button>
      </div>

      {accountMode === 'real' && cashBalance <= 0 && (
        <div className="p-2.5 rounded-md border border-[#F0B90B]/40 bg-[#F0B90B]/10 text-[11px] flex items-center justify-between gap-2 text-slate-700 dark:text-[#EAECEF]">
          <span>Real trading balance is $0. Deposit via UPI/Bank or unlock from Cold Vault.</span>
          {onOpenVault && (
            <button
              type="button"
              onClick={onOpenVault}
              className="px-2 py-1 rounded bg-[#F0B90B] text-[#0B0E11] font-semibold whitespace-nowrap shrink-0"
            >
              Deposit
            </button>
          )}
        </div>
      )}

      {/* Buy / Sell Segmented Toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#0B0E11] rounded-lg">
        <button
          type="button"
          onClick={() => switchSide('buy')}
          className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            side === 'buy'
              ? 'bg-[#0ECB81] text-[#0B0E11]'
              : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
          }`}
        >
          Buy {instrument.symbol}
        </button>
        <button
          type="button"
          onClick={() => switchSide('sell')}
          className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            side === 'sell'
              ? 'bg-[#F6465D] text-white'
              : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
          }`}
        >
          Sell {instrument.symbol}
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="grid grid-cols-5 gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(
          [
            { id: 'market', label: 'Market' },
            { id: 'limit', label: 'Limit' },
            { id: 'stop', label: 'Stop' },
            { id: 'oco', label: 'OCO' },
            { id: 'trailing', label: 'Trail' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setOrderType(t.id)}
            className={`py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              orderType === t.id
                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isFutures && (
        <div className="p-2 rounded border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-[#848E9C]">
              Futures Leverage · {instrument.contractSpec?.expiry ?? 'Perp'}
            </span>
            <span className="font-mono font-semibold text-[#F0B90B]">{effectiveLeverage}x</span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[1, 2, 5, 10, instrument.contractSpec?.maxLeverage ?? 20]
              .filter((v, idx, arr) => arr.indexOf(v) === idx)
              .sort((a, b) => a - b)
              .map((lev) => (
                <button
                  key={lev}
                  type="button"
                  onClick={() => setLeverage(lev)}
                  className={`py-0.5 text-[10px] font-mono rounded border transition-colors ${
                    effectiveLeverage === lev
                      ? 'border-[#F0B90B] bg-[#F0B90B] text-[#0B0E11] font-semibold'
                      : 'border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#848E9C]'
                  }`}
                >
                  {lev}x
                </button>
              ))}
          </div>
        </div>
      )}

      {isOptions && instrument.contractSpec && (
        <div className="p-2 rounded border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 text-slate-700 dark:text-[#EAECEF]">
          <span>
            {instrument.contractSpec.optionRight} · Strike {instrument.contractSpec.strike}
          </span>
          <span className="text-slate-500 dark:text-[#848E9C]">
            Exp {instrument.contractSpec.expiry} · Lot {instrument.contractSpec.lotSize ?? 1}
          </span>
        </div>
      )}

      {guideMode && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          {orderType === 'market'
            ? 'Market order: buys or sells immediately at the best price available right now.'
            : orderType === 'limit'
            ? 'Limit order: waits until the market reaches your exact target price or better.'
            : orderType === 'stop'
            ? 'Stop order: activates automatically if price crosses your trigger level (used for safety exits or breakouts).'
            : orderType === 'oco'
            ? 'OCO (One-Cancels-Other): deploys both a Take-Profit Limit leg and a Stop-Loss protection leg simultaneously.'
            : 'Trailing Stop: places a dynamic % trigger distance from current market price to protect profits or capture breakouts.'}
        </p>
      )}

      {/* Price Inputs */}
      {orderType === 'limit' && (
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            Limit Price
          </label>
          <input
            type="number"
            step="any"
            value={limitPriceInput}
            onChange={(e) => setLimitPriceInput(e.target.value)}
            className="w-full px-3 py-1.5 text-sm font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {orderType === 'stop' && (
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            Stop Trigger Price
          </label>
          <input
            type="number"
            step="any"
            value={stopPriceInput}
            onChange={(e) => setStopPriceInput(e.target.value)}
            className="w-full px-3 py-1.5 text-sm font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {orderType === 'oco' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Take-Profit Limit
            </label>
            <input
              type="number"
              step="any"
              value={limitPriceInput}
              onChange={(e) => setLimitPriceInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Stop-Loss Trigger
            </label>
            <input
              type="number"
              step="any"
              value={stopPriceInput}
              onChange={(e) => setStopPriceInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      )}

      {orderType === 'trailing' && (
        <div className="p-2.5 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-[#848E9C]">Trailing Distance (%)</span>
            <span className="font-mono font-semibold text-[#F0B90B]">
              {trailPct}% · Trigger {formatPrice(trailingTriggerPrice, instrument.symbol)}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {[0.5, 1, 2, 3, 5, 8].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setTrailPct(pct)}
                className={`py-1 text-[10px] font-mono rounded border ${
                  trailPct === pct
                    ? 'border-[#F0B90B] bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#848E9C]'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>Quantity ({instrument.symbol})</span>
          <span className="font-mono tabular-nums">
            Pos: {position ? position.size : 0}
          </span>
        </div>
        <input
          ref={quantityInputRef}
          type="number"
          step="any"
          min="0"
          value={sizeInput}
          onChange={(e) => {
            setSizeInput(e.target.value);
            setSimSizeInput(e.target.value);
          }}
          className="w-full px-3 py-1.5 text-sm font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {[0.1, 0.25, 0.5, 0.75].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => applyAllocationPct(pct)}
              className="py-1 text-[11px] font-mono tabular-nums rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {pct * 100}%
            </button>
          ))}
        </div>
      </div>

      {/* What-If Profit Simulator */}
      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-2.5 space-y-2 text-xs">
        <button
          type="button"
          onClick={() => setSimOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
            <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>What-If Profit Simulator</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-semibold">
            <span
              className={
                simNetPnl >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {simNetPnl >= 0 ? '+' : ''}
              {formatCurrency(simNetPnl)}
            </span>
            {simOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </span>
        </button>

        {simOpen && (
          <div className="space-y-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
            {guideMode && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Test different exit prices or sizes before placing your trade to see exact projected profit or loss after fees.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Target Exit Price
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.00000001"
                  value={simExitInput}
                  onChange={(e) => setSimExitInput(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-mono tabular-nums rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Simulated Qty
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={simSizeInput}
                  onChange={(e) => setSimSizeInput(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-mono tabular-nums rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <input
              type="range"
              aria-label="Simulated target exit price slider"
              min={simMinExit}
              max={simMaxExit}
              step={simSliderStep}
              value={Math.min(simMaxExit, Math.max(simMinExit, simExit))}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                setSimExitInput(val.toFixed(priceDecimalsFor(execPrice)));
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />

            <div className="grid grid-cols-5 gap-1">
              {[-0.05, -0.02, 0.02, 0.05, 0.1].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyExitPct(pct)}
                  className="py-0.5 text-[10px] font-mono tabular-nums rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  {pct > 0 ? `+${pct * 100}%` : `${pct * 100}%`}
                </button>
              ))}
            </div>

            <div className="space-y-1 text-[11px] pt-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="font-sans text-slate-500 dark:text-slate-400">
                  Projected Net P&amp;L
                </span>
                <span
                  className={`font-semibold ${
                    simNetPnl >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {simNetPnl >= 0 ? '+' : ''}
                  {formatCurrency(simNetPnl)} ({simRoiPct >= 0 ? '+' : ''}
                  {simRoiPct.toFixed(2)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500 dark:text-slate-400">
                  Break-Even / Resulting Pos
                </span>
                <span className="text-slate-800 dark:text-slate-200">
                  {formatPrice(simBreakEven, instrument.symbol)} · {projectedPosSize}
                </span>
              </div>
            </div>

            {prediction && (
              <button
                type="button"
                onClick={() => {
                  setSimExitInput(
                    prediction.suggestedTakeProfit.toFixed(priceDecimalsFor(instrument.price))
                  );
                  setStopPriceInput(
                    prediction.suggestedStopLoss.toFixed(priceDecimalsFor(instrument.price))
                  );
                }}
                className="w-full py-1.5 px-2 text-[11px] font-medium rounded border border-[#F0B90B]/40 text-[#B45309] dark:text-[#F0B90B] hover:bg-[#F0B90B]/10 inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>
                  Apply AI Target ({formatPrice(prediction.suggestedTakeProfit, instrument.symbol)})
                  &amp; Stop ({formatPrice(prediction.suggestedStopLoss, instrument.symbol)})
                </span>
              </button>
            )}

            {Math.abs(simSize - parsedSize) > 1e-6 && simSize > 0 && (
              <button
                type="button"
                onClick={() => setSizeInput(simSizeInput)}
                className="w-full py-1 text-[11px] font-medium rounded border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                Apply Simulated Qty ({simSizeInput}) to Order
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pre-Trade Summary */}
      <div className="mt-auto space-y-1.5 pt-2.5 border-t border-slate-200 dark:border-[#2B3139] text-xs">
        <div className="flex justify-between text-slate-500 dark:text-[#848E9C]">
          <span>Exec Reference</span>
          <span className="font-mono tabular-nums text-slate-800 dark:text-[#EAECEF]">
            {formatPrice(execPrice, instrument.symbol)}
          </span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-[#848E9C]">
          <span>{isFutures ? `Margin Required (${effectiveLeverage}x)` : 'Estimated Notional'}</span>
          <span className="font-mono tabular-nums text-slate-800 dark:text-[#EAECEF]">
            {formatCurrency(isFutures ? marginRequired : estNotional)}
          </span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-[#848E9C]">
          <span>Est. Venue Fee (4 bps)</span>
          <span className="font-mono tabular-nums text-slate-800 dark:text-[#EAECEF]">
            {formatCurrency(estFee)}
          </span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-[#848E9C]">
          <span>{accountMode === 'demo' ? 'Demo Buying Power' : 'Real Buying Power'}</span>
          <span className="font-mono tabular-nums text-slate-900 dark:text-[#EAECEF] font-medium">
            {formatCurrency(cashBalance)}
          </span>
        </div>
      </div>

      {priceInvalid && (
        <p className="text-[11px] font-medium text-[#F6465D]">
          Enter a valid positive {orderType} price to submit this order.
        </p>
      )}

      {insufficientRealCash && !priceInvalid && (
        <p className="text-[11px] font-medium text-[#F0B90B]">
          Insufficient Real cash ({formatCurrency(cashBalance)} available). Deposit funds or reduce order size.
        </p>
      )}

      <button
        type="submit"
        disabled={parsedSize <= 0 || priceInvalid || insufficientRealCash}
        className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-40 ${
          side === 'buy'
            ? 'bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11]'
            : 'bg-[#F6465D] hover:bg-[#e0384e] text-white'
        }`}
      >
        {side === 'buy'
          ? `Buy ${instrument.symbol} (${accountMode === 'demo' ? 'Demo' : 'Real'})`
          : `Sell ${instrument.symbol} (${accountMode === 'demo' ? 'Demo' : 'Real'})`}
      </button>
    </form>
  );
}
