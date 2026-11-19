import { Trash2 } from 'lucide-react';

interface HeaderProps {
  historyCount: number;
  onClearHistory: () => void;
  disabled?: boolean;
}

export function Header({ historyCount, onClearHistory, disabled = false }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0B0D11]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-3.5 sm:gap-8 sm:px-6">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D4A843]/35 bg-[#D4A843]/12 text-[#E5BE5C]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 17l5-5 4 3 7-8" />
              <path d="M16 7h4v4" />
            </svg>
          </span>
          <h1 className="truncate font-display text-[15px] font-bold tracking-tight text-[#F3F6FA] sm:text-lg whitespace-nowrap">
            XAU/USD Easy Signal Pro
          </h1>
        </div>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onClearHistory}
            disabled={disabled || historyCount === 0}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#141821] px-2.5 py-2 text-xs font-medium text-[#CBD5E1] transition-colors duration-150 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/[0.1] disabled:hover:bg-[#141821] disabled:hover:text-[#CBD5E1] whitespace-nowrap shrink-0 sm:gap-2 sm:px-3.5"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear History</span>
          </button>
        </div>
      </div>
    </header>
  );
}
