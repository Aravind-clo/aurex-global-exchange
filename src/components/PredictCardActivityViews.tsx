import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Coins,
  CreditCard,
  Download,
  Lock,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react';
import type {
  ExchangeFeaturesState,
  Instrument,
  MlPrediction,
  Order,
  VaultTransferRecord,
} from '../types/market';
import { downloadCsv, formatCurrency, formatPrice, formatTimeShort } from '../utils/format';

// ---------------------------------------------------------------------------
// 1. PREDICTIONS & STAKING YIELD VIEW
// ---------------------------------------------------------------------------
interface PredictMarketsViewProps {
  cashBalance: number;
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  exchangeFeatures: ExchangeFeaturesState | null;
  onPlacePrediction: (
    contractId: string,
    direction: 'UP' | 'DOWN',
    stakeUsd: number
  ) => Promise<boolean>;
  onSettlePrediction: (betId: string) => Promise<boolean>;
  onStake: (poolId: string, amountUsd: number) => Promise<boolean>;
  onUnstake: (positionId: string) => Promise<boolean>;
  onOpenTerminal: (symbol: string) => void;
}

export function PredictMarketsView({
  cashBalance,
  instruments,
  predictions,
  exchangeFeatures,
  onPlacePrediction,
  onSettlePrediction,
  onStake,
  onUnstake,
  onOpenTerminal,
}: PredictMarketsViewProps) {
  const [stakeByContract, setStakeByContract] = useState<Record<string, string>>({});
  const [stakePoolAmount, setStakePoolAmount] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const instrumentMap = useMemo(() => {
    const m = new Map<string, Instrument>();
    for (const i of instruments) m.set(i.symbol, i);
    return m;
  }, [instruments]);

  const contracts = exchangeFeatures?.predictionContracts ?? [];
  const bets = exchangeFeatures?.predictionBets ?? [];
  const pools = exchangeFeatures?.stakingPools ?? [];
  const stakingPositions = exchangeFeatures?.stakingPositions ?? [];

  const handlePredict = async (contractId: string, direction: 'UP' | 'DOWN') => {
    const raw = stakeByContract[contractId] ?? '50';
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount) || amount < 5) return;
    setBusyId(`${contractId}-${direction}`);
    await onPlacePrediction(contractId, direction, amount);
    setBusyId(null);
  };

  const handleStake = async (poolId: string) => {
    const raw = stakePoolAmount[poolId] ?? '250';
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBusyId(poolId);
    await onStake(poolId, amount);
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Strip */}
      <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#F59E0B]" />
            <span>5-Min Predictions &amp; Validator Staking Yield</span>
          </h1>
          <p className="text-xs text-[#8B919E] mt-0.5">
            Directional short-horizon Up/Down contracts marked live against institutional WebSocket prices, paired with flexible asset staking up to 6.0% APY.
          </p>
        </div>
        <div className="text-right font-mono tabular-nums">
          <div className="text-[11px] font-sans text-[#8B919E]">Available Cash</div>
          <div className="text-base font-bold text-[#F59E0B]">{formatCurrency(cashBalance)}</div>
        </div>
      </div>

      {/* Prediction Contracts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contracts.map((contract) => {
          const inst = instrumentMap.get(contract.symbol);
          const aiPred = predictions[contract.symbol];
          const stakeVal = stakeByContract[contract.id] ?? '50';
          return (
            <div
              key={contract.id}
              className="bg-[#090A0D] border border-[#24262C] hover:border-[#F59E0B]/40 rounded-2xl p-5 space-y-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-[#F59E0B] uppercase tracking-wider">
                    {contract.category} · {contract.horizonLabel}
                  </div>
                  <h2 className="text-base font-semibold text-white mt-0.5">{contract.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenTerminal(contract.symbol)}
                  className="text-right font-mono tabular-nums hover:opacity-80"
                >
                  <div className="text-sm font-bold text-white">
                    {inst ? formatPrice(inst.price, contract.symbol) : '—'}
                  </div>
                  <div
                    className={`text-[11px] ${
                      (inst?.changePct ?? 0) >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                    }`}
                  >
                    {inst ? `${inst.changePct >= 0 ? '+' : ''}${inst.changePct.toFixed(2)}%` : '—'}
                  </div>
                </button>
              </div>

              {aiPred && (
                <div className="px-3 py-2 rounded-xl bg-[#121419] border border-[#24262C] flex items-center justify-between text-xs">
                  <span className="text-[#8B919E]">ML 15m Signal</span>
                  <span
                    className={`font-mono font-semibold ${
                      aiPred.predictedReturnPct >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                    }`}
                  >
                    {aiPred.direction} ({aiPred.confidence}% conf ·{' '}
                    {aiPred.predictedReturnPct >= 0 ? '+' : ''}
                    {aiPred.predictedReturnPct.toFixed(2)}%)
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8B919E] shrink-0">Stake ($):</span>
                {['25', '50', '100', '250'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setStakeByContract((prev) => ({ ...prev, [contract.id]: preset }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                      stakeVal === preset
                        ? 'bg-[#F59E0B] text-[#090A0C] font-semibold'
                        : 'bg-[#171920] text-[#D1D5DB] hover:bg-[#22252F]'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
                <input
                  type="number"
                  min={5}
                  max={50000}
                  value={stakeVal}
                  onChange={(e) =>
                    setStakeByContract((prev) => ({ ...prev, [contract.id]: e.target.value }))
                  }
                  aria-label={`Stake USD for ${contract.title}`}
                  className="w-20 px-2.5 py-1 rounded-lg bg-[#121419] border border-[#2B3139] text-xs font-mono text-white text-right tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void handlePredict(contract.id, 'UP')}
                  className="min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl bg-[#0ECB81] hover:bg-[#0bb572] text-[#090A0C] text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Up ({contract.upOddsMultiplier.toFixed(2)}x)</span>
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void handlePredict(contract.id, 'DOWN')}
                  className="min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl bg-[#F6465D] hover:bg-[#e0384e] text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Down ({contract.downOddsMultiplier.toFixed(2)}x)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live & Settled Prediction Positions */}
      <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#24262C] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Your Prediction Positions</h3>
          <span className="text-xs font-mono text-[#8B919E]">{bets.length} Contracts</span>
        </div>
        <div className="divide-y divide-[#1B1D24]">
          {bets.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8B919E]">
              No active prediction positions yet. Select Up or Down on any 5-min contract above.
            </div>
          ) : (
            bets.map((bet) => {
              const pos = bet.unrealizedPnlUsd >= 0;
              return (
                <div
                  key={bet.id}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>{bet.title}</span>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          bet.direction === 'UP' ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                        }`}
                      >
                        {bet.direction}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-[#8B919E] tabular-nums">
                      Entry {bet.entryPrice} → Mark {bet.currentPrice} · Stake{' '}
                      {formatCurrency(bet.stakeUsd)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 font-mono tabular-nums">
                    <div className="text-right">
                      <div className={`font-bold ${pos ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                        {pos ? '+' : '-'}${Math.abs(bet.unrealizedPnlUsd).toFixed(2)} (
                        {pos ? '+' : ''}
                        {bet.unrealizedPnlPct.toFixed(2)}%)
                      </div>
                      <div className="text-[10px] text-[#8B919E]">{bet.status}</div>
                    </div>
                    {bet.status === 'OPEN' && (
                      <button
                        type="button"
                        disabled={busyId === bet.id}
                        onClick={async () => {
                          setBusyId(bet.id);
                          await onSettlePrediction(bet.id);
                          setBusyId(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] font-sans font-semibold whitespace-nowrap"
                      >
                        Settle &amp; Collect
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Validator & Treasury Staking Pools */}
      <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-white">Flexible Staking Yield Vaults</h3>
          </div>
          <span className="text-xs text-[#8B919E]">Instant unstake · Rewards accrued per second</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className="p-4 rounded-xl bg-[#121419] border border-[#24262C] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{pool.assetName}</div>
                  <div className="text-[11px] text-[#8B919E]">{pool.lockTermLabel}</div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-base font-bold text-[#0ECB81]">
                    {pool.apyPct.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-[#8B919E]">APY</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={pool.minStakeUsd}
                  value={stakePoolAmount[pool.id] ?? '250'}
                  onChange={(e) =>
                    setStakePoolAmount((prev) => ({ ...prev, [pool.id]: e.target.value }))
                  }
                  aria-label={`Stake amount for ${pool.assetName}`}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#090A0D] border border-[#2B3139] text-xs font-mono text-white tabular-nums"
                />
                <button
                  type="button"
                  disabled={busyId === pool.id}
                  onClick={() => void handleStake(pool.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Stake
                </button>
              </div>
            </div>
          ))}
        </div>

        {stakingPositions.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="text-xs font-semibold text-[#D1D5DB]">Active Staking Positions</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {stakingPositions.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#14161D] border border-[#24262C] text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {sp.assetName} · {sp.apyPct.toFixed(1)}% APY
                    </div>
                    <div className="font-mono text-[11px] text-[#0ECB81] tabular-nums">
                      Principal {formatCurrency(sp.amountUsd)} · Accrued +
                      {formatCurrency(sp.accruedRewardUsd)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onUnstake(sp.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#23262F] hover:bg-[#2F333F] text-white font-medium whitespace-nowrap"
                  >
                    Redeem
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. AUREX SOVEREIGN METAL CARD VIEW
// ---------------------------------------------------------------------------
interface AurexCardViewProps {
  cashBalance: number;
  exchangeFeatures: ExchangeFeaturesState | null;
  onToggleFreeze: (frozen: boolean) => Promise<boolean>;
  onUpdateConfig: (cfg: {
    cashbackAsset?: 'BTC' | 'SOL' | 'USDT';
    dailyLimitUsd?: number;
  }) => Promise<boolean>;
  onSpend: (merchant: string, category: string, amountUsd: number) => Promise<boolean>;
}

export function AurexCardView({
  cashBalance,
  exchangeFeatures,
  onToggleFreeze,
  onUpdateConfig,
  onSpend,
}: AurexCardViewProps) {
  const card = exchangeFeatures?.cardProfile;
  const [merchant, setMerchant] = useState('Cloud Compute Terminal');
  const [category, setCategory] = useState('Infrastructure');
  const [amount, setAmount] = useState('125');
  const [busy, setBusy] = useState(false);

  const handleCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) return;
    setBusy(true);
    await onSpend(merchant.trim() || 'Global Merchant', category, num);
    setBusy(false);
  };

  if (!card) {
    return (
      <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-6 text-xs text-[#8B919E]">
        Loading Aurex Sovereign Card telemetry…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Visual Amber Metal Debit Card */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className={`relative rounded-2xl p-6 border overflow-hidden transition-all ${
              card.frozen
                ? 'bg-[#121318] border-[#F6465D]/50 opacity-85'
                : 'bg-gradient-to-br from-[#231B0E] via-[#121318] to-[#08090C] border-[#F59E0B]/50 shadow-2xl'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#F59E0B]">
                AUREX · {card.tier}
              </span>
              <span
                className={`text-[11px] font-mono font-semibold ${
                  card.frozen ? 'text-[#F6465D]' : 'text-[#0ECB81]'
                }`}
              >
                {card.frozen ? 'FROZEN' : 'ACTIVE'}
              </span>
            </div>

            <div className="mt-8 mb-6 font-mono text-xl sm:text-2xl tracking-[0.2em] text-white font-semibold tabular-nums">
              5412 •••• {card.cardNumberMasked.replace('•••• ', '')}
            </div>

            <div className="flex items-end justify-between text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8B919E]">
                  Cardholder
                </div>
                <div className="font-semibold text-white mt-0.5">{card.holderName}</div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-[10px] font-sans uppercase tracking-wider text-[#8B919E]">
                  Rewards Rate
                </div>
                <div className="font-semibold text-[#0ECB81] mt-0.5">
                  {card.cashbackRatePct.toFixed(1)}% in {card.cashbackAsset}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8B919E]">Backing Spend Balance</span>
              <span className="font-mono font-bold text-white tabular-nums">
                {formatCurrency(cashBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8B919E]">Daily Spend Progress</span>
              <span className="font-mono text-white tabular-nums">
                {formatCurrency(card.spentTodayUsd)} / {formatCurrency(card.dailyLimitUsd)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8B919E]">Lifetime Crypto Cashback</span>
              <span className="font-mono font-semibold text-[#0ECB81] tabular-nums">
                +{formatCurrency(card.totalCashbackEarnedUsd)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void onToggleFreeze(!card.frozen)}
              className={`w-full min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                card.frozen
                  ? 'bg-[#0ECB81] hover:bg-[#0bb572] text-[#090A0C]'
                  : 'bg-[#1D2028] hover:bg-[#272B35] text-[#F6465D] border border-[#F6465D]/30'
              }`}
            >
              {card.frozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{card.frozen ? 'Unfreeze Debit Card' : 'Instant Freeze Card'}</span>
            </button>
          </div>
        </div>

        {/* Configuration & Live Authorization Simulator */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Cashback Reward &amp; Spend Controls</h2>
              <ShieldCheck className="w-4 h-4 text-[#0ECB81]" />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { asset: 'BTC', rate: '2.5% Back' },
                  { asset: 'SOL', rate: '3.0% Back' },
                  { asset: 'USDT', rate: '2.0% Back' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.asset}
                  type="button"
                  onClick={() => void onUpdateConfig({ cashbackAsset: opt.asset })}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    card.cashbackAsset === opt.asset
                      ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-white'
                      : 'bg-[#121419] border-[#24262C] text-[#9CA3AF] hover:border-[#3A3F4B]'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{opt.asset}</div>
                  <div className="text-[11px] text-[#0ECB81] mt-0.5">{opt.rate}</div>
                </button>
              ))}
            </div>

            <form onSubmit={handleCharge} className="pt-2 border-t border-[#1D2028] space-y-3">
              <div className="text-xs font-semibold text-white">Authorize Live Card Payment</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Merchant name"
                  className="px-3 py-2 rounded-xl bg-[#121419] border border-[#24262C] text-xs text-white"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#121419] border border-[#24262C] text-xs text-white"
                >
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Travel">Travel</option>
                  <option value="Retail">Retail</option>
                  <option value="Dining">Dining</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#121419] border border-[#24262C] text-xs font-mono text-white tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#F0B90B] text-[#090A0C] text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {busy ? 'Authorizing…' : `Pay & Earn ${card.cashbackRatePct.toFixed(1)}% ${card.cashbackAsset}`}
              </button>
            </form>
          </div>

          <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#24262C] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Recent Card Authorizations</h3>
              <CreditCard className="w-4 h-4 text-[#8B919E]" />
            </div>
            <div className="divide-y divide-[#1B1D24]">
              {card.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{tx.merchant}</div>
                    <div className="text-[11px] text-[#8B919E]">
                      {tx.category} · {formatTimeShort(tx.createdAt)}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-semibold text-white">-{formatCurrency(tx.amountUsd)}</div>
                    <div
                      className={`text-[11px] ${
                        tx.status === 'DECLINED_FROZEN' ? 'text-[#F6465D]' : 'text-[#0ECB81]'
                      }`}
                    >
                      {tx.status === 'DECLINED_FROZEN'
                        ? 'DECLINED (FROZEN)'
                        : `+${formatCurrency(tx.cashbackUsd)} ${tx.cashbackAsset}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. UNIFIED EXCHANGE ACTIVITY LEDGER VIEW
// ---------------------------------------------------------------------------
interface ExchangeActivityViewProps {
  orders: Order[];
  vaultTransfers: VaultTransferRecord[];
  exchangeFeatures: ExchangeFeaturesState | null;
  onOpenTerminal: (symbol: string) => void;
}

interface UnifiedActivityRow {
  id: string;
  kind: 'Trade' | 'Prediction' | 'Staking' | 'Card' | 'Vault';
  title: string;
  subtitle: string;
  amountLabel: string;
  status: string;
  timestamp: number;
  positive: boolean;
  symbol?: string;
}

export function ExchangeActivityView({
  orders,
  vaultTransfers,
  exchangeFeatures,
  onOpenTerminal,
}: ExchangeActivityViewProps) {
  const [filterKind, setFilterKind] = useState<
    'All' | 'Trade' | 'Prediction' | 'Staking' | 'Card' | 'Vault'
  >('All');

  const rows = useMemo<UnifiedActivityRow[]>(() => {
    const out: UnifiedActivityRow[] = [];

    for (const o of orders) {
      out.push({
        id: `ord-${o.id}`,
        kind: 'Trade',
        title: `${o.side.toUpperCase()} ${o.symbol}`,
        subtitle: `${o.type.toUpperCase()} · Qty ${o.size} @ ${formatPrice(o.price, o.symbol)}`,
        amountLabel: formatCurrency(o.notional),
        status: o.status.toUpperCase(),
        timestamp: o.updatedAt || o.createdAt,
        positive: o.side === 'buy',
        symbol: o.symbol,
      });
    }

    for (const vt of vaultTransfers) {
      const isDepositOrUnlock = vt.type === 'deposit' || vt.type === 'vault_unlock';
      out.push({
        id: `vt-${vt.id}`,
        kind: 'Vault',
        title: `${vt.type.replace('_', ' ').toUpperCase()} · ${vt.bankLabel}`,
        subtitle: `${vt.currency} · HMAC Verified`,
        amountLabel: `${isDepositOrUnlock ? '+' : '-'}${formatCurrency(vt.amountUsd)}`,
        status: vt.status.toUpperCase(),
        timestamp: vt.createdAt,
        positive: isDepositOrUnlock,
      });
    }

    for (const pb of exchangeFeatures?.predictionBets ?? []) {
      out.push({
        id: `pb-${pb.id}`,
        kind: 'Prediction',
        title: pb.title,
        subtitle: `${pb.direction} · Entry ${pb.entryPrice}`,
        amountLabel: `${pb.unrealizedPnlUsd >= 0 ? '+' : ''}${formatCurrency(pb.unrealizedPnlUsd)}`,
        status: pb.status,
        timestamp: pb.createdAt,
        positive: pb.unrealizedPnlUsd >= 0,
        symbol: pb.symbol,
      });
    }

    for (const sp of exchangeFeatures?.stakingPositions ?? []) {
      out.push({
        id: `sp-${sp.id}`,
        kind: 'Staking',
        title: `Stake ${sp.assetName}`,
        subtitle: `${sp.apyPct.toFixed(1)}% APY · Accrued +${formatCurrency(sp.accruedRewardUsd)}`,
        amountLabel: formatCurrency(sp.amountUsd),
        status: 'EARNING',
        timestamp: sp.stakedAt,
        positive: true,
        symbol: sp.symbol,
      });
    }

    for (const tx of exchangeFeatures?.cardProfile.transactions ?? []) {
      out.push({
        id: `cd-${tx.id}`,
        kind: 'Card',
        title: tx.merchant,
        subtitle: `${tx.category} · Cashback +${formatCurrency(tx.cashbackUsd)} ${tx.cashbackAsset}`,
        amountLabel: `-${formatCurrency(tx.amountUsd)}`,
        status: tx.status,
        timestamp: tx.createdAt,
        positive: tx.status === 'COMPLETED',
      });
    }

    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [exchangeFeatures, orders, vaultTransfers]);

  const filtered = useMemo(
    () => (filterKind === 'All' ? rows : rows.filter((r) => r.kind === filterKind)),
    [filterKind, rows]
  );

  const exportCsv = () => {
    downloadCsv(
      `aurex-activity-${Date.now()}.csv`,
      filtered.map((r) => ({
        Time: new Date(r.timestamp).toISOString(),
        Category: r.kind,
        Title: r.title,
        Details: r.subtitle,
        Amount: r.amountLabel,
        Status: r.status,
      }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-[#F59E0B]" />
          <div>
            <h1 className="text-base font-semibold text-white">Unified Exchange Activity Ledger</h1>
            <p className="text-xs text-[#8B919E]">
              Complete chronological audit feed of trades, predictions, staking yields, metal card charges, and vault rails.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16181E] hover:bg-[#22252F] border border-[#2B3139] text-xs font-medium text-white whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(['All', 'Trade', 'Prediction', 'Staking', 'Card', 'Vault'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterKind(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              filterKind === tab
                ? 'bg-[#F59E0B] text-[#090A0C]'
                : 'bg-[#121419] text-[#8B919E] border border-[#24262C] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl divide-y divide-[#1A1C23]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8B919E]">
            No activity recorded in this category yet.
          </div>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-[#111319] transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#F59E0B]">
                    {row.kind}
                  </span>
                  {row.symbol ? (
                    <button
                      type="button"
                      onClick={() => onOpenTerminal(row.symbol!)}
                      className="font-semibold text-white hover:text-[#F59E0B] truncate"
                    >
                      {row.title}
                    </button>
                  ) : (
                    <span className="font-semibold text-white truncate">{row.title}</span>
                  )}
                </div>
                <div className="text-[11px] text-[#8B919E] mt-0.5">
                  {row.subtitle} · {formatTimeShort(row.timestamp)}
                </div>
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <div className={`font-semibold ${row.positive ? 'text-[#0ECB81]' : 'text-white'}`}>
                  {row.amountLabel}
                </div>
                <div className="text-[10px] text-[#8B919E]">{row.status}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
