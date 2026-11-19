import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  ClipboardPaste,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { formatFileSize, MAX_CHARTS } from '../lib/signalParser';
import type { ChartTimeframe, StagedImage } from '../lib/signalParser';

const TIMEFRAMES: ChartTimeframe[] = ['Auto', '1m', '5m', '15m', '1H', '4H'];

interface UploadZoneProps {
  stagedImages: StagedImage[];
  autoAnalyze: boolean;
  onToggleAutoAnalyze: () => void;
  note: string;
  onNoteChange: (value: string) => void;
  isAnalyzing: boolean;
  onFilesSelected: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onUpdateTimeframe: (id: string, timeframe: ChartTimeframe) => void;
  onGenerateSignal: () => void;
  onLoadSampleChart: () => void;
  onInspectImage: (url: string, title: string) => void;
  pasteFlash: boolean;
}

export function UploadZone({
  stagedImages,
  autoAnalyze,
  onToggleAutoAnalyze,
  note,
  onNoteChange,
  isAnalyzing,
  onFilesSelected,
  onRemoveImage,
  onUpdateTimeframe,
  onGenerateSignal,
  onLoadSampleChart,
  onInspectImage,
  pasteFlash,
}: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input so re-selecting the same screenshot works
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const remainingSlots = MAX_CHARTS - stagedImages.length;

  return (
    <section
      aria-label="Chart upload and paste workspace"
      className={`rounded-xl border transition-colors duration-200 bg-[#12151C] ${
        pasteFlash
          ? 'border-[#D4A843]/70'
          : isDragging
            ? 'border-[#D4A843]/60 bg-[#161B25]'
            : 'border-white/[0.08]'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top workspace control bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-[#F3F6FA]">
            Paste or Upload Exness Charts
          </h2>
          <p className="mt-0.5 text-xs text-[#8E99AD]">
            Press <kbd className="font-mono text-[#D4A843]">Ctrl+V</kbd> anywhere · Up to 3 timeframes (1m, 5m, 15m, 1H, 4H) · 0.01 micro-lot context
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label
            htmlFor="auto-analyze-toggle"
            className="text-xs font-medium text-[#CBD5E1] select-none cursor-pointer whitespace-nowrap"
          >
            Auto-Analyze on Paste
          </label>
          <button
            id="auto-analyze-toggle"
            type="button"
            role="switch"
            aria-checked={autoAnalyze}
            aria-label="Auto-Analyze on Paste"
            onClick={onToggleAutoAnalyze}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] ${
              autoAnalyze
                ? 'border-[#D4A843]/60 bg-[#D4A843]'
                : 'border-white/[0.15] bg-[#1E2430]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform duration-150 ${
                autoAnalyze
                  ? 'translate-x-5.5 bg-[#0B0D11]'
                  : 'translate-x-1 bg-[#94A3B8]'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        multiple
        onChange={handleFileInput}
        className="sr-only"
        aria-label="Select chart screenshot files"
      />

      {/* Dropzone body */}
      <div className="p-5 sm:p-6">
        {stagedImages.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-7 text-center transition-colors duration-150 sm:py-8 ${
              isDragging
                ? 'border-[#D4A843] bg-[#D4A843]/[0.06]'
                : 'border-white/[0.14] bg-[#0D1016]'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/[0.08] bg-[#151A24] text-[#E5BE5C]">
              <ClipboardPaste className="h-5 w-5" aria-hidden="true" />
            </div>

            <p className="mt-4 font-display text-base font-semibold text-[#F3F6FA]">
              {isDragging
                ? 'Drop XAU/USD chart screenshots here'
                : 'Ctrl+V to paste chart screenshot instantly'}
            </p>
            <p className="mt-1.5 max-w-md text-sm text-[#8E99AD]">
              Supports Exness charts with Multi-TF Table v9 overlay and horizontal support/resistance lines.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-white/[0.12] bg-[#1A202C] px-4 py-2 text-sm font-medium text-[#F3F6FA] transition-colors duration-150 hover:border-white/[0.22] hover:bg-[#222938] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4 text-[#E5BE5C]" aria-hidden="true" />
                <span>Upload Screenshots</span>
              </button>

              <button
                type="button"
                onClick={onLoadSampleChart}
                disabled={isAnalyzing}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-white/[0.08] bg-transparent px-4 py-2 text-sm font-medium text-[#A7B1C2] transition-colors duration-150 hover:border-[#D4A843]/40 hover:text-[#F3F6FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                <span>Load Sample Chart</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-[#8E99AD]">
              <span className="font-mono tabular-nums">
                {stagedImages.length} / {MAX_CHARTS} charts staged
              </span>
              {remainingSlots > 0 && (
                <span>
                  Paste again or add {remainingSlots} more timeframe{remainingSlots > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {stagedImages.map((img, idx) => (
                <div
                  key={img.id}
                  data-testid="staged-chart-item"
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-white/[0.09] bg-[#0D1016]"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-[#080A0E]">
                    <button
                      type="button"
                      onClick={() => onInspectImage(img.dataUrl, img.name)}
                      aria-label={`Inspect staged chart ${idx + 1}: ${img.name}`}
                      className="block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#D4A843]"
                    >
                      <img
                        src={img.dataUrl}
                        alt={`Staged XAU/USD chart ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveImage(img.id)}
                      disabled={isAnalyzing}
                      aria-label={`Remove chart ${idx + 1}`}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.15] bg-[#0B0D11]/85 text-[#E8ECF2] transition-colors duration-150 hover:border-rose-400/50 hover:bg-rose-600 hover:text-white focus-visible:outline-2 focus-visible:outline-[#D4A843] disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#E2E8F0]">
                        {img.name}
                      </p>
                      <p className="font-mono text-[11px] text-[#7D889C] tabular-nums">
                        {formatFileSize(img.sizeBytes)}
                      </p>
                    </div>

                    <label className="sr-only" htmlFor={`tf-${img.id}`}>
                      Timeframe for chart {idx + 1}
                    </label>
                    <select
                      id={`tf-${img.id}`}
                      value={img.timeframe}
                      disabled={isAnalyzing}
                      onChange={(e) =>
                        onUpdateTimeframe(img.id, e.target.value as ChartTimeframe)
                      }
                      className="rounded-md border border-white/[0.1] bg-[#161B24] px-2 py-1 font-mono text-xs text-[#E8ECF2] focus:border-[#D4A843] focus:outline-none disabled:opacity-50"
                    >
                      {TIMEFRAMES.map((tf) => (
                        <option key={tf} value={tf}>
                          {tf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {remainingSlots > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-[#0D1016]/60 px-4 py-6 text-center text-xs font-medium text-[#8E99AD] transition-colors duration-150 hover:border-[#D4A843]/50 hover:bg-[#141822] hover:text-[#F3F6FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] disabled:opacity-40"
                >
                  <Plus className="h-5 w-5 text-[#D4A843]" aria-hidden="true" />
                  <span>Add Chart ({remainingSlots} left)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom action row: Optional note + Generate Signal CTA */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="trader-context-note" className="sr-only">
              Optional market note for Gemini
            </label>
            <input
              id="trader-context-note"
              type="text"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              disabled={isAnalyzing}
              placeholder="Optional note (e.g. TP1 hit, London open, price testing blue support...)"
              className="h-11 w-full rounded-lg border border-white/[0.1] bg-[#0B0D11] px-3.5 text-sm text-[#E8ECF2] placeholder:text-[#657085] transition-colors focus:border-[#D4A843]/60 focus:outline-none disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={onGenerateSignal}
            disabled={isAnalyzing || stagedImages.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#D4A843] px-6 text-sm font-bold text-[#0B0D11] transition-colors duration-150 hover:bg-[#E2B958] active:bg-[#C39735] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5BE5C] disabled:cursor-not-allowed disabled:bg-[#2A2F3B] disabled:text-[#6B768B] whitespace-nowrap shrink-0"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Analyzing Gold...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Generate Signal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
