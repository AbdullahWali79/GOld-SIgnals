import { Loader2 } from 'lucide-react';

interface SignalSkeletonProps {
  chartCount: number;
}

export function SignalSkeleton({ chartCount }: SignalSkeletonProps) {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-[#D4A843]/30 bg-[#12151C]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#D4A843]/[0.05] px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5 text-sm font-medium text-[#E5BE5C]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>
            Analyzing {chartCount} XAU/USD chart{chartCount > 1 ? 's' : ''} with Gemini...
          </span>
        </div>
        <span className="font-mono text-xs text-[#8E99AD]">Multi-TF &amp; S/R check</span>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="h-6 w-56 animate-pulse rounded bg-white/[0.07]" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-white/[0.05]" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.05]" />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="h-14 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="h-14 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="h-14 animate-pulse rounded-lg bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}
