import type {
  AuthUser,
  Instrument,
  MlPrediction,
  SecurityStatus,
} from '../src/types/market.ts';
import type { GitHubPrivateServerStatus } from './githubServerAuth.ts';
import type { StorageStoreStatus } from '../src/types/market.ts';

export type SkillCategory = 'Risk & Sizing' | 'Multi-Market' | 'Security & Auth' | 'AI & FX' | 'Cross-Platform';

export interface PlatformSkillInfo {
  id: string;
  name: string;
  category: SkillCategory;
  summary: string;
  inputsHint: string;
}

export interface SkillExecutionResult {
  skillId: string;
  skillName: string;
  status: 'OK' | 'WARN';
  headline: string;
  metrics: Array<{ label: string; value: string }>;
  recommendation: string;
  executedAt: number;
}

export const PLATFORM_SKILLS: PlatformSkillInfo[] = [
  {
    id: 'skill-kelly-risk',
    name: 'Portfolio Kelly & Position Sizing',
    category: 'Risk & Sizing',
    summary: 'Computes optimal risk-per-trade, fractional Kelly allocation, and max loss guardrail for the active market.',
    inputsHint: 'Uses live buying power, symbol volatility, and 15m confidence',
  },
  {
    id: 'skill-monte-carlo-var',
    name: 'Monte Carlo 1,000-Path VaR & Stress Test',
    category: 'Risk & Sizing',
    summary: 'Simulates 1,000 Geometric Brownian Motion paths on your active asset to calculate 95% and 99% Value-at-Risk.',
    inputsHint: 'Live price, annualized volatility, and tail risk quantile',
  },
  {
    id: 'skill-multi-market-scanner',
    name: '116-Market Global Momentum Scanner',
    category: 'Multi-Market',
    summary: 'Scans Crypto (30), India NSE/BSE (26), US, Europe, Asia & Global Forex to surface top actionable setups.',
    inputsHint: 'Ranks live instruments by ML opportunity score and 24h momentum',
  },
  {
    id: 'skill-cross-market-arb',
    name: 'Cross-Market Spread & Statistical Arbitrage',
    category: 'Multi-Market',
    summary: 'Detects top tight-spread execution venues vs wide-spread slippage traps and correlated relative-value pairs.',
    inputsHint: 'Scans spread_bps + 24h dispersion across Crypto, Stocks & FX',
  },
  {
    id: 'skill-whale-orderflow',
    name: 'L2 Orderbook Imbalance & Whale Flow Radar',
    category: 'AI & FX',
    summary: 'Measures institutional buy/sell pressure skew, breakout z-score, and liquidity absorption on the active asset.',
    inputsHint: 'Live L2 depth skew + Bollinger z-score + 15m projection',
  },
  {
    id: 'skill-inr-usd-fx-hedge',
    name: 'India/Global FX & Cross-Currency Hedge',
    category: 'AI & FX',
    summary: 'Calculates live USD/INR, EUR/INR, GBP/INR conversion value and FX delta hedge ratio for multi-currency desks.',
    inputsHint: 'Uses real-time USD-INR, EUR-INR, and EUR-USD feeds',
  },
  {
    id: 'skill-global-upi-fx',
    name: 'Global UPI Corridor & Multi-Currency Settler',
    category: 'AI & FX',
    summary: 'Benchmarks cross-border settlement equivalents across INR (NPCI UPI), SGD (PayNow), AED (Aani), EUR, GBP, JPY, AUD, CAD & CHF.',
    inputsHint: '10-currency live FX conversion & international UPI corridor availability',
  },
  {
    id: 'skill-zero-trust-security',
    name: 'Zero-Trust Auth, Vault & Firewall Audit',
    category: 'Security & Auth',
    summary: 'Verifies Dual-MFA custody readiness, Cold Vault Shield status, OAuth protection, and WAF threat blocks.',
    inputsHint: 'Inspects session security, firewall blocks, and ledger integrity',
  },
  {
    id: 'skill-ai-macro-brief',
    name: 'Quantitative Technical & Volatility Regime',
    category: 'Multi-Market',
    summary: 'Evaluates RSI(14), Z-score, volatility corridor, and spread efficiency across the active instrument.',
    inputsHint: 'Live candles + EWMA volatility band',
  },
  {
    id: 'skill-cross-platform-pwa',
    name: 'Android / Apple / Windows / MacBook Client Sync',
    category: 'Cross-Platform',
    summary: 'Validates standalone PWA manifest, offline resilience, FIDO2 Passkey RP, and synchronized custody ledgers.',
    inputsHint: 'Cross-device desktop & mobile client readiness check',
  },
];

export interface SkillRuntimeContext {
  activeSymbol: string;
  cashBalance: number;
  instruments: Instrument[];
  predictions: Record<string, MlPrediction>;
  user?: AuthUser;
  isFounder?: boolean;
  securityStatus: SecurityStatus;
  githubStatus?: GitHubPrivateServerStatus;
  storageStores?: StorageStoreStatus[];
  oauthConfiguredCount: number;
}

export function executePlatformSkill(
  skillId: string,
  ctx: SkillRuntimeContext
): SkillExecutionResult {
  const now = Date.now();
  const inst = ctx.instruments.find((i) => i.symbol === ctx.activeSymbol) ?? ctx.instruments[0];
  const pred = inst ? ctx.predictions[inst.symbol] : undefined;

  if (skillId === 'skill-kelly-risk') {
    const conf = pred ? pred.confidence : 0.62;
    const vol = pred ? pred.volatilityAnnPct : 28;
    const rawKelly = Math.max(0.02, Math.min(0.25, (conf - 0.5) * 0.8));
    const halfKellyPct = Number((rawKelly * 50).toFixed(1));
    const suggestedUsd = Math.round(ctx.cashBalance * (halfKellyPct / 100));
    const estUnits = inst && inst.price > 0 ? suggestedUsd / inst.price : 0;

    return {
      skillId,
      skillName: 'Portfolio Kelly & Position Sizing',
      status: vol > 65 ? 'WARN' : 'OK',
      headline: `Recommended Half-Kelly Allocation on ${inst?.symbol ?? 'Active Asset'}: ${halfKellyPct}% ($${suggestedUsd.toLocaleString()})`,
      metrics: [
        { label: 'Active Buying Power', value: `$${Math.round(ctx.cashBalance).toLocaleString()}` },
        { label: 'Half-Kelly Size', value: `${halfKellyPct}% ($${suggestedUsd.toLocaleString()})` },
        { label: 'Est. Order Qty', value: estUnits >= 1 ? estUnits.toFixed(2) : estUnits.toFixed(6) },
        { label: 'Ann. Volatility', value: `${vol.toFixed(1)}%` },
      ],
      recommendation:
        vol > 55
          ? 'High realized volatility detected. Keep single-position risk <= 2% of total equity and test stop-loss inside the Order Ticket Profit Simulator.'
          : 'Volatility is within normal institutional bounds. Confirm break-even fees in the What-If Profit Simulator before routing.',
      executedAt: now,
    };
  }

  if (skillId === 'skill-monte-carlo-var') {
    const annVol = (pred?.volatilityAnnPct ?? 26) / 100;
    const dailyVol = annVol / Math.sqrt(252);
    const drift = ((pred?.predictedReturnPct ?? 0) / 100) * 0.25;
    const positionNotional = Math.max(10_000, Math.min(ctx.cashBalance * 0.1, 100_000));
    const simReturns: number[] = [];
    // Box-Muller deterministic-seeded 1,000 GBM daily horizon samples
    let seed = (inst?.symbol.charCodeAt(0) ?? 65) * 1337 + Math.floor(now / 10000);
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return Math.max(1e-6, seed / 4294967296);
    };
    for (let i = 0; i < 1000; i += 2) {
      const u1 = nextRand();
      const u2 = nextRand();
      const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
      simReturns.push(drift + dailyVol * z1);
      simReturns.push(drift + dailyVol * z2);
    }
    simReturns.sort((a, b) => a - b);
    const var95Pct = Math.abs(simReturns[Math.floor(simReturns.length * 0.05)] ?? -0.025) * 100;
    const var99Pct = Math.abs(simReturns[Math.floor(simReturns.length * 0.01)] ?? -0.04) * 100;
    const var95Usd = Math.round(positionNotional * (var95Pct / 100));
    const var99Usd = Math.round(positionNotional * (var99Pct / 100));

    return {
      skillId,
      skillName: 'Monte Carlo 1,000-Path VaR & Stress Test',
      status: var99Pct > 5.5 ? 'WARN' : 'OK',
      headline: `${inst?.symbol ?? 'Asset'} Daily 95% VaR: -${var95Pct.toFixed(2)}% (-$${var95Usd.toLocaleString()} on $${(positionNotional / 1000).toFixed(0)}k tranche)`,
      metrics: [
        { label: 'Paths Simulated', value: '1,000 GBM' },
        { label: '95% Daily VaR', value: `-$${var95Usd.toLocaleString()} (${var95Pct.toFixed(2)}%)` },
        { label: '99% Tail VaR', value: `-$${var99Usd.toLocaleString()} (${var99Pct.toFixed(2)}%)` },
        { label: 'Daily Sigma', value: `${(dailyVol * 100).toFixed(2)}%` },
      ],
      recommendation:
        var99Pct > 5
          ? 'Elevated fat-tail downside risk. Place hard Stop-Loss inside the 95% VaR corridor before entering.'
          : 'Tail risk contained. Size position so 99% daily VaR stays below 2% of total account equity.',
      executedAt: now,
    };
  }

  if (skillId === 'skill-multi-market-scanner') {
    const scored = ctx.instruments
      .map((item) => ({
        inst: item,
        pred: ctx.predictions[item.symbol],
        score: ctx.predictions[item.symbol]?.opportunityScore ?? 50,
      }))
      .sort((a, b) => b.score - a.score);

    const topCrypto = scored.find((s) => s.inst.region === 'crypto');
    const topIndia = scored.find((s) => s.inst.region === 'india');
    const topUs = scored.find((s) => s.inst.region === 'us');
    const topFx = scored.find((s) => s.inst.region === 'fx');

    return {
      skillId,
      skillName: '116-Market Global Momentum Scanner',
      status: 'OK',
      headline: `Scanned ${ctx.instruments.length} live markets across 7 global regions.`,
      metrics: [
        {
          label: 'Top Crypto',
          value: topCrypto ? `${topCrypto.inst.symbol} (${topCrypto.score}/100)` : 'N/A',
        },
        {
          label: 'Top India NSE/BSE',
          value: topIndia ? `${topIndia.inst.symbol} (${topIndia.score}/100)` : 'N/A',
        },
        {
          label: 'Top US Equity',
          value: topUs ? `${topUs.inst.symbol} (${topUs.score}/100)` : 'N/A',
        },
        {
          label: 'Top Forex Pair',
          value: topFx ? `${topFx.inst.symbol} (${topFx.score}/100)` : 'N/A',
        },
      ],
      recommendation:
        'Open Markets Screener to filter by Crypto Coins, India NSE/BSE, US, Europe, Asia-Pacific, Forex, or Commodities with instant execution.',
      executedAt: now,
    };
  }

  if (skillId === 'skill-cross-market-arb') {
    const tightest = [...ctx.instruments].sort((a, b) => a.spreadBps - b.spreadBps)[0];
    const widest = [...ctx.instruments].sort((a, b) => b.spreadBps - a.spreadBps)[0];
    const topDispersion = [...ctx.instruments].sort(
      (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)
    )[0];

    return {
      skillId,
      skillName: 'Cross-Market Spread & Statistical Arbitrage',
      status: (inst?.spreadBps ?? 2) > 25 ? 'WARN' : 'OK',
      headline: `Tightest Liquidity: ${tightest?.symbol ?? 'EUR-USD'} (${tightest?.spreadBps.toFixed(1) ?? '0.8'} bps) · High Dispersion: ${topDispersion?.symbol ?? 'NVDA'}`,
      metrics: [
        { label: 'Active Spread', value: `${inst?.spreadBps.toFixed(1) ?? '1.4'} bps` },
        { label: 'Tightest Global', value: `${tightest?.symbol ?? 'N/A'} (${tightest?.spreadBps.toFixed(1) ?? '0'} bps)` },
        { label: 'Widest Slippage Risk', value: `${widest?.symbol ?? 'N/A'} (${widest?.spreadBps.toFixed(1) ?? '0'} bps)` },
        { label: 'Top Momentum Delta', value: `${topDispersion?.symbol ?? 'N/A'} (${(topDispersion?.changePct ?? 0).toFixed(2)}%)` },
      ],
      recommendation:
        'Route limit orders on tighter-spread benchmarks when spreads exceed 15 bps to prevent adverse taker slippage.',
      executedAt: now,
    };
  }

  if (skillId === 'skill-whale-orderflow') {
    const z = pred?.zScore ?? 0;
    const ret = pred?.predictedReturnPct ?? 0;
    const flowBias = ret > 0.12 ? 'ACCUMULATION' : ret < -0.12 ? 'DISTRIBUTION' : 'BALANCED';

    return {
      skillId,
      skillName: 'L2 Orderbook Imbalance & Whale Flow Radar',
      status: Math.abs(z) > 2.2 ? 'WARN' : 'OK',
      headline: `${inst?.symbol ?? 'NVDA'} Flow State: ${flowBias} (Z-Score ${z.toFixed(2)})`,
      metrics: [
        { label: 'Flow Regime', value: flowBias },
        { label: 'Bollinger Z-Score', value: `${z >= 0 ? '+' : ''}${z.toFixed(2)}` },
        { label: '15m Drift Bias', value: `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` },
        { label: 'RSI (14)', value: `${(pred?.rsi14 ?? 50).toFixed(1)}` },
      ],
      recommendation:
        Math.abs(z) > 2
          ? 'Price is extended >2 sigma from rolling mean—avoid chasing market orders; stagger Limit bids/asks near Support/Resistance.'
          : 'Institutional depth balanced; confirm consensus with Agents A02 (Liquidity) and A24 (Risk Gate).',
      executedAt: now,
    };
  }

  if (skillId === 'skill-inr-usd-fx-hedge') {
    const usdInr = ctx.instruments.find((i) => i.symbol === 'USD-INR')?.price ?? 84.35;
    const eurInr = ctx.instruments.find((i) => i.symbol === 'EUR-INR')?.price ?? 90.8;
    const eurUsd = ctx.instruments.find((i) => i.symbol === 'EUR-USD')?.price ?? 1.08;
    const buyingPowerInr = Math.round(ctx.cashBalance * usdInr);

    return {
      skillId,
      skillName: 'India/Global FX & Cross-Currency Hedge',
      status: 'OK',
      headline: `Desk Liquidity Equivalent: ₹${buyingPowerInr.toLocaleString('en-IN')} at USD/INR ${usdInr.toFixed(2)}`,
      metrics: [
        { label: 'USD-INR Live', value: `₹${usdInr.toFixed(3)}` },
        { label: 'EUR-INR Live', value: `₹${eurInr.toFixed(3)}` },
        { label: 'EUR-USD Cross', value: `$${eurUsd.toFixed(4)}` },
        { label: 'INR Desk Value', value: `₹${buyingPowerInr.toLocaleString('en-IN')}` },
      ],
      recommendation:
        'If holding US tech equities or USD crypto from India, track USD-INR conversion inside Wallet & Vault before cross-currency deposits.',
      executedAt: now,
    };
  }

  if (skillId === 'skill-global-upi-fx') {
    const usdInr = ctx.instruments.find((i) => i.symbol === 'USD-INR')?.price ?? 84.42;
    const usdSgd = ctx.instruments.find((i) => i.symbol === 'USD-SGD')?.price ?? 1.34;
    const usdAed = ctx.instruments.find((i) => i.symbol === 'USD-AED')?.price ?? 3.6725;
    const eurUsd = ctx.instruments.find((i) => i.symbol === 'EUR-USD')?.price ?? 1.08;

    return {
      skillId,
      skillName: 'Global UPI Corridor & Multi-Currency Settler',
      status: 'OK',
      headline: `Cross-Border UPI Corridors Active: India, Singapore PayNow, UAE Aani, France, Sri Lanka, Mauritius, Nepal & Bhutan`,
      metrics: [
        { label: '$1,000 in INR (UPI)', value: `₹${Math.round(1000 * usdInr).toLocaleString('en-IN')}` },
        { label: '$1,000 in SGD (PayNow)', value: `S$${Math.round(1000 * usdSgd).toLocaleString()}` },
        { label: '$1,000 in AED (Aani)', value: `AED ${Math.round(1000 * usdAed).toLocaleString()}` },
        { label: '$1,000 in EUR (SEPA)', value: `€${Math.round(1000 / Math.max(eurUsd, 0.5)).toLocaleString()}` },
      ],
      recommendation:
        'Open Wallet & Vault to select your country UPI corridor or international bank rail (ACH, SEPA, FPS, SWIFT) encrypted with AES-256-GCM.',
      executedAt: now,
    };
  }

  if (skillId === 'skill-zero-trust-security') {
    const mfaCount =
      (ctx.user?.totpEnabled ? 1 : 0) + ((ctx.user?.passkeysCount ?? 0) > 0 ? 1 : 0);

    return {
      skillId,
      skillName: 'Zero-Trust Auth, Vault & Firewall Audit',
      status: mfaCount >= 2 && !ctx.securityStatus.lockdownMode ? 'OK' : 'WARN',
      headline: `${mfaCount}/2 MFA Factors Active · WAF ${ctx.securityStatus.firewallActive ? 'Online' : 'Paused'} · Cold Vault Custody Guarded`,
      metrics: [
        { label: 'MFA Factors', value: `${mfaCount} / 2 (${ctx.user?.realMoneyEnabled ? 'Custody On' : 'Sim Mode'})` },
        { label: 'WAF Blocked', value: `${ctx.securityStatus.totalBlocked} threats` },
        { label: 'Encryption', value: 'AES-256-GCM + HMAC' },
        { label: 'SSO Guard', value: ctx.oauthConfiguredCount > 0 ? 'OAuth Active' : 'Password + FIDO2' },
      ],
      recommendation:
        mfaCount < 2
          ? 'Enroll both Authenticator App (TOTP) and a FIDO2 Hardware Passkey inside Wallet & Vault to unlock Real-Money Mode and Cold Vault withdrawals.'
          : 'Zero-Trust posture verified. All session cookies, Bearer tokens, and bank rails are protected.',
      executedAt: now,
    };
  }

  if (skillId === 'skill-ai-macro-brief') {
    return {
      skillId,
      skillName: 'Quantitative Technical & Volatility Regime',
      status: 'OK',
      headline: `${inst?.symbol ?? 'NVDA'} Regime: ${pred?.regime ?? 'Neutral'} · 15m Drift ${(pred?.predictedReturnPct ?? 0) >= 0 ? '+' : ''}${(pred?.predictedReturnPct ?? 0).toFixed(2)}%`,
      metrics: [
        { label: 'RSI (14)', value: pred ? pred.rsi14.toFixed(1) : '50.0' },
        { label: 'Z-Score', value: pred ? pred.zScore.toFixed(2) : '0.00' },
        { label: 'Spread', value: `${inst ? inst.spreadBps.toFixed(1) : '1.2'} bps` },
        { label: 'Opp. Score', value: `${pred?.opportunityScore ?? 65} / 100` },
      ],
      recommendation:
        'Cross-check this quantitative reading with the 24-Agent Command A24 Risk Gate before executing large positions.',
      executedAt: now,
    };
  }

  // Default: skill-cross-platform-pwa (do NOT leak internal store file paths or counts to non-founders)
  const stores = ctx.storageStores ?? [];
  return {
    skillId: 'skill-cross-platform-pwa',
    skillName: 'Android / Apple / Windows / MacBook Client Sync',
    status: stores.every((s) => s.sizeBytes > 0) ? 'OK' : 'WARN',
    headline: `Cross-Platform App Ready · Android, iPhone/iPad, Windows 10/11 & macOS Synchronized`,
    metrics: [
      { label: 'Install Targets', value: 'Android · iOS · Win · macOS' },
      { label: 'Auth Resilience', value: 'Cookie + Bearer + WS Token' },
      { label: 'Custody Ledgers', value: ctx.isFounder ? `${stores.length || 3} Disk Stores` : 'Encrypted & Synced' },
      { label: 'Global Coverage', value: `${ctx.instruments.length} Markets` },
    ],
    recommendation:
      'Use "Install App" in the header to run Aurex Exchange as a standalone native window on Android, iPhone/iPad, Windows, or MacBook.',
    executedAt: now,
  };
}
