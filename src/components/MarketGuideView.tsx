import { useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, FileText, Globe, HelpCircle, Search, ShieldCheck } from 'lucide-react';
import type { CountryGuideline } from '../types/market';

interface MarketGuideViewProps {
  countryGuidelines?: CountryGuideline[];
  onNavigate: (view: 'screener' | 'terminal' | 'overview' | 'vault' | 'guide') => void;
  onOpenSampleTrade: (symbol: string) => void;
}

interface GlossaryEntry {
  term: string;
  category: 'Orders & Trading' | 'Vault & Payments' | 'AI Predictions' | 'Risk & Profit';
  plainSummary: string;
  example: string;
}

const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Demo Account vs. Real Trading Account vs. Cold Vault',
    category: 'Vault & Payments',
    plainSummary:
      'Your Demo Account gives you $1,000,000 in virtual funds so you can practice placing trades and reading charts with zero risk. Your Real Trading Account holds deposited money ready for trading. Your Cold Vault is a separate hacker-proof safe where funds cannot be traded or withdrawn until unlocked with a 2FA code.',
    example:
      'Keep long-term savings locked inside Cold Vault Shield, and only move the exact amount you want to trade into your Real Trading Account.',
  },
  {
    term: 'Easy Global Deposits & UPI Corridors (10 Currencies)',
    category: 'Vault & Payments',
    plainSummary:
      'In Wallet & Vault, users across India, Singapore (PayNow), UAE (Aani), Sri Lanka, Mauritius, Nepal, Bhutan, US, UK, EU, Japan, Australia, Canada, and Switzerland can link UPI corridors or bank rails across 10 currencies (INR, USD, EUR, GBP, SGD, AED, JPY, AUD, CAD, CHF). Every deposit requires a fresh 6-digit 2FA OTP code.',
    example:
      'Deposit ₹25,000 via UPI and choose whether it lands directly in your Cold Vault Shield or your Real Trading Account.',
  },
  {
    term: 'Market Order vs. Limit Order vs. Stop Order',
    category: 'Orders & Trading',
    plainSummary:
      'A Market order buys or sells immediately at the best price available now. A Limit order waits until the price reaches your chosen level. A Stop order triggers automatically if price hits your safety exit or breakout point.',
    example:
      'If BTC-USD is $95,000 and you only want to buy at $93,500, place a Limit Buy at $93,500.',
  },
  {
    term: 'AI Chart Predictions (15m / 1h / 4h), Support & Resistance',
    category: 'AI Predictions',
    plainSummary:
      'Our AI chart engine draws a green Support floor (where buyers often step in) and a red Resistance ceiling (where sellers often take profit), plus a forecast cone for 15m, 1h, or 4h horizons with a plain-English summary and suggested Stop-Loss and Take-Profit.',
    example:
      'Click "Use AI Target" below the chart inside Trade to automatically load the suggested target and stop levels into the What-If Profit Simulator.',
  },
  {
    term: 'What-If Profit Simulator',
    category: 'Risk & Profit',
    plainSummary:
      'Built directly inside the Order Ticket so you can drag a target exit slider before placing any trade and instantly see projected net profit/loss after fees and your exact break-even price.',
    example:
      'Slide the target exit to +5% before hitting Buy to check if the reward is worth your risk.',
  },
  {
    term: '24-Agent Live Performance Leaderboard & Safety Gate',
    category: 'AI Predictions',
    plainSummary:
      'The AI Agents tab tracks 24 specialist agents scoring live mark-to-market return %, win rate, Sharpe ratio, and streak across real market feeds while Agent A24 enforces deterministic position & spread risk limits.',
    example:
      'Open AI Agents from the left sidebar to inspect the live ranked #1-#24 leaderboard and execute 10 quantitative skills.',
  },
];

export function MarketGuideView({
  countryGuidelines = [],
  onNavigate,
  onOpenSampleTrade,
}: MarketGuideViewProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'glossary' | 'compliance' | 'legal'>('guide');
  const [category, setCategory] = useState<'All' | GlossaryEntry['category']>('All');
  const [search, setSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GLOSSARY.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (
        q &&
        !item.term.toLowerCase().includes(q) &&
        !item.plainSummary.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [category, search]);

  const workflowSteps = [
    {
      step: 'Step 01',
      title: 'Browse 116+ Global Markets',
      desc: 'Explore Crypto coins, India NSE/BSE stocks, US & European equities, Gold, and Forex pairs with clear opportunity scores.',
      actionLabel: 'Open Markets',
      onClick: () => onNavigate('screener'),
    },
    {
      step: 'Step 02',
      title: 'Practice Risk-Free in Demo',
      desc: 'Stay on your $1,000,000 Demo Account to inspect live charts, AI 15m/1h/4h predictions, and simulate profits before risking money.',
      actionLabel: 'Try Trade on NVDA',
      onClick: () => onOpenSampleTrade('NVDA'),
    },
    {
      step: 'Step 03',
      title: 'Ask AI Agents & Coach',
      desc: 'Track the 24 live AI Agents scoreboard, run 10 quantitative skills, or ask the AI Coach any question at the top bar.',
      actionLabel: 'Open AI Signals',
      onClick: () => onNavigate('overview'),
    },
    {
      step: 'Step 04',
      title: 'Deposit & Lock in Cold Vault',
      desc: 'Add money easily via Global UPI Corridors or 10-currency banking, lock idle capital inside Cold Vault, and activate Real Trading.',
      actionLabel: 'Open Wallet & Vault',
      onClick: () => onNavigate('vault'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Sub-Tab Bar */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-[#EAECEF]">
            Aurex Help Center, Privacy Policy &amp; Strict Legal Terms
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#848E9C] mt-0.5">
            Plain-English trading walkthroughs, key financial terms, and institutional liability protections.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              activeTab === 'guide'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Beginner Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('glossary')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              activeTab === 'glossary'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Market Glossary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              activeTab === 'compliance'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Country Rules &amp; IP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('legal')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              activeTab === 'legal'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Privacy &amp; Terms
          </button>
        </div>
      </div>

      {activeTab === 'guide' && (
        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              4 Simple Steps to Trade Safely &amp; Understand Charts
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#848E9C]">
              Everything is organized cleanly—start risk-free in Demo mode and switch to Real Trading only when you are ready.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {workflowSteps.map((w) => (
              <div
                key={w.step}
                className="p-4 rounded-lg border border-slate-200 dark:border-[#2B3139] bg-slate-50/60 dark:bg-[#0B0E11]/60 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="text-[11px] font-mono font-semibold text-[#D9A70A] dark:text-[#F0B90B]">
                    {w.step}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                    {w.title}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
                    {w.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={w.onClick}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#D9A70A] dark:text-[#F0B90B] hover:underline self-start"
                >
                  {w.actionLabel}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'glossary' && (
        <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-[#2B3139]">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#0B0E11] rounded-lg">
              {(
                ['All', 'Orders & Trading', 'Vault & Payments', 'AI Predictions', 'Risk & Profit'] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    category === cat
                      ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                      : 'text-slate-600 dark:text-[#848E9C]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search any concept..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF] focus:outline-none focus:ring-2 focus:ring-[#F0B90B]"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-[#2B3139]">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-[#848E9C]">
                No concepts matched your search.
              </div>
            ) : (
              filtered.map((entry) => (
                <div key={entry.term} className="p-5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {entry.term}
                    </h3>
                    <span className="text-xs font-mono text-[#D9A70A] dark:text-[#F0B90B]">
                      {entry.category}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-[#B7BDC6]">
                    {entry.plainSummary}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#848E9C] pt-1">
                    <strong className="text-slate-700 dark:text-[#EAECEF]">Example:</strong>{' '}
                    {entry.example}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Global Country Regulatory Guidelines &amp; Copyright Safe Harbor
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#848E9C]">
                Jurisdiction-specific rules across India, US, UK, EU, Singapore, UAE, Japan, Australia, Canada, Switzerland, Brazil, plus global DMCA copyright protection.
              </p>
            </div>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Filter country or regulator..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {countryGuidelines
              .filter((g) => {
                const q = countrySearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  g.countryName.toLowerCase().includes(q) ||
                  g.countryCode.toLowerCase().includes(q) ||
                  g.regulator.toLowerCase().includes(q)
                );
              })
              .map((g) => (
                <div
                  key={g.countryCode}
                  className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#2B3139]">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                        {g.countryName} ({g.countryCode})
                      </div>
                      <div className="font-mono text-[11px] text-[#B45309] dark:text-[#F0B90B]">
                        {g.regulator}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-[#0ECB81] font-semibold">
                      {g.accessStatus}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
                    <strong className="text-slate-800 dark:text-[#EAECEF]">Digital Assets &amp; Policy:</strong>{' '}
                    {g.cryptoPolicy}
                  </p>
                  <p className="text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
                    <strong className="text-slate-800 dark:text-[#EAECEF]">Equities, FX &amp; Derivatives:</strong>{' '}
                    {g.equitiesFxDerivativesRules}
                  </p>
                  <p className="text-slate-500 dark:text-[#848E9C] leading-relaxed">
                    <strong className="text-slate-700 dark:text-[#EAECEF]">Tax &amp; Reporting:</strong>{' '}
                    {g.taxAndReportingNote}
                  </p>
                  <div className="pt-1 font-mono text-[11px] text-slate-500 dark:text-[#848E9C]">
                    Rails: {g.supportedPaymentRails.join(' · ')}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'legal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-[#B7BDC6]">
            <div className="flex items-center gap-2 text-slate-900 dark:text-[#EAECEF] font-semibold text-sm border-b border-slate-200 dark:border-[#2B3139] pb-2.5">
              <ShieldCheck className="w-4 h-4 text-[#0ECB81]" />
              <span>Aurex Privacy &amp; Zero-Trust Data Policy</span>
            </div>
            <p>
              <strong className="text-slate-900 dark:text-[#EAECEF]">1. Credential Protection:</strong> Passwords are protected via salted Scrypt key derivation and sessions use HttpOnly HMAC-SHA256 cookies. TOTP secrets and raw account digits are never logged or exposed back to the browser.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-[#EAECEF]">2. Encrypted Payment Rails:</strong> All Global UPI handles, IMPS/NEFT accounts, IFSC codes, IBANs, ACH routing codes, and card tokens are encrypted server-side using AES-256-GCM before storage and masked in UI tables.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-[#EAECEF]">3. Security Auditing &amp; Secret Isolation:</strong> Login, registration, MFA, and Cold Vault operations are hash-chained with HMAC-SHA256 solely for cyber defense and Founder-only security monitoring. Platform keys and directory controls remain strictly isolated to the Founder. We never sell investor data.
            </p>
          </div>

          <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-[#B7BDC6]">
            <div className="flex items-center gap-2 text-slate-900 dark:text-[#EAECEF] font-semibold text-sm border-b border-slate-200 dark:border-[#2B3139] pb-2.5">
              <FileText className="w-4 h-4 text-[#F0B90B]" />
              <span>Strict Terms &amp; Conditions, Liability Cap &amp; Arbitration</span>
            </div>
            <p>
              <strong className="text-slate-900 dark:text-[#EAECEF]">1. Strictly Non-Advisory &amp; AS-IS Zero Warranty:</strong> Aurex Global Exchange provides quantitative analytics, 24-agent scoreboards, and chart forecasts for educational software use only—never financial, legal, or tax advice. Software is provided &ldquo;AS IS&rdquo; without warranties of merchantability or profit.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-[#EAECEF]">2. Maximum Liability Cap &amp; Indemnification:</strong> Aggregate liability of Aurex and its Founder is strictly capped at the greater of USD $100 or platform fees paid in the past 3 months. Users indemnify Aurex against losses, regulatory claims, tax obligations, or misuse arising from their trading or account activity.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-[#EAECEF]">3. Binding Arbitration, Tax &amp; Third-Party Rails:</strong> All disputes are governed by mandatory binding individual arbitration with an irrevocable class-action waiver. Users are solely responsible for local taxes, KYC compliance, and sanctions rules. Aurex disclaims liability for third-party payment rail or market feed delays and reserves the right to suspend abusive accounts.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-[#EAECEF]">4. Smart Bots, Rewards &amp; Anti-Exploit Protection:</strong> Quantitative bots, OCO/trailing orders, XP quests, and X25519 network tools operate strictly AS-IS with zero profit warranty. Sybil farming, unauthorized key probing, or sanctions violations cause immediate reward forfeiture and permanent quarantine; Force Majeure and severability survive termination.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
