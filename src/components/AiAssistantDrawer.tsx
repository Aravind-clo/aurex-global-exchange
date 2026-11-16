import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import type { AiAssistantMessage } from '../types/market';
import { formatTimeShort } from '../utils/format';

interface AiAssistantDrawerProps {
  open: boolean;
  activeSymbol: string;
  guideMode: boolean;
  onClose: () => void;
  onAsk: (payload: {
    message: string;
    symbol: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => Promise<{ reply: string; poweredBy: string } | null>;
}

const STARTER_PROMPTS = [
  'Analyze this chart prediction, support & resistance',
  'How do I protect my money in the Cold Vault?',
  'How do Demo vs Real accounts and UPI deposits work?',
  'Beginner guide: how do I place a safe order?',
];

export function AiAssistantDrawer({
  open,
  activeSymbol,
  guideMode,
  onClose,
  onAsk,
}: AiAssistantDrawerProps) {
  const [messages, setMessages] = useState<AiAssistantMessage[]>([
    {
      id: 'ai-welcome',
      role: 'assistant',
      content: `Hello! I am your Aurex AI Coach, grounded in live market telemetry, chart predictions, and your wallet security.\n\nAsk me about ${activeSymbol} targets & support/resistance, Demo vs Real accounts, Cold Vault 2FA safety, Global UPI Corridors, or the 24-agent live leaderboard.`,
      symbol: activeSymbol,
      poweredBy: 'Gemini 4 Hydrogen',
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  if (!open) return null;

  const sendQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: AiAssistantMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      symbol: activeSymbol,
      createdAt: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setBusy(true);

    const res = await onAsk({
      message: trimmed,
      symbol: activeSymbol,
      history: nextHistory.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    setBusy(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content:
          res?.reply ??
          'Unable to reach AI Assistant endpoint right now. Please try again in a moment.',
        symbol: activeSymbol,
        poweredBy: res?.poweredBy ?? 'Quantitative Engine',
        createdAt: Date.now(),
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                Aurex AI Assistant
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                Live Context: {activeSymbol} · {guideMode ? 'Beginner Guide' : 'Pro Quant'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Assistant"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 bg-slate-50/70 dark:bg-slate-900/40 shrink-0">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => void sendQuestion(prompt)}
              className="px-2.5 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:border-blue-500/50 text-slate-700 dark:text-slate-200 transition-colors text-left"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Conversation Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3.5 py-2.5 whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'
                }`}
              >
                {m.content}
              </div>
              <div className="mt-1 px-1 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                <span>{formatTimeShort(m.createdAt)}</span>
                {m.role === 'assistant' && m.poweredBy && (
                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-2.5 h-2.5" />
                    {m.poweredBy}
                  </span>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Synthesizing live market, 24-agent &amp; portfolio telemetry…
            </div>
          )}
        </div>

        {/* Prompt Form */}
        <form
          onSubmit={handleSubmit}
          className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0 bg-white dark:bg-[#0F172A]"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${activeSymbol}, risk, or MFA…`}
            className="flex-1 px-3 py-2 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send message to AI Assistant"
            className="px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
