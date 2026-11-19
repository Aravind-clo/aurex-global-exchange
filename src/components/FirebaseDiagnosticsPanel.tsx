import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  clearFirebaseDiagnosticLogs,
  getFirebaseDiagnostics,
  runFirebaseDiagnosticsProbe,
  type FirebaseDiagnosticsSnapshot,
} from '../lib/firebase';
import { formatTimeShort } from '../utils/format';

export function FirebaseDiagnosticsPanel() {
  const [diag, setDiag] = useState<FirebaseDiagnosticsSnapshot>(() => getFirebaseDiagnostics());
  const [probing, setProbing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDiag(getFirebaseDiagnostics());
  }, []);

  const handleRunProbe = async () => {
    setProbing(true);
    const next = await runFirebaseDiagnosticsProbe();
    setDiag(next);
    setProbing(false);
  };

  const handleClear = () => {
    clearFirebaseDiagnosticLogs();
    setDiag(getFirebaseDiagnostics());
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const statusTone =
    diag.connectionStatus === 'HEALTHY' || diag.connectionStatus === 'AUTH_REQUIRED'
      ? 'text-[#0ECB81]'
      : diag.connectionStatus === 'CONFIG_ERROR' || diag.connectionStatus === 'OFFLINE'
      ? 'text-[#F6465D]'
      : 'text-[#F59E0B]';

  return (
    <div className="bg-[#090A0D] border border-[#24262C] rounded-2xl p-5 space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24262C] pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-white">
              Firebase, Firestore &amp; Gmail OAuth Diagnostics
            </h3>
          </div>
          <p className="text-[11px] text-[#8B919E]">
            Inspects active Firestore database ID routing, runtime Web API key validation, and live Identity Toolkit health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={probing}
            onClick={() => void handleRunProbe()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#F0B90B] disabled:opacity-50 text-[#090A0C] font-semibold whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            {probing ? 'Probing…' : 'Run Live Probe'}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyReport()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14161B] border border-[#24262C] text-[#D1D5DB] hover:text-white whitespace-nowrap shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#14161B] border border-[#24262C] text-[#8B919E] hover:text-white whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Telemetry Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 font-mono tabular-nums">
        <div className="p-3 rounded-xl bg-[#14161B] border border-[#24262C] space-y-1">
          <div className="text-[10px] text-[#8B919E] uppercase">Firestore Database ID</div>
          <div
            className={`font-semibold break-all ${
              diag.usingNamedDatabase ? 'text-[#0ECB81]' : 'text-[#F6465D]'
            }`}
          >
            {diag.firestoreDatabaseId}
          </div>
          <div className="text-[10px] text-[#8B919E]">
            {diag.usingNamedDatabase
              ? 'Named Enterprise DB active (avoids (default) not found)'
              : "Falling back to '(default)'"}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#14161B] border border-[#24262C] space-y-1">
          <div className="text-[10px] text-[#8B919E] uppercase flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-[#F59E0B]" />
            Web API Key Posture
          </div>
          <div className={diag.apiKeyFormatValid ? 'font-semibold text-[#0ECB81]' : 'font-semibold text-[#F6465D]'}>
            {diag.maskedApiKeyPreview} ({diag.apiKeyFormatValid ? 'AIza Valid' : 'Invalid'})
          </div>
          <div className="text-[10px] text-[#8B919E] truncate">
            Source: {diag.apiKeySource}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#14161B] border border-[#24262C] space-y-1">
          <div className="text-[10px] text-[#8B919E] uppercase flex items-center gap-1">
            <Activity className="w-3 h-3 text-[#0ECB81]" />
            Firestore Endpoint Status
          </div>
          <div className={`font-semibold ${statusTone}`}>
            {diag.connectionStatus}
            {diag.lastProbeLatencyMs !== null ? ` · ${diag.lastProbeLatencyMs}ms` : ''}
          </div>
          <div className="text-[10px] text-[#8B919E] truncate">
            Project: {diag.projectId}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#14161B] border border-[#24262C] space-y-1">
          <div className="text-[10px] text-[#8B919E] uppercase">Gmail OAuth &amp; Auth Domain</div>
          <div className="font-semibold text-white truncate">
            {diag.gmailConnected ? `Connected (${diag.gmailEmail ?? 'Google'})` : 'Ready (In-Memory Session)'}
          </div>
          <div className="text-[10px] text-[#8B919E] truncate">
            {diag.authDomain}
          </div>
        </div>
      </div>

      {diag.envOverrideIgnored && (
        <div className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/40 text-[11px] text-[#FDE68A] flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Invalid Runtime Override Bypassed: </span>
            Detected non-Google-key value <span className="font-mono">{diag.envOverridePreview}</span> in{' '}
            <span className="font-mono">VITE_FIREBASE_API_KEY</span>. Safely fell back to the provisioned{' '}
            <span className="font-mono">AIza...</span> Web key to prevent <span className="font-mono">auth/api-key-not-valid</span>.
          </div>
        </div>
      )}

      {/* Secret Hygiene Guide */}
      <div className="p-3.5 rounded-xl bg-[#14161B] border border-[#24262C] space-y-1.5 text-[11px] text-[#B7BDC6]">
        <div className="font-semibold text-white">
          Runtime API Key Configuration (VITE_FIREBASE_API_KEY)
        </div>
        <p className="leading-relaxed">
          The <span className="font-mono text-white">apiKey</span> field in{' '}
          <span className="font-mono">firebase-applet-config.json</span> is intentionally blank. Supply a referrer-restricted{' '}
          <span className="font-mono text-[#F59E0B]">AIza...</span> key in{' '}
          <span className="font-mono text-white">VITE_FIREBASE_API_KEY</span> via your{' '}
          <span className="font-mono">.env</span> (gitignored) or Secret Manager / Cloud Run environment. Never prefix backend-only credentials with{' '}
          <span className="font-mono">VITE_</span>.
        </p>
      </div>

      {/* Diagnostic Log Console */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[#8B919E]">
          <span>Diagnostic Event Stream ({diag.logs.length})</span>
          {diag.lastCheckedAt && (
            <span className="font-mono">Last probe: {formatTimeShort(diag.lastCheckedAt)}</span>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {diag.logs.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#14161B] border border-[#24262C] text-[#8B919E] text-center">
              Click Run Live Probe to test Firestore reachability and Identity Toolkit key validity.
            </div>
          ) : (
            diag.logs.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-xl bg-[#14161B] border border-[#24262C] space-y-1"
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {entry.level === 'ERROR' ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-[#F6465D]" />
                    ) : entry.level === 'WARN' ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-[#F59E0B]" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0ECB81]" />
                    )}
                    <span
                      className={
                        entry.level === 'ERROR'
                          ? 'text-[#F6465D]'
                          : entry.level === 'WARN'
                          ? 'text-[#F59E0B]'
                          : 'text-[#0ECB81]'
                      }
                    >
                      [{entry.subsystem}] {entry.code}
                    </span>
                  </span>
                  <span className="text-[#8B919E]">{formatTimeShort(entry.timestamp)}</span>
                </div>
                <div className="text-[11px] text-[#E5E7EB] leading-relaxed">{entry.message}</div>
                {entry.hint && (
                  <div className="text-[10px] text-[#F59E0B]">Remediation: {entry.hint}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
