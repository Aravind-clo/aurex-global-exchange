import { useState } from 'react';
import { BellPlus, Download, RotateCcw, Trash2, Users } from 'lucide-react';
import type {
  DeskMember,
  Instrument,
  Order,
  Position,
  PriceAlert,
} from '../types/market';
import {
  downloadCsv,
  formatCurrency,
  formatPrice,
  formatRelativeTime,
  formatTimeShort,
} from '../utils/format';

interface AlertsPortfolioViewProps {
  instruments: Instrument[];
  positions: Position[];
  orders: Order[];
  alerts: PriceAlert[];
  deskMembers: DeskMember[];
  cashBalance: number;
  clientId: string;
  onCancelOrder: (orderId: string) => void;
  onClosePosition: (pos: Position) => void;
  onCreateAlert: (payload: {
    symbol: string;
    condition: 'above' | 'below';
    targetPrice: number;
    note?: string;
  }) => void;
  onDeleteAlert: (alertId: string) => void;
  onUpdateDeskIdentity: (name: string, role: string) => void;
  onResetPortfolio: () => void;
  onOpenTerminal: (symbol: string) => void;
}

export function AlertsPortfolioView({
  instruments,
  positions,
  orders,
  alerts,
  deskMembers,
  cashBalance,
  clientId,
  onCancelOrder,
  onClosePosition,
  onCreateAlert,
  onDeleteAlert,
  onUpdateDeskIdentity,
  onResetPortfolio,
  onOpenTerminal,
}: AlertsPortfolioViewProps) {
  const [alertSymbol, setAlertSymbol] = useState(instruments[0]?.symbol ?? 'NVDA');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertPrice, setAlertPrice] = useState(
    String(instruments[0]?.price ?? 147)
  );
  const [alertNote, setAlertNote] = useState('');

  const selfMember = deskMembers.find((m) => m.clientId === clientId);
  const [analystName, setAnalystName] = useState(selfMember?.name ?? 'Lead Strategist');
  const [analystRole, setAnalystRole] = useState(selfMember?.role ?? 'Quant Execution');

  const handleAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number.parseFloat(alertPrice);
    if (!Number.isFinite(target) || target <= 0) return;
    onCreateAlert({
      symbol: alertSymbol,
      condition: alertCondition,
      targetPrice: target,
      note: alertNote.trim() || undefined,
    });
    setAlertNote('');
  };

  const handleExportBlotter = () => {
    downloadCsv(
      `nuvra-blotter-${new Date().toISOString().slice(0, 10)}.csv`,
      orders.map((o) => ({
        OrderID: o.id,
        Time: new Date(o.createdAt).toISOString(),
        Trader: o.traderName,
        Symbol: o.symbol,
        Side: o.side,
        Type: o.type,
        Price: o.price,
        Quantity: o.size,
        NotionalUSD: o.notional,
        Status: o.status,
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Price Alert Creator + Multi-User Desk Presence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAlertSubmit}
          className="lg:col-span-7 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Server-Evaluated Price & Breakout Alerts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alerts are monitored continuously against incoming WebSocket and exchange ticks
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                Symbol
              </label>
              <select
                value={alertSymbol}
                onChange={(e) => {
                  const sym = e.target.value;
                  setAlertSymbol(sym);
                  const found = instruments.find((i) => i.symbol === sym);
                  if (found) setAlertPrice(String(found.price));
                }}
                className="w-full px-2.5 py-2 text-xs font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {instruments.map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                Condition
              </label>
              <select
                value={alertCondition}
                onChange={(e) => setAlertCondition(e.target.value as 'above' | 'below')}
                className="w-full px-2.5 py-2 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="above">Crosses Above</option>
                <option value="below">Crosses Below</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                Trigger Price
              </label>
              <input
                type="number"
                step="any"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap transition-colors"
              >
                <BellPlus className="w-3.5 h-3.5" />
                Arm Alert
              </button>
            </div>
          </div>

          <input
            type="text"
            value={alertNote}
            onChange={(e) => setAlertNote(e.target.value)}
            placeholder="Optional thesis note (e.g., VWAP reclaim, resistance breakout)..."
            className="w-full px-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 pt-1">
            {alerts.length === 0 ? (
              <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
                No alerts configured. Arm an alert above to receive real-time execution notifications.
              </p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {alert.symbol}
                    </span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">
                      {alert.condition} {formatPrice(alert.targetPrice, alert.symbol)}
                    </span>
                    {alert.note && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}
                        · {alert.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-medium ${
                        alert.active
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {alert.active
                        ? 'Armed'
                        : `Triggered ${alert.triggeredAt ? formatRelativeTime(alert.triggeredAt) : ''}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteAlert(alert.id)}
                      aria-label="Delete alert"
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </form>

        {/* Connected Desk Presence */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Connected Institutional Desk ({deskMembers.length})
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={analystName}
              onChange={(e) => setAnalystName(e.target.value)}
              placeholder="Analyst Name"
              className="px-2.5 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                value={analystRole}
                onChange={(e) => setAnalystRole(e.target.value)}
                placeholder="Role"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => onUpdateDeskIdentity(analystName, analystRole)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Update
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {deskMembers.map((member) => (
              <div
                key={member.clientId}
                className="flex items-center justify-between py-2.5 text-xs"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {member.name}
                    {member.clientId === clientId ? ' (You)' : ''}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {member.role} · Joined {formatRelativeTime(member.connectedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenTerminal(member.activeSymbol)}
                  className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Viewing {member.activeSymbol}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Active Portfolio Positions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Available Buying Power: {formatCurrency(cashBalance)}
            </p>
          </div>
          <button
            type="button"
            onClick={onResetPortfolio}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Paper Account
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-3 text-right">Net Size</th>
                <th className="py-2.5 px-3 text-right">Avg Entry</th>
                <th className="py-2.5 px-3 text-right">Market Value</th>
                <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                <th className="py-2.5 px-3 text-right">Realized P&L</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-sans text-slate-500 dark:text-slate-400">
                    No open positions. Execute a Market or Limit order in the Terminal to establish exposure.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => onOpenTerminal(pos.symbol)}
                        className="hover:underline"
                      >
                        {pos.symbol}
                      </button>
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-medium ${
                        pos.size >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {pos.size}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatPrice(pos.avgEntry, pos.symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
                      {formatCurrency(pos.marketValue)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-medium ${
                        pos.unrealizedPnl >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {pos.unrealizedPnl >= 0 ? '+' : ''}
                      {formatCurrency(pos.unrealizedPnl)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right ${
                        pos.realizedPnl >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {pos.realizedPnl >= 0 ? '+' : ''}
                      {formatCurrency(pos.realizedPnl)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-sans">
                      {Math.abs(pos.size) > 1e-6 && (
                        <button
                          type="button"
                          onClick={() => onClosePosition(pos)}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Flatten
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Blotter */}
      <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Shared Execution Blotter ({orders.length})
          </h2>
          <button
            type="button"
            onClick={handleExportBlotter}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-3">Trader</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Side / Type</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Price</th>
                <th className="py-2.5 px-3 text-right">Notional</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-sans text-slate-500 dark:text-slate-400">
                    No orders routed during this session yet.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                      {formatTimeShort(ord.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                      {ord.traderName}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {ord.symbol}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={
                          ord.side === 'buy'
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-red-600 dark:text-red-400 font-medium'
                        }
                      >
                        {ord.side.toUpperCase()}
                      </span>{' '}
                      · <span className="capitalize text-slate-500 dark:text-slate-400">{ord.type}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {ord.size}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
                      {formatPrice(ord.price, ord.symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(ord.notional)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-sans">
                      {ord.status === 'open' ? (
                        <button
                          type="button"
                          onClick={() => onCancelOrder(ord.id)}
                          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span
                          className={
                            ord.status === 'filled'
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-slate-400'
                          }
                        >
                          {ord.status === 'filled' ? 'Filled' : 'Cancelled'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
