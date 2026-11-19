import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { SignalCard } from './components/SignalCard';
import { SignalSkeleton } from './components/SignalSkeleton';
import { ChartLightbox } from './components/ChartLightbox';
import {
  extractBase64FromDataUrl,
  MAX_CHARTS,
  validateIncomingImages,
} from './lib/signalParser';
import { createSampleXauChart } from './lib/sampleChart';
import type {
  ChartTimeframe,
  HistoryTurnPayload,
  PriceLevels,
  SignalHistoryItem,
  SignalType,
  StagedImage,
} from './lib/signalParser';

type SignalFilter = 'ALL' | SignalType;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read chart image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read chart image file.'));
    reader.readAsDataURL(file);
  });
}

function formatSignalTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Just now';
  }
}

export default function App() {
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [history, setHistory] = useState<SignalHistoryItem[]>([]);
  const [filter, setFilter] = useState<SignalFilter>('ALL');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzingCount, setAnalyzingCount] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pasteFlash, setPasteFlash] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Refs for fresh state inside global paste listener & auto-analyze callbacks
  const stagedRef = useRef<StagedImage[]>(stagedImages);
  stagedRef.current = stagedImages;
  const historyRef = useRef<SignalHistoryItem[]>(history);
  historyRef.current = history;
  const noteRef = useRef<string>(note);
  noteRef.current = note;
  const isAnalyzingRef = useRef<boolean>(isAnalyzing);
  isAnalyzingRef.current = isAnalyzing;
  const autoAnalyzeRef = useRef<boolean>(autoAnalyze);
  autoAnalyzeRef.current = autoAnalyze;

  const runAnalysis = useCallback(async (imagesToAnalyze: StagedImage[], traderNote: string) => {
    if (imagesToAnalyze.length === 0 || isAnalyzingRef.current) return;

    setIsAnalyzing(true);
    setAnalyzingCount(imagesToAnalyze.length);
    setErrorMessage(null);

    try {
      // Oldest-first history order for Gemini multi-turn context
      const historyPayload: HistoryTurnPayload[] = [...historyRef.current]
        .reverse()
        .map((item) => ({
          timestamp: item.timestamp,
          signalType: item.signalType,
          markdown: item.markdown,
          timeframes: item.charts.map((c) => c.timeframe),
          note: item.note,
        }));

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesToAnalyze.map((img) => ({
            mimeType: img.mimeType,
            data: img.base64,
            timeframe: img.timeframe,
          })),
          history: historyPayload,
          note: traderNote.trim() || undefined,
        }),
      });

      const data = (await response.json()) as {
        markdown?: string;
        signalType?: SignalType;
        levels?: PriceLevels;
        generatedAt?: string;
        error?: string;
      };

      if (!response.ok || !data.markdown) {
        throw new Error(data.error || 'Could not generate signal. Please try again.');
      }

      const nextIndex = historyRef.current.length + 1;
      const newSignal: SignalHistoryItem = {
        id: `sig-${Date.now()}-${nextIndex}`,
        index: nextIndex,
        timestamp: formatSignalTime(data.generatedAt || new Date().toISOString()),
        signalType: data.signalType ?? 'WAIT',
        markdown: data.markdown,
        levels: data.levels ?? { stopLoss: null, tp1: null, tp2: null },
        note: traderNote.trim() || undefined,
        charts: imagesToAnalyze.map((img) => ({
          id: img.id,
          name: img.name,
          dataUrl: img.dataUrl,
          timeframe: img.timeframe,
        })),
      };

      setHistory((prev) => [newSignal, ...prev]);
      setStagedImages([]);
      setNote('');
      setFilter('ALL');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unexpected network error while contacting Gemini.';
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const ingestFiles = useCallback(
    async (files: File[], source: 'paste' | 'upload') => {
      if (files.length === 0) return;
      setErrorMessage(null);

      // If pasting while Auto-Analyze is ON and no analysis is running,
      // combine with any staged charts up to 3 (or replace if already full).
      const currentStaged = stagedRef.current;
      const baseCount =
        source === 'paste' && autoAnalyzeRef.current && currentStaged.length >= MAX_CHARTS
          ? 0
          : currentStaged.length;

      const validation = validateIncomingImages(
        files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        baseCount,
        MAX_CHARTS
      );

      if (validation.error) {
        setErrorMessage(validation.error);
      }

      if (validation.accepted.length === 0) return;

      // Map validated metadata back to actual File instances
      const acceptedFiles: File[] = [];
      let cursor = 0;
      for (const f of files) {
        if (cursor >= validation.accepted.length) break;
        const target = validation.accepted[cursor];
        if (f.name === target.name && f.size === target.size && f.type === target.type) {
          acceptedFiles.push(f);
          cursor++;
        }
      }

      try {
        const encoded: StagedImage[] = await Promise.all(
          acceptedFiles.map(async (file, idx) => {
            const dataUrl = await readFileAsDataUrl(file);
            return {
              id: `chart-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              name:
                file.name && file.name !== 'image.png'
                  ? file.name
                  : `Clipboard_Chart_${baseCount + idx + 1}.png`,
              mimeType: file.type || 'image/png',
              dataUrl,
              base64: extractBase64FromDataUrl(dataUrl),
              sizeBytes: file.size,
              timeframe: 'Auto',
            };
          })
        );

        const nextBatch =
          baseCount === 0 ? encoded : [...currentStaged, ...encoded].slice(0, MAX_CHARTS);
        setStagedImages(nextBatch);

        if (source === 'paste') {
          setPasteFlash(true);
          window.setTimeout(() => setPasteFlash(false), 600);

          if (autoAnalyzeRef.current && !isAnalyzingRef.current) {
            void runAnalysis(nextBatch, noteRef.current);
          }
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to read pasted chart screenshot.'
        );
      }
    },
    [runAnalysis]
  );

  // Global Ctrl+V / Cmd+V paste listener anywhere on the page
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items || items.length === 0) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        void ingestFiles(imageFiles, 'paste');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [ingestFiles]);

  const handleRemoveImage = (id: string) => {
    setStagedImages((prev) => prev.filter((item) => item.id !== id));
    setErrorMessage(null);
  };

  const handleUpdateTimeframe = (id: string, timeframe: ChartTimeframe) => {
    setStagedImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, timeframe } : item))
    );
  };

  const handleLoadSampleChart = () => {
    setErrorMessage(null);
    if (stagedImages.length >= MAX_CHARTS) {
      setErrorMessage(`Maximum ${MAX_CHARTS} chart screenshots allowed per analysis.`);
      return;
    }
    const sample = createSampleXauChart();
    setStagedImages((prev) => [...prev, sample].slice(0, MAX_CHARTS));
  };

  const handleClearHistory = () => {
    setHistory([]);
    setFilter('ALL');
    setErrorMessage(null);
  };

  const filteredHistory = useMemo(() => {
    if (filter === 'ALL') return history;
    return history.filter((item) => item.signalType === filter);
  }, [history, filter]);

  const counts = useMemo(() => {
    return {
      ALL: history.length,
      BUY: history.filter((h) => h.signalType === 'BUY').length,
      SELL: history.filter((h) => h.signalType === 'SELL').length,
      WAIT: history.filter((h) => h.signalType === 'WAIT').length,
    };
  }, [history]);

  return (
    <div className="min-h-screen bg-[#0B0D11] text-[#E8ECF2] flex flex-col">
      <Header
        historyCount={history.length}
        onClearHistory={handleClearHistory}
        disabled={isAnalyzing}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-8">
          {/* Primary Instant Paste & Upload Zone */}
          <UploadZone
            stagedImages={stagedImages}
            autoAnalyze={autoAnalyze}
            onToggleAutoAnalyze={() => setAutoAnalyze((prev) => !prev)}
            note={note}
            onNoteChange={setNote}
            isAnalyzing={isAnalyzing}
            onFilesSelected={(files) => void ingestFiles(files, 'upload')}
            onRemoveImage={handleRemoveImage}
            onUpdateTimeframe={handleUpdateTimeframe}
            onGenerateSignal={() => void runAnalysis(stagedImages, note)}
            onLoadSampleChart={handleLoadSampleChart}
            onInspectImage={(url, title) => setLightboxImage({ url, title })}
            pasteFlash={pasteFlash}
          />

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss error"
                className="rounded p-1 text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Signal History Feed */}
          <section aria-label="Signal history" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-3">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-display text-base font-semibold text-[#F3F6FA]">
                  Signal History
                </h2>
                <span className="font-mono text-xs text-[#7D889C] tabular-nums">
                  {history.length === 0
                    ? 'Context active · 0 signals'
                    : `${history.length} signal${history.length > 1 ? 's' : ''} · Context carried to next scan`}
                </span>
              </div>

              {history.length > 0 && (
                <div
                  role="tablist"
                  aria-label="Filter signals by direction"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-[#12151C] p-1"
                >
                  {(['ALL', 'BUY', 'SELL', 'WAIT'] as SignalFilter[]).map((tab) => {
                    const active = filter === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setFilter(tab)}
                        className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#222836] text-[#F8FAFC]'
                            : 'text-[#8E99AD] hover:text-[#E8ECF2]'
                        }`}
                      >
                        {tab === 'ALL' ? 'All' : tab} ({counts[tab]})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isAnalyzing && <SignalSkeleton chartCount={analyzingCount} />}

            {filteredHistory.length > 0 ? (
              <div className="space-y-5">
                {filteredHistory.map((item) => (
                  <SignalCard
                    key={item.id}
                    signal={item}
                    onInspectImage={(url, title) => setLightboxImage({ url, title })}
                  />
                ))}
              </div>
            ) : !isAnalyzing ? (
              <div className="rounded-xl border border-white/[0.07] bg-[#101319] px-6 py-7 text-center">
                {history.length > 0 ? (
                  <p className="text-sm text-[#8E99AD]">
                    No <span className="font-mono text-[#E8ECF2]">{filter}</span> signals in this session yet.
                  </p>
                ) : (
                  <div className="mx-auto max-w-2xl">
                    <h3 className="font-display text-base font-semibold text-[#E8ECF2]">
                      Ready for Your First Gold Chart
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#8E99AD]">
                      Paste a screenshot from Exness (<kbd className="font-mono text-[#CBD5E1]">Ctrl+V</kbd>) or upload up to 3 timeframes. Each signal stays in session memory so follow-up charts automatically account for prior TP1/TP2 hits and reversals.
                    </p>

                    <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/[0.06] pt-5 text-left sm:grid-cols-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#D4A843]">
                          01. Instant Capture
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#8E99AD]">
                          Paste 1m, 5m, 15m, 1H, or 4H screenshots directly from your clipboard.
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#D4A843]">
                          02. Roman Urdu Clarity
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#8E99AD]">
                          Simple Pullback &amp; Breakout entries with clean SL, TP1, and TP2 prices.
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#D4A843]">
                          03. Session Continuity
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#8E99AD]">
                          Follow-up uploads reference earlier trades to spot continuations or invalidations.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <ChartLightbox
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
