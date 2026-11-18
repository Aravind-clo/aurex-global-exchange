import crypto from 'node:crypto';
import type {
  CountryGuideline,
  GlobalBankDirectoryEntry,
  Instrument,
  InvestorProfile,
  KycDocumentType,
  KycVerificationRecord,
  MlPrediction,
  NewsItem,
  NextMoveInterestItem,
  ScamReportRecord,
} from '../src/types/market.ts';

export const COUNTRY_GUIDELINES: CountryGuideline[] = [
  {
    countryCode: 'IN',
    countryName: 'India',
    regulator: 'SEBI · RBI · FIU-IND · NPCI',
    cryptoPolicy:
      'Virtual Digital Assets (VDAs) follow FIU-IND AML/KYC onboarding rules. Real-money VDA transfers attract 30% tax on gains + 1% TDS under Section 115BBH/194S (simulation demo carries zero tax liability).',
    equitiesFxDerivativesRules:
      'NSE/BSE cash & F&O equity analytics are displayed for informational charting; live cross-border INR FX leveraged contracts follow RBI FEMA guidelines and LRS limits.',
    taxAndReportingNote: 'Report VDA/capital gains on ITR-2/ITR-3; retain verifiable ledger exports.',
    supportedPaymentRails: ['UPI (GPay / PhonePe / Paytm / BHIM)', 'IMPS', 'NEFT'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    regulator: 'SEC · CFTC · FINRA · FinCEN',
    cryptoPolicy:
      'Digital asset spot analytics & research operate under FinCEN BSA/AML monitoring; token classifications remain subject to SEC/CFTC guidance.',
    equitiesFxDerivativesRules:
      'Equities/Options insights follow Pattern Day Trader ($25k margin threshold for live margin accounts) & CFTC Rule 4.41 simulated-performance disclosure rules.',
    taxAndReportingNote: 'Realized capital gains & digital asset dispositions report via IRS Form 8949 / 1099-DA.',
    supportedPaymentRails: ['FedNow / ACH', 'Fedwire', 'Wise USD'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    regulator: 'FCA (Financial Conduct Authority)',
    cryptoPolicy:
      'Promotions and digital asset risk warnings follow FCA PS23/6 Financial Promotion Regime (24-hour cooling-off & appropriateness assessment for new retail investors).',
    equitiesFxDerivativesRules:
      'Retail CFD/Futures analytics highlight leverage caps (30:1 major FX, 20:1 indices, 2:1 crypto) and negative-balance protection principles.',
    taxAndReportingNote: 'Capital Gains Tax annual exempt allowance applies to realized UK disposals via HMRC.',
    supportedPaymentRails: ['Faster Payments (FPS)', 'CHAPS', 'Revolut / Wise GBP'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'EU',
    countryName: 'European Union (MiCA / ESMA)',
    regulator: 'ESMA · EBA · National Competent Authorities',
    cryptoPolicy:
      'Aligned with Markets in Crypto-Assets (MiCA) transparency, whitepaper attribution, and stablecoin reserve disclosures.',
    equitiesFxDerivativesRules:
      'ESMA product intervention standards apply for retail CFDs, futures margining, and MiFID II best-execution transparency.',
    taxAndReportingNote: 'DAC8 cross-border crypto & securities reporting applies across EU member states.',
    supportedPaymentRails: ['SEPA Instant', 'TARGET2 Wire', 'Revolut / N26 EUR'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'SG',
    countryName: 'Singapore',
    regulator: 'MAS (Monetary Authority of Singapore)',
    cryptoPolicy:
      'Digital Payment Token (DPT) guidance discourages speculative retail leverage and prioritizes institutional-grade custody & travel-rule AML.',
    equitiesFxDerivativesRules:
      'Capital Markets Services (CMS) boundary disclosures distinguish educational simulation tools from licensed brokerage execution.',
    taxAndReportingNote: 'No general capital gains tax for long-term individual investments; business trading income taxable per IRAS.',
    supportedPaymentRails: ['PayNow · UPI Link', 'FAST SGD', 'DBS / OCBC SWIFT'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    regulator: 'VARA (Dubai) · ADGM FSRA · SCA',
    cryptoPolicy:
      'Multi-tier VARA custody, anti-scam verification, and marketing compliance standards enforced for digital asset disclosures.',
    equitiesFxDerivativesRules:
      'UAE onshore SCA & DIFC/ADGM derivatives frameworks govern leveraged forex, commodities, and institutional contracts.',
    taxAndReportingNote: '0% personal capital gains tax for qualifying individual holdings; corporate rules apply to licensed entities.',
    supportedPaymentRails: ['Aani · NPCI Corridor', 'UAEFTS AED', 'Emirates NBD / ADCB'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'JP',
    countryName: 'Japan',
    regulator: 'FSA (Financial Services Agency) · JVCEA',
    cryptoPolicy:
      'Payment Services Act requires segregated cold storage of client assets and strict 2x maximum leverage on crypto margin.',
    equitiesFxDerivativesRules:
      'TSE equity margin & FX retail leverage strictly capped at 25x per FSA regulations.',
    taxAndReportingNote: 'Crypto gains currently categorized under miscellaneous progressive tax rules by NTA.',
    supportedPaymentRails: ['Zengin JPY', 'MUFG / SMBC SWIFT'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'AU',
    countryName: 'Australia',
    regulator: 'ASIC · AUSTRAC',
    cryptoPolicy:
      'AUSTRAC DCE registration & AML verification applied; AFSL licensing required for financial product advice.',
    equitiesFxDerivativesRules:
      'ASIC Product Intervention Order enforces retail leverage limits and mandatory risk-disclosure metrics.',
    taxAndReportingNote: 'ATO treats crypto-to-crypto swaps and disposals as CGT events (50% discount >12m).',
    supportedPaymentRails: ['NPP / Osko AUD', 'CommBank / ANZ SWIFT'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'CA',
    countryName: 'Canada',
    regulator: 'CSA · CIRO · FINTRAC',
    cryptoPolicy:
      'Pre-Registration Undertaking rules prioritize cold-wallet custody segregation and annual purchase caps on restricted tokens.',
    equitiesFxDerivativesRules:
      'CIRO margin rules and accredited-investor exemptions apply to complex derivatives.',
    taxAndReportingNote: 'CRA taxes 50% of realized capital gains (or 100% if classified as business income).',
    supportedPaymentRails: ['Interac e-Transfer', 'RBC / TD Wire'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'CH',
    countryName: 'Switzerland',
    regulator: 'FINMA · Swiss National Bank',
    cryptoPolicy:
      'DLT Act provides clear legal property rights for tokenized securities and payment tokens alongside strict AML Travel Rule checks.',
    equitiesFxDerivativesRules:
      'SIX equity, FX, and structured product data shown strictly for non-advisory quantitative research.',
    taxAndReportingNote: 'Private capital gains generally tax-exempt; wealth tax applies to year-end holdings.',
    supportedPaymentRails: ['SIC CHF Instant', 'UBS / ZKB IBAN'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'BR',
    countryName: 'Brazil',
    regulator: 'CVM · Banco Central do Brasil (BCB)',
    cryptoPolicy:
      'Marco Legal das Criptomoedas (Law 14.478/2022) mandates VASP authorization and segregated customer balances.',
    equitiesFxDerivativesRules:
      'B3 equities/futures and FX remittances regulated by CVM & BCB.',
    taxAndReportingNote: 'Monthly Receita Federal reporting applies above exemption thresholds.',
    supportedPaymentRails: ['PIX Instant BRL->USD', 'Nubank / Itaú SWIFT'],
    accessStatus: 'OPEN_SIMULATION',
  },
  {
    countryCode: 'GLOBAL-IP',
    countryName: 'Global Copyright, Fair-Use & Non-Impersonation Safe Harbor',
    regulator: 'DMCA · Berne Convention · WIPO · GDPR / DPDP Act (India)',
    cryptoPolicy:
      'All news headlines & summaries derive strictly from public RSS / open market wires with publisher attribution & direct external links—no paywalled or copyrighted articles are reproduced.',
    equitiesFxDerivativesRules:
      'Public trader & organization cards present factual historical disclosures and verified performance telemetry strictly for market research.',
    taxAndReportingNote:
      'Copyright or impersonation notices may be submitted anytime via our Fraud & DMCA Registry for immediate review and takedown.',
    supportedPaymentRails: ['Multi-Region Compliance Shield'],
    accessStatus: 'OPEN_SIMULATION',
  },
];

export const GLOBAL_BANK_DIRECTORY: GlobalBankDirectoryEntry[] = [
  // India Banks & UPI Apps
  { id: 'in-gpay', country: 'India', region: 'india', bankName: 'Google Pay UPI (ICICI)', rail: 'UPI', currency: 'INR', sampleAcct: 'investor@okicici', routingCode: 'NPCI-UPI', settlementSpeed: 'Instant (<5s)' },
  { id: 'in-phonepe', country: 'India', region: 'india', bankName: 'PhonePe UPI (Yes Bank)', rail: 'UPI', currency: 'INR', sampleAcct: 'investor@ybl', routingCode: 'NPCI-UPI', settlementSpeed: 'Instant (<5s)' },
  { id: 'in-paytm', country: 'India', region: 'india', bankName: 'Paytm Payments UPI', rail: 'UPI', currency: 'INR', sampleAcct: 'investor@paytm', routingCode: 'NPCI-UPI', settlementSpeed: 'Instant (<5s)' },
  { id: 'in-bhim', country: 'India', region: 'india', bankName: 'BHIM / SBI YONO UPI', rail: 'UPI', currency: 'INR', sampleAcct: 'investor@oksbi', routingCode: 'SBIN0000001', settlementSpeed: 'Instant (<5s)' },
  { id: 'in-amazon', country: 'India', region: 'india', bankName: 'Amazon Pay / CRED UPI', rail: 'UPI', currency: 'INR', sampleAcct: 'investor@apl', routingCode: 'NPCI-UPI', settlementSpeed: 'Instant (<5s)' },
  { id: 'in-hdfc', country: 'India', region: 'india', bankName: 'HDFC Bank IMPS / UPI', rail: 'IMPS', currency: 'INR', sampleAcct: '50100928371829', routingCode: 'HDFC0000001', settlementSpeed: 'Instant 24x7' },
  { id: 'in-icici', country: 'India', region: 'india', bankName: 'ICICI Bank iMobile / IMPS', rail: 'IMPS', currency: 'INR', sampleAcct: '000401928374', routingCode: 'ICIC0000004', settlementSpeed: 'Instant 24x7' },
  { id: 'in-sbi', country: 'India', region: 'india', bankName: 'State Bank of India (SBI NEFT)', rail: 'NEFT', currency: 'INR', sampleAcct: '309182736451', routingCode: 'SBIN0000300', settlementSpeed: '<30 min' },
  { id: 'in-axis', country: 'India', region: 'india', bankName: 'Axis Bank Burgundy / NEFT', rail: 'NEFT', currency: 'INR', sampleAcct: '918010029384', routingCode: 'UTIB0000004', settlementSpeed: '<30 min' },
  { id: 'in-kotak', country: 'India', region: 'india', bankName: 'Kotak Mahindra 811 / UPI', rail: 'IMPS', currency: 'INR', sampleAcct: '041192837465', routingCode: 'KKBK0000958', settlementSpeed: 'Instant 24x7' },
  { id: 'in-pnb', country: 'India', region: 'india', bankName: 'Punjab National Bank (PNB)', rail: 'NEFT', currency: 'INR', sampleAcct: '015300210009', routingCode: 'PUNB0015300', settlementSpeed: '<30 min' },
  { id: 'in-bob', country: 'India', region: 'india', bankName: 'Bank of Baroda (BoB World)', rail: 'IMPS', currency: 'INR', sampleAcct: '039201000182', routingCode: 'BARB0BOMBAY', settlementSpeed: 'Instant 24x7' },
  { id: 'in-indusind', country: 'India', region: 'india', bankName: 'IndusInd Bank Pioneer', rail: 'IMPS', currency: 'INR', sampleAcct: '201004928172', routingCode: 'INDB0000006', settlementSpeed: 'Instant 24x7' },
  { id: 'in-idfc', country: 'India', region: 'india', bankName: 'IDFC First Bank Wealth', rail: 'UPI', currency: 'INR', sampleAcct: 'investor@idfcbank', routingCode: 'IDFB0040101', settlementSpeed: 'Instant (<5s)' },
  { id: 'in-canara', country: 'India', region: 'india', bankName: 'Canara Bank / Federal Bank', rail: 'NEFT', currency: 'INR', sampleAcct: '110048291038', routingCode: 'CNRB0000401', settlementSpeed: '<30 min' },

  // International Banks & Instant Corridors
  { id: 'us-chase', country: 'United States', region: 'international', bankName: 'JPMorgan Chase (FedNow / ACH)', rail: 'ACH', currency: 'USD', sampleAcct: 'US480091283910', routingCode: 'CHASUS33', settlementSpeed: 'Same Day' },
  { id: 'us-bofa', country: 'United States', region: 'international', bankName: 'Bank of America / Citi Global', rail: 'WIRE', currency: 'USD', sampleAcct: 'US882019384712', routingCode: 'BOFAUS3N', settlementSpeed: '<1 hour' },
  { id: 'us-wise', country: 'Global Multi-FX', region: 'international', bankName: 'Wise Multi-Currency Instant', rail: 'ACH', currency: 'USD', sampleAcct: 'WISE8820194812', routingCode: 'TRWIUS35', settlementSpeed: 'Instant' },
  { id: 'uk-hsbc', country: 'United Kingdom', region: 'international', bankName: 'HSBC UK Faster Payments', rail: 'FPS', currency: 'GBP', sampleAcct: 'GB29HBUK400515', routingCode: 'HBUKGB4B', settlementSpeed: 'Instant (<1m)' },
  { id: 'uk-barclays', country: 'United Kingdom', region: 'international', bankName: 'Barclays / Monzo FPS', rail: 'FPS', currency: 'GBP', sampleAcct: 'GB82BARC200000', routingCode: 'BARCGB22', settlementSpeed: 'Instant (<1m)' },
  { id: 'eu-revolut', country: 'Eurozone / UK', region: 'international', bankName: 'Revolut SEPA Instant', rail: 'SEPA', currency: 'EUR', sampleAcct: 'LT60325009182736', routingCode: 'REVOLT21', settlementSpeed: 'Instant (<10s)' },
  { id: 'eu-db', country: 'Germany / EU', region: 'international', bankName: 'Deutsche Bank / BNP Paribas', rail: 'SEPA', currency: 'EUR', sampleAcct: 'DE89370400440532', routingCode: 'DEUTDEFF', settlementSpeed: 'SEPA Instant' },
  { id: 'sg-paynow', country: 'Singapore', region: 'international', bankName: 'DBS / OCBC PayNow-UPI', rail: 'UPI', currency: 'SGD', sampleAcct: '+6591234567@paynow', routingCode: 'DBSSSGSG', settlementSpeed: 'Instant (<10s)' },
  { id: 'ae-aani', country: 'UAE', region: 'international', bankName: 'Emirates NBD / Aani-UPI', rail: 'UPI', currency: 'AED', sampleAcct: 'dubai@aani.ae', routingCode: 'EBILAEAD', settlementSpeed: 'Instant (<10s)' },
  { id: 'jp-mufg', country: 'Japan', region: 'international', bankName: 'MUFG / SMBC Tokyo', rail: 'SWIFT', currency: 'JPY', sampleAcct: 'JP190028371920', routingCode: 'BOTKJPJT', settlementSpeed: 'T+1' },
  { id: 'au-cba', country: 'Australia', region: 'international', bankName: 'CommBank / ANZ Osko', rail: 'SWIFT', currency: 'AUD', sampleAcct: 'AU610620001829', routingCode: 'CTBAAU2S', settlementSpeed: 'Same Day' },
  { id: 'ca-rbc', country: 'Canada', region: 'international', bankName: 'RBC / TD Canada Trust', rail: 'WIRE', currency: 'CAD', sampleAcct: 'CA003192847561', routingCode: 'ROYCCAT2', settlementSpeed: '<2 hours' },
  { id: 'ch-ubs', country: 'Switzerland', region: 'international', bankName: 'UBS / ZKB Swiss IBAN', rail: 'SWIFT', currency: 'CHF', sampleAcct: 'CH9300762011623', routingCode: 'UBSWCHZH', settlementSpeed: 'Same Day' },
  { id: 'br-pix', country: 'Brazil', region: 'international', bankName: 'Nubank / Itaú PIX Corridor', rail: 'WIRE', currency: 'USD', sampleAcct: 'BR180036030500', routingCode: 'NUBKBRSP', settlementSpeed: 'Instant PIX' },
  { id: 'lk-lankapay', country: 'Sri Lanka / Nepal', region: 'international', bankName: 'LankaPay / Fonepay Cross-UPI', rail: 'UPI', currency: 'USD', sampleAcct: 'investor@lankapay', routingCode: 'CBSL-UPI', settlementSpeed: 'Instant (<15s)' },
];

const INITIAL_INVESTOR_PROFILES: InvestorProfile[] = [
  // Famous Public Investors (Strictly Educational / Public Historical Filing Summaries — Zero Affiliation/Endorsement)
  {
    id: 'inv-famous-buffett',
    category: 'famous',
    name: 'Warren Buffett',
    handle: '@berkshire_13f_archive',
    title: 'Value Compounding · Public 13F Archive',
    country: 'United States',
    verificationBadge: 'PUBLIC-13F-ARCHIVE',
    kycVerified: true,
    style: 'Long-Term Intrinsic Value & Moat Investing',
    focusMarkets: ['AAPL', 'SPY', 'JPM'],
    topHoldings: ['Apple', 'American Express', 'Coca-Cola', 'T-Bills'],
    winRatePct: 81.4,
    returnYtdPct: 19.8,
    aumOrCapitalLabel: 'Public SEC 13F Filing Study',
    followers: 48200,
    following: false,
    bio: 'Historical portfolio study based strictly on public SEC Form 13F quarterly disclosures: concentrated durable competitive moats and cash-generative balance sheets.',
    disclaimerNote: 'Educational study of public SEC 13F filings. Not affiliated with or endorsed by Berkshire Hathaway.',
    updatedAt: Date.now() - 86400_000,
  },
  {
    id: 'inv-famous-jhunjhunwala',
    category: 'famous',
    name: 'Rakesh Jhunjhunwala (Legacy Archive)',
    handle: '@rare_india_archive',
    title: 'India Structural Growth · Public Archive',
    country: 'India',
    verificationBadge: 'PUBLIC-BSE-ARCHIVE',
    kycVerified: true,
    style: 'Multi-Decade India Secular Compounding',
    focusMarkets: ['NIFTY50.NS', 'HDFCBANK.NS', 'RELIANCE.NS', 'TATAMOTORS.NS'],
    topHoldings: ['Titan Co.', 'Tata Motors', 'Metro Brands', 'PSU Banks'],
    winRatePct: 79.2,
    returnYtdPct: 24.6,
    aumOrCapitalLabel: 'Public NSE/BSE Shareholding Archive',
    followers: 39400,
    following: false,
    bio: 'Public shareholding case study examining conviction in Indian domestic consumption, formal banking, and manufacturing turnarounds over multi-year cycles.',
    disclaimerNote: 'Historical educational tribute compiled from public NSE/BSE shareholding filings.',
    updatedAt: Date.now() - 86400_000,
  },
  {
    id: 'inv-famous-dalio',
    category: 'famous',
    name: 'Ray Dalio',
    handle: '@allweather_macro_study',
    title: 'Global Macro & Risk Parity · Public Archive',
    country: 'United States',
    verificationBadge: 'PUBLIC-13F-ARCHIVE',
    kycVerified: true,
    style: 'All-Weather Risk-Parity Diversification',
    focusMarkets: ['XAU-USD', 'SPY', 'US10Y', 'EUR-USD'],
    topHoldings: ['S&P 500 ETF', 'Gold Bullion', 'Long Treasuries', 'Emerging Asia'],
    winRatePct: 76.5,
    returnYtdPct: 15.2,
    aumOrCapitalLabel: 'Public Macro Principles Study',
    followers: 31800,
    following: false,
    bio: 'Balances growth vs. inflation regimes across uncorrelated return streams—equities, sovereign bonds, commodities, and sovereign FX hedges.',
    disclaimerNote: 'Educational study of public macroeconomic writings & 13F filings. Not affiliated with Bridgewater.',
    updatedAt: Date.now() - 86400_000,
  },
  {
    id: 'inv-famous-damani',
    category: 'famous',
    name: 'Radhakishan Damani',
    handle: '@india_retail_value',
    title: 'Concentrated Retail & Consumer Value',
    country: 'India',
    verificationBadge: 'PUBLIC-BSE-ARCHIVE',
    kycVerified: true,
    style: 'Low-Debt Cashflow & Retail Efficiency',
    focusMarkets: ['SENSEX.BO', 'ITC.NS', 'HDFCBANK.NS'],
    topHoldings: ['Avenue Supermarts (DMart)', 'Consumer Staples', 'VST'],
    winRatePct: 80.1,
    returnYtdPct: 21.3,
    aumOrCapitalLabel: 'Public Exchange Disclosure Study',
    followers: 24900,
    following: false,
    bio: 'Public disclosure study focusing on disciplined inventory turnover, zero-debt expansion, and patient multi-year compounding in Indian equities.',
    disclaimerNote: 'Compiled solely from public NSE/BSE regulatory disclosures for educational research.',
    updatedAt: Date.now() - 86400_000,
  },
  {
    id: 'inv-famous-druckenmiller',
    category: 'famous',
    name: 'Stanley Druckenmiller',
    handle: '@duquesne_macro_13f',
    title: 'Tactical Macro & Liquidity Momentum',
    country: 'United States',
    verificationBadge: 'PUBLIC-13F-ARCHIVE',
    kycVerified: true,
    style: 'Asymmetric Liquidity & Earnings Acceleration',
    focusMarkets: ['NVDA', 'NQ-FUT', 'XAU-USD', 'USD-JPY'],
    topHoldings: ['AI Semiconductors', 'Natera', 'Gold', 'Rate Curves'],
    winRatePct: 77.8,
    returnYtdPct: 28.4,
    aumOrCapitalLabel: 'Public Duquesne Family Office 13F',
    followers: 28600,
    following: false,
    bio: 'Educational study of central-bank liquidity inflections combined with concentrated conviction in secular tech & macro regime shifts.',
    disclaimerNote: 'Educational summary of public SEC 13F filings. Non-affiliated.',
    updatedAt: Date.now() - 86400_000,
  },
  {
    id: 'inv-famous-wood',
    category: 'famous',
    name: 'Cathie Wood',
    handle: '@disruptive_innovation_study',
    title: 'Thematic Innovation & AI · Public ETFs',
    country: 'United States',
    verificationBadge: 'PUBLIC-ETF-ARCHIVE',
    kycVerified: true,
    style: '5-Year Exponential Tech Wright’s Law',
    focusMarkets: ['TSLA', 'BTC-USD', 'COIN', 'NVDA'],
    topHoldings: ['Tesla', 'Coinbase', 'Roku', 'Spot Bitcoin ETF'],
    winRatePct: 62.4,
    returnYtdPct: 18.9,
    aumOrCapitalLabel: 'Public Daily ETF Holdings',
    followers: 26300,
    following: false,
    bio: 'Tracks public daily ETF trade disclosures centered on autonomous mobility, AI compute, robotics, and digital assets.',
    disclaimerNote: 'Public ETF disclosure study for educational reference only.',
    updatedAt: Date.now() - 86400_000,
  },

  // Verified Normal / Everyday & Community Investors
  {
    id: 'inv-comm-aarav',
    category: 'community',
    name: 'Aarav Mehta',
    handle: '@aarav_nse_quant',
    title: 'Everyday Systematic SIP & Options Hedger',
    country: 'India',
    verificationBadge: 'KYC-TIER2-IN-8841',
    kycVerified: true,
    style: 'Nifty Covered Calls + Bluechip SIP',
    focusMarkets: ['RELIANCE.NS', 'TCS.NS', 'NIFTY-24000CE.NS'],
    topHoldings: ['Reliance', 'TCS', 'HDFC Bank', 'Nifty Bees'],
    winRatePct: 71.4,
    returnYtdPct: 22.1,
    aumOrCapitalLabel: 'Verified Desk Trader (Tier 2 KYC)',
    followers: 1420,
    following: true,
    bio: 'Full-time software engineer investing monthly INR savings into Indian bluechips and hedged covered options with strict max-loss stops.',
    disclaimerNote: 'KYC Document Verified via SHA-256 Anti-Scam Registry.',
    updatedAt: Date.now() - 3600_000,
  },
  {
    id: 'inv-comm-elena',
    category: 'community',
    name: 'Elena Vance',
    handle: '@elena_semi_desk',
    title: 'Semiconductor & Index Momentum Trader',
    country: 'United Kingdom',
    verificationBadge: 'KYC-TIER2-UK-4192',
    kycVerified: true,
    style: 'VWAP Pullback + ATR Position Sizing',
    focusMarkets: ['NVDA', 'ASML.AS', 'ES-FUT'],
    topHoldings: ['NVDA', 'ASML', 'TSMC', 'S&P 500 Futures'],
    winRatePct: 74.8,
    returnYtdPct: 26.4,
    aumOrCapitalLabel: 'Verified Desk Trader (Tier 2 KYC)',
    followers: 2890,
    following: false,
    bio: 'Focuses on strict 24h ATR stop sizing across US/EU chipmakers and S&P futures with zero overnight unhedged leverage.',
    disclaimerNote: 'KYC Document Verified via SHA-256 Anti-Scam Registry.',
    updatedAt: Date.now() - 7200_000,
  },
  {
    id: 'inv-comm-marcus',
    category: 'community',
    name: 'Marcus Chen',
    handle: '@marcus_sg_macro',
    title: 'Crypto Spot + Gold Carry Allocator',
    country: 'Singapore',
    verificationBadge: 'KYC-TIER2-SG-9027',
    kycVerified: true,
    style: 'Bitcoin Spot + Gold Sovereign Barbell',
    focusMarkets: ['BTC-USD', 'ETH-USD', 'XAU-USD', 'USD-SGD'],
    topHoldings: ['BTC Spot', 'ETH Spot', 'COMEX Gold', 'SGD T-Bills'],
    winRatePct: 68.2,
    returnYtdPct: 31.7,
    aumOrCapitalLabel: 'Verified Desk Trader (Tier 2 KYC)',
    followers: 1185,
    following: false,
    bio: 'Pairs PayNow-settled savings in gold and Singapore T-bills with disciplined spot accumulation in Bitcoin and Ethereum.',
    disclaimerNote: 'KYC Document Verified via SHA-256 Anti-Scam Registry.',
    updatedAt: Date.now() - 10800_000,
  },
  {
    id: 'inv-comm-priya',
    category: 'community',
    name: 'Priya Nair',
    handle: '@priya_fx_swing',
    title: 'Part-Time Forex & Commodity Swing Investor',
    country: 'UAE',
    verificationBadge: 'KYC-TIER2-AE-3310',
    kycVerified: true,
    style: '4H Swing Structure & Mean Reversion',
    focusMarkets: ['EUR-USD', 'USD-INR', 'XAU-FUT'],
    topHoldings: ['EUR-USD', 'Gold Futures', 'USD-INR Carry'],
    winRatePct: 69.5,
    returnYtdPct: 17.8,
    aumOrCapitalLabel: 'Verified Desk Trader (Tier 2 KYC)',
    followers: 860,
    following: false,
    bio: 'Retail swing trader based in Dubai using Aani-UPI corridors and 4h Bollinger + Fib retracements to manage multi-currency exposure.',
    disclaimerNote: 'Verified Tier 2 Account',
    updatedAt: Date.now() - 14400_000,
  },
  // Institutional & Organization Trading Desks (Factual Quantitative Directory — No Legalese)
  {
    id: 'inv-org-temasek',
    category: 'organization',
    name: 'Sovereign Asia Allocation Desk',
    handle: '@sg_sovereign_macro',
    title: 'Multi-Horizon Infrastructure & Tech Fund',
    country: 'Singapore',
    verificationBadge: 'ORG-INSTITUTIONAL-SG',
    kycVerified: true,
    style: 'Global Equity Core + Sovereign FX Neutrality',
    focusMarkets: ['TSM', 'NVDA', 'USD-SGD', 'RELIANCE.NS'],
    topHoldings: ['TSMC', 'NVIDIA', 'DBS Group', 'India Infrastructure'],
    winRatePct: 78.4,
    returnYtdPct: 20.6,
    aumOrCapitalLabel: 'Institutional Organization Desk',
    followers: 19400,
    following: false,
    bio: 'Cross-border institutional allocation covering Asian foundries, Indian enterprise banking, and currency-hedged sovereign liquidity.',
    disclaimerNote: 'Verified Organization',
    updatedAt: Date.now() - 7200_000,
  },
  {
    id: 'inv-org-norges',
    category: 'organization',
    name: 'Nordic Index & Yield Mandate',
    handle: '@nordic_index_mandate',
    title: 'Global Equities & Fixed Income Allocator',
    country: 'Norway / Europe',
    verificationBadge: 'ORG-INSTITUTIONAL-EU',
    kycVerified: true,
    style: 'Low-Turnover Global Factor Weighting',
    focusMarkets: ['MSFT', 'AAPL', 'ASML.AS', 'XAU-USD'],
    topHoldings: ['Microsoft', 'Apple', 'ASML', 'European Sovereign Bills'],
    winRatePct: 82.1,
    returnYtdPct: 16.4,
    aumOrCapitalLabel: 'Institutional Organization Desk',
    followers: 24100,
    following: false,
    bio: 'Broad global diversification combining hyperscale software cashflows, European lithography leaders, and inflation-linked reserves.',
    disclaimerNote: 'Verified Organization',
    updatedAt: Date.now() - 7200_000,
  },
  {
    id: 'inv-org-quantmm',
    category: 'organization',
    name: 'Meridian-Vector Market Makers',
    handle: '@vector_liquidity_org',
    title: 'Delta-Neutral Crypto & Equities Liquidity',
    country: 'Switzerland',
    verificationBadge: 'ORG-INSTITUTIONAL-CH',
    kycVerified: true,
    style: 'Microsecond Order-Book Spread Capture',
    focusMarkets: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'EUR-USD'],
    topHoldings: ['BTC Basis', 'ETH Perp Hedge', 'T-Bill Collateral', 'EUR Liquidity'],
    winRatePct: 74.9,
    returnYtdPct: 29.3,
    aumOrCapitalLabel: 'Verified Market-Maker Organization',
    followers: 11200,
    following: false,
    bio: 'Provides continuous two-sided liquidity across spot crypto pairs and G10 FX books using REA hash-chained inventory reconciliation.',
    disclaimerNote: 'Verified Organization',
    updatedAt: Date.now() - 3600_000,
  },
];

const kycRecordsByUser = new Map<string, KycVerificationRecord>();
const investorProfilesList: InvestorProfile[] = [...INITIAL_INVESTOR_PROFILES];
const scamReportsList: ScamReportRecord[] = [
  {
    id: 'scm-seed-1',
    suspectedHandle: '@nuvra_guaranteed_double_bot',
    channel: 'Telegram / WhatsApp',
    description: 'Fake signal group claiming guaranteed 40% weekly returns using unauthorized Nuvra branding.',
    reportedBy: 'Anti-Scam Automated Monitor',
    status: 'CONFIRMED_SCAM_BLOCKED',
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
  },
];

function maskDocumentNumber(raw: string): string {
  const clean = raw.replace(/\s+/g, '');
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

export function getKycVerification(userId: string): KycVerificationRecord {
  const existing = kycRecordsByUser.get(userId);
  if (existing) return existing;
  return {
    userId,
    tier: 'Unverified',
    status: 'NOT_SUBMITTED',
    country: 'India',
    fullName: '',
    docType: 'Passport',
    maskedDocNumber: 'Not linked',
    docHash: '',
    proofOfAddressType: 'Utility Bill / Bank Statement',
    selfieVerified: false,
    badgeCode: 'UNVERIFIED',
    updatedAt: Date.now(),
  };
}

export function submitKycVerification(params: {
  userId: string;
  country: string;
  fullName: string;
  docType: KycDocumentType;
  docNumber: string;
  proofOfAddressType: string;
  selfieLivenessToken: string;
  antiScamPledge: boolean;
}): { ok: boolean; error?: string; record?: KycVerificationRecord } {
  const fullName = params.fullName.trim();
  const country = params.country.trim();
  const docNumber = params.docNumber.trim();
  const liveness = params.selfieLivenessToken.trim();

  if (fullName.length < 3) {
    return { ok: false, error: 'Legal full name (minimum 3 characters) is required for KYC verification.' };
  }
  if (!country) {
    return { ok: false, error: 'Country of residence is required for regulatory compliance.' };
  }
  if (docNumber.length < 5) {
    return { ok: false, error: 'Enter a valid Government ID / Passport / Aadhaar / PAN number (min 5 chars).' };
  }
  if (liveness.length < 4) {
    return { ok: false, error: 'Complete selfie liveness confirmation before submitting KYC.' };
  }
  if (!params.antiScamPledge) {
    return { ok: false, error: 'You must sign the Anti-Scam & Non-Impersonation Attestation.' };
  }

  const normalizedDoc = docNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const docHash = crypto.createHash('sha256').update(`${params.docType}:${normalizedDoc}`).digest('hex').slice(0, 20);
  const badgeCode = `KYC-TIER2-${country.slice(0, 2).toUpperCase()}-${docHash.slice(0, 4).toUpperCase()}`;

  const record: KycVerificationRecord = {
    userId: params.userId,
    tier: 'Tier 2 Documented',
    status: 'VERIFIED',
    country,
    fullName,
    docType: params.docType,
    maskedDocNumber: maskDocumentNumber(docNumber),
    docHash,
    proofOfAddressType: params.proofOfAddressType.trim() || 'Bank Statement / Utility Bill',
    selfieVerified: true,
    antiScamPledgeAt: Date.now(),
    badgeCode,
    updatedAt: Date.now(),
  };
  kycRecordsByUser.set(params.userId, record);

  // Upgrade user's community investor profile badge if already published
  const existingProfile = investorProfilesList.find((p) => p.id === `inv-user-${params.userId}`);
  if (existingProfile) {
    existingProfile.kycVerified = true;
    existingProfile.verificationBadge = badgeCode;
    existingProfile.country = country;
    existingProfile.updatedAt = Date.now();
  }

  return { ok: true, record };
}

export function listInvestorProfiles(): InvestorProfile[] {
  return investorProfilesList;
}

export function toggleFollowInvestorProfile(profileId: string): InvestorProfile | null {
  const found = investorProfilesList.find((p) => p.id === profileId);
  if (!found) return null;
  found.following = !found.following;
  found.followers += found.following ? 1 : -1;
  return found;
}

export function publishMyInvestorProfile(params: {
  userId: string;
  name: string;
  title: string;
  style: string;
  country: string;
  focusMarkets: string[];
  bio: string;
}): InvestorProfile {
  const kyc = getKycVerification(params.userId);
  const profileId = `inv-user-${params.userId}`;
  const cleanHandle = `@${params.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20) || 'verified_trader'}`;

  const existingIdx = investorProfilesList.findIndex((p) => p.id === profileId);
  const nextProfile: InvestorProfile = {
    id: profileId,
    category: 'community',
    name: params.name.trim() || 'Verified Nuvra Trader',
    handle: cleanHandle,
    title: params.title.trim() || 'Independent Multi-Asset Trader',
    country: params.country.trim() || kyc.country || 'Global',
    verificationBadge: kyc.status === 'VERIFIED' ? kyc.badgeCode : 'STANDARD-MEMBER',
    kycVerified: kyc.status === 'VERIFIED',
    style: params.style.trim() || 'Diversified Spot & Risk-Managed Trends',
    focusMarkets: params.focusMarkets.length ? params.focusMarkets.slice(0, 5) : ['NVDA', 'BTC-USD', 'RELIANCE.NS'],
    topHoldings: params.focusMarkets.length ? params.focusMarkets.slice(0, 4) : ['NVDA', 'BTC-USD', 'RELIANCE.NS'],
    winRatePct: existingIdx >= 0 ? investorProfilesList[existingIdx].winRatePct : 66.5,
    returnYtdPct: existingIdx >= 0 ? investorProfilesList[existingIdx].returnYtdPct : 14.2,
    aumOrCapitalLabel: kyc.status === 'VERIFIED' ? 'Verified Desk Trader (Tier 2 KYC)' : 'Desk Community Member',
    followers: existingIdx >= 0 ? investorProfilesList[existingIdx].followers : 1,
    following: false,
    bio: params.bio.trim() || 'Active investor publishing transparent, risk-managed market focus on Nuvra.',
    disclaimerNote: kyc.status === 'VERIFIED' ? `Verified (${kyc.badgeCode})` : 'Member',
    updatedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    investorProfilesList[existingIdx] = nextProfile;
  } else {
    investorProfilesList.splice(6, 0, nextProfile);
  }
  return nextProfile;
}

export function listScamReports(): ScamReportRecord[] {
  return scamReportsList;
}

export function submitScamReport(params: {
  suspectedHandle: string;
  channel: string;
  description: string;
  reportedBy: string;
}): { ok: boolean; error?: string; report?: ScamReportRecord } {
  const handle = params.suspectedHandle.trim();
  const description = params.description.trim();
  if (handle.length < 2 || description.length < 8) {
    return {
      ok: false,
      error: 'Provide both the suspected impersonator handle/URL and a clear description (min 8 chars).',
    };
  }
  const report: ScamReportRecord = {
    id: `scm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    suspectedHandle: handle.slice(0, 80),
    channel: params.channel.trim().slice(0, 40) || 'External Social / App',
    description: description.slice(0, 320),
    reportedBy: params.reportedBy,
    status: 'INVESTIGATING',
    createdAt: Date.now(),
  };
  scamReportsList.unshift(report);
  if (scamReportsList.length > 50) scamReportsList.pop();
  return { ok: true, report };
}

export function buildNextMoveInterestRadar(
  instruments: Instrument[],
  predictions: Record<string, MlPrediction>,
  news: NewsItem[]
): NextMoveInterestItem[] {
  const newsCounts = new Map<string, number>();
  for (const item of news) {
    for (const sym of item.symbols) {
      newsCounts.set(sym, (newsCounts.get(sym) ?? 0) + 1);
    }
  }

  return instruments
    .map((inst) => {
      const pred = predictions[inst.symbol];
      const mentions = newsCounts.get(inst.symbol) ?? 0;
      const opp = pred?.opportunityScore ?? 55;
      const momentumBoost = Math.min(18, Math.abs(inst.changePct) * 3.5);
      const newsBoost = Math.min(24, mentions * 8);
      const heatScore = Math.min(99, Math.round(opp * 0.68 + momentumBoost + newsBoost));
      const direction = pred?.direction ?? (inst.changePct >= 0 ? 'Bullish' : 'Bearish');

      const regionLabel =
        inst.region === 'india'
          ? 'India NSE/BSE'
          : inst.region === 'crypto'
          ? 'Global Crypto'
          : inst.region === 'europe'
          ? 'Europe'
          : inst.region === 'asia'
          ? 'Asia-Pacific'
          : inst.region === 'fx'
          ? 'Global FX'
          : inst.region === 'commodities'
          ? 'Commodities'
          : 'United States';

      const reason =
        mentions > 0
          ? `${mentions} active news catalyst(s) + ${opp}/100 ML score in ${inst.sector ?? regionLabel}`
          : `${inst.instrumentType === 'futures' ? 'Futures open interest' : inst.instrumentType === 'options' ? 'Options flow' : 'Spot breadth'} shift (${inst.changePct >= 0 ? '+' : ''}${inst.changePct.toFixed(2)}%)`;

      return {
        symbol: inst.symbol,
        name: inst.name,
        region: regionLabel,
        sector: inst.sector ?? 'Global Markets',
        heatScore,
        direction,
        newsMentions: mentions,
        opportunityScore: opp,
        predictedReturnPct: pred?.predictedReturnPct ?? 0,
        reason,
      };
    })
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 12);
}
