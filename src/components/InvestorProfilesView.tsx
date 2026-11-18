import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  CheckCircle2,
  FileCheck2,
  Gift,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  AuthUser,
  InvestorProfile,
  KycDocumentType,
  KycVerificationRecord,
  ScamReportRecord,
  SocialGraphState,
  UserRewardsState,
} from '../types/market';

interface InvestorProfilesViewProps {
  authUser: AuthUser;
  kycRecord: KycVerificationRecord | null;
  profiles: InvestorProfile[];
  scamReports: ScamReportRecord[];
  rewardsState?: UserRewardsState | null;
  socialGraph?: SocialGraphState | null;
  onClaimQuest?: (questId: string) => Promise<{ ok: boolean; error?: string }>;
  onRefreshRewardsAndSocial?: () => Promise<void>;
  onSubmitKyc: (payload: {
    country: string;
    fullName: string;
    docType: KycDocumentType;
    docNumber: string;
    proofOfAddressType: string;
    selfieLivenessToken: string;
    antiScamPledge: boolean;
  }) => Promise<{ ok: boolean; error?: string; kyc?: KycVerificationRecord }>;
  onFollowProfile: (id: string) => Promise<void>;
  onPublishProfile: (payload: {
    title: string;
    style: string;
    country: string;
    focusMarkets: string[];
    bio: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onSubmitScamReport: (payload: {
    suspectedHandle: string;
    channel: string;
    description: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onOpenTerminal: (symbol: string) => void;
}

export function InvestorProfilesView({
  authUser,
  kycRecord,
  profiles,
  scamReports,
  rewardsState = null,
  socialGraph = null,
  onClaimQuest,
  onRefreshRewardsAndSocial,
  onSubmitKyc,
  onFollowProfile,
  onPublishProfile,
  onSubmitScamReport,
  onOpenTerminal,
}: InvestorProfilesViewProps) {
  const [subTab, setSubTab] = useState<'directory' | 'rewards' | 'kyc' | 'scam'>('directory');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'famous' | 'organization' | 'community' | 'following'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // KYC form state
  const [kycCountry, setKycCountry] = useState(kycRecord?.country || 'India');
  const [kycFullName, setKycFullName] = useState(kycRecord?.fullName || authUser.name);
  const [kycDocType, setKycDocType] = useState<KycDocumentType>(kycRecord?.docType || 'Passport');
  const [kycDocNumber, setKycDocNumber] = useState('');
  const [kycAddressProof, setKycAddressProof] = useState('Bank Statement / Utility Bill');
  const [kycLivenessToken, setKycLivenessToken] = useState('');
  const [kycAntiScamPledge, setKycAntiScamPledge] = useState(false);
  const [kycBusy, setKycBusy] = useState(false);
  const [kycError, setKycError] = useState('');

  // Publish my investor profile form
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [pubTitle, setPubTitle] = useState('Systematic Multi-Asset Investor');
  const [pubStyle, setPubStyle] = useState('Momentum + Risk-Managed Spot');
  const [pubCountry, setPubCountry] = useState(kycRecord?.country || 'India');
  const [pubMarkets, setPubMarkets] = useState('NVDA, BTC-USD, RELIANCE.NS');
  const [pubBio, setPubBio] = useState('');
  const [pubBusy, setPubBusy] = useState(false);
  const [pubError, setPubError] = useState('');

  // Scam report form
  const [scamHandle, setScamHandle] = useState('');
  const [scamChannel, setScamChannel] = useState('Telegram / WhatsApp');
  const [scamDesc, setScamDesc] = useState('');
  const [scamBusy, setScamBusy] = useState(false);
  const [scamError, setScamError] = useState('');

  const followingSet = useMemo(
    () => new Set(socialGraph?.followingIds ?? []),
    [socialGraph?.followingIds]
  );

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((p) => {
      if (categoryFilter === 'following') {
        if (!p.following && !followingSet.has(p.id)) return false;
      } else if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.handle.toLowerCase().includes(q) &&
        !p.country.toLowerCase().includes(q) &&
        !p.style.toLowerCase().includes(q) &&
        !p.focusMarkets.some((m) => m.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, followingSet, profiles, searchQuery]);

  const famousCount = profiles.filter((p) => p.category === 'famous').length;
  const organizationCount = profiles.filter((p) => p.category === 'organization').length;
  const communityCount = profiles.filter((p) => p.category === 'community').length;
  const followingCount = profiles.filter((p) => p.following || followingSet.has(p.id)).length;

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycError('');
    setKycBusy(true);
    const res = await onSubmitKyc({
      country: kycCountry,
      fullName: kycFullName,
      docType: kycDocType,
      docNumber: kycDocNumber,
      proofOfAddressType: kycAddressProof,
      selfieLivenessToken: kycLivenessToken,
      antiScamPledge: kycAntiScamPledge,
    });
    setKycBusy(false);
    if (!res.ok) {
      setKycError(res.error ?? 'Unable to verify KYC documentation.');
    } else {
      setKycDocNumber('');
    }
  };

  const handlePublishProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPubError('');
    setPubBusy(true);
    const markets = pubMarkets
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const res = await onPublishProfile({
      title: pubTitle,
      style: pubStyle,
      country: pubCountry,
      focusMarkets: markets,
      bio: pubBio,
    });
    setPubBusy(false);
    if (!res.ok) {
      setPubError(res.error ?? 'Could not publish investor profile.');
    } else {
      setShowPublishForm(false);
    }
  };

  const handleScamReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setScamError('');
    setScamBusy(true);
    const res = await onSubmitScamReport({
      suspectedHandle: scamHandle,
      channel: scamChannel,
      description: scamDesc,
    });
    setScamBusy(false);
    if (!res.ok) {
      setScamError(res.error ?? 'Unable to submit scam report.');
    } else {
      setScamHandle('');
      setScamDesc('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#0ECB81]" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-[#EAECEF]">
              Verified Investor Profiles &amp; Anti-Scam KYC Registry
            </h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
              · {kycRecord?.status === 'VERIFIED' ? kycRecord.badgeCode : 'KYC Tier: Unverified'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#848E9C] mt-1">
            Explore public 13F/BSE studies of famous investors alongside KYC-documented everyday desk investors—backed by SHA-256 ID verification to prevent fake impersonator scams.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-xs">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              subTab === 'directory'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            Investor Directory ({profiles.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('rewards');
              void onRefreshRewardsAndSocial?.();
            }}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              subTab === 'rewards'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            Social &amp; Rewards ({rewardsState?.xpPoints ?? 0} XP)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('kyc')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              subTab === 'kyc'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            KYC Document Shield
          </button>
          <button
            type="button"
            onClick={() => setSubTab('scam')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              subTab === 'scam'
                ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                : 'text-slate-600 dark:text-[#848E9C] hover:text-slate-900 dark:hover:text-[#EAECEF]'
            }`}
          >
            Anti-Scam Watch ({scamReports.length})
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Famous & Verified Everyday Investor Directory */}
      {subTab === 'directory' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#0B0E11] rounded-lg text-xs">
              {(
                [
                  { id: 'all', label: `All Profiles (${profiles.length})` },
                  { id: 'famous', label: `Famous Traders (${famousCount})` },
                  { id: 'organization', label: `Organizations (${organizationCount})` },
                  { id: 'community', label: `Community Traders (${communityCount})` },
                  { id: 'following', label: `Following (${followingCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    categoryFilter === tab.id
                      ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                      : 'text-slate-600 dark:text-[#848E9C]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search investor, country, symbol..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF] focus:outline-none focus:ring-2 focus:ring-[#F0B90B]"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowPublishForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11] whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Publish My Profile
              </button>
            </div>
          </div>

          {showPublishForm && (
            <form
              onSubmit={handlePublishProfile}
              className="bg-white dark:bg-[#181A20] border border-[#0ECB81]/40 rounded-lg p-5 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm text-slate-900 dark:text-[#EAECEF]">
                  Publish Verified Everyday Investor Card ({authUser.name})
                </div>
                <span className="font-mono text-[11px] text-slate-500 dark:text-[#848E9C]">
                  {kycRecord?.status === 'VERIFIED'
                    ? `Verified Badge: ${kycRecord.badgeCode}`
                    : 'Tip: Complete KYC Document Shield to upgrade to Tier 2 badge'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="Profile Title (e.g. Swing Investor)"
                  className="px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
                <input
                  type="text"
                  required
                  value={pubStyle}
                  onChange={(e) => setPubStyle(e.target.value)}
                  placeholder="Strategy Style"
                  className="px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
                <input
                  type="text"
                  required
                  value={pubCountry}
                  onChange={(e) => setPubCountry(e.target.value)}
                  placeholder="Country"
                  className="px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
                <input
                  type="text"
                  required
                  value={pubMarkets}
                  onChange={(e) => setPubMarkets(e.target.value)}
                  placeholder="Focus Symbols (comma separated)"
                  className="px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
              </div>

              <textarea
                rows={2}
                required
                value={pubBio}
                onChange={(e) => setPubBio(e.target.value)}
                placeholder="Describe your risk rules, time horizon, and watchlist discipline..."
                className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />

              {pubError && <div className="text-[#F6465D] font-medium">{pubError}</div>}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPublishForm(false)}
                  className="px-3 py-1.5 rounded border border-slate-200 dark:border-[#2B3139] text-slate-600 dark:text-[#848E9C]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pubBusy}
                  className="px-4 py-1.5 font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] disabled:opacity-50"
                >
                  {pubBusy ? 'Publishing...' : 'Save Investor Profile'}
                </button>
              </div>
            </form>
          )}

          {/* Profile Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProfiles.map((prof) => (
              <div
                key={prof.id}
                className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                          {prof.name}
                        </h3>
                        {prof.kycVerified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0ECB81] shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
                        {prof.handle} · {prof.country}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onFollowProfile(prof.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded border whitespace-nowrap shrink-0 transition-colors ${
                        prof.following
                          ? 'border-[#0ECB81]/50 bg-[#0ECB81]/10 text-[#059669] dark:text-[#0ECB81]'
                          : 'border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:border-[#F0B90B]'
                      }`}
                    >
                      {prof.following ? 'Following' : 'Follow'} ({prof.followers.toLocaleString()})
                    </button>
                  </div>

                  <div className="text-[11px] font-mono text-[#B45309] dark:text-[#F0B90B]">
                    {prof.category === 'organization'
                      ? 'Verified Institution'
                      : prof.category === 'famous'
                      ? 'Public Filing Profile'
                      : 'Verified Trader'}{' '}
                    · {prof.verificationBadge}
                  </div>

                  <div className="text-xs font-medium text-slate-800 dark:text-[#EAECEF]">
                    {prof.title} — <span className="text-slate-500 dark:text-[#848E9C]">{prof.style}</span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
                    {prof.bio}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-[#2B3139] font-mono tabular-nums text-[11px]">
                    <div>
                      <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Win Rate</div>
                      <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                        {prof.winRatePct.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">YTD Return</div>
                      <div className="font-semibold text-[#0ECB81]">
                        +{prof.returnYtdPct.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Scale</div>
                      <div className="font-sans text-[10px] text-slate-700 dark:text-[#B7BDC6] truncate">
                        {prof.aumOrCapitalLabel}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#2B3139]">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-500 dark:text-[#848E9C]">Focus Markets:</span>
                    {prof.focusMarkets.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => onOpenTerminal(sym)}
                        className="inline-flex items-center gap-0.5 font-mono font-semibold text-blue-600 dark:text-[#F0B90B] hover:underline"
                      >
                        {sym}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab: Social Graph & Rewards Center */}
      {subTab === 'rewards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2B3139]">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#F0B90B]" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                    Nuvra Loyalty Tier &amp; Social Graph
                  </h3>
                </div>
                {onRefreshRewardsAndSocial && (
                  <button
                    type="button"
                    onClick={() => void onRefreshRewardsAndSocial()}
                    className="p-1.5 rounded border border-slate-200 dark:border-[#2B3139] text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    title="Sync Rewards & Social Graph"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
                <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]">
                  <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Tier &amp; XP</div>
                  <div className="text-sm font-semibold text-[#F0B90B]">
                    {rewardsState?.tierName ?? 'Bronze'} · {rewardsState?.xpPoints ?? 0} XP
                  </div>
                </div>
                <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]">
                  <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Fee Discount / Streak</div>
                  <div className="text-sm font-semibold text-[#0ECB81]">
                    {rewardsState?.feeDiscountPct ?? 0}% off · {rewardsState?.streakDays ?? 1}d
                  </div>
                </div>
                <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]">
                  <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Following / Followers</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                    {socialGraph?.followingCount ?? followingCount} / {socialGraph?.followersCount ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]">
                  <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Bonus Demo Claimed</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                    ${(rewardsState?.totalClaimedDemoUsd ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {rewardsState && (
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-mono tabular-nums text-slate-500 dark:text-[#848E9C]">
                    <span>Progress to next tier</span>
                    <span>
                      {rewardsState.xpPoints} / {rewardsState.nextTierXp} XP
                    </span>
                  </div>
                  <div className="h-2 w-full rounded bg-slate-200 dark:bg-[#0B0E11] overflow-hidden">
                    <div
                      className="h-full bg-[#F0B90B]"
                      style={{
                        width: `${Math.min(100, Math.round((rewardsState.xpPoints / Math.max(rewardsState.nextTierXp, 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#2B3139]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-[#EAECEF]">
                  <Users className="w-3.5 h-3.5 text-[#0ECB81]" />
                  <span>Recent Follow Activity</span>
                </div>
                {(socialGraph?.recentFollowEvents ?? []).length === 0 ? (
                  <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                    Follow famous investors or verified community traders in the Directory to populate your social feed.
                  </p>
                ) : (
                  <div className="space-y-1.5 text-[11px] max-h-40 overflow-y-auto">
                    {socialGraph?.recentFollowEvents.slice(0, 8).map((ev, idx) => (
                      <div
                        key={`${ev.targetId}-${ev.at}-${idx}`}
                        className="flex items-center justify-between font-mono py-1 border-b border-slate-100 dark:border-[#2B3139]"
                      >
                        <span className="text-slate-700 dark:text-[#EAECEF]">
                          {ev.action === 'followed' ? '+ Followed' : '- Unfollowed'} {ev.targetName}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(ev.at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2B3139]">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#0ECB81]" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                    Claimable Quests &amp; Milestone Rewards
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-slate-500 dark:text-[#848E9C]">
                  Anti-Sybil Validated
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {(rewardsState?.quests ?? []).map((q) => (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">{q.title}</div>
                      <div className="text-[11px] text-slate-600 dark:text-[#B7BDC6]">{q.description}</div>
                      <div className="font-mono tabular-nums text-[10px] text-[#B45309] dark:text-[#F0B90B]">
                        Progress: {q.progress}/{q.target} · Reward: +{q.xpReward} XP + ${q.bonusDemoUsd.toLocaleString()} Demo
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!q.completed || q.claimed || claimingId === q.id}
                      onClick={async () => {
                        if (!onClaimQuest) return;
                        setClaimingId(q.id);
                        await onClaimQuest(q.id);
                        setClaimingId(null);
                      }}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded whitespace-nowrap ${
                        q.claimed
                          ? 'bg-slate-200 dark:bg-[#2B3139] text-slate-500 cursor-default'
                          : q.completed
                          ? 'bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11]'
                          : 'border border-slate-200 dark:border-[#2B3139] text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {q.claimed ? 'Claimed' : claimingId === q.id ? 'Claiming...' : q.completed ? 'Claim Reward' : 'In Progress'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: KYC & Anti-Scam Identity Verification */}
      {subTab === 'kyc' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#0ECB81]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Your KYC Verification Status
                </h3>
              </div>
              <span
                className={`font-mono text-xs font-semibold ${
                  kycRecord?.status === 'VERIFIED' ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
                }`}
              >
                {kycRecord?.status === 'VERIFIED' ? 'VERIFIED TIER 2' : 'NOT SUBMITTED'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#848E9C]">Badge ID</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-[#EAECEF]">
                  {kycRecord?.badgeCode ?? 'UNVERIFIED'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#848E9C]">Document Type</span>
                <span className="font-mono text-slate-900 dark:text-[#EAECEF]">
                  {kycRecord?.docType ?? 'None'} ({kycRecord?.maskedDocNumber ?? 'Not linked'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#848E9C]">Country / Address Proof</span>
                <span className="text-slate-900 dark:text-[#EAECEF]">
                  {kycRecord?.country ?? 'India'} · {kycRecord?.proofOfAddressType ?? 'Pending'}
                </span>
              </div>
              {kycRecord?.docHash && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-[#848E9C]">SHA-256 Digest</span>
                  <span className="font-mono text-[11px] text-[#0ECB81]">{kycRecord.docHash}</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-600 dark:text-[#B7BDC6] leading-relaxed space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-[#EAECEF] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0ECB81]" />
                Zero-Plaintext Anti-Scam Architecture
              </div>
              <p>
                Government ID numbers (Aadhaar, PAN, Passport, SSN, National ID) are one-way hashed via SHA-256 server-side to block duplicate fake accounts and impersonators. Raw document numbers are never stored or exposed in the browser.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleKycSubmit}
            className="lg:col-span-7 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-[#2B3139]">
              <FileCheck2 className="w-4 h-4 text-[#F0B90B]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Submit Advanced Identity &amp; Document Verification
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Legal Full Name (as on Government ID)
                </label>
                <input
                  type="text"
                  required
                  value={kycFullName}
                  onChange={(e) => setKycFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Jurisdiction / Country
                </label>
                <select
                  value={kycCountry}
                  onChange={(e) => setKycCountry(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                >
                  <option value="India">India (Aadhaar / PAN / Passport)</option>
                  <option value="United States">United States (Passport / Driver License)</option>
                  <option value="United Kingdom">United Kingdom (Passport / BRP)</option>
                  <option value="European Union">European Union (National ID / Passport)</option>
                  <option value="Singapore">Singapore (NRIC / FIN / Passport)</option>
                  <option value="UAE">UAE (Emirates ID / Passport)</option>
                  <option value="Japan">Japan (MyNumber / Passport)</option>
                  <option value="Australia">Australia (Driver License / Passport)</option>
                  <option value="Canada">Canada (Passport / Driver License)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Government Document Type
                </label>
                <select
                  value={kycDocType}
                  onChange={(e) => setKycDocType(e.target.value as KycDocumentType)}
                  className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                >
                  <option value="Passport">International Passport</option>
                  <option value="Aadhaar">India Aadhaar / VID</option>
                  <option value="PAN">India PAN Card</option>
                  <option value="National ID">National ID / Emirates ID / NRIC</option>
                  <option value="Drivers License">Driver’s License</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Document Number (SHA-256 hashed server-side)
                </label>
                <input
                  type="text"
                  required
                  value={kycDocNumber}
                  onChange={(e) => setKycDocNumber(e.target.value)}
                  placeholder="Enter ID / Passport / PAN number"
                  className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Proof of Residence Document
                </label>
                <select
                  value={kycAddressProof}
                  onChange={(e) => setKycAddressProof(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                >
                  <option value="Bank Statement / Utility Bill">Bank Statement / Utility Bill (&lt;90 days)</option>
                  <option value="Government Tax Assessment">Government Tax / Residence Certificate</option>
                  <option value="Registered Lease Agreement">Registered Lease / Voter Card</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Selfie Liveness Verification Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={kycLivenessToken}
                    onChange={(e) => setKycLivenessToken(e.target.value)}
                    placeholder="Click Generate Liveness Token"
                    className="flex-1 px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setKycLivenessToken(`LIVE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
                    }
                    className="px-2.5 py-2 font-medium rounded border border-slate-200 dark:border-[#2B3139] hover:border-[#F0B90B] whitespace-nowrap"
                  >
                    Capture
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] cursor-pointer">
              <input
                type="checkbox"
                checked={kycAntiScamPledge}
                onChange={(e) => setKycAntiScamPledge(e.target.checked)}
                className="mt-0.5 accent-[#0ECB81]"
              />
              <span className="text-[11px] text-slate-600 dark:text-[#B7BDC6] leading-relaxed">
                <strong className="text-slate-900 dark:text-[#EAECEF]">Anti-Scam &amp; Non-Impersonation Attestation:</strong> I certify that this account belongs strictly to me, I will never impersonate another investor, solicit off-platform UPI/crypto deposits, or promise guaranteed returns. Violation results in permanent account lockdown.
              </span>
            </label>

            {kycError && <div className="text-[#F6465D] font-medium">{kycError}</div>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={kycBusy}
                className="px-5 py-2 font-semibold rounded-md bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11] disabled:opacity-50"
              >
                {kycBusy ? 'Verifying & Hashing...' : 'Verify Identity & Issue Tier 2 Shield'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-Tab 3: Anti-Scam & Impersonation Registry */}
      {subTab === 'scam' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleScamReport}
            className="lg:col-span-5 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-3 text-xs"
          >
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-[#2B3139]">
              <ShieldAlert className="w-4 h-4 text-[#F6465D]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Report Fake Account / Impersonator
              </h3>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Suspected Handle, Telegram Group, or URL
              </label>
              <input
                type="text"
                required
                value={scamHandle}
                onChange={(e) => setScamHandle(e.target.value)}
                placeholder="@fake_desk_admin or suspicious link"
                className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Platform / Channel
              </label>
              <select
                value={scamChannel}
                onChange={(e) => setScamChannel(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              >
                <option value="Telegram / WhatsApp">Telegram / WhatsApp</option>
                <option value="Instagram / X">Instagram / X (Twitter)</option>
                <option value="Fake UPI / Wallet Link">Fake UPI / Phishing Site</option>
                <option value="In-App Community">In-App Community</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                Evidence &amp; Description
              </label>
              <textarea
                rows={3}
                required
                value={scamDesc}
                onChange={(e) => setScamDesc(e.target.value)}
                placeholder="Describe what the impersonator claimed (e.g., asked for off-platform UPI transfer or promised guaranteed daily profit)..."
                className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            {scamError && <div className="text-[#F6465D] font-medium">{scamError}</div>}

            <button
              type="submit"
              disabled={scamBusy}
              className="w-full py-2 font-semibold rounded-md bg-[#F6465D] hover:bg-[#e0384e] text-white disabled:opacity-50"
            >
              {scamBusy ? 'Logging Report...' : 'Submit Anti-Scam Alert'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2B3139] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F0B90B]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Public Anti-Scam &amp; DMCA Watchlist
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#848E9C]">
                {scamReports.length} Logged
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-[#2B3139] text-xs">
              {scamReports.map((rep) => (
                <div key={rep.id} className="p-4 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {rep.suspectedHandle} · <span className="text-slate-500 dark:text-[#848E9C]">{rep.channel}</span>
                    </span>
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        rep.status === 'CONFIRMED_SCAM_BLOCKED' ? 'text-[#F6465D]' : 'text-[#F0B90B]'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-[#B7BDC6]">{rep.description}</p>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-[#848E9C]">
                    Reported by {rep.reportedBy} · {new Date(rep.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
