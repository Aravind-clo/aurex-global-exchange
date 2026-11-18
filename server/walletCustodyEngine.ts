import crypto from 'node:crypto';
import type {
  CustodyWalletSnapshot,
  CustodyWithdrawalRecord,
  FxSwapQuote,
  FxSwapRecord,
  MultiChainWalletAddress,
  WalletCurrencyBalance,
  WalletVelocityPolicy,
  WithdrawalAllowlistEntry,
} from '../src/types/market.ts';
import { checkThreatReputation, fetchFrankfurterFxRates } from './publicApisHub.ts';
import { sanitizePlainText } from './securityFirewall.ts';

type SupportedChain = MultiChainWalletAddress['chain'];

interface ChainMeta {
  chain: SupportedChain;
  chainName: string;
  assetSymbol: string;
  minDepositNative: string;
  confirmationsRequired: number;
  initialBalanceNative: number;
}

const CHAIN_CONFIGS: ChainMeta[] = [
  { chain: 'BTC', chainName: 'Bitcoin SegWit', assetSymbol: 'BTC', minDepositNative: '0.0002 BTC', confirmationsRequired: 2, initialBalanceNative: 0.145 },
  { chain: 'ETH', chainName: 'Ethereum Mainnet', assetSymbol: 'ETH', minDepositNative: '0.005 ETH', confirmationsRequired: 12, initialBalanceNative: 2.85 },
  { chain: 'SOL', chainName: 'Solana SPL', assetSymbol: 'SOL', minDepositNative: '0.05 SOL', confirmationsRequired: 32, initialBalanceNative: 24.5 },
  { chain: 'ARB', chainName: 'Arbitrum One', assetSymbol: 'ETH', minDepositNative: '0.002 ETH', confirmationsRequired: 12, initialBalanceNative: 0.92 },
  { chain: 'BASE', chainName: 'Base Mainnet', assetSymbol: 'ETH', minDepositNative: '0.002 ETH', confirmationsRequired: 12, initialBalanceNative: 0.65 },
  { chain: 'MATIC', chainName: 'Polygon PoS', assetSymbol: 'MATIC', minDepositNative: '10 MATIC', confirmationsRequired: 64, initialBalanceNative: 1450 },
  { chain: 'TRX', chainName: 'TRON TRC-20', assetSymbol: 'TRX', minDepositNative: '15 TRX', confirmationsRequired: 20, initialBalanceNative: 4200 },
];

interface UserCustodyState {
  ownerId: string;
  chainAddresses: Record<SupportedChain, string>;
  currencyBalances: Record<string, number>;
  allowlist: WithdrawalAllowlistEntry[];
  velocityPolicy: WalletVelocityPolicy;
  fxSwaps: FxSwapRecord[];
  withdrawals: CustodyWithdrawalRecord[];
  updatedAt: number;
}

const custodyStore = new Map<string, UserCustodyState>();

function deriveDeterministicAddress(userId: string, chain: SupportedChain): string {
  const hash = crypto.createHash('sha256').update(`aurex-custody-v1:${userId}:${chain}`).digest('hex');
  if (chain === 'BTC') {
    const bechChars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    let suffix = '';
    for (let i = 0; i < 38; i++) {
      const byte = parseInt(hash.slice((i * 2) % 60, ((i * 2) % 60) + 2), 16);
      suffix += bechChars[byte % bechChars.length];
    }
    return `bc1q${suffix}`;
  }
  if (chain === 'ETH' || chain === 'ARB' || chain === 'BASE' || chain === 'MATIC') {
    return `0x${hash.slice(0, 40)}`;
  }
  if (chain === 'SOL') {
    const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let addr = '';
    for (let i = 0; i < 44; i++) {
      const byte = parseInt(hash.slice((i * 2) % 60, ((i * 2) % 60) + 2), 16);
      addr += b58[byte % b58.length];
    }
    return addr;
  }
  // TRX base58check-style address starting with T
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let tAddr = 'T';
  for (let i = 0; i < 33; i++) {
    const byte = parseInt(hash.slice((i * 2) % 60, ((i * 2) % 60) + 2), 16);
    tAddr += b58[byte % b58.length];
  }
  return tAddr;
}

function getOrCreateCustodyState(userId: string): UserCustodyState {
  const existing = custodyStore.get(userId);
  if (existing) return existing;

  const chainAddresses = {} as Record<SupportedChain, string>;
  for (const cfg of CHAIN_CONFIGS) {
    chainAddresses[cfg.chain] = deriveDeterministicAddress(userId, cfg.chain);
  }

  const created: UserCustodyState = {
    ownerId: userId,
    chainAddresses,
    currencyBalances: {
      EUR: 4500,
      GBP: 2200,
      INR: 185000,
      SGD: 3200,
      AED: 9500,
      JPY: 320000,
      BTC: 0.145,
      ETH: 2.85,
      SOL: 24.5,
      MATIC: 1450,
      TRX: 4200,
    },
    allowlist: [
      {
        id: `al-${crypto.randomBytes(3).toString('hex')}`,
        ownerId: userId,
        label: 'Ledger Hardware Cold Vault',
        chain: 'ETH',
        address: `0x${crypto.createHash('sha256').update(`cold:${userId}:eth`).digest('hex').slice(0, 40)}`,
        enabled: true,
        threatStatus: 'CLEAN',
        createdAt: Date.now() - 86_400_000 * 3,
      },
      {
        id: `al-${crypto.randomBytes(3).toString('hex')}`,
        ownerId: userId,
        label: 'Bitcoin Treasury Multisig',
        chain: 'BTC',
        address: deriveDeterministicAddress(`${userId}:cold`, 'BTC'),
        enabled: true,
        threatStatus: 'CLEAN',
        createdAt: Date.now() - 86_400_000 * 2,
      },
    ],
    velocityPolicy: {
      dailyLimitUsd: 50_000,
      singleTxLimitUsd: 15_000,
      spentLast24hUsd: 0,
      remaining24hUsd: 50_000,
      strictAllowlistOnly: true,
      updatedAt: Date.now(),
    },
    fxSwaps: [],
    withdrawals: [],
    updatedAt: Date.now(),
  };
  custodyStore.set(userId, created);
  return created;
}

export function validateChainAddress(chain: SupportedChain, address: string): boolean {
  const trimmed = address.trim();
  if (chain === 'BTC') return /^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(trimmed);
  if (chain === 'ETH' || chain === 'ARB' || chain === 'BASE' || chain === 'MATIC') {
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  }
  if (chain === 'SOL') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  if (chain === 'TRX') return /^T[a-zA-Z0-9]{33}$/.test(trimmed);
  return false;
}

function getCryptoUsdPrice(asset: string, priceLookup: (sym: string) => number | undefined): number {
  const upper = asset.toUpperCase();
  if (upper === 'BTC') return priceLookup('BTC-USD') ?? 91_500;
  if (upper === 'ETH') return priceLookup('ETH-USD') ?? 3_180;
  if (upper === 'SOL') return priceLookup('SOL-USD') ?? 195;
  if (upper === 'MATIC') return priceLookup('MATIC-USD') ?? 0.58;
  if (upper === 'TRX') return 0.24;
  return 1;
}

function get24hWithdrawalSpent(state: UserCustodyState): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return Number(
    state.withdrawals
      .filter((w) => w.status === 'BROADCASTED' && w.createdAt >= cutoff)
      .reduce((acc, w) => acc + w.amountUsd, 0)
      .toFixed(2)
  );
}

export function getCustodySnapshot(
  userId: string,
  usdCashBalance: number,
  priceLookup: (sym: string) => number | undefined,
  fxRatesPerUsd?: Record<string, number>
): CustodyWalletSnapshot {
  const state = getOrCreateCustodyState(userId);
  const rates = fxRatesPerUsd ?? { USD: 1, EUR: 0.924, GBP: 0.786, INR: 84.42, SGD: 1.34, AED: 3.6725, JPY: 153.5 };
  const spent24h = get24hWithdrawalSpent(state);
  state.velocityPolicy.spentLast24hUsd = spent24h;
  state.velocityPolicy.remaining24hUsd = Math.max(
    0,
    Number((state.velocityPolicy.dailyLimitUsd - spent24h).toFixed(2))
  );

  const chains: MultiChainWalletAddress[] = CHAIN_CONFIGS.map((cfg) => {
    const nativeBal =
      cfg.chain === 'ARB'
        ? Number(((state.currencyBalances.ETH ?? 0) * 0.24).toFixed(4))
        : cfg.chain === 'BASE'
        ? Number(((state.currencyBalances.ETH ?? 0) * 0.16).toFixed(4))
        : Number((state.currencyBalances[cfg.assetSymbol] ?? cfg.initialBalanceNative).toFixed(5));
    const unitUsd = getCryptoUsdPrice(cfg.assetSymbol, priceLookup);
    return {
      chain: cfg.chain,
      chainName: cfg.chainName,
      assetSymbol: cfg.assetSymbol,
      address: state.chainAddresses[cfg.chain],
      minDepositNative: cfg.minDepositNative,
      confirmationsRequired: cfg.confirmationsRequired,
      balanceNative: nativeBal,
      balanceUsd: Number((nativeBal * unitUsd).toFixed(2)),
    };
  });

  const currencyMeta: Array<{ code: string; label: string; kind: 'fiat' | 'crypto' }> = [
    { code: 'USD', label: 'US Dollar', kind: 'fiat' },
    { code: 'EUR', label: 'Euro', kind: 'fiat' },
    { code: 'GBP', label: 'British Pound', kind: 'fiat' },
    { code: 'INR', label: 'Indian Rupee', kind: 'fiat' },
    { code: 'SGD', label: 'Singapore Dollar', kind: 'fiat' },
    { code: 'AED', label: 'UAE Dirham', kind: 'fiat' },
    { code: 'JPY', label: 'Japanese Yen', kind: 'fiat' },
    { code: 'BTC', label: 'Bitcoin', kind: 'crypto' },
    { code: 'ETH', label: 'Ethereum', kind: 'crypto' },
    { code: 'SOL', label: 'Solana', kind: 'crypto' },
  ];

  const balances: WalletCurrencyBalance[] = currencyMeta.map((c) => {
    const bal = c.code === 'USD' ? usdCashBalance : state.currencyBalances[c.code] ?? 0;
    const usdVal =
      c.code === 'USD'
        ? bal
        : c.kind === 'crypto'
        ? bal * getCryptoUsdPrice(c.code, priceLookup)
        : bal / (rates[c.code] || 1);
    return {
      currency: c.code,
      label: c.label,
      kind: c.kind,
      balance: Number(bal.toFixed(c.kind === 'crypto' ? 5 : 2)),
      usdValue: Number(usdVal.toFixed(2)),
    };
  });

  return {
    ownerId: userId,
    chains,
    balances,
    allowlist: [...state.allowlist],
    velocityPolicy: { ...state.velocityPolicy },
    fxSwaps: state.fxSwaps.slice(0, 25),
    withdrawals: state.withdrawals.slice(0, 25),
    updatedAt: state.updatedAt,
  };
}

export async function quoteFxSwap(
  fromCurrencyRaw: string,
  toCurrencyRaw: string,
  fromAmount: number,
  priceLookup: (sym: string) => number | undefined
): Promise<FxSwapQuote> {
  const fromCurrency = sanitizePlainText(fromCurrencyRaw, 8).toUpperCase();
  const toCurrency = sanitizePlainText(toCurrencyRaw, 8).toUpperCase();
  const fxBundle = await fetchFrankfurterFxRates('USD', priceLookup);

  const unitToUsd = (code: string): number => {
    if (code === 'USD') return 1;
    if (['BTC', 'ETH', 'SOL', 'MATIC', 'TRX'].includes(code)) {
      return getCryptoUsdPrice(code, priceLookup);
    }
    const perUsd = fxBundle.rates[code];
    if (!perUsd || perUsd <= 0) {
      throw new Error(`Unsupported currency code: ${code}`);
    }
    return 1 / perUsd;
  };

  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
    throw new Error('Choose two distinct currencies for cross-currency swap.');
  }
  if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
    throw new Error('Swap amount must be greater than zero.');
  }

  const fromUsd = unitToUsd(fromCurrency);
  const toUsd = unitToUsd(toCurrency);
  const grossUsd = fromAmount * fromUsd;
  const spreadBps = ['BTC', 'ETH', 'SOL', 'MATIC', 'TRX'].includes(fromCurrency) ||
    ['BTC', 'ETH', 'SOL', 'MATIC', 'TRX'].includes(toCurrency)
    ? 12
    : 6;
  const feeUsd = Number(Math.max(0.25, grossUsd * (spreadBps / 10_000)).toFixed(2));
  const netUsd = Math.max(0, grossUsd - feeUsd);
  const rawRate = fromUsd / toUsd;
  const toAmount = Number((netUsd / toUsd).toFixed(['BTC', 'ETH', 'SOL'].includes(toCurrency) ? 6 : 2));

  return {
    fromCurrency,
    toCurrency,
    fromAmount: Number(fromAmount.toFixed(6)),
    rate: Number(rawRate.toFixed(6)),
    inverseRate: Number((1 / rawRate).toFixed(6)),
    spreadBps,
    feeUsd,
    toAmount,
    rateSource: fxBundle.source,
    expiresAt: Date.now() + 30_000,
  };
}

export async function executeFxSwap(
  userId: string,
  currentUsdCash: number,
  fromCurrencyRaw: string,
  toCurrencyRaw: string,
  fromAmount: number,
  priceLookup: (sym: string) => number | undefined
): Promise<{ swap: FxSwapRecord; updatedUsdCash: number }> {
  const state = getOrCreateCustodyState(userId);
  const quote = await quoteFxSwap(fromCurrencyRaw, toCurrencyRaw, fromAmount, priceLookup);

  const availableFrom =
    quote.fromCurrency === 'USD'
      ? currentUsdCash
      : state.currencyBalances[quote.fromCurrency] ?? 0;

  if (availableFrom < quote.fromAmount) {
    throw new Error(
      `Insufficient ${quote.fromCurrency} balance (${availableFrom.toLocaleString()} available vs ${quote.fromAmount} requested).`
    );
  }

  let updatedUsdCash = currentUsdCash;
  if (quote.fromCurrency === 'USD') {
    updatedUsdCash = Number((currentUsdCash - quote.fromAmount).toFixed(2));
  } else {
    state.currencyBalances[quote.fromCurrency] = Number(
      (availableFrom - quote.fromAmount).toFixed(6)
    );
  }

  if (quote.toCurrency === 'USD') {
    updatedUsdCash = Number((updatedUsdCash + quote.toAmount).toFixed(2));
  } else {
    state.currencyBalances[quote.toCurrency] = Number(
      ((state.currencyBalances[quote.toCurrency] ?? 0) + quote.toAmount).toFixed(6)
    );
  }

  const swap: FxSwapRecord = {
    id: `fxs-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    ownerId: userId,
    fromCurrency: quote.fromCurrency,
    toCurrency: quote.toCurrency,
    fromAmount: quote.fromAmount,
    toAmount: quote.toAmount,
    rate: quote.rate,
    feeUsd: quote.feeUsd,
    rateSource: quote.rateSource,
    status: 'SETTLED',
    createdAt: Date.now(),
  };

  state.fxSwaps.unshift(swap);
  if (state.fxSwaps.length > 50) state.fxSwaps.pop();
  state.updatedAt = Date.now();

  return { swap, updatedUsdCash };
}

export async function addAllowlistAddress(
  userId: string,
  labelRaw: string,
  chain: SupportedChain,
  addressRaw: string
): Promise<WithdrawalAllowlistEntry> {
  const state = getOrCreateCustodyState(userId);
  const label = sanitizePlainText(labelRaw, 64) || `${chain} Verified Wallet`;
  const address = sanitizePlainText(addressRaw, 128);

  if (!validateChainAddress(chain, address)) {
    throw new Error(`Invalid ${chain} destination address format.`);
  }
  if (state.allowlist.some((e) => e.chain === chain && e.address.toLowerCase() === address.toLowerCase())) {
    throw new Error(`Address is already registered in your ${chain} allowlist.`);
  }

  const threat = await checkThreatReputation(address);
  if (threat.verdict === 'BLOCKED') {
    throw new Error(`Blocked by Anti-Phishing Shield: ${threat.indicators.join('; ')}`);
  }

  const entry: WithdrawalAllowlistEntry = {
    id: `al-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    ownerId: userId,
    label,
    chain,
    address,
    enabled: true,
    threatStatus: threat.verdict,
    createdAt: Date.now(),
  };
  state.allowlist.unshift(entry);
  state.updatedAt = Date.now();
  return entry;
}

export function findAllowlistEntryOwner(entryId: string): string | null {
  for (const state of custodyStore.values()) {
    if (state.allowlist.some((a) => a.id === entryId)) {
      return state.ownerId;
    }
  }
  return null;
}

export function toggleAllowlistAddress(
  userId: string,
  entryId: string,
  enabled: boolean,
  isAdmin = false
): WithdrawalAllowlistEntry {
  const actualOwner = findAllowlistEntryOwner(entryId);
  if (!actualOwner) {
    const err = new Error('Allowlist destination not found.');
    (err as Error & { code?: string }).code = 'NOT_FOUND';
    throw err;
  }
  if (actualOwner !== userId && !isAdmin) {
    const err = new Error('Forbidden: Anti-IDOR ownership check rejected cross-tenant allowlist mutation.');
    (err as Error & { code?: string }).code = 'FORBIDDEN_IDOR';
    throw err;
  }
  const state = getOrCreateCustodyState(actualOwner);
  const entry = state.allowlist.find((e) => e.id === entryId);
  if (!entry) {
    const err = new Error('Allowlist destination not found.');
    (err as Error & { code?: string }).code = 'NOT_FOUND';
    throw err;
  }
  entry.enabled = Boolean(enabled);
  state.updatedAt = Date.now();
  return entry;
}

export function removeAllowlistAddress(
  userId: string,
  entryId: string,
  isAdmin = false
): { deletedId: string } {
  const actualOwner = findAllowlistEntryOwner(entryId);
  if (!actualOwner) {
    const err = new Error('Allowlist destination not found.');
    (err as Error & { code?: string }).code = 'NOT_FOUND';
    throw err;
  }
  if (actualOwner !== userId && !isAdmin) {
    const err = new Error('Forbidden: Anti-IDOR ownership check rejected cross-tenant allowlist deletion.');
    (err as Error & { code?: string }).code = 'FORBIDDEN_IDOR';
    throw err;
  }
  const state = getOrCreateCustodyState(actualOwner);
  state.allowlist = state.allowlist.filter((e) => e.id !== entryId);
  state.updatedAt = Date.now();
  return { deletedId: entryId };
}

export function updateVelocityPolicy(
  userId: string,
  patch: { dailyLimitUsd?: number; singleTxLimitUsd?: number; strictAllowlistOnly?: boolean }
): WalletVelocityPolicy {
  const state = getOrCreateCustodyState(userId);
  if (typeof patch.dailyLimitUsd === 'number' && Number.isFinite(patch.dailyLimitUsd)) {
    state.velocityPolicy.dailyLimitUsd = Math.min(10_000_000, Math.max(100, Math.round(patch.dailyLimitUsd)));
  }
  if (typeof patch.singleTxLimitUsd === 'number' && Number.isFinite(patch.singleTxLimitUsd)) {
    state.velocityPolicy.singleTxLimitUsd = Math.min(
      state.velocityPolicy.dailyLimitUsd,
      Math.max(50, Math.round(patch.singleTxLimitUsd))
    );
  }
  if (typeof patch.strictAllowlistOnly === 'boolean') {
    state.velocityPolicy.strictAllowlistOnly = patch.strictAllowlistOnly;
  }
  const spent24h = get24hWithdrawalSpent(state);
  state.velocityPolicy.spentLast24hUsd = spent24h;
  state.velocityPolicy.remaining24hUsd = Math.max(
    0,
    Number((state.velocityPolicy.dailyLimitUsd - spent24h).toFixed(2))
  );
  state.velocityPolicy.updatedAt = Date.now();
  state.updatedAt = Date.now();
  return { ...state.velocityPolicy };
}

export async function executeGuardedWithdrawal(
  userId: string,
  payload: { chain: SupportedChain; toAddress: string; amountNative: number },
  lockdownMode: boolean,
  priceLookup: (sym: string) => number | undefined
): Promise<CustodyWithdrawalRecord> {
  if (lockdownMode) {
    throw new Error('Emergency Lockdown is active: all on-chain withdrawals are frozen.');
  }
  const state = getOrCreateCustodyState(userId);
  const cfg = CHAIN_CONFIGS.find((c) => c.chain === payload.chain);
  if (!cfg) {
    throw new Error(`Unsupported blockchain network: ${payload.chain}`);
  }
  const toAddress = sanitizePlainText(payload.toAddress, 128);
  if (!validateChainAddress(payload.chain, toAddress)) {
    throw new Error(`Destination address failed ${payload.chain} checksum/format check.`);
  }
  const amountNative = Number(payload.amountNative);
  if (!Number.isFinite(amountNative) || amountNative <= 0) {
    throw new Error('Withdrawal amount must be positive.');
  }

  const unitUsd = getCryptoUsdPrice(cfg.assetSymbol, priceLookup);
  const amountUsd = Number((amountNative * unitUsd).toFixed(2));
  const feeUsd = Number(Math.max(0.5, amountUsd * 0.0005).toFixed(2));
  const now = Date.now();

  const threat = await checkThreatReputation(toAddress);
  if (threat.verdict === 'BLOCKED') {
    const blockedRec: CustodyWithdrawalRecord = {
      id: `wd-${now}-${crypto.randomBytes(2).toString('hex')}`,
      ownerId: userId,
      chain: payload.chain,
      assetSymbol: cfg.assetSymbol,
      toAddress,
      amountNative,
      amountUsd,
      feeUsd: 0,
      status: 'BLOCKED_THREAT',
      reason: `Blocked by Anti-Phishing Threat Engine: ${threat.indicators.join('; ')}`,
      createdAt: now,
    };
    state.withdrawals.unshift(blockedRec);
    return blockedRec;
  }

  if (state.velocityPolicy.strictAllowlistOnly) {
    const matched = state.allowlist.find(
      (e) => e.chain === payload.chain && e.address.toLowerCase() === toAddress.toLowerCase() && e.enabled
    );
    if (!matched) {
      const blockedRec: CustodyWithdrawalRecord = {
        id: `wd-${now}-${crypto.randomBytes(2).toString('hex')}`,
        ownerId: userId,
        chain: payload.chain,
        assetSymbol: cfg.assetSymbol,
        toAddress,
        amountNative,
        amountUsd,
        feeUsd: 0,
        status: 'BLOCKED_ALLOWLIST',
        reason: `Strict Allowlist Policy blocked ${payload.chain} destination not registered & enabled in Withdrawal Allowlist.`,
        createdAt: now,
      };
      state.withdrawals.unshift(blockedRec);
      return blockedRec;
    }
  }

  const spent24h = get24hWithdrawalSpent(state);
  if (
    amountUsd > state.velocityPolicy.singleTxLimitUsd ||
    spent24h + amountUsd > state.velocityPolicy.dailyLimitUsd
  ) {
    const blockedRec: CustodyWithdrawalRecord = {
      id: `wd-${now}-${crypto.randomBytes(2).toString('hex')}`,
      ownerId: userId,
      chain: payload.chain,
      assetSymbol: cfg.assetSymbol,
      toAddress,
      amountNative,
      amountUsd,
      feeUsd: 0,
      status: 'BLOCKED_VELOCITY',
      reason: `Spend Velocity Guard blocked $${amountUsd.toLocaleString()} transfer (Single Max: $${state.velocityPolicy.singleTxLimitUsd.toLocaleString()}, 24h Remaining: $${Math.max(0, state.velocityPolicy.dailyLimitUsd - spent24h).toLocaleString()}).`,
      createdAt: now,
    };
    state.withdrawals.unshift(blockedRec);
    return blockedRec;
  }

  const held = state.currencyBalances[cfg.assetSymbol] ?? 0;
  if (held < amountNative) {
    throw new Error(`Insufficient ${cfg.assetSymbol} balance (${held} available).`);
  }

  state.currencyBalances[cfg.assetSymbol] = Number((held - amountNative).toFixed(6));
  const rec: CustodyWithdrawalRecord = {
    id: `wd-${now}-${crypto.randomBytes(2).toString('hex')}`,
    ownerId: userId,
    chain: payload.chain,
    assetSymbol: cfg.assetSymbol,
    toAddress,
    amountNative,
    amountUsd,
    feeUsd,
    status: 'BROADCASTED',
    reason: 'Cleared Allowlist, Velocity Cap, and Threat Reputation checks.',
    txHash: `0x${crypto.randomBytes(16).toString('hex')}`,
    createdAt: now,
  };
  state.withdrawals.unshift(rec);
  state.updatedAt = now;
  return rec;
}
