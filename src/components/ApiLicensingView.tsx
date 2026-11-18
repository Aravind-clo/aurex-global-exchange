import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Play, Plus, Trash2 } from 'lucide-react';
import { authFetch } from '../hooks/useMarketSocket';
import type { ApiLicenseKey, Instrument } from '../types/market';
import { formatCurrency, formatRelativeTime } from '../utils/format';

interface ApiLicensingViewProps {
  apiKeys: ApiLicenseKey[];
  setApiKeys: React.Dispatch<React.SetStateAction<ApiLicenseKey[]>>;
  instruments: Instrument[];
}

export function ApiLicensingView({
  apiKeys,
  setApiKeys,
  instruments,
}: ApiLicensingViewProps) {
  const [label, setLabel] = useState('');
  const [tier, setTier] = useState<ApiLicenseKey['tier']>('Institutional');
  const [newlyIssuedToken, setNewlyIssuedToken] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [testSymbol, setTestSymbol] = useState(instruments[0]?.symbol ?? 'NVDA');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Commercial Revenue & Licensing Calculator
  const [seats, setSeats] = useState(12);
  const [billingCadence, setBillingCadence] = useState<'monthly' | 'annual'>('annual');

  useEffect(() => {
    if (instruments.length > 0 && !instruments.some((i) => i.symbol === testSymbol)) {
      setTestSymbol(instruments[0].symbol);
    }
  }, [instruments, testSymbol]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    try {
      const res = await authFetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim() || 'Quant Execution Client',
          tier,
        }),
      });
      const data = (await res.json()) as {
        key?: ApiLicenseKey;
        rawToken?: string;
        error?: string;
      };
      if (!res.ok || !data.key || !data.rawToken) {
        setApiError(data.error ?? `Unable to issue API key (${res.status}).`);
        return;
      }
      setApiKeys((prev) => [data.key!, ...prev]);
      setNewlyIssuedToken(data.rawToken);
      setLabel('');
    } catch {
      setApiError('Network error while provisioning API key.');
    }
  };

  const handleDeleteKey = async (id: string) => {
    setApiError(null);
    try {
      const res = await authFetch(`/api/v1/keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { keys?: ApiLicenseKey[]; error?: string };
      if (!res.ok || !Array.isArray(data.keys)) {
        setApiError(data.error ?? `Unable to revoke API key (${res.status}).`);
        return;
      }
      setApiKeys(data.keys);
    } catch {
      setApiError('Network error while revoking API key.');
    }
  };

  const handleRunApiTest = async () => {
    setTestLoading(true);
    setApiError(null);
    try {
      const activeKey = newlyIssuedToken || apiKeys[0]?.keyPreview || '';
      const res = await authFetch(`/api/v1/market/quote/${encodeURIComponent(testSymbol)}`, {
        headers: activeKey ? { 'x-api-key': activeKey } : {},
      });
      const text = await res.text();
      try {
        setTestResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setTestResponse(text || `HTTP ${res.status}`);
      }

      const keysRes = await authFetch('/api/v1/keys');
      if (keysRes.ok) {
        const keysData = (await keysRes.json()) as { keys?: ApiLicenseKey[] };
        if (Array.isArray(keysData.keys)) {
          setApiKeys(keysData.keys);
        }
      }
    } catch (err) {
      setTestResponse(
        JSON.stringify(
          { error: err instanceof Error ? err.message : 'Endpoint request failed' },
          null,
          2
        )
      );
    } finally {
      setTestLoading(false);
    }
  };

  const copyToken = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const monthlyPerSeat = tier === 'Institutional' ? 1450 : tier === 'Pro' ? 490 : 149;
  const discount = billingCadence === 'annual' ? 0.82 : 1;
  const estArr = seats * monthlyPerSeat * 12 * discount;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* API Key Provisioning */}
        <div className="lg:col-span-7 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Commercial Market Data & ML Signal API Keys
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provision metered access keys for trading bots, fund risk pipelines, and fintech integrations
            </p>
          </div>

          {apiError && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
              {apiError}
            </div>
          )}

          <form onSubmit={handleCreateKey} className="flex flex-wrap sm:flex-nowrap gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Client or desk label (e.g., AlphaStat Arbitrage Pod)"
              className="flex-1 min-w-[180px] px-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as ApiLicenseKey['tier'])}
              className="px-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="Starter">Starter (300 req/m)</option>
              <option value="Pro">Pro (2,400 req/m)</option>
              <option value="Institutional">Institutional (12,000 req/m)</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Issue Key
            </button>
          </form>

          {newlyIssuedToken && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs">
              <div className="font-mono text-emerald-700 dark:text-emerald-300 truncate">
                New key: <strong>{newlyIssuedToken}</strong>
              </div>
              <button
                type="button"
                onClick={() => copyToken(newlyIssuedToken)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-xs shrink-0"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    {k.label}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {k.keyPreview} · {k.tier} · {k.rateLimitPerMin.toLocaleString()} req/min · Issued{' '}
                    {formatRelativeTime(k.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {k.callsToday.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      calls today
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteKey(k.id)}
                    aria-label="Revoke API key"
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Metered API Explorer */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Live Endpoint Explorer
              </h2>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                GET /api/v1/market/quote/{testSymbol}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={testSymbol}
                onChange={(e) => setTestSymbol(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {instruments.map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleRunApiTest}
                disabled={testLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                {testLoading ? 'Running...' : 'Execute'}
              </button>
            </div>
          </div>

          <pre className="p-3.5 rounded-md bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-auto max-h-72 border border-slate-800">
            {testResponse ??
              `// Click Execute to query live quote, ML 15m prediction,\n// L2 top-of-book imbalance, and detected patterns\n// directly from the Nuvra API engine.`}
          </pre>
        </div>
      </div>

      {/* Institutional Licensing Plans & ARR Calculator */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Enterprise Licensing & Seat Calculator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transparent institutional licensing for prop desks, hedge funds, and wealth platforms
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              <button
                type="button"
                onClick={() => setBillingCadence('monthly')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  billingCadence === 'monthly'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCadence('annual')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  billingCadence === 'annual'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Annual (18% Off)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              name: 'Starter · For Solo Quant Analysts',
              price: 149,
              limit: '300 REST req/min · 1 WebSocket stream · 15m ML forecasts',
            },
            {
              name: 'Pro · For Active Trading Pods',
              price: 490,
              limit: '2,400 REST req/min · 10 concurrent streams · News NLP & L2 imbalance',
            },
            {
              name: 'Institutional · For Funds & Fintechs',
              price: 1450,
              limit: '12,000 REST req/min · Dedicated FIX/WS relay · Custom Gemini 4 briefs',
            },
          ].map((plan) => {
            const effective = Math.round(plan.price * discount);
            return (
              <div
                key={plan.name}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {plan.name}
                  </div>
                  <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    ${effective}
                    <span className="text-xs font-sans font-normal text-slate-500 dark:text-slate-400">
                      {' '}
                      / seat / mo
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {plan.limit}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTier(
                      plan.name.startsWith('Institutional')
                        ? 'Institutional'
                        : plan.name.startsWith('Pro')
                        ? 'Pro'
                        : 'Starter'
                    )
                  }
                  className="w-full py-2 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Select Tier
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4 flex-1 min-w-[260px]">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Desk Seats: <strong className="font-mono tabular-nums">{seats}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="flex-1 max-w-xs accent-blue-600"
            />
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Projected Contract Value ({tier}):{' '}
            </span>
            <strong className="text-base font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(estArr)} / yr
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
