import { useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  Fingerprint,
  Globe,
  KeyRound,
  Landmark,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlock,
  UserCheck,
  Vault,
  Wrench,
} from 'lucide-react';
import type {
  AuthSessionInfo,
  AuthUser,
  BankAccountRecord,
  BankRailType,
  DiagnosticsReport,
  EncryptedNetworkTelemetry,
  FirewallIncident,
  GlobalBankDirectoryEntry,
  HackDefenseAgent,
  PasskeyCredentialInfo,
  ReferralPromoProfile,
  SecurityStatus,
  SupportedCurrency,
  TotpEnrollmentSetup,
  VaultTransferRecord,
} from '../types/market';
import { downloadCsv, formatCurrency, formatTimeShort } from '../utils/format';
import { PromoRewardsCard } from './PromoRewardsCard';

interface SecurityVaultViewProps {
  accountMode: 'demo' | 'real';
  cashBalance: number;
  demoCashBalance: number;
  realCashBalance: number;
  vaultBalanceUsd: number;
  bankAccounts: BankAccountRecord[];
  vaultTransfers: VaultTransferRecord[];
  firewallIncidents: FirewallIncident[];
  securityStatus: SecurityStatus;
  authUser?: AuthUser | null;
  authSessions?: AuthSessionInfo[];
  passkeys?: PasskeyCredentialInfo[];
  promoProfile?: ReferralPromoProfile | null;
  bankDirectory?: GlobalBankDirectoryEntry[];
  kycVerified?: boolean;
  onOpenKyc?: () => void;
  guideMode?: boolean;
  onSwitchAccountMode: (mode: 'demo' | 'real') => Promise<{ ok: boolean; error?: string }>;
  onTransferVaultShield: (payload: {
    action: 'lock' | 'unlock';
    amountUsd: number;
    challengeId?: string;
    otpCode?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onToggleLockdown: (enabled?: boolean) => Promise<void>;
  onVerifyChain: () => Promise<boolean>;
  onRequestChallenge: (
    purpose: string
  ) => Promise<{ challengeId: string; otpPreview: string; expiresAt: number } | null>;
  onLinkBank: (payload: {
    bankName: string;
    accountHolder: string;
    rail: BankRailType;
    currency: SupportedCurrency;
    accountNumber: string;
    routingCode: string;
    challengeId: string;
    otpCode: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onSubmitTransfer: (payload: {
    type: 'deposit' | 'withdrawal';
    amount: number;
    currency: SupportedCurrency;
    bankAccountId: string;
    destination?: 'real_trading' | 'cold_vault';
    challengeId: string;
    otpCode: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRunWafProbe: (
    probeType: 'sqli' | 'xss' | 'clean'
  ) => Promise<{ status: number; message: string }>;
  onRevokeOtherSessions?: () => Promise<void>;
  onSetupTotp?: () => Promise<TotpEnrollmentSetup | null>;
  onConfirmTotp?: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onDisableTotp?: () => Promise<void>;
  onEnrollPasskey?: (label: string) => Promise<{ ok: boolean; error?: string }>;
  onRemovePasskey?: (id: string) => Promise<void>;
  onToggleRealMoneyMode?: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  onRedeemPromo?: (code: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  onRecordShare?: (channel: string) => Promise<{ ok: boolean; bonusAwardedUsd?: number }>;
  networkTelemetry?: EncryptedNetworkTelemetry | null;
  diagnosticsReport?: DiagnosticsReport | null;
  defenseAgents?: HackDefenseAgent[];
  onVerifyNetworkEnvelope?: (channel?: string) => Promise<{ ok: boolean; error?: string }>;
  onRefreshNetwork?: () => Promise<void>;
  onRefreshDiagnostics?: () => Promise<void>;
  onSolveDiagnostic?: (targetId?: string) => Promise<{ ok: boolean; summary?: string }>;
  onRefreshDefenseAgents?: () => Promise<void>;
}

const FX_TO_USD: Record<SupportedCurrency, number> = {
  USD: 1,
  INR: 1 / 84.45,
  EUR: 1.085,
  GBP: 1.27,
  SGD: 1 / 1.34,
  AED: 1 / 3.6725,
  JPY: 1 / 153.5,
  AUD: 0.65,
  CAD: 1 / 1.39,
  CHF: 1 / 0.88,
};

const UPI_PRESETS = [
  { label: 'Google Pay', handle: '@okicici', bank: 'GPay UPI (ICICI)', currency: 'INR' as SupportedCurrency, rail: 'UPI' as BankRailType, route: 'NPCI-UPI' },
  { label: 'PhonePe', handle: '@ybl', bank: 'PhonePe UPI (Yes Bank)', currency: 'INR' as SupportedCurrency, rail: 'UPI' as BankRailType, route: 'NPCI-UPI' },
  { label: 'Paytm UPI', handle: '@paytm', bank: 'Paytm Payments UPI', currency: 'INR' as SupportedCurrency, rail: 'UPI' as BankRailType, route: 'NPCI-UPI' },
  { label: 'BHIM / SBI', handle: '@oksbi', bank: 'BHIM SBI UPI', currency: 'INR' as SupportedCurrency, rail: 'UPI' as BankRailType, route: 'NPCI-UPI' },
  { label: 'HDFC Bank', handle: '@okhdfcbank', bank: 'HDFC Bank UPI / IMPS', currency: 'INR' as SupportedCurrency, rail: 'UPI' as BankRailType, route: 'HDFC0000001' },
  { label: 'ICICI iMobile', handle: '@icici', bank: 'ICICI Bank UPI / IMPS', currency: 'INR' as SupportedCurrency, rail: 'UPI' as BankRailType, route: 'ICIC0000004' },
  { label: 'Axis Bank', handle: '@okaxis', bank: 'Axis Bank UPI / NEFT', currency: 'INR' as SupportedCurrency, rail: 'UPI' as BankRailType, route: 'UTIB0000004' },
];

const GLOBAL_UPI_CORRIDORS: Array<{
  country: string;
  network: string;
  currency: SupportedCurrency;
  rail: BankRailType;
  sampleId: string;
  route: string;
}> = [
  { country: 'India', network: 'NPCI BHIM / UPI', currency: 'INR', rail: 'UPI', sampleId: 'trader@okicici', route: 'NPCI-INTL' },
  { country: 'Singapore', network: 'PayNow · UPI Link', currency: 'SGD', rail: 'UPI', sampleId: '+6591234567@paynow', route: 'MAS-PAYNOW' },
  { country: 'UAE', network: 'Aani · NPCI Corridor', currency: 'AED', rail: 'UPI', sampleId: 'dubai@aani.ae', route: 'CBUAE-AANI' },
  { country: 'France / EU', network: 'Lyra / SEPA Instant', currency: 'EUR', rail: 'SEPA', sampleId: 'FR763000600001123456', route: 'BNPAFRPP' },
  { country: 'Sri Lanka', network: 'LankaPay · UPI QR', currency: 'USD', rail: 'UPI', sampleId: 'colombo@lankapay', route: 'CBSL-LANKAPAY' },
  { country: 'Mauritius', network: 'MauCAS · UPI Bridge', currency: 'USD', rail: 'UPI', sampleId: 'portlouis@maucas', route: 'BOM-MAUCAS' },
  { country: 'Nepal', network: 'Fonepay · Cross-UPI', currency: 'INR', rail: 'UPI', sampleId: 'kathmandu@fonepay', route: 'NRB-FONEPAY' },
  { country: 'Bhutan', network: 'DrukPay · BHIM Link', currency: 'INR', rail: 'UPI', sampleId: 'thimphu@drukpay', route: 'RMA-DRUKPAY' },
];

const WORLD_BANK_PRESETS: Array<{
  label: string;
  bank: string;
  currency: SupportedCurrency;
  rail: BankRailType;
  acct: string;
  route: string;
}> = [
  { label: 'JPMorgan Chase (US)', bank: 'JPMorgan Chase ACH', currency: 'USD', rail: 'ACH', acct: 'US480091283910', route: 'CHASUS33' },
  { label: 'Wise Multi-Currency', bank: 'Wise Global Instant', currency: 'USD', rail: 'ACH', acct: 'WISE8820194812', route: 'TRWIUS35' },
  { label: 'Revolut (UK/EU)', bank: 'Revolut Instant SEPA', currency: 'EUR', rail: 'SEPA', acct: 'LT60325009182736', route: 'REVOLT21' },
  { label: 'HSBC UK FPS', bank: 'HSBC Faster Payments', currency: 'GBP', rail: 'FPS', acct: 'GB29HBUK400515', route: 'HBUKGB4B' },
  { label: 'DBS Singapore', bank: 'DBS Vickers Corridor', currency: 'SGD', rail: 'SWIFT', acct: 'SG001928374610', route: 'DBSSSGSG' },
  { label: 'Emirates NBD', bank: 'Emirates NBD Dubai', currency: 'AED', rail: 'WIRE', acct: 'AE0703312345678', route: 'EBILAEAD' },
  { label: 'MUFG Tokyo', bank: 'MUFG Bank Japan', currency: 'JPY', rail: 'SWIFT', acct: 'JP190028371920', route: 'BOTKJPJT' },
  { label: 'CommBank Australia', bank: 'Commonwealth Bank AU', currency: 'AUD', rail: 'SWIFT', acct: 'AU610620001829', route: 'CTBAAU2S' },
  { label: 'RBC Canada', bank: 'Royal Bank Canada', currency: 'CAD', rail: 'WIRE', acct: 'CA003192847561', route: 'ROYCCAT2' },
  { label: 'UBS Switzerland', bank: 'UBS Zurich Swiss IBAN', currency: 'CHF', rail: 'SWIFT', acct: 'CH9300762011623', route: 'UBSWCHZH' },
];

export function SecurityVaultView({
  accountMode,
  demoCashBalance,
  realCashBalance,
  vaultBalanceUsd,
  bankAccounts,
  vaultTransfers,
  firewallIncidents,
  securityStatus,
  authUser,
  authSessions = [],
  passkeys = [],
  promoProfile = null,
  bankDirectory = [],
  kycVerified = false,
  onOpenKyc,
  guideMode = false,
  onSwitchAccountMode,
  onTransferVaultShield,
  onToggleLockdown,
  onVerifyChain,
  onRequestChallenge,
  onLinkBank,
  onSubmitTransfer,
  onRunWafProbe,
  onRevokeOtherSessions,
  onSetupTotp,
  onConfirmTotp,
  onDisableTotp,
  onEnrollPasskey,
  onRemovePasskey,
  onToggleRealMoneyMode,
  onRedeemPromo,
  onRecordShare,
  networkTelemetry = null,
  diagnosticsReport = null,
  defenseAgents = [],
  onVerifyNetworkEnvelope,
  onRefreshNetwork,
  onRefreshDiagnostics,
  onSolveDiagnostic,
  onRefreshDefenseAgents,
}: SecurityVaultViewProps) {
  // Cold Vault Lock / Unlock controls
  const [vaultAction, setVaultAction] = useState<'lock' | 'unlock'>('lock');
  const [vaultAmountInput, setVaultAmountInput] = useState('5000');
  const [vaultChallenge, setVaultChallenge] = useState<{
    challengeId: string;
    otpPreview: string;
  } | null>(null);
  const [vaultOtp, setVaultOtp] = useState('');
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Deposit & Withdraw Form
  const [transferType, setTransferType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [depositDestination, setDepositDestination] = useState<'real_trading' | 'cold_vault'>('real_trading');
  const [transferCurrency, setTransferCurrency] = useState<SupportedCurrency>('INR');
  const [transferAmount, setTransferAmount] = useState('25000');
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id ?? '');
  const [txChallenge, setTxChallenge] = useState<{
    challengeId: string;
    otpPreview: string;
  } | null>(null);
  const [txOtp, setTxOtp] = useState('');
  const [txBusy, setTxBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Payment Rail Region Form (India Instant vs International)
  const [railRegion, setRailRegion] = useState<'india' | 'international'>('india');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [rail, setRail] = useState<BankRailType>('UPI');
  const [bankCurrency, setBankCurrency] = useState<SupportedCurrency>('INR');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingCode, setRoutingCode] = useState('');
  const [bankChallenge, setBankChallenge] = useState<{
    challengeId: string;
    otpPreview: string;
  } | null>(null);
  const [bankOtp, setBankOtp] = useState('');
  const [bankBusy, setBankBusy] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [dirSearch, setDirSearch] = useState('');
  const [dirRegion, setDirRegion] = useState<'all' | 'india' | 'international'>('all');

  // MFA (TOTP & Hardware Passkey)
  const [totpSetup, setTotpSetup] = useState<TotpEnrollmentSetup | null>(null);
  const [totpQrUrl, setTotpQrUrl] = useState<string | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpBusy, setTotpBusy] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState('Hardware Key / Touch ID');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const [probeBusy, setProbeBusy] = useState(false);
  const [realMoneyBusy, setRealMoneyBusy] = useState(false);
  const [realMoneyError, setRealMoneyError] = useState<string | null>(null);
  const [reportTemplateCopied, setReportTemplateCopied] = useState(false);

  const activeBankId = bankAccounts.some((b) => b.id === selectedBankId)
    ? selectedBankId
    : bankAccounts[0]?.id ?? '';
  const numericTransfer = Number.parseFloat(transferAmount) || 0;
  const estUsdPreview = numericTransfer * (FX_TO_USD[transferCurrency] ?? 1);

  const hasTotpMfa = Boolean(authUser?.totpEnabled);
  const hasPasskeyMfa = (authUser?.passkeysCount ?? passkeys.length) > 0;
  const verifiedMfaCount = (hasTotpMfa ? 1 : 0) + (hasPasskeyMfa ? 1 : 0);
  const vaultIntegrityReady = securityStatus.ledgerChainValid && !securityStatus.lockdownMode;
  const hasVerifiedBankRail = bankAccounts.length > 0;
  const checklistPassed = verifiedMfaCount >= 2 && vaultIntegrityReady && hasVerifiedBankRail;
  const isRealMoneyEnabled = Boolean(authUser?.realMoneyEnabled);

  const handleRequestVaultOtp = async () => {
    const ch = await onRequestChallenge(`Unlock Cold Vault $${vaultAmountInput}`);
    if (ch) {
      setVaultChallenge({ challengeId: ch.challengeId, otpPreview: ch.otpPreview });
      setVaultOtp(ch.otpPreview);
    }
  };

  const handleVaultShieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError(null);
    const amountUsd = Number.parseFloat(vaultAmountInput);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      setVaultError('Enter a positive USD amount.');
      return;
    }
    if (vaultAction === 'unlock' && !vaultChallenge) {
      setVaultError('Generate a 2FA code first.');
      return;
    }

    setVaultBusy(true);
    const res = await onTransferVaultShield({
      action: vaultAction,
      amountUsd,
      challengeId: vaultAction === 'unlock' ? vaultChallenge?.challengeId : undefined,
      otpCode: vaultAction === 'unlock' ? vaultOtp : undefined,
    });
    setVaultBusy(false);
    if (res.ok) {
      setVaultChallenge(null);
      setVaultOtp('');
    } else if (res.error) {
      setVaultError(res.error);
    }
  };

  const handleRequestTxOtp = async () => {
    setTxError(null);
    const ch = await onRequestChallenge(
      `${transferType.toUpperCase()} ${transferCurrency} ${transferAmount}`
    );
    if (ch) {
      setTxChallenge({ challengeId: ch.challengeId, otpPreview: ch.otpPreview });
      setTxOtp(ch.otpPreview);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);
    if (!Number.isFinite(numericTransfer) || numericTransfer <= 0) {
      setTxError('Enter a valid positive transfer amount.');
      return;
    }
    if (!activeBankId) {
      setTxError('Link a UPI ID, bank account, or payment rail first.');
      return;
    }
    if (!txChallenge) {
      setTxError('Generate a 2FA confirmation code first.');
      return;
    }
    setTxBusy(true);
    const res = await onSubmitTransfer({
      type: transferType,
      amount: numericTransfer,
      currency: transferCurrency,
      bankAccountId: activeBankId,
      destination: transferType === 'deposit' ? depositDestination : undefined,
      challengeId: txChallenge.challengeId,
      otpCode: txOtp,
    });
    setTxBusy(false);
    if (res.ok) {
      setTxChallenge(null);
      setTxOtp('');
    } else if (res.error) {
      setTxError(res.error);
    }
  };

  const handleRequestBankOtp = async () => {
    setBankError(null);
    const ch = await onRequestChallenge(`Link Payment Rail ${bankName || rail}`);
    if (ch) {
      setBankChallenge({ challengeId: ch.challengeId, otpPreview: ch.otpPreview });
      setBankOtp(ch.otpPreview);
    }
  };

  const handleLinkBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError(null);
    if (!bankChallenge) {
      setBankError('Generate a 2FA code first.');
      return;
    }
    setBankBusy(true);
    const res = await onLinkBank({
      bankName,
      accountHolder,
      rail,
      currency: bankCurrency,
      accountNumber,
      routingCode: routingCode || (rail === 'UPI' ? 'UPI-NPCI' : 'SWIFT-GEN'),
      challengeId: bankChallenge.challengeId,
      otpCode: bankOtp,
    });
    setBankBusy(false);
    if (res.ok) {
      setBankName('');
      setAccountHolder('');
      setAccountNumber('');
      setRoutingCode('');
      setBankChallenge(null);
      setBankOtp('');
    } else if (res.error) {
      setBankError(res.error);
    }
  };

  const handleStartTotpSetup = async () => {
    if (!onSetupTotp) return;
    setTotpError(null);
    setTotpBusy(true);
    const setup = await onSetupTotp();
    if (setup) {
      setTotpSetup(setup);
      try {
        const dataUrl = await QRCode.toDataURL(setup.otpauthUri, {
          width: 156,
          margin: 1,
          color: { dark: '#0B0E11', light: '#FFFFFF' },
        });
        setTotpQrUrl(dataUrl);
      } catch {
        setTotpQrUrl(null);
      }
    }
    setTotpBusy(false);
  };

  const handleConfirmTotpSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onConfirmTotp) return;
    setTotpError(null);
    setTotpBusy(true);
    const res = await onConfirmTotp(totpVerifyCode);
    setTotpBusy(false);
    if (!res.ok) {
      setTotpError(res.error ?? 'Verification code mismatch.');
    } else {
      setTotpSetup(null);
      setTotpQrUrl(null);
      setTotpVerifyCode('');
    }
  };

  const handleEnrollPasskeyClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEnrollPasskey) return;
    setPasskeyError(null);
    setPasskeyBusy(true);
    const res = await onEnrollPasskey(passkeyLabel);
    setPasskeyBusy(false);
    if (!res.ok) {
      setPasskeyError(res.error ?? 'Failed to register hardware key.');
    }
  };

  const handleExportVaultCsv = () => {
    downloadCsv(
      `aurex-vault-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      vaultTransfers.map((tx) => ({
        id: tx.id,
        timestamp: new Date(tx.createdAt).toISOString(),
        type: tx.type,
        destination: tx.destination ?? '',
        currency: tx.currency,
        nativeAmount: tx.nativeAmount,
        amountUsd: tx.amountUsd,
        bankLabel: tx.bankLabel,
        status: tx.status,
        entryHash: tx.entryHash,
      }))
    );
  };

  const handleToggleRealMoneyClick = async () => {
    if (!onToggleRealMoneyMode) return;
    setRealMoneyError(null);
    setRealMoneyBusy(true);
    const res = await onToggleRealMoneyMode(!isRealMoneyEnabled);
    setRealMoneyBusy(false);
    if (!res.ok) {
      setRealMoneyError(res.error ?? 'Unable to update real-money custody mode.');
    }
  };

  return (
    <div className="space-y-6">
      {/* A. Account Wallets & Hacker-Proof Cold Vault Shield */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Vault
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                securityStatus.lockdownMode ? 'text-[#F6465D]' : 'text-[#0ECB81]'
              }`}
            />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-[#EAECEF]">
                Wallet, Demo / Real Accounts &amp; Hacker-Proof Cold Vault
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#848E9C] mt-0.5">
                Practice risk-free with Demo funds, trade with your Real account, and isolate savings inside Cold Vault Shield.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onVerifyChain()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139] text-slate-800 dark:text-[#EAECEF] whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0ECB81]" />
              Verify Integrity
            </button>

            <button
              type="button"
              onClick={() => void onToggleLockdown()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                securityStatus.lockdownMode
                  ? 'bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11]'
                  : 'bg-[#F6465D] hover:bg-[#e0384e] text-white'
              }`}
            >
              {securityStatus.lockdownMode ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  Lift Emergency Freeze
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Emergency Lockdown Freeze
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Clean Account Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Card 1: Demo Practice */}
          <div
            className={`p-4 rounded-lg border transition-colors ${
              accountMode === 'demo'
                ? 'border-[#F0B90B] bg-[#F0B90B]/5'
                : 'border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                Demo Practice Account
              </span>
              <span className="font-mono text-[10px] text-[#D9A70A] dark:text-[#F0B90B]">
                {accountMode === 'demo' ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
            <div className="mt-2 text-xl font-mono tabular-nums font-bold text-slate-900 dark:text-[#EAECEF]">
              {formatCurrency(demoCashBalance)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-[#848E9C]">
              100% risk-free virtual practice balance. Isolated from Real money.
            </p>
            <button
              type="button"
              disabled={accountMode === 'demo'}
              onClick={() => void onSwitchAccountMode('demo')}
              className="mt-3 w-full py-1.5 text-xs font-semibold rounded border border-slate-200 dark:border-[#2B3139] disabled:opacity-50 hover:bg-white dark:hover:bg-[#181A20] text-slate-900 dark:text-[#EAECEF]"
            >
              {accountMode === 'demo' ? 'Currently Trading Demo' : 'Switch to Demo'}
            </button>
          </div>

          {/* Card 2: Real Trading */}
          <div
            className={`p-4 rounded-lg border transition-colors ${
              accountMode === 'real'
                ? 'border-[#0ECB81] bg-[#0ECB81]/5'
                : 'border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                Real Trading Account
              </span>
              <span className="font-mono text-[10px] text-[#0ECB81]">
                {accountMode === 'real' ? 'ACTIVE' : 'ISOLATED'}
              </span>
            </div>
            <div className="mt-2 text-xl font-mono tabular-nums font-bold text-slate-900 dark:text-[#EAECEF]">
              {formatCurrency(realCashBalance)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-[#848E9C]">
              Funded via UPI/Bank deposit or unlocked from your Cold Vault.
            </p>
            <button
              type="button"
              disabled={accountMode === 'real'}
              onClick={() => void onSwitchAccountMode('real')}
              className="mt-3 w-full py-1.5 text-xs font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] disabled:opacity-50 text-[#0B0E11]"
            >
              {accountMode === 'real' ? 'Currently Trading Real' : 'Switch to Real Account'}
            </button>
          </div>

          {/* Card 3: Hacker-Proof Cold Vault */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/60">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-[#EAECEF] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0ECB81]" />
                Cold Vault Shield
              </span>
              <span className="font-mono text-[10px] text-[#0ECB81]">
                {securityStatus.lockdownMode ? 'FROZEN' : '2FA LOCKED'}
              </span>
            </div>
            <div className="mt-2 text-xl font-mono tabular-nums font-bold text-[#0ECB81]">
              {formatCurrency(vaultBalanceUsd)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-[#848E9C]">
              Cannot be traded or withdrawn by anyone unless unlocked with a 2FA code.
            </p>
            <form onSubmit={handleVaultShieldSubmit} className="mt-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <select
                  value={vaultAction}
                  onChange={(e) => {
                    setVaultAction(e.target.value === 'unlock' ? 'unlock' : 'lock');
                    setVaultChallenge(null);
                  }}
                  className="px-2 py-1 rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] text-[11px]"
                >
                  <option value="lock">Lock to Vault</option>
                  <option value="unlock">Unlock (2FA)</option>
                </select>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={vaultAmountInput}
                  onChange={(e) => setVaultAmountInput(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 font-mono rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] text-[11px]"
                />
                <button
                  type="submit"
                  disabled={vaultBusy || (vaultAction === 'unlock' && !vaultChallenge)}
                  className="px-2.5 py-1 rounded bg-[#0ECB81] hover:bg-[#0bb572] disabled:opacity-50 text-[#0B0E11] font-semibold text-[11px] whitespace-nowrap"
                >
                  {vaultAction === 'lock' ? 'Lock' : 'Release'}
                </button>
              </div>
              {vaultAction === 'unlock' && (
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleRequestVaultOtp()}
                    className="text-[11px] underline text-[#D9A70A] dark:text-[#F0B90B] whitespace-nowrap"
                  >
                    {vaultChallenge ? `2FA: ${vaultChallenge.otpPreview}` : 'Get 2FA Code'}
                  </button>
                  {vaultChallenge && (
                    <input
                      type="text"
                      value={vaultOtp}
                      onChange={(e) => setVaultOtp(e.target.value)}
                      placeholder="OTP"
                      className="w-20 px-2 py-0.5 font-mono text-[11px] rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]"
                    />
                  )}
                </div>
              )}
              {vaultError && (
                <div role="alert" className="text-[11px] font-medium text-[#F6465D]">
                  {vaultError}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* B. Easy Deposits & Withdrawals (India UPI/IMPS + International Banking) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 6 Cols: Deposit & Withdrawal Gateway */}
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2B3139] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Easy Worldwide Deposit &amp; Withdrawal (10 Currencies)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                Deposit in INR (UPI/IMPS) or USD, EUR, GBP, SGD, AED, JPY, AUD, CAD, CHF · Protected by Step-Up 2FA
              </p>
            </div>
          </div>

          <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#0B0E11] rounded-md">
              <button
                type="button"
                onClick={() => {
                  setTransferType('deposit');
                  setTxChallenge(null);
                }}
                className={`py-1.5 font-semibold rounded flex items-center justify-center gap-1.5 transition-colors ${
                  transferType === 'deposit'
                    ? 'bg-[#0ECB81] text-[#0B0E11]'
                    : 'text-slate-600 dark:text-[#848E9C]'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Deposit Money
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferType('withdrawal');
                  setTxChallenge(null);
                }}
                className={`py-1.5 font-semibold rounded flex items-center justify-center gap-1.5 transition-colors ${
                  transferType === 'withdrawal'
                    ? 'bg-[#F6465D] text-white'
                    : 'text-slate-600 dark:text-[#848E9C]'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Withdraw Money
              </button>
            </div>

            {transferType === 'deposit' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDepositDestination('real_trading')}
                  className={`p-2 rounded border text-left transition-colors ${
                    depositDestination === 'real_trading'
                      ? 'border-[#F0B90B] bg-[#F0B90B]/10'
                      : 'border-slate-200 dark:border-[#2B3139]'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                    To Real Trading
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-[#848E9C]">
                    Ready to buy stocks &amp; crypto
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDepositDestination('cold_vault')}
                  className={`p-2 rounded border text-left transition-colors ${
                    depositDestination === 'cold_vault'
                      ? 'border-[#0ECB81] bg-[#0ECB81]/10'
                      : 'border-slate-200 dark:border-[#2B3139]'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                    Direct to Cold Vault
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-[#848E9C]">
                    Locked safe storage (2FA)
                  </div>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Linked UPI / Bank / Card Rail
                </label>
                <select
                  value={activeBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF]"
                >
                  {bankAccounts.length === 0 ? (
                    <option value="">Link a UPI ID or bank rail on the right first</option>
                  ) : (
                    bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({b.maskedNumber}) · {b.rail}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                  Currency
                </label>
                <select
                  value={transferCurrency}
                  onChange={(e) => setTransferCurrency(e.target.value as SupportedCurrency)}
                  className="w-full px-3 py-2 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF]"
                >
                  <option value="INR">INR (₹ India)</option>
                  <option value="USD">USD ($ US)</option>
                  <option value="EUR">EUR (€ EU)</option>
                  <option value="GBP">GBP (£ UK)</option>
                  <option value="SGD">SGD (S$ SG)</option>
                  <option value="AED">AED (د.إ UAE)</option>
                  <option value="JPY">JPY (¥ Japan)</option>
                  <option value="AUD">AUD (A$ Australia)</option>
                  <option value="CAD">CAD (C$ Canada)</option>
                  <option value="CHF">CHF (Fr Switzerland)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#848E9C] mb-1">
                <span>Amount ({transferCurrency})</span>
                <span className="font-mono text-[#0ECB81]">
                  ≈ {formatCurrency(estUsdPreview)} USD credited
                </span>
              </div>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-slate-900 dark:text-[#EAECEF]"
              />
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {(transferCurrency === 'INR'
                  ? [5000, 25000, 100000, 500000]
                  : [100, 1000, 5000, 25000]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTransferAmount(String(preset))}
                    className="py-1 text-[10px] font-mono rounded border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139] text-slate-600 dark:text-[#B7BDC6]"
                  >
                    {transferCurrency === 'INR' ? `₹${preset.toLocaleString()}` : preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Step-Up OTP Box */}
            <div className="p-3 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/60 dark:bg-[#0B0E11]/60 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-700 dark:text-[#EAECEF] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#F0B90B]" />
                  2FA Transfer Confirmation
                </span>
                <button
                  type="button"
                  onClick={() => void handleRequestTxOtp()}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11] whitespace-nowrap"
                >
                  {txChallenge ? 'Refresh 2FA Code' : 'Generate 2FA Code'}
                </button>
              </div>
              {txChallenge && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                    Code:{' '}
                    <strong className="font-mono text-slate-900 dark:text-[#EAECEF]">
                      {txChallenge.otpPreview}
                    </strong>
                  </span>
                  <input
                    type="text"
                    required
                    value={txOtp}
                    onChange={(e) => setTxOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-36 px-2.5 py-1 font-mono rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]"
                  />
                </div>
              )}
            </div>

            {txError && (
              <div role="alert" className="text-xs font-medium text-[#F6465D]">
                {txError}
              </div>
            )}

            <button
              type="submit"
              disabled={txBusy || !txChallenge || securityStatus.lockdownMode}
              className="w-full py-2.5 font-semibold rounded-md bg-[#F0B90B] hover:bg-[#d9a70a] disabled:opacity-50 text-[#0B0E11] transition-colors"
            >
              {securityStatus.lockdownMode
                ? 'Blocked — Lift Emergency Lockdown First'
                : txBusy
                ? 'Settling & Signing Ledger...'
                : transferType === 'deposit'
                ? `Deposit ${transferCurrency} to ${depositDestination === 'cold_vault' ? 'Cold Vault' : 'Real Account'}`
                : `Withdraw ${transferCurrency} to Linked Account`}
            </button>
          </form>
        </div>

        {/* Right 6 Cols: Quick Link India UPI / International Bank */}
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2B3139] pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#F0B90B]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Linked UPI &amp; Global Banking Rails ({bankAccounts.length})
              </h3>
            </div>
            <div className="flex items-center p-0.5 rounded bg-slate-100 dark:bg-[#0B0E11] text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setRailRegion('india');
                  setRail('UPI');
                  setBankCurrency('INR');
                }}
                className={`px-2 py-1 rounded font-medium ${
                  railRegion === 'india'
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                India UPI/IMPS
              </button>
              <button
                type="button"
                onClick={() => {
                  setRailRegion('international');
                  setRail('ACH');
                  setBankCurrency('USD');
                }}
                className={`px-2 py-1 rounded font-medium inline-flex items-center gap-1 ${
                  railRegion === 'international'
                    ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                    : 'text-slate-500 dark:text-[#848E9C]'
                }`}
              >
                <Globe className="w-3 h-3" />
                Global Banking
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-[#2B3139] text-xs max-h-36 overflow-y-auto">
            {bankAccounts.map((b) => (
              <div key={b.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-[#EAECEF] truncate">
                    {b.bankName} · <span className="font-mono">{b.maskedNumber}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#848E9C] font-mono truncate">
                    {b.rail} ({b.currency}) · Route {b.maskedRouting}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#0ECB81] shrink-0">
                  AES-256-GCM
                </span>
              </div>
            ))}
          </div>

          {railRegion === 'india' ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 dark:text-[#848E9C]">India UPI &amp; Banks:</span>
              {UPI_PRESETS.map((up) => (
                <button
                  key={up.label}
                  type="button"
                  onClick={() => {
                    setBankName(up.bank);
                    setRail(up.rail);
                    setBankCurrency(up.currency);
                    setAccountNumber(`investor${up.handle}`);
                    setRoutingCode(up.route);
                  }}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-[#2B3139] hover:border-[#F0B90B] text-slate-700 dark:text-[#EAECEF]"
                >
                  {up.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 dark:text-[#848E9C]">Global Banks:</span>
              {WORLD_BANK_PRESETS.map((wb) => (
                <button
                  key={wb.label}
                  type="button"
                  onClick={() => {
                    setBankName(wb.bank);
                    setRail(wb.rail);
                    setBankCurrency(wb.currency);
                    setAccountNumber(wb.acct);
                    setRoutingCode(wb.route);
                  }}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-[#2B3139] hover:border-[#F0B90B] text-slate-700 dark:text-[#EAECEF]"
                >
                  {wb.label}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleLinkBankSubmit}
            className="pt-2 border-t border-slate-200 dark:border-[#2B3139] space-y-2.5 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={railRegion === 'india' ? 'UPI App or HDFC / ICICI / SBI' : 'Bank (e.g. Chase, Revolut, HSBC)'}
                className="px-3 py-1.5 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Account Holder Full Name"
                className="px-3 py-1.5 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={rail === 'UPI' ? 'UPI ID (e.g. name@okicici)' : 'Account Number / IBAN / Card'}
                className="px-3 py-1.5 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
              <input
                type="text"
                required={rail !== 'UPI'}
                value={routingCode}
                onChange={(e) => setRoutingCode(e.target.value)}
                placeholder={railRegion === 'india' ? 'IFSC / NPCI-UPI' : 'Routing / BIC / Sort Code'}
                className="px-3 py-1.5 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={rail}
                onChange={(e) => setRail(e.target.value as BankRailType)}
                className="px-3 py-1.5 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              >
                {railRegion === 'india' ? (
                  <>
                    <option value="UPI">India UPI Instant (₹0 Fee)</option>
                    <option value="IMPS">India IMPS 24x7</option>
                    <option value="NEFT">India NEFT</option>
                    <option value="CARD">RuPay / Visa / Mastercard</option>
                  </>
                ) : (
                  <>
                    <option value="ACH">US ACH Bank Transfer</option>
                    <option value="SEPA">Europe SEPA Instant (EUR)</option>
                    <option value="FPS">UK Faster Payments (GBP)</option>
                    <option value="SWIFT">International SWIFT / FedWire</option>
                    <option value="CARD">International Debit / Credit Card</option>
                  </>
                )}
              </select>
              <select
                value={bankCurrency}
                onChange={(e) => setBankCurrency(e.target.value as SupportedCurrency)}
                className="px-3 py-1.5 font-mono rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="SGD">SGD (S$)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="CHF">CHF (Fr)</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleRequestBankOtp()}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139] whitespace-nowrap"
              >
                {bankChallenge ? `2FA Code: ${bankChallenge.otpPreview}` : '1. Issue 2FA Code'}
              </button>
              {bankChallenge && (
                <input
                  type="text"
                  required
                  value={bankOtp}
                  onChange={(e) => setBankOtp(e.target.value)}
                  placeholder="OTP"
                  className="w-24 px-2.5 py-1.5 font-mono rounded bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
              )}
              <button
                type="submit"
                disabled={bankBusy || !bankChallenge}
                className="px-3.5 py-1.5 font-semibold rounded-md bg-[#0ECB81] hover:bg-[#0bb572] disabled:opacity-50 text-[#0B0E11] whitespace-nowrap"
              >
                {bankBusy ? 'Encrypting...' : '2. Encrypt & Link'}
              </button>
            </div>
            {bankError && (
              <div role="alert" className="text-[11px] font-medium text-[#F6465D]">
                {bankError}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* International UPI Corridors & Global 30-Bank Instant Settlement Directory */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0ECB81]" />
              India UPI, Global Banks &amp; Cross-Border Settlement Directory
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
              Click any supported country corridor or bank (India UPI/IMPS/NEFT, US FedNow/ACH, UK FPS, EU SEPA, Singapore PayNow, UAE Aani, PIX, SWIFT) to pre-fill your linked rail above.
            </p>
          </div>
          {onOpenKyc && (
            <button
              type="button"
              onClick={onOpenKyc}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded border whitespace-nowrap ${
                kycVerified
                  ? 'border-[#0ECB81]/50 bg-[#0ECB81]/10 text-[#059669] dark:text-[#0ECB81]'
                  : 'border-[#F0B90B]/50 bg-[#F0B90B]/10 text-[#B45309] dark:text-[#F0B90B]'
              }`}
            >
              {kycVerified ? 'Tier 2 KYC Verified' : 'Complete KYC Document Shield'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {GLOBAL_UPI_CORRIDORS.map((cor) => (
            <button
              key={cor.country}
              type="button"
              onClick={() => {
                setRailRegion(cor.country === 'India' ? 'india' : 'international');
                setBankName(`${cor.country} · ${cor.network}`);
                setRail(cor.rail);
                setBankCurrency(cor.currency);
                setAccountNumber(cor.sampleId);
                setRoutingCode(cor.route);
              }}
              className="text-left p-3 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50 dark:bg-[#0B0E11] hover:border-[#F0B90B] transition-colors"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-[#EAECEF]">{cor.country}</span>
                <span className="font-mono text-[10px] text-[#0ECB81]">{cor.currency}</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-[#B7BDC6] mt-0.5">{cor.network}</div>
              <div className="text-[10px] font-mono text-slate-400 dark:text-[#848E9C] mt-1">
                {cor.rail} · {cor.route}
              </div>
            </button>
          ))}
        </div>

        {bankDirectory.length > 0 && (
          <div className="pt-3 border-t border-slate-200 dark:border-[#2B3139] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded bg-slate-100 dark:bg-[#0B0E11] text-[11px]">
                {(
                  [
                    { id: 'all', label: `All Banks (${bankDirectory.length})` },
                    { id: 'india', label: 'India Banks & UPI' },
                    { id: 'international', label: 'International Banks' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDirRegion(t.id)}
                    className={`px-2.5 py-1 rounded font-medium ${
                      dirRegion === t.id
                        ? 'bg-[#F0B90B] text-[#0B0E11] font-semibold'
                        : 'text-slate-600 dark:text-[#848E9C]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dirSearch}
                  onChange={(e) => setDirSearch(e.target.value)}
                  placeholder="Search HDFC, SBI, Chase, SEPA, UPI..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
              {bankDirectory
                .filter((b) => {
                  if (dirRegion !== 'all' && b.region !== dirRegion) return false;
                  const q = dirSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    b.bankName.toLowerCase().includes(q) ||
                    b.country.toLowerCase().includes(q) ||
                    b.rail.toLowerCase().includes(q) ||
                    b.currency.toLowerCase().includes(q)
                  );
                })
                .map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setRailRegion(entry.region);
                      setBankName(entry.bankName);
                      setRail(entry.rail);
                      setBankCurrency(entry.currency);
                      setAccountNumber(entry.sampleAcct);
                      setRoutingCode(entry.routingCode);
                    }}
                    className="text-left p-2.5 rounded border border-slate-200 dark:border-[#2B3139] bg-slate-50/80 dark:bg-[#0B0E11]/80 hover:border-[#F0B90B] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-[#EAECEF] truncate">
                        {entry.bankName}
                      </span>
                      <span className="font-mono text-[10px] text-[#0ECB81] shrink-0">
                        {entry.currency} · {entry.rail}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-[#848E9C] mt-0.5 flex justify-between">
                      <span>{entry.country}</span>
                      <span>{entry.settlementSpeed}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Viral Referral & Promo Rewards Card */}
      {onRedeemPromo && onRecordShare && (
        <PromoRewardsCard
          profile={promoProfile}
          onRedeemPromo={onRedeemPromo}
          onRecordShare={onRecordShare}
        />
      )}

      {/* C. Real-Money Security Checklist + MFA Enrollment (TOTP & Hardware Keys) */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2B3139] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck
                className={`w-4 h-4 shrink-0 ${
                  isRealMoneyEnabled ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
                }`}
              />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Hacker-Defense Security Checklist (Required for Real-Money Trading)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#848E9C] mt-0.5">
              Enable both an Authenticator App (TOTP) and a Hardware Passkey ({verifiedMfaCount}/2) to unlock Real-Money Custody Mode.
            </p>
          </div>

          {onToggleRealMoneyMode && (
            <button
              type="button"
              disabled={realMoneyBusy || (!isRealMoneyEnabled && !checklistPassed)}
              onClick={() => void handleToggleRealMoneyClick()}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors disabled:opacity-50 ${
                isRealMoneyEnabled
                  ? 'border border-slate-300 dark:border-[#2B3139] text-slate-800 dark:text-[#EAECEF]'
                  : 'bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11]'
              }`}
            >
              {realMoneyBusy
                ? 'Updating...'
                : isRealMoneyEnabled
                ? 'Real-Money Active (Click to Pause)'
                : 'Enable Real-Money Trading'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {[
            { label: '1. Authenticator App (TOTP)', pass: hasTotpMfa },
            { label: '2. FIDO2 Hardware Passkey', pass: hasPasskeyMfa },
            { label: '3. Ledger & Unlock Intact', pass: vaultIntegrityReady },
            { label: '4. UPI / Bank Rail Linked', pass: hasVerifiedBankRail },
          ].map((chk) => (
            <div
              key={chk.label}
              className="flex items-center justify-between gap-2 p-3 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/60"
            >
              <span className="font-medium text-slate-800 dark:text-[#EAECEF] truncate">
                {chk.label}
              </span>
              {chk.pass ? (
                <CheckCircle2 className="w-4 h-4 text-[#0ECB81] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#F0B90B] shrink-0" />
              )}
            </div>
          ))}
        </div>

        {realMoneyError && (
          <div className="p-2.5 rounded border border-[#F6465D]/40 bg-[#F6465D]/10 text-xs text-[#F6465D]">
            {realMoneyError}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
          {/* Authenticator TOTP */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-[#2B3139] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-[#EAECEF]">
                <Smartphone className="w-4 h-4 text-[#F0B90B]" />
                Authenticator App (TOTP)
              </div>
              <span className={`font-mono text-[11px] ${authUser?.totpEnabled ? 'text-[#0ECB81]' : 'text-[#F0B90B]'}`}>
                {authUser?.totpEnabled ? 'ACTIVE' : 'NOT ENROLLED'}
              </span>
            </div>

            {authUser?.totpEnabled ? (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600 dark:text-[#B7BDC6]">
                  6-digit Authenticator protection is active on sign-in &amp; vault unlocks.
                </span>
                {onDisableTotp && (
                  <button
                    type="button"
                    onClick={() => void onDisableTotp()}
                    className="px-2.5 py-1 rounded border border-[#F6465D]/40 text-[#F6465D] hover:bg-[#F6465D]/10 shrink-0"
                  >
                    Disable
                  </button>
                )}
              </div>
            ) : totpSetup ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {totpQrUrl && (
                    <img src={totpQrUrl} alt="TOTP QR" className="w-28 h-28 rounded bg-white p-1 shrink-0" />
                  )}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <code className="block px-2 py-1 rounded bg-slate-100 dark:bg-[#0B0E11] font-mono text-[11px] break-all">
                      {totpSetup.secretBase32}
                    </code>
                    <div className="text-[10px] font-mono text-slate-500">
                      Backup: {totpSetup.recoveryCodes.slice(0, 3).join(' · ')}
                    </div>
                  </div>
                </div>
                {totpError && <div className="text-[#F6465D]">{totpError}</div>}
                <form onSubmit={handleConfirmTotpSetup} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="flex-1 px-2.5 py-1.5 font-mono rounded bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                  />
                  <button
                    type="submit"
                    disabled={totpBusy}
                    className="px-3 py-1.5 font-semibold rounded bg-[#F0B90B] text-[#0B0E11]"
                  >
                    Activate
                  </button>
                </form>
              </div>
            ) : (
              onSetupTotp && (
                <button
                  type="button"
                  disabled={totpBusy}
                  onClick={() => void handleStartTotpSetup()}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
                >
                  Setup Authenticator QR
                </button>
              )
            )}
          </div>

          {/* Hardware Passkeys */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-[#2B3139] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-[#EAECEF]">
                <Fingerprint className="w-4 h-4 text-[#0ECB81]" />
                Hardware Passkey / Biometrics (FIDO2)
              </div>
              <span className="font-mono text-[11px] text-slate-500 dark:text-[#848E9C]">
                {passkeys.length} Bound
              </span>
            </div>

            {passkeyError && <div className="text-xs text-[#F6465D]">{passkeyError}</div>}

            {onEnrollPasskey && (
              <form onSubmit={handleEnrollPasskeyClick} className="flex gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={passkeyLabel}
                  onChange={(e) => setPasskeyLabel(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139]"
                />
                <button
                  type="submit"
                  disabled={passkeyBusy}
                  className="px-3 py-1.5 font-semibold rounded bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11] whitespace-nowrap"
                >
                  Register Passkey
                </button>
              </form>
            )}

            {passkeys.length > 0 && (
              <div className="divide-y divide-slate-200 dark:divide-[#2B3139] text-xs">
                {passkeys.map((pk) => (
                  <div key={pk.id} className="py-1.5 flex items-center justify-between">
                    <span className="font-medium text-slate-800 dark:text-[#EAECEF]">
                      {pk.label} <span className="font-mono text-[10px] text-slate-500">({pk.algorithm})</span>
                    </span>
                    {onRemovePasskey && (
                      <button
                        type="button"
                        onClick={() => void onRemovePasskey(pk.id)}
                        className="text-[#F6465D] hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* D. Vault Ledger, Active Sessions & Live WAF Hacker Defense */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-[#2B3139] flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              Vault &amp; Payment History ({vaultTransfers.length})
            </h3>
            <button
              type="button"
              onClick={handleExportVaultCsv}
              disabled={vaultTransfers.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139] disabled:opacity-40"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C] bg-slate-50/70 dark:bg-[#0B0E11]/60">
                  <th className="py-2 px-4">Time</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3 text-right">USD Value</th>
                  <th className="py-2 px-4 text-right">HMAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139] font-mono tabular-nums">
                {vaultTransfers.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2 px-4 text-slate-500 whitespace-nowrap">
                      {formatTimeShort(tx.createdAt)}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                        {tx.type.replace('_', ' ').toUpperCase()} ({tx.currency})
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[190px]">
                        {tx.bankLabel}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {formatCurrency(tx.amountUsd)}
                    </td>
                    <td className="py-2 px-4 text-right text-[10px] text-slate-500">
                      {tx.entryHash.slice(0, 10)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-[#2B3139] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F0B90B]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Hacker Defense &amp; Sessions ({authSessions.length} active)
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {onRevokeOtherSessions && authSessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => void onRevokeOtherSessions()}
                  className="px-2 py-1 text-[11px] rounded border border-[#F6465D]/40 text-[#F6465D] hover:bg-[#F6465D]/10"
                >
                  Revoke Others
                </button>
              )}
              <button
                type="button"
                disabled={probeBusy}
                onClick={async () => {
                  setProbeBusy(true);
                  await onRunWafProbe('sqli');
                  setProbeBusy(false);
                }}
                className="px-2 py-1 text-[11px] font-mono rounded border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
              >
                Test Intrusion Block
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C] bg-slate-50/70 dark:bg-[#0B0E11]/60">
                  <th className="py-2 px-4">Time</th>
                  <th className="py-2 px-3">Firewall Event</th>
                  <th className="py-2 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139]">
                {firewallIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500 dark:text-[#848E9C]">
                      Zero intrusions detected. WAF &amp; rate shield actively protecting your funds.
                    </td>
                  </tr>
                ) : (
                  firewallIncidents.map((inc) => (
                    <tr key={inc.id}>
                      <td className="py-2 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {formatTimeShort(inc.createdAt)}
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-slate-900 dark:text-[#EAECEF]">{inc.ruleTriggered}</div>
                        <div className="text-[10px] font-mono text-slate-500">{inc.maskedIp}</div>
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-[#F6465D]">
                        {inc.action}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {guideMode && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-[#2B3139] text-[11px] text-slate-500 dark:text-[#848E9C]">
              Every deposit, withdrawal, and Cold Vault move is checked by our anti-hacker firewall and signed into a tamper-evident ledger.
            </div>
          )}
        </div>
      </div>

      {/* Encrypted Security & Payment Mesh + 6-Agent Hack Protection Squad + Built-In Bug Solver */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Built-In X25519 Encrypted Security & Payment Network Mesh */}
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#0ECB81]" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Built-In Encrypted Network Mesh (X25519 + AES-256-GCM)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                  End-to-end envelope hashing &amp; anti-replay nonce tunnel securing UPI, banking &amp; KYC traffic.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {onRefreshNetwork && (
                <button
                  type="button"
                  onClick={() => void onRefreshNetwork()}
                  className="p-1.5 rounded border border-slate-200 dark:border-[#2B3139] text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Refresh Network Telemetry"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              {onVerifyNetworkEnvelope && (
                <button
                  type="button"
                  onClick={() => void onVerifyNetworkEnvelope('vault_probe')}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#0ECB81] hover:bg-[#0bb572] text-[#0B0E11]"
                >
                  Verify Encrypted Tunnel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Handshake</div>
              <div className="font-semibold text-[#0ECB81]">
                {networkTelemetry?.handshakeActive ? 'X25519 ACTIVE' : 'INITIALIZING'}
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Packets Verified</div>
              <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                {networkTelemetry?.packetsVerified ?? 0}
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Packets Sealed</div>
              <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                {networkTelemetry?.packetsSealed ?? 0}
              </div>
            </div>
            <div>
              <div className="font-sans text-[10px] text-slate-500 dark:text-[#848E9C]">Replays Blocked</div>
              <div className="font-semibold text-[#F6465D]">
                {networkTelemetry?.replayBlockedCount ?? 0}
              </div>
            </div>
          </div>

          {networkTelemetry && (
            <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] text-[11px] font-mono text-slate-600 dark:text-[#B7BDC6] space-y-1">
              <div>
                Session Key ID: <span className="text-[#F0B90B]">{networkTelemetry.sessionKeyId}</span> · KDF: {networkTelemetry.kdf}
              </div>
              <div className="truncate">
                SPKI PubKey: {networkTelemetry.serverPublicKeySpkiB64.slice(0, 48)}…
              </div>
            </div>
          )}

          <div className="overflow-x-auto max-h-40 overflow-y-auto">
            <table className="w-full text-left text-[11px] font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2B3139] text-slate-500 dark:text-[#848E9C]">
                  <th className="py-1.5 pr-2">Channel</th>
                  <th className="py-1.5 pr-2">Direction</th>
                  <th className="py-1.5 pr-2">Tag</th>
                  <th className="py-1.5 text-right">Bytes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2B3139]">
                {(networkTelemetry?.recentPackets ?? []).slice(0, 6).map((pkt) => (
                  <tr key={pkt.id}>
                    <td className="py-1.5 pr-2 text-slate-900 dark:text-[#EAECEF]">{pkt.channel}</td>
                    <td
                      className={`py-1.5 pr-2 ${
                        pkt.direction === 'REPLAY_BLOCKED' ? 'text-[#F6465D]' : 'text-[#0ECB81]'
                      }`}
                    >
                      {pkt.direction}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500">{pkt.authTagPreview}</td>
                    <td className="py-1.5 text-right">{pkt.payloadBytes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Built-In Self-Diagnostics Bug Solver */}
        <div className="xl:col-span-6 bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#F0B90B]" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                  Built-In Auto-Diagnostics &amp; Bug Solver (
                  {diagnosticsReport?.healthScorePct ?? 100}% {diagnosticsReport?.overallHealth ?? 'HEALTHY'})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                  Continuous live checks across order books, candles, HMAC ledger chains, CCXT feeds, &amp; memory.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {onRefreshDiagnostics && (
                <button
                  type="button"
                  onClick={() => void onRefreshDiagnostics()}
                  className="p-1.5 rounded border border-slate-200 dark:border-[#2B3139] text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Re-scan Probes"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              {onSolveDiagnostic && (
                <button
                  type="button"
                  onClick={() => void onSolveDiagnostic('all')}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
                >
                  Run Auto-Fix Solver
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {(diagnosticsReport?.probes ?? []).map((probe) => (
              <div
                key={probe.id}
                className="p-2.5 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-[#EAECEF] truncate">
                    {probe.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-[#848E9C]">
                    {probe.measuredValue}
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] font-semibold shrink-0 ${
                    probe.status === 'PASS'
                      ? 'text-[#0ECB81]'
                      : probe.status === 'WARN'
                      ? 'text-[#F0B90B]'
                      : 'text-[#F6465D]'
                  }`}
                >
                  {probe.status}
                </span>
              </div>
            ))}
          </div>

          {diagnosticsReport?.lastRemediationSummary && (
            <div className="text-[11px] font-mono text-[#0ECB81] bg-[#0ECB81]/10 border border-[#0ECB81]/30 rounded px-3 py-1.5">
              {diagnosticsReport.lastRemediationSummary}
            </div>
          )}
        </div>
      </div>

      {/* Built-In 6-Agent Hack Protection Squad */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#0ECB81]" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                6-Agent Autonomous Hack Protection Squad
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                Dedicated AI cyber-defense units guarding WAF signatures, brute-force throttles, Merkle ledgers, sybil scams, key isolation, &amp; payload sanitization.
              </p>
            </div>
          </div>
          {onRefreshDefenseAgents && (
            <button
              type="button"
              onClick={() => void onRefreshDefenseAgents()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
            >
              <RefreshCw className="w-3 h-3" />
              Sync Squad
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
          {defenseAgents.map((agent) => (
            <div
              key={agent.id}
              className="p-3.5 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-slate-900 dark:text-[#EAECEF]">
                  {agent.codename}
                </span>
                <span className="font-mono text-[10px] font-semibold text-[#0ECB81]">
                  {agent.status}
                </span>
              </div>
              <div className="text-[11px] font-medium text-[#D9A70A] dark:text-[#F0B90B]">
                {agent.role}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-[#B7BDC6] leading-snug">
                {agent.latestAction}
              </p>
              <div className="flex items-center justify-between pt-1 font-mono tabular-nums text-[10px] text-slate-500 dark:text-[#848E9C]">
                <span>Surface: {agent.focusSurface}</span>
                <span>Blocked: {agent.threatsNeutralized}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Defense-in-Depth Security Flow & Responsible Disclosure Policy */}
      <div className="bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3139]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0ECB81]" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
                Defense-in-Depth Security Flow &amp; Responsible Disclosure Policy
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#848E9C]">
                End-to-end 6-layer request hardening pipeline, enterprise security controls, and coordinated bug-reporting SLAs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(
                'Title:\nSeverity:\nAffected Component:\nDescription:\nImpact:\nReproduction Steps:\nProof of Concept:\nSuggested Fix:\nContact Information:'
              );
              setReportTemplateCopied(true);
              setTimeout(() => setReportTemplateCopied(false), 1800);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-[#2B3139] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
          >
            {reportTemplateCopied ? (
              <>
                <Check className="w-3 h-3 text-[#0ECB81]" />
                Report Template Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy Vulnerability Report Format
              </>
            )}
          </button>
        </div>

        <div className="p-3 rounded-md bg-slate-50 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] font-mono text-[11px] text-slate-800 dark:text-[#EAECEF] overflow-x-auto whitespace-nowrap">
          Internet Traffic → Aegis-WAF → ZeroDay-Sanitizer → Chronos-BruteShield → Sybil-ScamHunter → Merkle-VaultGuard → KeySentinel-Isolator → Core Exchange Services
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          <div className="lg:col-span-7 p-3.5 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 space-y-2">
            <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
              Enterprise Controls &amp; Objectives
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-600 dark:text-[#B7BDC6]">
              {[
                'MFA (TOTP + FIDO2)',
                'Device Fingerprinting',
                'DDoS Throttling',
                'HMAC Audit Logging',
                'Founder RBAC',
                'X25519 + AES-256-GCM',
                'Strict HTTP 403 Path Isolation',
                'Continuous Diagnostics',
              ].map((ctrl) => (
                <span
                  key={ctrl}
                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-[#2B3139] bg-white dark:bg-[#181A20]"
                >
                  {ctrl}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#848E9C] leading-snug">
              Safe Harbor applies to good-faith researchers avoiding user data modification, service disruption, social engineering, or public disclosure before remediation.
            </p>
          </div>

          <div className="lg:col-span-5 p-3.5 rounded-md border border-slate-200 dark:border-[#2B3139] bg-slate-50/70 dark:bg-[#0B0E11]/70 space-y-2">
            <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
              Responsible Disclosure SLAs &amp; Contact
            </div>
            <div className="font-mono text-[11px] text-[#0ECB81]">
              security@aurexglobalexchange.com · founder@aurexglobalexchange.com
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              <div className="flex justify-between px-2 py-1 rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]">
                <span className="text-[#F6465D] font-semibold">Critical</span>
                <span>24h</span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]">
                <span className="text-[#F0B90B] font-semibold">High</span>
                <span>48h</span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]">
                <span className="text-blue-500 font-semibold">Medium</span>
                <span>5 Days</span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139]">
                <span className="text-slate-500 font-semibold">Low</span>
                <span>10 Days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
