import React, { useState } from 'react';
import { Check, Copy, Download, Smartphone, ShieldCheck, Globe, Terminal, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PlayStoreReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlayStoreReadinessModal: React.FC<PlayStoreReadinessModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://mughalai.app';

  const bubblewrapInitCmd = `npx @bubblewrap/cli init --manifest="${appOrigin}/manifest.webmanifest"`;
  const bubblewrapBuildCmd = `npx @bubblewrap/cli build`;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0B0F17]">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Google Play Store & PWA Publishing Guide
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mughal AI is pre-configured for Android TWA (Trusted Web Activity) & Home Screen Install
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Direct Device Install */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Install Directly on Your Phone or Desktop</span>
              </div>
              <p className="text-xs text-slate-400">
                {isInstalled
                  ? 'Mughal AI is already installed in standalone mode on this device.'
                  : isIOS
                  ? 'On iPhone/iPad Safari: Tap Share in the toolbar, then select "Add to Home Screen".'
                  : 'Install Mughal AI with a native app icon, splash screen, and fullscreen standalone window.'}
              </p>
            </div>
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={install}
                className="px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Install App Now</span>
              </button>
            )}
          </div>

          {/* Compliance Checklist */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Play Store Readiness Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-200">Web App Manifest</div>
                  <div className="text-slate-400 mt-0.5 font-mono text-[11px]">
                    display: standalone · 192px & 512px maskable icons
                  </div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-200">Digital Asset Links</div>
                  <div className="text-slate-400 mt-0.5 font-mono text-[11px]">
                    /.well-known/assetlinks.json active
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Play Store Bundle Instructions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Generate Android App Bundle (.aab) for Google Play Console</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Use Google&apos;s official <strong>Bubblewrap CLI</strong> or <strong>PWABuilder.com</strong> to package Mughal AI into a signed Android App Bundle (<code className="font-mono text-emerald-300">app-release-bundle.aab</code>) ready for Google Play Store upload:
            </p>

            <div className="space-y-2.5">
              <div className="rounded-xl bg-[#070A10] border border-slate-800 p-3 flex items-center justify-between gap-3">
                <div className="overflow-x-auto">
                  <div className="text-[11px] text-slate-400 mb-1">1. Initialize Android TWA project from live manifest:</div>
                  <code className="font-mono text-xs text-emerald-300 whitespace-nowrap">
                    {bubblewrapInitCmd}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(bubblewrapInitCmd, 'init')}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 transition-colors"
                  title="Copy command"
                >
                  {copiedCmd === 'init' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="rounded-xl bg-[#070A10] border border-slate-800 p-3 flex items-center justify-between gap-3">
                <div className="overflow-x-auto">
                  <div className="text-[11px] text-slate-400 mb-1">2. Build signed Play Store .aab & .apk packages:</div>
                  <code className="font-mono text-xs text-emerald-300 whitespace-nowrap">
                    {bubblewrapBuildCmd}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(bubblewrapBuildCmd, 'build')}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 transition-colors"
                  title="Copy command"
                >
                  {copiedCmd === 'build' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#0B0F17] flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Package ID: <code className="font-mono text-slate-300">com.mughalai.assistant</code>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
