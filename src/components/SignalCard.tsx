import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Check,
  Clock,
  Copy,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { SignalHistoryItem, SignalType } from '../lib/signalParser';

interface SignalCardProps {
  signal: SignalHistoryItem;
  onInspectImage: (url: string, title: string) => void;
}

const SIGNAL_STYLES: Record<
  SignalType,
  {
    border: string;
    headerTint: string;
    labelText: string;
    accentColor: string;
    actionWord: string;
    Icon: typeof TrendingUp;
  }
> = {
  BUY: {
    border: 'border-emerald-500/35',
    headerTint: 'bg-emerald-500/[0.06]',
    labelText: 'text-emerald-400',
    accentColor: 'text-emerald-300',
    actionWord: 'BUY',
    Icon: TrendingUp,
  },
  SELL: {
    border: 'border-rose-500/35',
    headerTint: 'bg-rose-500/[0.06]',
    labelText: 'text-rose-400',
    accentColor: 'text-rose-300',
    actionWord: 'SELL',
    Icon: TrendingDown,
  },
  WAIT: {
    border: 'border-amber-500/35',
    headerTint: 'bg-amber-500/[0.06]',
    labelText: 'text-amber-400',
    accentColor: 'text-amber-300',
    actionWord: 'WAIT',
    Icon: Clock,
  },
};

export function SignalCard({ signal, onInspectImage }: SignalCardProps) {
  const [copied, setCopied] = useState(false);
  const style = SIGNAL_STYLES[signal.signalType];
  const DirectionIcon = style.Icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signal.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard write unavailable in non-secure context
    }
  };

  const hasParsedLevels =
    Boolean(signal.levels.stopLoss) ||
    Boolean(signal.levels.tp1) ||
    Boolean(signal.levels.tp2);

  return (
    <article
      data-testid="signal-card"
      data-signal-type={signal.signalType}
      className={`overflow-hidden rounded-xl border ${style.border} bg-[#12151C]`}
    >
      {/* Semantic Signal Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5 sm:px-6 ${style.headerTint}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className={`inline-flex items-center gap-2 font-display text-sm font-bold tracking-wide ${style.labelText}`}>
            <DirectionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>SIGNAL: {style.actionWord}</span>
          </div>

          <span aria-hidden="true" className="text-[#4B5568]">
            ·
          </span>

          <div className="flex items-center gap-2 font-mono text-xs text-[#9AA5B8] tabular-nums">
            <span>#{signal.index}</span>
            <span aria-hidden="true">·</span>
            <span>{signal.timestamp}</span>
            <span aria-hidden="true">·</span>
            <span>
              {signal.charts.length} chart{signal.charts.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy signal #${signal.index}`}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-white/[0.1] bg-[#161B24] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] transition-colors duration-150 hover:border-white/[0.2] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-300">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy Signal</span>
            </>
          )}
        </button>
      </div>

      {/* Quick SL / TP1 / TP2 Reference Bar */}
      {hasParsedLevels && (
        <div className="grid grid-cols-3 divide-x divide-white/[0.07] border-b border-white/[0.07] bg-[#0E1117]">
          <div className="px-4 py-3 sm:px-6">
            <p className="text-[11px] font-medium text-[#8E99AD]">Stop Loss (SL)</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-rose-400 tabular-nums sm:text-base">
              {signal.levels.stopLoss ?? '—'}
            </p>
          </div>
          <div className="px-4 py-3 sm:px-6">
            <p className="text-[11px] font-medium text-[#8E99AD]">Take Profit 1</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-400 tabular-nums sm:text-base">
              {signal.levels.tp1 ?? '—'}
            </p>
          </div>
          <div className="px-4 py-3 sm:px-6">
            <p className="text-[11px] font-medium text-[#8E99AD]">Take Profit 2</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-300 tabular-nums sm:text-base">
              {signal.levels.tp2 ?? '—'}
            </p>
          </div>
        </div>
      )}

      {/* Body: Analyzed Charts + Roman Urdu Markdown */}
      <div className="px-5 py-5 sm:px-6">
        {signal.charts.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {signal.charts.map((chart, idx) => (
              <button
                key={chart.id}
                type="button"
                onClick={() =>
                  onInspectImage(
                    chart.dataUrl,
                    `Signal #${signal.index} — ${chart.timeframe !== 'Auto' ? `${chart.timeframe} ` : ''}${chart.name}`
                  )
                }
                aria-label={`View analyzed chart ${idx + 1} for signal #${signal.index}`}
                className="group relative h-16 w-28 overflow-hidden rounded-md border border-white/[0.1] bg-[#080A0E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]"
              >
                <img
                  src={chart.dataUrl}
                  alt={`Analyzed chart ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                />
                {chart.timeframe !== 'Auto' && (
                  <span className="absolute bottom-1 right-1 rounded bg-[#0B0D11]/85 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#E5BE5C]">
                    {chart.timeframe}
                  </span>
                )}
              </button>
            ))}

            {signal.note && (
              <p className="text-xs text-[#8E99AD]">
                Note: <span className="text-[#CBD5E1]">{signal.note}</span>
              </p>
            )}
          </div>
        )}

        <div className="signal-markdown space-y-4 text-[15px] leading-[1.65] text-[#DCE3EE]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h3: ({ children }) => (
                <h3 className="font-display text-lg font-bold tracking-tight text-[#F8FAFC] sm:text-xl">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="mt-5 pt-2 font-display text-sm font-semibold tracking-tight text-[#E5BE5C] sm:text-[15px]">
                  {children}
                </h4>
              ),
              p: ({ children }) => {
                const rawText = String(children ?? '');
                const isInvalidation =
                  rawText.includes('Kab Trade Nahi Leni') || rawText.includes('⚠️');

                if (isInvalidation) {
                  return (
                    <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm leading-relaxed text-[#F3DFB0]">
                      {children}
                    </p>
                  );
                }

                return <p className="text-[#DCE3EE]">{children}</p>;
              },
              ul: ({ children }) => (
                <ul className="space-y-2 pl-5 list-disc marker:text-[#64748B]">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="space-y-2.5 pl-5 list-decimal marker:font-mono marker:text-[#D4A843]">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="pl-1 text-[#DCE3EE]">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-[#F8FAFC]">{children}</strong>
              ),
              table: ({ children }) => (
                <div className="my-3 overflow-x-auto rounded-lg border border-white/[0.09] bg-[#0D1016]">
                  <table className="w-full border-collapse text-left text-sm">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="border-b border-white/[0.08] bg-[#161B24] text-xs font-semibold text-[#9AA5B8]">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
              ),
              tr: ({ children }) => (
                <tr className="transition-colors hover:bg-white/[0.02]">{children}</tr>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 align-middle text-[#DCE3EE] [&:nth-child(2)]:font-mono [&:nth-child(2)]:font-semibold [&:nth-child(2)]:tabular-nums [&:nth-child(2)]:whitespace-nowrap [&:nth-child(2)]:text-[#F5DFA0]">
                  {children}
                </td>
              ),
            }}
          >
            {signal.markdown}
          </ReactMarkdown>
        </div>
      </div>
    </article>
  );
}
