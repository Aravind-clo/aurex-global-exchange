import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  action: string;
  detail: string;
}

const TRADING_SHORTCUTS: ShortcutRow[] = [
  {
    keys: ['B'],
    action: 'Quick Buy Focus',
    detail: 'Switches Order Ticket to BUY and selects the quantity input box.',
  },
  {
    keys: ['S'],
    action: 'Quick Sell Focus',
    detail: 'Switches Order Ticket to SELL and selects the quantity input box.',
  },
  {
    keys: ['F'],
    action: 'Toggle Chart Fullscreen',
    detail: 'Expands or collapses the technical chart across the full terminal viewport.',
  },
  {
    keys: ['Esc'],
    action: 'Clear / Exit / Close',
    detail: 'Exits chart fullscreen, clears selected Order Book price, and closes active modals.',
  },
  {
    keys: ['?'],
    action: 'Keyboard Shortcuts',
    detail: 'Opens or closes this interactive keyboard command reference.',
  },
];

const CHART_TIMEFRAME_SHORTCUTS: ShortcutRow[] = [
  {
    keys: ['1', '2', '3', '4', '5'],
    action: 'Quick Chart Timeframe',
    detail: 'Jump directly to 1m, 5m, 15m, 1h, or 1D candle intervals on the terminal.',
  },
  {
    keys: ['Click Book Row'],
    action: 'Fill Limit Price',
    detail: 'Clicking any Bid or Ask level loads that exact price into a Limit Order.',
  },
];

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2B3139] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#F0B90B]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-[#EAECEF]">
              Terminal Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#848E9C]">
              Execution &amp; Terminal Controls
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#2B3139] border border-slate-200 dark:border-[#2B3139] rounded-md">
              {TRADING_SHORTCUTS.map((row) => (
                <div
                  key={row.action}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {row.action}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-[#848E9C] mt-0.5">
                      {row.detail}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {row.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-1 text-[11px] font-mono font-semibold rounded border border-slate-300 dark:border-[#2B3139] bg-slate-100 dark:bg-[#0B0E11] text-slate-900 dark:text-[#F0B90B]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#848E9C]">
              Charting &amp; Order Book Interaction
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#2B3139] border border-slate-200 dark:border-[#2B3139] rounded-md">
              {CHART_TIMEFRAME_SHORTCUTS.map((row) => (
                <div
                  key={row.action}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-[#EAECEF]">
                      {row.action}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-[#848E9C] mt-0.5">
                      {row.detail}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {row.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-1 text-[11px] font-mono font-semibold rounded border border-slate-300 dark:border-[#2B3139] bg-slate-100 dark:bg-[#0B0E11] text-slate-900 dark:text-[#EAECEF]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#2B3139] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#848E9C]">
          <span>Shortcuts pause automatically while typing inside any input box.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 font-semibold rounded bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
          >
            Done (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
