import type { Candle, Instrument, MarketGenesisProfile } from '../src/types/market.ts';
import type { SeedAsset } from './marketCatalog.ts';

interface CuratedGenesisSeed {
  foundedYear: number;
  foundedDate: string;
  genesisPrice: number;
  allTimeHigh: number;
  athYear: number;
  allTimeLow: number;
  atlYear: number;
  marketCapUsd: number;
  circulatingSupplyLabel: string;
  maxSupplyLabel: string;
  originStory: string;
  milestones: Array<{ year: number; event: string }>;
}

const CURATED_GENESIS: Record<string, CuratedGenesisSeed> = {
  'BTC-USD': {
    foundedYear: 2009,
    foundedDate: '2009-01-03',
    genesisPrice: 0.0008,
    allTimeHigh: 93490,
    athYear: 2024,
    allTimeLow: 0.0008,
    atlYear: 2009,
    marketCapUsd: 1_810_000_000_000,
    circulatingSupplyLabel: '19.78M BTC',
    maxSupplyLabel: '21.00M BTC',
    originStory:
      'Genesis block mined on Jan 3, 2009 as the first decentralized peer-to-peer scarce monetary ledger.',
    milestones: [
      { year: 2009, event: 'Genesis Block #0 mined (50 BTC block subsidy)' },
      { year: 2012, event: 'First block-reward halving to 25 BTC' },
      { year: 2017, event: 'CME regulated futures launch & $19.7k peak' },
      { year: 2021, event: 'Sovereign adoption & $69k cycle ATH' },
      { year: 2024, event: 'US Spot Bitcoin ETF approvals & 4th Halving' },
    ],
  },
  'ETH-USD': {
    foundedYear: 2015,
    foundedDate: '2015-07-30',
    genesisPrice: 0.31,
    allTimeHigh: 4891.7,
    athYear: 2021,
    allTimeLow: 0.42,
    atlYear: 2015,
    marketCapUsd: 381_000_000_000,
    circulatingSupplyLabel: '120.4M ETH',
    maxSupplyLabel: 'Uncapped (EIP-1559 Burn)',
    originStory:
      'Frontier mainnet launched July 2015 introducing general-purpose EVM smart contracts.',
    milestones: [
      { year: 2015, event: 'Frontier Genesis launch' },
      { year: 2020, event: 'Beacon Chain Proof-of-Stake genesis' },
      { year: 2021, event: 'EIP-1559 fee burn & $4,891 peak' },
      { year: 2022, event: 'The Merge transition to Proof-of-Stake' },
      { year: 2024, event: 'Dencun L2 blobs & Spot Ether ETFs' },
    ],
  },
  'SOL-USD': {
    foundedYear: 2020,
    foundedDate: '2020-03-16',
    genesisPrice: 0.22,
    allTimeHigh: 263.8,
    athYear: 2024,
    allTimeLow: 0.5,
    atlYear: 2020,
    marketCapUsd: 103_000_000_000,
    circulatingSupplyLabel: '472.1M SOL',
    maxSupplyLabel: 'Disinflationary',
    originStory:
      'Mainnet Beta launched March 2020 using Proof-of-History cryptographic clock synchronization.',
    milestones: [
      { year: 2020, event: 'Mainnet Beta genesis block' },
      { year: 2021, event: 'DeFi & NFT high-throughput expansion' },
      { year: 2023, event: 'Ecosystem revival & Firedancer client milestones' },
      { year: 2024, event: 'DEX volume surge & new cycle peak above $250' },
    ],
  },
  'BNB-USD': {
    foundedYear: 2017,
    foundedDate: '2017-07-25',
    genesisPrice: 0.15,
    allTimeHigh: 720.6,
    athYear: 2024,
    allTimeLow: 0.096,
    atlYear: 2017,
    marketCapUsd: 91_200_000_000,
    circulatingSupplyLabel: '144.0M BNB',
    maxSupplyLabel: '100.0M (Auto-Burn Target)',
    originStory:
      'Launched in July 2017 for fee utility before migrating onto BNB Smart Chain.',
    milestones: [
      { year: 2017, event: 'Token genesis ($0.15 launch)' },
      { year: 2020, event: 'EVM-compatible smart chain activation' },
      { year: 2024, event: 'Auto-burn mechanism & $720 ATH' },
    ],
  },
  'XRP-USD': {
    foundedYear: 2012,
    foundedDate: '2012-06-02',
    genesisPrice: 0.0058,
    allTimeHigh: 3.4,
    athYear: 2018,
    allTimeLow: 0.0028,
    atlYear: 2014,
    marketCapUsd: 63_800_000_000,
    circulatingSupplyLabel: '56.9B XRP',
    maxSupplyLabel: '100.0B XRP',
    originStory:
      'XRP Ledger launched in 2012 for deterministic 3–5 second cross-border liquidity settlement.',
    milestones: [
      { year: 2012, event: 'XRPL Ledger closed genesis' },
      { year: 2018, event: 'Cycle high at $3.40' },
      { year: 2024, event: 'Institutional ODL corridor growth' },
    ],
  },
  NVDA: {
    foundedYear: 1999,
    foundedDate: '1999-01-22',
    genesisPrice: 0.04,
    allTimeHigh: 152.89,
    athYear: 2024,
    allTimeLow: 0.03,
    atlYear: 1999,
    marketCapUsd: 3_590_000_000_000,
    circulatingSupplyLabel: '24.5B Shares (Split-Adj)',
    maxSupplyLabel: 'Common Stock (NASDAQ)',
    originStory:
      'Founded 1993 by Jensen Huang, Chris Malachowsky, and Curtis Priem; listed on NASDAQ Jan 1999 at split-adjusted $0.04.',
    milestones: [
      { year: 1999, event: 'NASDAQ IPO & GeForce 256 GPU launch' },
      { year: 2006, event: 'CUDA parallel computing platform introduced' },
      { year: 2016, event: 'DGX-1 AI supercomputer delivered' },
      { year: 2023, event: 'Generative AI cycle pushes above $1T valuation' },
      { year: 2024, event: 'Blackwell architecture & 10-for-1 split' },
    ],
  },
  AAPL: {
    foundedYear: 1980,
    foundedDate: '1980-12-12',
    genesisPrice: 0.1,
    allTimeHigh: 237.49,
    athYear: 2024,
    allTimeLow: 0.04,
    atlYear: 1982,
    marketCapUsd: 3_460_000_000_000,
    circulatingSupplyLabel: '15.1B Shares',
    maxSupplyLabel: 'Common Stock (NASDAQ)',
    originStory:
      'Founded 1976 in Cupertino; completed historic Dec 1980 IPO at split-adjusted ~$0.10.',
    milestones: [
      { year: 1980, event: 'NASDAQ IPO ($22 pre-split)' },
      { year: 2007, event: 'First-generation iPhone unveiled' },
      { year: 2018, event: 'First US public firm to pass $1T market cap' },
      { year: 2024, event: 'Apple Silicon M-series & Services ecosystem peak' },
    ],
  },
  MSFT: {
    foundedYear: 1986,
    foundedDate: '1986-03-13',
    genesisPrice: 0.07,
    allTimeHigh: 468.35,
    athYear: 2024,
    allTimeLow: 0.06,
    atlYear: 1986,
    marketCapUsd: 3_150_000_000_000,
    circulatingSupplyLabel: '7.43B Shares',
    maxSupplyLabel: 'Common Stock (NASDAQ)',
    originStory:
      'Founded 1975; listed on NASDAQ March 1986 and scaled from OS software into Azure cloud & enterprise AI.',
    milestones: [
      { year: 1986, event: 'NASDAQ IPO ($21 pre-split)' },
      { year: 1995, event: 'Windows 95 global desktop era' },
      { year: 2014, event: 'Cloud-first Azure transformation' },
      { year: 2024, event: 'Copilot & Azure AI surpass $3T valuation' },
    ],
  },
  AMZN: {
    foundedYear: 1997,
    foundedDate: '1997-05-15',
    genesisPrice: 0.075,
    allTimeHigh: 215.9,
    athYear: 2024,
    allTimeLow: 0.065,
    atlYear: 1997,
    marketCapUsd: 2_190_000_000_000,
    circulatingSupplyLabel: '10.5B Shares',
    maxSupplyLabel: 'Common Stock (NASDAQ)',
    originStory:
      'Listed May 1997 ($18 pre-split) and grew into global logistics, Prime, and AWS cloud infrastructure.',
    milestones: [
      { year: 1997, event: 'NASDAQ IPO ($0.075 split-adj)' },
      { year: 2006, event: 'Amazon Web Services (AWS) launched' },
      { year: 2022, event: '20-for-1 stock split' },
    ],
  },
  TSLA: {
    foundedYear: 2010,
    foundedDate: '2010-06-29',
    genesisPrice: 1.13,
    allTimeHigh: 414.5,
    athYear: 2021,
    allTimeLow: 1.05,
    atlYear: 2010,
    marketCapUsd: 1_050_000_000_000,
    circulatingSupplyLabel: '3.21B Shares',
    maxSupplyLabel: 'Common Stock (NASDAQ)',
    originStory:
      'First US automaker IPO since 1956 (June 2010 at $17 pre-split, ~$1.13 split-adj).',
    milestones: [
      { year: 2010, event: 'NASDAQ IPO ($1.13 split-adj)' },
      { year: 2017, event: 'Model 3 mass EV ramp' },
      { year: 2020, event: 'S&P 500 index inclusion' },
    ],
  },
  'NIFTY50.NS': {
    foundedYear: 1996,
    foundedDate: '1996-04-22',
    genesisPrice: 1000,
    allTimeHigh: 26277.35,
    athYear: 2024,
    allTimeLow: 788,
    atlYear: 1996,
    marketCapUsd: 2_450_000_000_000,
    circulatingSupplyLabel: '50 Large-Cap NSE Constituents',
    maxSupplyLabel: 'Free-Float Weighted Index',
    originStory:
      'National Stock Exchange flagship 50-stock benchmark, base index value 1,000 set on Nov 3, 1995.',
    milestones: [
      { year: 1996, event: 'Live benchmark launch (Base 1,000)' },
      { year: 2007, event: 'First crossing of 6,000 milestone' },
      { year: 2023, event: 'NSE becomes world #1 derivatives exchange by contracts' },
      { year: 2024, event: 'Breakout above 26,200 all-time high' },
    ],
  },
  'SENSEX.BO': {
    foundedYear: 1979,
    foundedDate: '1979-04-01',
    genesisPrice: 100,
    allTimeHigh: 85978.25,
    athYear: 2024,
    allTimeLow: 100,
    atlYear: 1979,
    marketCapUsd: 2_120_000_000_000,
    circulatingSupplyLabel: '30 Bluechip BSE Constituents',
    maxSupplyLabel: 'Asia Oldest Stock Exchange Index',
    originStory:
      'India’s oldest stock market benchmark (base value 100 on April 1, 1979) on the Bombay Stock Exchange (est. 1875).',
    milestones: [
      { year: 1979, event: 'SENSEX base 100 established' },
      { year: 1991, event: 'Economic liberalization bull market above 4,000' },
      { year: 2021, event: 'Crossed 50,000 historic threshold' },
      { year: 2024, event: 'Surpassed 85,900 milestone' },
    ],
  },
  'RELIANCE.NS': {
    foundedYear: 1977,
    foundedDate: '1977-11-29',
    genesisPrice: 1.25,
    allTimeHigh: 1608.8,
    athYear: 2024,
    allTimeLow: 1.1,
    atlYear: 1977,
    marketCapUsd: 206_000_000_000,
    circulatingSupplyLabel: '13.53B Shares (Bonus-Adj)',
    maxSupplyLabel: 'Common Stock (NSE/BSE)',
    originStory:
      'Founded by Dhirubhai Ambani; 1977 IPO sparked retail equity participation across India.',
    milestones: [
      { year: 1977, event: 'Historic Indian retail IPO' },
      { year: 1999, event: 'Jamnagar mega-refinery commissioning' },
      { year: 2016, event: 'Reliance Jio 4G digital revolution' },
      { year: 2024, event: '1:1 bonus issue & O2C/Retail expansion' },
    ],
  },
  'TCS.NS': {
    foundedYear: 2004,
    foundedDate: '2004-08-25',
    genesisPrice: 125.0,
    allTimeHigh: 4592.25,
    athYear: 2024,
    allTimeLow: 112.0,
    atlYear: 2004,
    marketCapUsd: 177_000_000_000,
    circulatingSupplyLabel: '3.62B Shares',
    maxSupplyLabel: 'Common Stock (NSE/BSE)',
    originStory:
      'Founded 1968 under Tata Sons; 2004 IPO became India’s largest private IT services listing.',
    milestones: [
      { year: 2004, event: 'NSE/BSE mega IT IPO' },
      { year: 2018, event: 'First Indian company at $100B+ valuation' },
      { year: 2024, event: 'Global AI/Cloud modernization contracts' },
    ],
  },
  'HDFCBANK.NS': {
    foundedYear: 1995,
    foundedDate: '1995-05-19',
    genesisPrice: 4.1,
    allTimeHigh: 1880.0,
    athYear: 2024,
    allTimeLow: 3.6,
    atlYear: 1995,
    marketCapUsd: 158_000_000_000,
    circulatingSupplyLabel: '7.63B Shares',
    maxSupplyLabel: 'Common Stock (NSE/BSE)',
    originStory:
      'One of India’s first private-sector banks licensed under 1994 RBI liberalization; merged with HDFC Ltd in 2023.',
    milestones: [
      { year: 1995, event: 'Public listing on BSE/NSE' },
      { year: 2023, event: 'Mega-merger with parent HDFC Ltd' },
    ],
  },
  'INFY.NS': {
    foundedYear: 1993,
    foundedDate: '1993-06-14',
    genesisPrice: 1.5,
    allTimeHigh: 1991.4,
    athYear: 2024,
    allTimeLow: 1.4,
    atlYear: 1993,
    marketCapUsd: 91_500_000_000,
    circulatingSupplyLabel: '4.15B Shares',
    maxSupplyLabel: 'NSE & NYSE ADR',
    originStory:
      'Co-founded 1981 with INR 10,000 seed capital; first Indian IT firm to list on NASDAQ (1999).',
    milestones: [
      { year: 1993, event: 'Indian domestic IPO' },
      { year: 1999, event: 'First Indian firm listed on NASDAQ' },
      { year: 2023, event: 'Topaz enterprise AI suite rollout' },
    ],
  },
  'XAU-USD': {
    foundedYear: 1971,
    foundedDate: '1971-08-15',
    genesisPrice: 35.0,
    allTimeHigh: 2790.1,
    athYear: 2024,
    allTimeLow: 35.0,
    atlYear: 1971,
    marketCapUsd: 17_800_000_000_000,
    circulatingSupplyLabel: '~212,582 Metric Tonnes Above-Ground',
    maxSupplyLabel: 'Geological Reserve',
    originStory:
      'Free-floating fiat gold market era began Aug 1971 after closing the Bretton Woods $35/oz window.',
    milestones: [
      { year: 1971, event: 'End of Bretton Woods $35/oz peg' },
      { year: 1980, event: 'Inflation cycle peak at $850/oz' },
      { year: 2011, event: 'GFC sovereign debt rally to $1,920/oz' },
      { year: 2024, event: 'Central bank accumulation & $2,790 ATH' },
    ],
  },
  'EUR-USD': {
    foundedYear: 1999,
    foundedDate: '1999-01-04',
    genesisPrice: 1.1789,
    allTimeHigh: 1.6038,
    athYear: 2008,
    allTimeLow: 0.823,
    atlYear: 2000,
    marketCapUsd: 15_400_000_000_000,
    circulatingSupplyLabel: 'Eurozone M3 Broad Money',
    maxSupplyLabel: 'ECB Sovereign Liquidity',
    originStory:
      'Launched Jan 1999 as accounting currency across 11 Eurozone nations before physical notes in 2002.',
    milestones: [
      { year: 1999, event: 'Euro currency launch at 1.1789 USD' },
      { year: 2008, event: 'All-time high at 1.6038' },
      { year: 2022, event: 'Parity re-test during energy tightening cycle' },
    ],
  },
  'USD-INR': {
    foundedYear: 1993,
    foundedDate: '1993-03-01',
    genesisPrice: 31.37,
    allTimeHigh: 84.52,
    athYear: 2024,
    allTimeLow: 31.2,
    atlYear: 1993,
    marketCapUsd: 685_000_000_000,
    circulatingSupplyLabel: 'RBI FX Reserves Anchor',
    maxSupplyLabel: 'Managed Floating Sovereign FX',
    originStory:
      'India transitioned to a unified market-determined exchange rate regime (LERMS) in March 1993.',
    milestones: [
      { year: 1993, event: 'Unified market-determined INR float (~31.37)' },
      { year: 2013, event: 'Taper tantrum stabilization near 68.8' },
      { year: 2024, event: 'UPI global corridors & RBI reserves >$680B' },
    ],
  },
  SPY: {
    foundedYear: 1993,
    foundedDate: '1993-01-22',
    genesisPrice: 43.94,
    allTimeHigh: 600.17,
    athYear: 2024,
    allTimeLow: 42.81,
    atlYear: 1993,
    marketCapUsd: 618_000_000_000,
    circulatingSupplyLabel: '1.04B ETF Units',
    maxSupplyLabel: 'Open-End UIT ETF',
    originStory:
      'World’s first US-listed Exchange Traded Fund (SPDR S&P 500), launched Jan 22, 1993 on AMEX.',
    milestones: [
      { year: 1993, event: 'First US ETF inception ($43.94)' },
      { year: 2009, event: 'Post-GFC secular expansion from $68' },
      { year: 2024, event: 'First ETF past $600B AUM' },
    ],
  },
};

export function formatMarketCapUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$1.0B';
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  return `$${usd.toFixed(0)}`;
}

function deterministicSeedHash(sym: string): number {
  let h = 2166136261;
  for (let i = 0; i < sym.length; i += 1) {
    h ^= sym.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function estimateMarketCapUsd(asset: SeedAsset): number {
  const hash = deterministicSeedHash(asset.symbol);
  if (asset.contractSpec?.openInterestUsd) {
    return asset.contractSpec.openInterestUsd;
  }
  if (asset.assetClass === 'crypto') {
    return Math.max(850_000_000, asset.basePrice * asset.baseVolume * (0.28 + (hash % 40) / 100));
  }
  if (asset.assetClass === 'fx') {
    return 1_200_000_000_000 + (hash % 18) * 350_000_000_000;
  }
  if (asset.assetClass === 'commodities') {
    return 900_000_000_000 + (hash % 12) * 420_000_000_000;
  }
  // Equities
  const fxToUsd = asset.quoteCurrency === 'INR' ? 1 / 84.4 : asset.quoteCurrency === 'JPY' ? 1 / 154.6 : 1;
  return Math.max(4_500_000_000, asset.basePrice * fxToUsd * asset.baseVolume * 6.5);
}

export function buildGenesisProfile(asset: SeedAsset, livePrice?: number): MarketGenesisProfile {
  const currentPrice = livePrice ?? asset.basePrice;
  const curated = CURATED_GENESIS[asset.symbol];
  const hash = deterministicSeedHash(asset.symbol);
  const currentYear = 2025;

  let foundedYear: number;
  let foundedDate: string;
  let genesisPrice: number;
  let allTimeHigh: number;
  let athYear: number;
  let allTimeLow: number;
  let atlYear: number;
  let marketCapUsd: number;
  let circulatingSupplyLabel: string;
  let maxSupplyLabel: string;
  let originStory: string;
  let milestones: Array<{ year: number; event: string }>;

  if (curated) {
    foundedYear = curated.foundedYear;
    foundedDate = curated.foundedDate;
    genesisPrice = curated.genesisPrice;
    allTimeHigh = Math.max(curated.allTimeHigh, currentPrice);
    athYear = curated.athYear;
    allTimeLow = Math.min(curated.allTimeLow, currentPrice);
    atlYear = curated.atlYear;
    marketCapUsd = curated.marketCapUsd;
    circulatingSupplyLabel = curated.circulatingSupplyLabel;
    maxSupplyLabel = curated.maxSupplyLabel;
    originStory = curated.originStory;
    milestones = curated.milestones;
  } else {
    if (asset.instrumentType === 'options' || asset.instrumentType === 'futures') {
      foundedYear = asset.assetClass === 'crypto' ? 2019 : 2005;
      foundedDate = `${foundedYear}-01-15`;
      genesisPrice = Number((currentPrice * 0.42).toPrecision(5));
      allTimeHigh = Number((currentPrice * 1.38).toPrecision(5));
      athYear = 2024;
      allTimeLow = Number((currentPrice * 0.24).toPrecision(5));
      atlYear = foundedYear;
      marketCapUsd = estimateMarketCapUsd(asset);
      circulatingSupplyLabel = `${Math.round((asset.contractSpec?.openInterestUsd ?? 500_000_000) / 1e6)}M USD OI`;
      maxSupplyLabel = `${asset.contractSpec?.expiry ?? 'Rolling'} Derivative`;
      originStory = `${asset.name} regulated/exchange-cleared derivative contract benchmarked on ${asset.venue}.`;
      milestones = [
        { year: foundedYear, event: `Initial contract series listed on ${asset.venue}` },
        { year: 2024, event: 'Peak institutional open-interest expansion' },
      ];
    } else if (asset.assetClass === 'crypto') {
      foundedYear = 2014 + (hash % 9);
      foundedDate = `${foundedYear}-0${1 + (hash % 8)}-14`;
      genesisPrice = Number((currentPrice * (0.015 + (hash % 12) * 0.008)).toPrecision(4));
      allTimeHigh = Number((currentPrice * (1.12 + (hash % 45) / 100)).toPrecision(5));
      athYear = 2021 + (hash % 4);
      allTimeLow = Number((genesisPrice * 0.65).toPrecision(4));
      atlYear = foundedYear;
      marketCapUsd = estimateMarketCapUsd(asset);
      circulatingSupplyLabel = 'On-Chain Circulating';
      maxSupplyLabel = asset.sector;
      originStory = `${asset.name} (${asset.sector}) genesis mainnet launch on ${foundedDate}, traded globally across ${asset.venue} & spot liquidity venues.`;
      milestones = [
        { year: foundedYear, event: `Mainnet genesis & initial ${asset.venue} spot liquidity` },
        { year: Math.min(2024, foundedYear + 2), event: 'Multi-cycle institutional market cap expansion' },
      ];
    } else if (asset.assetClass === 'fx') {
      foundedYear = 1994 + (hash % 6);
      foundedDate = `${foundedYear}-01-04`;
      genesisPrice = Number((currentPrice * (0.72 + (hash % 15) / 100)).toPrecision(4));
      allTimeHigh = Number((currentPrice * 1.24).toPrecision(4));
      athYear = 2016 + (hash % 8);
      allTimeLow = Number((currentPrice * 0.68).toPrecision(4));
      atlYear = foundedYear;
      marketCapUsd = estimateMarketCapUsd(asset);
      circulatingSupplyLabel = '24h Interbank OTC Depth';
      maxSupplyLabel = 'Central Bank Free-Float';
      originStory = `${asset.name} sovereign foreign-exchange benchmark priced continuously across London, NY, Tokyo & Mumbai prime desks.`;
      milestones = [
        { year: foundedYear, event: 'Modern electronic FX prime quoting' },
        { year: 2024, event: 'Global central bank rate-cycle repricing' },
      ];
    } else if (asset.assetClass === 'commodities') {
      foundedYear = 1978 + (hash % 10);
      foundedDate = `${foundedYear}-03-01`;
      genesisPrice = Number((currentPrice * 0.25).toPrecision(4));
      allTimeHigh = Number((currentPrice * 1.32).toPrecision(4));
      athYear = 2022 + (hash % 3);
      allTimeLow = Number((currentPrice * 0.19).toPrecision(4));
      atlYear = foundedYear;
      marketCapUsd = estimateMarketCapUsd(asset);
      circulatingSupplyLabel = 'Global Physical & Futures Pool';
      maxSupplyLabel = 'CME / Global Benchmark';
      originStory = `${asset.name} benchmarked on ${asset.venue} with multi-decade physical delivery and macro inflation sensitivity.`;
      milestones = [
        { year: foundedYear, event: 'Electronic & pit futures standardization' },
        { year: 2024, event: 'Multi-year supply-demand rebalancing' },
      ];
    } else {
      // Equities (India / US / EU / Asia)
      foundedYear = asset.region === 'india' ? 1992 + (hash % 16) : 1988 + (hash % 24);
      foundedDate = `${foundedYear}-0${1 + (hash % 8)}-18`;
      genesisPrice = Number((currentPrice * (0.04 + (hash % 18) * 0.01)).toPrecision(4));
      allTimeHigh = Number((currentPrice * (1.06 + (hash % 18) / 100)).toPrecision(5));
      athYear = 2024;
      allTimeLow = Number((genesisPrice * 0.78).toPrecision(4));
      atlYear = foundedYear;
      marketCapUsd = estimateMarketCapUsd(asset);
      circulatingSupplyLabel = `Public Float (${asset.venue})`;
      maxSupplyLabel = `Listed Equity (${asset.quoteCurrency})`;
      originStory = `${asset.name} (${asset.sector}) listed on ${asset.venue} since ${foundedYear}, scaling institutional earnings and market capitalization.`;
      milestones = [
        { year: foundedYear, event: `Public IPO & listing on ${asset.venue}` },
        { year: Math.min(2021, foundedYear + 5), event: 'Benchmark index inclusion & scale-up' },
        { year: 2024, event: 'All-time revenue & valuation milestone' },
      ];
    }
  }

  const yearsElapsed = Math.max(1, currentYear - foundedYear);
  const safeGenesis = Math.max(genesisPrice, 1e-8);
  const lifetimeReturnPct = Number((((currentPrice - safeGenesis) / safeGenesis) * 100).toFixed(1));
  const historicalCagrPct = Number(
    ((Math.pow(Math.max(currentPrice / safeGenesis, 0.01), 1 / yearsElapsed) - 1) * 100).toFixed(2)
  );

  // Build yearly trajectory checkpoints from foundedYear -> 2025
  const totalSpan = Math.max(2, currentYear - foundedYear);
  const stepYears = totalSpan > 20 ? 3 : totalSpan > 10 ? 2 : 1;
  const yearlyCheckpoints: Array<{ year: number; price: number; marketCapUsd: number }> = [];
  for (let y = foundedYear; y <= currentYear; y += stepYears) {
    const t = (y - foundedYear) / totalSpan;
    const wave = 1 + 0.14 * Math.sin(t * Math.PI * 3 + (hash % 5));
    // Smooth exponential / S-curve interpolation
    const interp =
      safeGenesis * Math.pow(Math.max(currentPrice / safeGenesis, 0.1), Math.pow(t, 0.85)) * (y === foundedYear || y === currentYear ? 1 : wave);
    const clampedPrice = Number(Math.max(allTimeLow * 0.8, Math.min(allTimeHigh * 1.02, interp)).toPrecision(5));
    const estMcap = Math.round(marketCapUsd * Math.max(0.01, clampedPrice / Math.max(currentPrice, 1e-8)));
    yearlyCheckpoints.push({ year: y, price: clampedPrice, marketCapUsd: estMcap });
  }
  if (yearlyCheckpoints[yearlyCheckpoints.length - 1]?.year !== currentYear) {
    yearlyCheckpoints.push({
      year: currentYear,
      price: Number(currentPrice.toPrecision(5)),
      marketCapUsd: Math.round(marketCapUsd),
    });
  }

  return {
    foundedYear,
    foundedDate,
    genesisPrice,
    allTimeHigh,
    athYear,
    allTimeLow,
    atlYear,
    marketCapUsd,
    marketCapFormatted: formatMarketCapUsd(marketCapUsd),
    circulatingSupplyLabel,
    maxSupplyLabel,
    lifetimeReturnPct,
    historicalCagrPct,
    originStory,
    milestones,
    yearlyCheckpoints,
  };
}

export function generateGenesisHistoryCandles(inst: Instrument): Candle[] {
  const genesis = inst.genesis;
  const startYear = genesis?.foundedYear ?? 2010;
  const startPrice = Math.max(genesis?.genesisPrice ?? inst.price * 0.1, 1e-8);
  const endPrice = Math.max(inst.price, 1e-8);
  const now = Date.now();
  const startMs = Date.UTC(startYear, 0, 1);
  const totalPoints = 120;
  const stepMs = Math.max(86_400_000, Math.floor((now - startMs) / totalPoints));

  const hash = deterministicSeedHash(inst.symbol);
  const out: Candle[] = [];
  let prevClose = startPrice;

  for (let i = 0; i < totalPoints; i += 1) {
    const t = i / (totalPoints - 1);
    const time = i === totalPoints - 1 ? now : startMs + i * stepMs;
    const trendTarget =
      startPrice * Math.pow(Math.max(endPrice / startPrice, 0.05), Math.pow(t, 0.82));
    const cycleSwing = 1 + 0.18 * Math.sin(t * Math.PI * 5 + (hash % 7)) * (1 - t * 0.45);
    const close =
      i === totalPoints - 1
        ? endPrice
        : Number(Math.max(1e-8, trendTarget * cycleSwing).toPrecision(5));
    const open = i === 0 ? startPrice : prevClose;
    const wickScale = 0.04 + 0.04 * Math.abs(Math.cos(i * 1.7 + hash));
    const high = Number((Math.max(open, close) * (1 + wickScale)).toPrecision(5));
    const low = Number((Math.min(open, close) * (1 - wickScale * 0.8)).toPrecision(5));
    const volume = Math.round(inst.volume24h * (0.15 + t * 0.9) * (0.8 + ((i + hash) % 5) * 0.1));
    out.push({ time, open, high, low, close, volume });
    prevClose = close;
  }

  return out;
}
