import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type {
  ExchangeFeaturesState,
  Instrument,
  MlPrediction,
  Position,
} from '../types/market';
import { computePortfolioAnalyticsReport } from '../utils/quantPortfolioEngine';
import { formatCurrency } from '../utils/format';

interface HomePortfolioViewProps {
  accountMode: 'demo' | 'real';
  cashBalance: number;
  vaultBalanceUsd: number;
  positions: Position[];
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  exchangeFeatures: ExchangeFeaturesState | null;
  onSwitchAccountMode: (mode: 'demo' | 'real') => void;
  onOpenTerminal: (symbol: string) => void;
  onNavigate: (
    target:
      | 'home'
      | 'terminal'
      | 'screener'
      | 'analytics'
      | 'predict'
      | 'card'
      | 'activity'
      | 'vault'
      | 'profile'
  ) => void;
  onStake: (poolId: string, amountUsd: number) => Promise<boolean>;
  onUnstake: (positionId: string) => Promise<boolean>;
}

function splitDollarParts(value: number): { whole: string; cents: string } {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = Math.abs(safe).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = Number(intPart).toLocaleString('en-US');
  return {
    whole: `${safe < 0 ? '-' : ''}$${formattedInt}`,
    cents: `.${decPart ?? '00'}`,
  };
}

function CryptoBadge({ symbol }: { symbol: string }) {
  const base = symbol.split('-')[0].split('.')[0];
  if (base === 'BTC') {
    return (
      <div className="w-9 h-9 rounded-full bg-[#F7931A] text-white flex items-center justify-center font-bold text-sm shrink-0">
        ₿
      </div>
    );
  }
  if (base === 'SOL') {
    return (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFA3] via-[#14F195] to-[#9945FF] text-[#090A0C] flex items-center justify-center font-bold text-xs shrink-0">
        SOL
      </div>
    );
  }
  if (base === 'ETH') {
    return (
      <div className="w-9 h-9 rounded-full bg-[#627EEA] text-white flex items-center justify-center font-bold text-xs shrink-0">
        Ξ
      </div>
    );
  }
  if (base === 'XRP') {
    return (
      <div className="w-9 h-9 rounded-xl bg-[#1A1C21] border border-[#2D3139] text-white flex items-center justify-center font-bold text-xs shrink-0">
        ✕
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#1C1E24] border border-[#2D3139] text-[#F59E0B] flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
      {base.slice(0, 4)}
    </div>
  );
}

export function HomePortfolioView({
  accountMode,
  cashBalance,
  vaultBalanceUsd,
  positions,
  instruments,
  predictions,
  exchangeFeatures,
  onSwitchAccountMode,
  onOpenTerminal,
  onNavigate,
  onStake,
  onUnstake,
}: HomePortfolioViewProps) {
  const [openCrypto, setOpenCrypto] = useState(true);
  const [openStocks, setOpenStocks] = useState(false);
  const [openStaking, setOpenStaking] = useState(false);
  const [openPredictions, setOpenPredictions] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [quickStakePoolId, setQuickStakePoolId] = useState<string | null>(null);
  const [quickStakeAmount, setQuickStakeAmount] = useState('500');
  const [stakingBusy, setStakingBusy] = useState(false);

  const instrumentMap = useMemo(() => {
    const map = new Map<string, Instrument>();
    for (const inst of instruments) map.set(inst.symbol, inst);
    return map;
  }, [instruments]);

  const cryptoHoldings = useMemo(() => {
    const fromPos = positions.filter((p) => {
      const inst = instrumentMap.get(p.symbol);
      return inst?.assetClass === 'crypto' && Math.abs(p.size) > 1e-8;
    });
    return fromPos.map((p) => {
      const inst = instrumentMap.get(p.symbol);
      return {
        symbol: p.symbol,
        name: inst?.name ?? p.symbol,
        valueUsd: Math.abs(p.marketValue),
        unrealizedPnl: p.unrealizedPnl,
        changePct: inst?.changePct ?? 0,
        apyHint: p.symbol === 'SOL-USD' ? 'Up to 6% APY' : p.symbol === 'ETH-USD' ? 'Up to 4.2% APY' : null,
      };
    });
  }, [instrumentMap, positions]);

  const stockHoldings = useMemo(() => {
    const fromPos = positions.filter((p) => {
      const inst = instrumentMap.get(p.symbol);
      return inst?.assetClass === 'equities' && Math.abs(p.size) > 1e-8;
    });
    return fromPos.map((p) => {
      const inst = instrumentMap.get(p.symbol);
      return {
        symbol: p.symbol,
        name: inst?.name ?? p.symbol,
        valueUsd: Math.abs(p.marketValue),
        unrealizedPnl: p.unrealizedPnl,
        changePct: inst?.changePct ?? 0,
      };
    });
  }, [instrumentMap, positions]);

  const stakingPositions = exchangeFeatures?.stakingPositions ?? [];
  const stakingPools = exchangeFeatures?.stakingPools ?? [];
  const openPredictionsList = useMemo(
    () => (exchangeFeatures?.predictionBets ?? []).filter((b) => b.status === 'OPEN'),
    [exchangeFeatures?.predictionBets]
  );

  const cryptoTotalUsd = useMemo(
    () => cryptoHoldings.reduce((acc, h) => acc + h.valueUsd, 0),
    [cryptoHoldings]
  );
  const stocksTotalUsd = useMemo(
    () => stockHoldings.reduce((acc, h) => acc + h.valueUsd, 0),
    [stockHoldings]
  );
  const stakingTotalUsd = useMemo(
    () => stakingPositions.reduce((acc, s) => acc + s.amountUsd + s.accruedRewardUsd, 0),
    [stakingPositions]
  );
  const predictionsTotalUsd = useMemo(
    () => openPredictionsList.reduce((acc, b) => acc + b.stakeUsd + b.unrealizedPnlUsd, 0),
    [openPredictionsList]
  );

  const otherPositionsUsd = useMemo(() => {
    return positions
      .filter((p) => {
        const cls = instrumentMap.get(p.symbol)?.assetClass;
        return cls !== 'crypto' && cls !== 'equities';
      })
      .reduce((acc, p) => acc + Math.abs(p.marketValue), 0);
  }, [instrumentMap, positions]);

  const totalPortfolioUsd = useMemo(
    () =>
      cashBalance +
      vaultBalanceUsd +
      cryptoTotalUsd +
      stocksTotalUsd +
      otherPositionsUsd +
      stakingTotalUsd +
      predictionsTotalUsd,
    [
      cashBalance,
      cryptoTotalUsd,
      otherPositionsUsd,
      predictionsTotalUsd,
      stakingTotalUsd,
      stocksTotalUsd,
      vaultBalanceUsd,
    ]
  );

  const hourlyDeltaUsd = useMemo(() => {
    const posPnl = positions.reduce((acc, p) => acc + p.unrealizedPnl, 0);
    const predPnl = openPredictionsList.reduce((acc, b) => acc + b.unrealizedPnlUsd, 0);
    const stakePnl = stakingPositions.reduce((acc, s) => acc + s.accruedRewardUsd, 0);
    return Number((posPnl + predPnl + stakePnl).toFixed(2));
  }, [openPredictionsList, positions, stakingPositions]);

  const hourlyDeltaPct = useMemo(() => {
    const base = Math.max(1, totalPortfolioUsd - hourlyDeltaUsd);
    return Number(((hourlyDeltaUsd / base) * 100).toFixed(2));
  }, [hourlyDeltaUsd, totalPortfolioUsd]);

  const quantReport = useMemo(
    () =>
      computePortfolioAnalyticsReport({
        positions,
        instruments,
        predictions,
        cashBalance,
        vaultBalanceUsd,
        accountMode,
        riskFreeRatePct: 4.25,
      }),
    [accountMode, cashBalance, instruments, positions, predictions, vaultBalanceUsd]
  );

  // Dynamic amber sparkline curve tied to live BTC + portfolio delta
  const sparkline = useMemo(() => {
    const btcChange = instrumentMap.get('BTC-USD')?.changePct ?? 1.2;
    const ethChange = instrumentMap.get('ETH-USD')?.changePct ?? 0.8;
    const seedPoints = [
      54,
      50,
      46,
      49,
      42,
      45,
      58,
      53,
      62,
      67,
      61,
      70,
      78 - Math.max(-14, Math.min(14, btcChange * 1.6)),
      73,
      62,
      55,
      42,
      31 - Math.max(-10, Math.min(10, ethChange * 1.4)),
      26,
      36,
      31,
    ];
    const width = 148;
    const height = 64;
    const min = Math.min(...seedPoints);
    const max = Math.max(...seedPoints);
    const span = Math.max(1, max - min);
    const coords = seedPoints.map((val, idx) => {
      const x = (idx / (seedPoints.length - 1)) * width;
      const y = 8 + ((max - val) / span) * (height - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePath = `M ${coords.join(' L ')}`;
    const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
    return { linePath, areaPath, width, height };
  }, [instrumentMap]);

  const equityParts = splitDollarParts(totalPortfolioUsd);
  const deltaPositive = hourlyDeltaUsd >= 0;

  const handleQuickStakeSubmit = async (poolId: string) => {
    const num = Number.parseFloat(quickStakeAmount);
    if (!Number.isFinite(num) || num <= 0) return;
    setStakingBusy(true);
    const ok = await onStake(poolId, num);
    setStakingBusy(false);
    if (ok) {
      setQuickStakePoolId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Primary Obsidian & Amber Portfolio Column (Screenshot-faithful Architecture) */}
      <div className="xl:col-span-7 bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl">
        {/* Top Portfolio Value Hero + Right Sparkline */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-medium text-[#8B919E]">Total Portfolio</div>
            <div className="flex items-baseline gap-0.5 font-sans tracking-tight tabular-nums">
              <span className="text-3xl sm:text-4xl font-bold text-white leading-none">
                {equityParts.whole}
              </span>
              <span className="text-xl sm:text-2xl font-semibold text-[#6F7582] leading-none">
                {equityParts.cents}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-1 text-xs font-medium tabular-nums">
              {deltaPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-[#0ECB81] shrink-0" />
              ) : (
                <ArrowDownLeft className="w-3.5 h-3.5 text-[#F6465D] shrink-0" />
              )}
              <span className={deltaPositive ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>
                {deltaPositive ? '+' : '-'}${Math.abs(hourlyDeltaUsd).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                ({deltaPositive ? '+' : ''}
                {hourlyDeltaPct.toFixed(2)}%)
              </span>
              <span className="text-[#8B919E]">Past hour</span>
            </div>
          </div>

          <div className="shrink-0 pt-1">
            <svg
              width={sparkline.width}
              height={sparkline.height}
              viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
              aria-label="Portfolio trajectory sparkline"
              className="overflow-visible"
            >
              <defs>
                <linearGradient id="nuvraAmberArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={sparkline.areaPath} fill="url(#nuvraAmberArea)" />
              <path
                d={sparkline.linePath}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Account Selector Bar */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountMenuOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#15171C] hover:bg-[#1B1D23] border border-[#24262C] text-xs transition-colors"
          >
            <span className="font-medium text-[#E5E7EB]">Primary</span>
            <span className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#23262F] text-[10px] font-mono font-semibold uppercase tracking-wider text-[#B4BAC6]">
                EXCHANGE · {accountMode}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8B919E]" />
            </span>
          </button>

          {accountMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 z-20 rounded-xl bg-[#14161B] border border-[#2B3139] shadow-xl p-1.5 space-y-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  onSwitchAccountMode('demo');
                  setAccountMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left ${
                  accountMode === 'demo'
                    ? 'bg-[#F59E0B]/15 text-[#F59E0B] font-semibold'
                    : 'text-[#D1D5DB] hover:bg-[#1E2128]'
                }`}
              >
                <span>Primary Paper ($1M)</span>
                <span className="font-mono">DEMO</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSwitchAccountMode('real');
                  setAccountMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left ${
                  accountMode === 'real'
                    ? 'bg-[#F59E0B]/15 text-[#F59E0B] font-semibold'
                    : 'text-[#D1D5DB] hover:bg-[#1E2128]'
                }`}
              >
                <span>Verified Live Rail</span>
                <span className="font-mono">REAL</span>
              </button>
            </div>
          )}
        </div>

        {/* Amber-Rimmed Asset Breakdown Container */}
        <div className="rounded-2xl border border-[#F59E0B]/40 bg-gradient-to-b from-[#111318] to-[#0A0B0D] p-4 sm:p-5 space-y-4">
          {/* 1. CRYPTO ACCORDION */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setOpenCrypto((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                Crypto
                {openCrypto ? (
                  <ChevronUp className="w-4 h-4 text-[#8B919E]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#8B919E]" />
                )}
              </span>
              <span className="text-sm font-semibold text-white font-mono tabular-nums">
                {formatCurrency(cryptoTotalUsd)}
              </span>
            </button>

            {openCrypto && (
              <div className="space-y-2.5 pl-0.5">
                {cryptoHoldings.length === 0 ? (
                  <div className="flex items-center justify-between py-2 text-xs text-[#8B919E]">
                    <span>No open spot crypto positions in this account.</span>
                    <button
                      type="button"
                      onClick={() => onOpenTerminal('BTC-USD')}
                      className="text-[#F59E0B] font-semibold hover:underline whitespace-nowrap"
                    >
                      Buy BTC / SOL
                    </button>
                  </div>
                ) : (
                  cryptoHoldings.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => onOpenTerminal(item.symbol)}
                      className="w-full flex items-center justify-between py-1.5 px-2 -mx-2 rounded-xl hover:bg-[#171920] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CryptoBadge symbol={item.symbol} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {item.name.replace(' / USD', '')}
                          </div>
                          {item.apyHint ? (
                            <div className="text-[11px] text-[#8B919E]">
                              {item.symbol.split('-')[0]} ·{' '}
                              <span className="text-[#0ECB81] font-medium">{item.apyHint}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#8B919E] font-mono">
                              {item.symbol}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-sm font-semibold text-white">
                          {formatCurrency(item.valueUsd)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            item.unrealizedPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                          }`}
                        >
                          {item.unrealizedPnl >= 0 ? '+' : ''}
                          {formatCurrency(item.unrealizedPnl)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-[#1E2028]" />

          {/* 2. STOCKS ACCORDION */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setOpenStocks((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                Stocks
                {openStocks ? (
                  <ChevronUp className="w-4 h-4 text-[#8B919E]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#8B919E]" />
                )}
              </span>
              <span className="text-sm font-semibold text-white font-mono tabular-nums">
                {formatCurrency(stocksTotalUsd)}
              </span>
            </button>

            {openStocks && (
              <div className="space-y-2">
                {stockHoldings.length === 0 ? (
                  <div className="flex items-center justify-between py-1 text-xs text-[#8B919E]">
                    <span>Trade NVDA, AAPL, MSFT, RELIANCE.NS &amp; global equities 24/7.</span>
                    <button
                      type="button"
                      onClick={() => onOpenTerminal('NVDA')}
                      className="text-[#F59E0B] font-semibold hover:underline whitespace-nowrap"
                    >
                      Trade Stocks
                    </button>
                  </div>
                ) : (
                  stockHoldings.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => onOpenTerminal(item.symbol)}
                      className="w-full flex items-center justify-between py-1.5 px-2 -mx-2 rounded-xl hover:bg-[#171920] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CryptoBadge symbol={item.symbol} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-[#8B919E] font-mono">{item.symbol}</div>
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-sm font-semibold text-white">
                          {formatCurrency(item.valueUsd)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            item.changePct >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                          }`}
                        >
                          {item.changePct >= 0 ? '+' : ''}
                          {item.changePct.toFixed(2)}%
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-[#1E2028]" />

          {/* 3. STAKING ACCORDION */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setOpenStaking((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                Staking
                {openStaking ? (
                  <ChevronUp className="w-4 h-4 text-[#8B919E]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#8B919E]" />
                )}
              </span>
              <span className="text-sm font-semibold text-white font-mono tabular-nums">
                {formatCurrency(stakingTotalUsd)}
              </span>
            </button>

            {openStaking && (
              <div className="space-y-2.5">
                {stakingPositions.map((sp) => (
                  <div
                    key={sp.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#14161B] border border-[#24262C]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CryptoBadge symbol={sp.symbol} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {sp.assetName} Staked
                        </div>
                        <div className="text-[11px] text-[#0ECB81] font-mono">
                          {sp.apyPct.toFixed(1)}% APY · +{formatCurrency(sp.accruedRewardUsd)} earned
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-semibold text-white tabular-nums">
                        {formatCurrency(sp.amountUsd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void onUnstake(sp.id)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#23262F] hover:bg-[#2F333F] text-white whitespace-nowrap"
                      >
                        Redeem
                      </button>
                    </div>
                  </div>
                ))}

                <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stakingPools.slice(0, 2).map((pool) => (
                    <div
                      key={pool.id}
                      className="p-2.5 rounded-xl bg-[#121419] border border-[#24262C] space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{pool.assetName}</span>
                        <span className="font-mono font-semibold text-[#0ECB81]">
                          {pool.apyPct.toFixed(1)}% APY
                        </span>
                      </div>
                      {quickStakePoolId === pool.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={pool.minStakeUsd}
                            value={quickStakeAmount}
                            onChange={(e) => setQuickStakeAmount(e.target.value)}
                            className="w-full px-2 py-1 text-xs font-mono rounded bg-[#090A0D] border border-[#2E323C] text-white"
                          />
                          <button
                            type="button"
                            disabled={stakingBusy}
                            onClick={() => void handleQuickStakeSubmit(pool.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#F59E0B] text-[#090A0C] whitespace-nowrap"
                          >
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQuickStakePoolId(pool.id)}
                          className="w-full py-1.5 text-[11px] font-semibold rounded-lg bg-[#1D2028] hover:bg-[#272B35] text-[#F59E0B] transition-colors"
                        >
                          Stake {pool.symbol.split('-')[0]}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-[#1E2028]" />

          {/* 4. PREDICTIONS ACCORDION */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setOpenPredictions((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                Predictions
                {openPredictions ? (
                  <ChevronUp className="w-4 h-4 text-[#8B919E]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#8B919E]" />
                )}
              </span>
              <span className="text-sm font-semibold text-white font-mono tabular-nums">
                {formatCurrency(predictionsTotalUsd)}
              </span>
            </button>

            {openPredictions && (
              <div className="space-y-2">
                {openPredictionsList.length === 0 ? (
                  <div className="flex items-center justify-between py-1 text-xs text-[#8B919E]">
                    <span>No active Up/Down contracts.</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('predict')}
                      className="text-[#F59E0B] font-semibold hover:underline"
                    >
                      Open Predict Markets
                    </button>
                  </div>
                ) : (
                  openPredictionsList.map((bet) => {
                    const pos = bet.unrealizedPnlUsd >= 0;
                    return (
                      <button
                        key={bet.id}
                        type="button"
                        onClick={() => onNavigate('predict')}
                        className="w-full flex items-center justify-between py-1.5 px-2 -mx-2 rounded-xl hover:bg-[#171920] transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CryptoBadge symbol={bet.symbol} />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {bet.title}
                            </div>
                            <div className="text-[11px] text-[#8B919E] font-mono">
                              {bet.direction} · Entry {bet.entryPrice}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <div className="text-sm font-semibold text-white">
                            {formatCurrency(bet.stakeUsd)}
                          </div>
                          <div className={`text-[11px] ${pos ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                            {pos ? '+' : '-'}${Math.abs(bet.unrealizedPnlUsd).toFixed(2)} (
                            {Math.abs(bet.unrealizedPnlPct).toFixed(2)}%)
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Screenshot Dual CTA Pill Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onNavigate('vault')}
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-full bg-[#222429] hover:bg-[#2C2F36] text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <ArrowLeftRight className="w-4 h-4 text-[#9CA3AF]" />
            <span>Transfer</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('terminal')}
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-full bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Buy &amp; Sell</span>
          </button>
        </div>
      </div>

      {/* Right Desk Column: Quantitative Health, Metal Card & Quick Modules */}
      <div className="xl:col-span-5 space-y-4">
        {/* Quantitative Risk Pulse linking to D3 Analytics */}
        <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Quantitative Risk &amp; Allocation Pulse
              </h2>
              <p className="text-xs text-[#8B919E]">
                Live portfolio Sharpe ratio, covariance volatility, and 95% 1D VaR.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-xs font-semibold hover:bg-[#F59E0B]/25 whitespace-nowrap shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>D3 Analytics</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
            <div className="p-3 rounded-xl bg-[#121419] border border-[#24262C]">
              <div className="font-sans text-[11px] text-[#8B919E]">Sharpe Ratio</div>
              <div
                className={`mt-1 text-lg font-bold ${
                  quantReport.sharpeRatio >= 1
                    ? 'text-[#0ECB81]'
                    : quantReport.sharpeRatio >= 0
                    ? 'text-[#F59E0B]'
                    : 'text-[#F6465D]'
                }`}
              >
                {quantReport.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#121419] border border-[#24262C]">
              <div className="font-sans text-[11px] text-[#8B919E]">Annualized Vol</div>
              <div className="mt-1 text-lg font-bold text-white">
                {quantReport.portfolioVolatilityPct.toFixed(2)}%
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#121419] border border-[#24262C]">
              <div className="font-sans text-[11px] text-[#8B919E]">95% 1-Day VaR</div>
              <div className="mt-1 text-base font-bold text-[#F6465D]">
                -{formatCurrency(quantReport.parametricVar95Usd)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#121419] border border-[#24262C]">
              <div className="font-sans text-[11px] text-[#8B919E]">Available Cash + Vault</div>
              <div className="mt-1 text-base font-bold text-white">
                {formatCurrency(cashBalance + vaultBalanceUsd)}
              </div>
            </div>
          </div>
        </div>

        {/* Amber Metal Card Summary */}
        <div className="bg-gradient-to-br from-[#1A1610] via-[#101116] to-[#090A0D] border border-[#F59E0B]/35 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F59E0B]">
              <CreditCard className="w-4 h-4" />
              <span>Nuvra {exchangeFeatures?.cardProfile.tier ?? 'Amber Sovereign'} Card</span>
            </div>
            <span className="font-mono text-xs text-[#9CA3AF]">
              {exchangeFeatures?.cardProfile.cardNumberMasked ?? '•••• 4829'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[11px] text-[#8B919E]">Instant Spend Power</div>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {formatCurrency(cashBalance)}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-[11px] font-sans text-[#8B919E]">Crypto Cashback</div>
              <div className="text-sm font-semibold text-[#0ECB81]">
                {exchangeFeatures?.cardProfile.cashbackRatePct ?? 2.5}% in{' '}
                {exchangeFeatures?.cardProfile.cashbackAsset ?? 'BTC'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('card')}
              className="flex-1 py-2 rounded-xl bg-[#1E2027] hover:bg-[#272A33] text-xs font-semibold text-white transition-colors"
            >
              Manage Card &amp; Cashback
            </button>
            <button
              type="button"
              onClick={() => onNavigate('screener')}
              className="flex-1 py-2 rounded-xl bg-[#1E2027] hover:bg-[#272A33] text-xs font-semibold text-[#F59E0B] transition-colors flex items-center justify-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Market Heatmap</span>
            </button>
          </div>
        </div>

        {/* High-Yield Pools & Prediction Quick Launch */}
        <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Coins className="w-4 h-4 text-[#F59E0B]" />
              <span>Yield &amp; 5-Min Prediction Markets</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('predict')}
              className="text-xs font-semibold text-[#F59E0B] hover:underline"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('predict')}
              className="p-3 rounded-xl bg-[#121419] hover:bg-[#191C23] border border-[#24262C] text-left space-y-1 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>XRP 5m Up/Down</span>
              </div>
              <div className="text-[11px] font-mono text-[#0ECB81]">1.92x Instant Payout</div>
            </button>
            <button
              type="button"
              onClick={() => setOpenStaking(true)}
              className="p-3 rounded-xl bg-[#121419] hover:bg-[#191C23] border border-[#24262C] text-left space-y-1 transition-colors"
            >
              <div className="text-xs font-semibold text-white">Solana Validator</div>
              <div className="text-[11px] font-mono text-[#0ECB81]">6.0% APY Flexible</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
