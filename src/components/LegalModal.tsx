import { useEffect, useState } from 'react';
import { Check, Copy, FileText, Lock, ShieldCheck, X } from 'lucide-react';

interface LegalModalProps {
  open: boolean;
  initialTab?: 'privacy' | 'terms' | 'disclosure';
  onClose: () => void;
}

const REPORT_FORMAT_TEMPLATE = `Title:
Severity:
Affected Component:
Description:
Impact:
Reproduction Steps:
Proof of Concept:
Suggested Fix:
Contact Information:`;

export function LegalModal({ open, initialTab = 'privacy', onClose }: LegalModalProps) {
  const [tab, setTab] = useState<'privacy' | 'terms' | 'disclosure'>(initialTab);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  if (!open) return null;

  const copyReportTemplate = () => {
    void navigator.clipboard?.writeText(REPORT_FORMAT_TEMPLATE);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Privacy Policy, Terms & Conditions, and Security Disclosure"
    >
      <div className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2B3139] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {tab === 'privacy' ? (
              <ShieldCheck className="w-4 h-4 text-[#0ECB81]" />
            ) : tab === 'disclosure' ? (
              <Lock className="w-4 h-4 text-[#0ECB81]" />
            ) : (
              <FileText className="w-4 h-4 text-[#F0B90B]" />
            )}
            <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              {tab === 'privacy'
                ? 'Privacy Policy & Data Protection'
                : tab === 'disclosure'
                ? 'Security Architecture & Responsible Disclosure'
                : 'Terms & Conditions & Risk Disclosure'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-xs">
              <button
                type="button"
                onClick={() => setTab('privacy')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  tab === 'privacy'
                    ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setTab('terms')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  tab === 'terms'
                    ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                Terms &amp; Conditions
              </button>
              <button
                type="button"
                onClick={() => setTab('disclosure')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  tab === 'disclosure'
                    ? 'bg-white dark:bg-[#2B3139] text-slate-900 dark:text-[#EAECEF]'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                Security &amp; Disclosure
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close legal dialog"
              className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-600 dark:text-[#B7BDC6]">
          {tab === 'privacy' ? (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  1. Zero-Trust Account &amp; Password Protection
                </h3>
                <p>
                  Aurex Global Exchange protects every investor identity using salted Scrypt key derivation, HMAC-SHA256 HttpOnly sessions, and optional 2-Factor Authentication (RFC-6238 Authenticator TOTP &amp; FIDO2 Hardware Passkeys). Passwords and TOTP secrets are never written to plain-text logs or exposed to the browser.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  2. Encrypted Banking, Global UPI &amp; Cold Vault Custody
                </h3>
                <p>
                  Any India or International UPI handle (NPCI, PayNow, Aani, LankaPay, MauCAS, Fonepay, DrukPay), IMPS/NEFT account number, IFSC, IBAN, ACH routing number, or card reference added to Wallet &amp; Vault is encrypted server-side with AES-256-GCM before storage and masked in all API responses. Every transfer is cryptographically hash-chained with HMAC-SHA256.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  3. Security Auditing &amp; Strict Founder Isolation
                </h3>
                <p>
                  Sign-in attempts, MFA challenges, Web Application Firewall blocks, prototype-pollution rejections, and session telemetry are recorded strictly for cyber defense and Founder-authorized security auditing. Internal server configuration, API credentials, and directory logs are strictly isolated from public and non-founder accounts. We never sell personal data.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  4. Federated OAuth, Data Retention &amp; Regulatory Cooperation
                </h3>
                <p>
                  If you sign in via Google or GitHub, Aurex stores only your verified email, display name, and provider link. You may revoke remote sessions at any time inside Wallet &amp; Vault. Records may be retained or disclosed solely as compelled by valid legal process or anti-fraud enforcement.
                </p>
              </div>
            </>
          ) : tab === 'disclosure' ? (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  1. Defense-in-Depth Security Pipeline (6 Independent Layers)
                </h3>
                <p className="mb-2">
                  Every request passes sequentially from Internet Traffic through six active cyber-defense layers before reaching Core Exchange Services:
                </p>
                <div className="p-2.5 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] font-mono text-[11px] text-slate-800 dark:text-[#EAECEF]">
                  Internet Traffic → Aegis-WAF → ZeroDay-Sanitizer → Chronos-BruteShield → Sybil-ScamHunter → Merkle-VaultGuard → KeySentinel-Isolator → Core Exchange Services
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    name: 'Aegis-WAF',
                    desc: 'Blocks SQLi, XSS, shell/command injection, malicious payloads, and API abuse.',
                  },
                  {
                    name: 'ZeroDay-Sanitizer',
                    desc: 'Stops prototype pollution, cross-origin spoofing, CSRF, and unsafe object mutations.',
                  },
                  {
                    name: 'Chronos-BruteShield',
                    desc: 'Defends login/MFA gates with credential-stuffing checks, HMAC rate buckets, and cooldowns.',
                  },
                  {
                    name: 'Sybil-ScamHunter',
                    desc: 'Prevents fake accounts, reward farming, multi-account abuse, and handle impersonation.',
                  },
                  {
                    name: 'Merkle-VaultGuard',
                    desc: 'Validates deposits/withdrawals, blocks replay envelopes, and seals HMAC transfer chains.',
                  },
                  {
                    name: 'KeySentinel-Isolator',
                    desc: 'Enforces HTTP 403 secret path isolation and Founder-only administrative access.',
                  },
                ].map((layer) => (
                  <div
                    key={layer.name}
                    className="p-2.5 rounded border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70"
                  >
                    <div className="font-mono font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {layer.name}
                    </div>
                    <div className="text-[11px] mt-0.5">{layer.desc}</div>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  2. Responsible Vulnerability Reporting &amp; Response Commitment
                </h3>
                <p>
                  Private Contacts:{' '}
                  <span className="font-mono text-slate-900 dark:text-[#EAECEF]">
                    security@aurexglobalexchange.com
                  </span>{' '}
                  · Alternative:{' '}
                  <span className="font-mono text-slate-900 dark:text-[#EAECEF]">
                    founder@aurexglobalexchange.com
                  </span>
                </p>
                <div className="mt-2 overflow-hidden rounded border border-slate-200 dark:border-[#2B3139]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 dark:bg-[#0B0E11] text-slate-500 dark:text-[#848E9C]">
                      <tr>
                        <th className="py-1.5 px-3">Severity</th>
                        <th className="py-1.5 px-3">Initial Response Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139]">
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-[#F6465D]">Critical</td>
                        <td className="py-1.5 px-3 font-mono">Within 24 Hours</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-[#F0B90B]">High</td>
                        <td className="py-1.5 px-3 font-mono">Within 48 Hours</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-blue-500">Medium</td>
                        <td className="py-1.5 px-3 font-mono">Within 5 Business Days</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-500">Low</td>
                        <td className="py-1.5 px-3 font-mono">Within 10 Business Days</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                    3. Safe Harbor Commitments
                  </h4>
                  <p>
                    We will not pursue legal action against researchers who act in good faith, avoid privacy violations, do not access/alter/destroy user data, do not disrupt availability, report confidentially, and allow reasonable remediation time. Valid reports qualify for Security Hall of Fame recognition.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                    4. Out of Scope &amp; Coordinated Disclosure
                  </h4>
                  <p>
                    Prohibited: social engineering, physical attacks, DoS/DDoS floods, spam/phishing, malware, data exfiltration, unauthorized account access, or disruptive automated scanning. Never publicly disclose before remediation and mutual agreement.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                    5. Standard Vulnerability Report Format
                  </h4>
                  <button
                    type="button"
                    onClick={copyReportTemplate}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-[#2B3139] text-[11px] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
                  >
                    {copiedTemplate ? (
                      <>
                        <Check className="w-3 h-3 text-[#0ECB81]" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Format
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-slate-950 text-slate-200 font-mono text-[11px] leading-snug border border-slate-800 overflow-x-auto">
                  {REPORT_FORMAT_TEMPLATE}
                </pre>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  1. Strictly Non-Advisory Platform · Zero Financial Advice
                </h3>
                <p>
                  Aurex Global Exchange provides market software, simulated paper execution, 24-agent analytical scoreboards, and AI technical models strictly for educational and informational decision-support purposes. Nothing on Aurex constitutes investment, legal, accounting, or tax advice, solicitation, or fiduciary recommendation. You are solely responsible for your trades and capital.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  2. &ldquo;AS-IS&rdquo; Zero Warranty &amp; Maximum Liability Cap
                </h3>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND (EXPRESS OR IMPLIED), INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. IN NO EVENT SHALL AUREX, ITS FOUNDER, DEVELOPERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR LOST-PROFIT DAMAGES, AND AGGREGATE LIABILITY SHALL NOT EXCEED THE GREATER OF USD $100 OR PLATFORM FEES PAID BY YOU IN THE PRECEDING 3 MONTHS.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  3. User Indemnification, Binding Arbitration &amp; Class-Action Waiver
                </h3>
                <p>
                  You agree to indemnify and hold harmless Aurex Global Exchange and its Founder from any third-party claims, losses, fines, or legal expenses arising from your trading activity, breach of these Terms, tax omissions, or unlawful conduct. Any dispute shall be resolved exclusively by binding individual arbitration—YOU WAIVE ANY RIGHT TO JURY TRIAL OR CLASS-ACTION LAWSUIT.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  4. Demo vs. Real Accounts, Taxes, KYC &amp; Third-Party Rails
                </h3>
                <p>
                  Demo mode uses virtual funds isolated from Real Accounts and Cold Vault balances. You bear sole responsibility for jurisdictional tax reporting, regulatory eligibility, sanctions compliance, and KYC verification. Third-party payment rails (NPCI UPI, PayNow, SEPA, ACH, SWIFT, bank/card networks) and external market feeds operate independently and Aurex disclaims liability for third-party outages or delays. Aurex reserves the unilateral right to suspend or terminate accounts violating anti-hacker or acceptable-use policies.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  5. Copyright, Open-Data Attribution &amp; DMCA Safe Harbor
                </h3>
                <p>
                  All Aurex charting canvases, interface typography, indicators, and proprietary engines are original works without third-party trademarks or infringing watermarks. Public news dispatches strictly show factual titles with direct links and publisher attribution under fair-use reporting, and public investor case studies cite official SEC 13F / exchange filings with zero endorsement or affiliation. Any copyright or impersonation concern may be logged in our DMCA / Anti-Scam Watchlist for immediate removal.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  6. Smart Algorithmic Bots &amp; Automated Execution Risk Waiver
                </h3>
                <p>
                  Grid, DCA, EMA Momentum, Bollinger Mean-Reversion, TWAP, OCO, and Trailing Stop automations execute deterministically according to user-configured parameters. Aurex guarantees neither profitability nor uninterrupted signal execution during flash volatility, illiquid spreads, or exchange feed interruptions. You assume 100% financial risk for all autonomous bot orders.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  7. Rewards, XP Tiers, Promotions &amp; Anti-Sybil Forfeiture
                </h3>
                <p>
                  Virtual rewards, XP loyalty tiers, promo codes, and Demo credits carry zero monetary cash value and are non-transferable. Aurex reserves absolute discretion to audit, claw back, or forfeit rewards and terminate accounts involved in Sybil multi-accounting, wash trading, referral abuse, or automated farming.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] mb-1">
                  8. Anti-Exploit, Global Sanctions, Force Majeure &amp; Severability
                </h3>
                <p>
                  Unauthorized probing of private configuration files, path-traversal attempts, API scraping, DDoS floods, or key-extraction attacks are strictly prohibited under computer-fraud statutes and trigger immediate IP/session quarantine. You represent that you are not located in any OFAC, UN, EU, or Indian sanctioned jurisdiction. Aurex shall not be liable for Force Majeure events (war, sovereign capital controls, internet backbone failures, or clearinghouse halts). If any clause is held unenforceable, all remaining clauses remain in full force and constitute the entire binding agreement.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B3139] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
          >
            I Understand &amp; Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
