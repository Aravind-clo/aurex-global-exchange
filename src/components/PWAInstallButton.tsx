import React, { useState } from 'react';
import { Check, Download, Laptop, Monitor, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { canNativeInstall, isInstalled, platform, promptInstall } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (canNativeInstall) {
      const outcome = await promptInstall();
      if (outcome !== 'unavailable') return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleAction()}
        className={`flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-semibold transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-[11px] min-h-[36px]' : 'px-3 py-2 text-xs min-h-[40px]'
        }`}
        title="Install Aurex Global Exchange on Android, iPhone, iPad, Windows, or MacBook"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Install App' : 'Install App'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Install Aurex Global Exchange
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Standalone cross-platform execution client with offline cache and native passkey support.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div
                className={`p-3 rounded-lg border ${
                  platform === 'ios'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                  <span>Apple iPhone / iPad (Safari)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed flex items-center gap-1 flex-wrap">
                  <span>Tap</span>
                  <Share className="w-3.5 h-3.5 text-blue-500 inline" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Share</span>
                  <span>and choose</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Add to Home Screen</span>.
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  platform === 'android'
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Android (Chrome / Edge / Brave)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Open browser menu <span className="font-mono font-semibold">⋮</span> →{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Install App</span> or{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Add to Home screen</span>.
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  platform === 'macos'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                  <span>MacBook (Safari / Chrome)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  In Safari click <span className="font-semibold text-slate-800 dark:text-slate-200">File → Add to Dock</span>, or in Chrome click the address-bar install icon.
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  platform === 'windows'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111E]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  <Monitor className="w-3.5 h-3.5 text-sky-500" />
                  <span>Windows 10/11 (Edge / Chrome)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Click the install icon in the right side of the URL bar →{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Install Aurex</span> to pin to Start & Taskbar.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="px-4 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center gap-2 shrink-0">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline mode active — displaying cached market snapshots until connection resumes.</span>
    </div>
  );
};
