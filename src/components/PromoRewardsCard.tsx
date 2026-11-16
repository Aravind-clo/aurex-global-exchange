import React, { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Gift, Share2 } from 'lucide-react';
import type { ReferralPromoProfile } from '../types/market';

interface PromoRewardsCardProps {
  profile: ReferralPromoProfile | null;
  onRedeemPromo: (code: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  onRecordShare: (channel: string) => Promise<{ ok: boolean; bonusAwardedUsd?: number }>;
}

const QUICK_PROMOS = [
  { code: 'WELCOME500', label: '+$500 Demo · 5% Fee Off' },
  { code: 'GLOBALVIP', label: '+$1,500 Demo · 10% Fee Off' },
  { code: 'UPIZERO', label: '+$750 Demo · UPI Zero-Fee Tier' },
  { code: 'AGENTPRO', label: '+$1,000 Demo · 24-Agent Pro' },
];

export const PromoRewardsCard: React.FC<PromoRewardsCardProps> = ({
  profile,
  onRedeemPromo,
  onRecordShare,
}) => {
  const [promoInput, setPromoInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://aurex.exchange';
  const refCode = profile?.referralCode ?? 'AURX-GLOBAL';
  const inviteLink = `${shareOrigin}/?ref=${encodeURIComponent(refCode)}`;
  const shareText = `Trading global stocks, India NSE, crypto & forex with 24 live AI agents and Global UPI Corridors on Aurex Global Exchange. Use my referral code ${refCode} for bonus demo credits & fee discounts: ${inviteLink}`;

  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(inviteLink);

  const socialLinks = [
    {
      channel: 'x',
      label: 'Share on X / Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
    },
    {
      channel: 'whatsapp',
      label: 'Share on WhatsApp',
      href: `https://api.whatsapp.com/send?text=${encodedText}`,
    },
    {
      channel: 'telegram',
      label: 'Share on Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      channel: 'linkedin',
      label: 'Share on LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
  ];

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      void onRecordShare('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMsg({ tone: 'err', text: 'Copy link directly from the referral field.' });
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Aurex Global Exchange',
          text: shareText,
          url: inviteLink,
        });
        await onRecordShare('native');
        return;
      } catch {
        // user cancelled native share sheet
      }
    }
    await handleCopyInvite();
  };

  const handleClaim = async (codeToClaim?: string) => {
    const code = (codeToClaim ?? promoInput).trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setStatusMsg(null);
    const res = await onRedeemPromo(code);
    setBusy(false);
    if (res.ok) {
      setStatusMsg({ tone: 'ok', text: res.message ?? `Promo ${code} activated.` });
      if (!codeToClaim) setPromoInput('');
    } else {
      setStatusMsg({ tone: 'err', text: res.error ?? 'Unable to apply promo code.' });
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-lg border border-[#F0B90B]/40 bg-[#F0B90B]/10 flex items-center justify-center text-[#B8860B] dark:text-[#F0B90B]">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAECEF]">
              Global Referral & Promo Growth Rewards
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#848E9C]">
              Share your personal invite code across social platforms to unlock fee-discount tiers and practice credits. Rewards are governed by server rules.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono tabular-nums text-xs">
          <div>
            <span className="text-slate-500 dark:text-[#848E9C] block text-[10px]">TIER</span>
            <span className="font-bold text-[#B8860B] dark:text-[#F0B90B]">
              {profile?.tierLabel ?? 'Standard'} ({profile?.feeDiscountPct ?? 0}% Fee Off)
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-[#848E9C] block text-[10px]">BONUS CREDITED</span>
            <span className="font-bold text-[#0ECB81]">
              +${(profile?.bonusDemoUsd ?? 0).toLocaleString()} Demo
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-[#848E9C] block text-[10px]">SHARES</span>
            <span className="font-bold text-slate-900 dark:text-[#EAECEF]">
              {profile?.shareCount ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Invite Link & Social Share Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-[#EAECEF]">
              Your Referral Invite Link ({refCode})
            </span>
            <button
              type="button"
              onClick={() => void handleNativeShare()}
              className="text-[11px] font-semibold text-[#B8860B] dark:text-[#F0B90B] hover:underline flex items-center gap-1"
            >
              <Share2 className="w-3 h-3" />
              Quick Share
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              aria-label="Personal Referral Link"
              className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-[#2B3139] bg-white dark:bg-[#181A20] text-xs font-mono text-slate-800 dark:text-[#EAECEF]"
            />
            <button
              type="button"
              onClick={() => void handleCopyInvite()}
              className="px-3 py-1.5 rounded bg-[#F0B90B] hover:bg-[#d9a609] text-[#0B0E11] text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {socialLinks.map((soc) => (
              <a
                key={soc.channel}
                href={soc.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void onRecordShare(soc.channel)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-[#2B3139] bg-white dark:bg-[#181A20] hover:border-[#F0B90B] text-[11px] font-semibold text-slate-700 dark:text-[#EAECEF] transition-colors"
              >
                {soc.label}
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>
        </div>

        {/* Promo Code Redemption */}
        <div className="rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] p-3 space-y-2.5">
          <span className="text-xs font-semibold text-slate-700 dark:text-[#EAECEF] block">
            Redeem Official Promo or Friend Referral Code
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="Enter WELCOME500 or friend's AURX-... code"
              className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-[#2B3139] bg-white dark:bg-[#181A20] text-xs font-mono text-slate-900 dark:text-[#EAECEF] placeholder:text-slate-400"
            />
            <button
              type="button"
              disabled={busy || !promoInput.trim()}
              onClick={() => void handleClaim()}
              className="px-3 py-1.5 rounded bg-[#0ECB81] hover:bg-[#0bb572] disabled:opacity-50 text-[#0B0E11] text-xs font-bold shrink-0 transition-colors"
            >
              {busy ? 'Applying...' : 'Claim'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMOS.map((item) => {
              const claimed = profile?.redeemedCodes.includes(item.code) ?? false;
              return (
                <button
                  key={item.code}
                  type="button"
                  disabled={claimed || busy}
                  onClick={() => void handleClaim(item.code)}
                  className={`px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
                    claimed
                      ? 'border-[#0ECB81]/40 bg-[#0ECB81]/10 text-[#0ECB81] cursor-default'
                      : 'border-slate-300 dark:border-[#2B3139] bg-white dark:bg-[#181A20] hover:border-[#F0B90B] text-slate-700 dark:text-[#EAECEF]'
                  }`}
                >
                  {claimed ? `✓ ${item.code}` : `${item.code} (${item.label})`}
                </button>
              );
            })}
          </div>

          {statusMsg && (
            <p
              className={`text-[11px] font-medium ${
                statusMsg.tone === 'ok' ? 'text-[#0ECB81]' : 'text-[#F6465D]'
              }`}
            >
              {statusMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
