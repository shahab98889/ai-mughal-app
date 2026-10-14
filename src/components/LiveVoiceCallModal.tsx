import React from 'react';
import { Headphones, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';

export type VoiceCallState = 'listening' | 'thinking' | 'speaking' | 'muted';

interface LiveVoiceCallModalProps {
  isOpen: boolean;
  callState: VoiceCallState;
  liveTranscript: string;
  aiReplyText: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onInterruptAI: () => void;
  onEndCall: () => void;
}

export const LiveVoiceCallModal: React.FC<LiveVoiceCallModalProps> = ({
  isOpen,
  callState,
  liveTranscript,
  aiReplyText,
  isMuted,
  onToggleMute,
  onInterruptAI,
  onEndCall,
}) => {
  if (!isOpen) return null;

  const statusLabel =
    callState === 'listening'
      ? 'Listening — Bolिये, Mughal AI sun raha hai...'
      : callState === 'thinking'
      ? 'Thinking — Mughal AI jawab tayyar kar raha hai...'
      : callState === 'speaking'
      ? 'Speaking — Tap orb to interrupt & speak'
      : 'Microphone Muted — Tap mic to resume';

  return (
    <div className="fixed inset-0 z-50 bg-[#070A10]/95 backdrop-blur-xl flex flex-col justify-between p-6 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-2xl w-full mx-auto pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold text-white">
              Mughal AI Live Voice
            </div>
            <div className="text-[11px] text-slate-400">
              Continuous Hands-Free Call Mode
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onEndCall}
          className="px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
        >
          Minimize to Chat
        </button>
      </div>

      {/* Center Animated Voice Orb & Live Captions */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-xl w-full mx-auto text-center space-y-8 my-6">
        <button
          type="button"
          onClick={() => {
            if (callState === 'speaking') {
              onInterruptAI();
            }
          }}
          className="relative group flex items-center justify-center focus:outline-none cursor-pointer"
          aria-label="Voice status orb"
        >
          {/* Outer Ripples */}
          <div
            className={`absolute w-56 h-56 sm:w-64 sm:h-64 rounded-full transition-transform duration-500 ${
              callState === 'speaking'
                ? 'bg-emerald-500/20 scale-115 animate-ping'
                : callState === 'listening'
                ? 'bg-sky-500/15 scale-105 animate-pulse'
                : callState === 'thinking'
                ? 'bg-amber-500/15 scale-100 animate-pulse'
                : 'bg-slate-800/30 scale-95'
            }`}
          />
          <div
            className={`absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full transition-all duration-300 ${
              callState === 'speaking'
                ? 'bg-emerald-500/30 scale-110'
                : callState === 'listening'
                ? 'bg-sky-500/25 scale-100'
                : callState === 'thinking'
                ? 'bg-amber-500/25 scale-95'
                : 'bg-slate-800/50 scale-90'
            }`}
          />

          {/* Core Orb */}
          <div
            className={`relative w-36 h-36 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center shadow-2xl border transition-all duration-300 ${
              callState === 'speaking'
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-300 text-slate-950 scale-105'
                : callState === 'listening'
                ? 'bg-gradient-to-br from-sky-400 to-emerald-500 border-sky-300 text-slate-950 scale-100'
                : callState === 'thinking'
                ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-emerald-500/50 text-emerald-300 scale-95'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {callState === 'speaking' ? (
              <Volume2 className="w-12 h-12 animate-bounce" />
            ) : callState === 'listening' ? (
              <Mic className="w-12 h-12" />
            ) : callState === 'thinking' ? (
              <div className="font-display text-3xl font-bold tracking-wider animate-pulse">
                M
              </div>
            ) : (
              <MicOff className="w-10 h-10" />
            )}
          </div>
        </button>

        {/* Status & Live Transcript / Reply */}
        <div className="space-y-3 px-4 w-full">
          <div className="font-display text-sm sm:text-base font-semibold text-emerald-400 tracking-wide">
            {statusLabel}
          </div>

          {liveTranscript && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm sm:text-base text-white font-medium max-w-lg mx-auto">
              &ldquo;{liveTranscript}&rdquo;
            </div>
          )}

          {aiReplyText && callState === 'speaking' && (
            <div className="p-4 rounded-2xl bg-[#111827]/90 border border-emerald-500/30 text-sm text-slate-200 max-h-40 overflow-y-auto leading-relaxed max-w-lg mx-auto">
              {aiReplyText}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Call Controls (Mute / Interrupt / End Call) */}
      <div className="flex items-center justify-center gap-6 pb-4 max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={onToggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
            isMuted
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          type="button"
          onClick={onEndCall}
          className="px-7 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm flex items-center gap-2.5 shadow-lg shadow-rose-950/50 transition-colors cursor-pointer"
          title="End Live Voice Call"
        >
          <PhoneOff className="w-5 h-5" />
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
};
