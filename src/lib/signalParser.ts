export type SignalType = 'BUY' | 'SELL' | 'WAIT';

export type ChartTimeframe = 'Auto' | '1m' | '5m' | '15m' | '1H' | '4H';

export interface StagedImage {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  base64: string;
  sizeBytes: number;
  timeframe: ChartTimeframe;
}

export interface PriceLevels {
  stopLoss: string | null;
  tp1: string | null;
  tp2: string | null;
}

export interface SignalHistoryItem {
  id: string;
  index: number;
  timestamp: string;
  signalType: SignalType;
  markdown: string;
  levels: PriceLevels;
  note?: string;
  charts: Array<{
    id: string;
    name: string;
    dataUrl: string;
    timeframe: ChartTimeframe;
  }>;
}

export interface HistoryTurnPayload {
  timestamp: string;
  signalType: SignalType;
  markdown: string;
  timeframes: ChartTimeframe[];
  note?: string;
}

export const MAX_CHARTS = 3;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB per chart

export const XAU_SYSTEM_INSTRUCTION = `You are an expert Gold (XAU/USD) scalping and intraday analyst for Exness charts. The user will upload 1 or more chart screenshots (1m, 5m, 15m, 1H, 4H) which may include a 'Multi-TF Table v9' overlay showing 1D, 4H, 1H, 15m, 5m, 1m alignment and RSI, along with horizontal support/resistance lines (blue/yellow/Week lines).

Analyze the price action, candlestick rejections, support/resistance breakouts/pullbacks, Multi-TF alignment, and previous signal history.

ALWAYS respond in simple, easy-to-understand Roman Urdu using ONLY this exact clean structure (no complex jargon):

### 🟢 Signal: **BUY** (Gold / XAUUSD)  [OR 🔴 Signal: **SELL** / 🟡 Signal: **WAIT**]

* **Kya karna hai?** [1 clear line: Upar ki trade (BUY) leni hai / Neeche ki trade (SELL) leni hai / Abhi intezar karna hai]
* **Kyun?** [1-2 simple lines explaining support/resistance break, Multi-TF table alignment, or candle rejection]

#### 📍 Entry ke 2 Aasan Tareeqay (Koi ek choose karein)
1. **Option 1 (Pullback Entry - Safe):** [Exact price zone to wait for pullback + 1m/5m candle confirmation]
2. **Option 2 (Breakout Entry):** [Exact price level for 5m candle close breakout/breakdown]

#### 🎯 Targets & Risk (SL / TP)
| Level | Price | Matlab |
| :--- | :--- | :--- |
| **Stop Loss (SL)** | **$X,XXX.XX** | Yahan pohanchay to loss mein trade band kar dein |
| **Take Profit 1 (TP1)** | **$X,XXX.XX** | Pehla profit target |
| **Take Profit 2 (TP2)** | **$X,XXX.XX** | Doosra bada target |

⚠️ **Kab Trade Nahi Leni?** [1 clear invalidation rule with exact price level]`;

/**
 * Parses BUY, SELL, or WAIT from Gemini's Roman Urdu Markdown signal.
 */
export function detectSignalType(markdown: string): SignalType {
  if (!markdown) return 'WAIT';

  const firstLines = markdown
    .split('\n')
    .slice(0, 6)
    .join('\n');

  const signalLineMatch = firstLines.match(
    /Signal\s*:\s*\*?\*?(BUY|SELL|WAIT)\*?\*?/i
  );
  if (signalLineMatch) {
    const normalized = signalLineMatch[1].toUpperCase();
    if (normalized === 'BUY' || normalized === 'SELL' || normalized === 'WAIT') {
      return normalized;
    }
  }

  if (firstLines.includes('🟢') || /\bBUY\b/i.test(firstLines)) return 'BUY';
  if (firstLines.includes('🔴') || /\bSELL\b/i.test(firstLines)) return 'SELL';
  if (firstLines.includes('🟡') || /\bWAIT\b/i.test(firstLines)) return 'WAIT';

  return 'WAIT';
}

/**
 * Extracts Stop Loss, Take Profit 1, and Take Profit 2 price strings from the Markdown table.
 */
export function extractPriceLevels(markdown: string): PriceLevels {
  const levels: PriceLevels = {
    stopLoss: null,
    tp1: null,
    tp2: null,
  };

  if (!markdown) return levels;

  const lines = markdown.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;

    const cells = line
      .split('|')
      .map((cell) => cell.replace(/\*\*/g, '').trim())
      .filter((cell) => cell.length > 0);

    if (cells.length < 2) continue;

    const label = cells[0].toLowerCase();
    const price = cells[1];

    if (!price || price === 'Price' || /^:?-{2,}:?$/.test(price)) continue;

    if (label.includes('stop loss') || /\bsl\b/.test(label)) {
      levels.stopLoss = price;
    } else if (label.includes('take profit 1') || /\btp1\b/.test(label)) {
      levels.tp1 = price;
    } else if (label.includes('take profit 2') || /\btp2\b/.test(label)) {
      levels.tp2 = price;
    }
  }

  return levels;
}

/**
 * Builds compact multi-turn conversation history for Gemini so it remembers
 * previous signals (SL/TP1/TP2, direction, and reversals) without re-sending old image blobs.
 */
export function buildConversationHistory(
  history: HistoryTurnPayload[],
  maxTurns = 8
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const recent = history.slice(-maxTurns);
  const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  recent.forEach((item, idx) => {
    const tfSummary =
      item.timeframes && item.timeframes.length > 0
        ? item.timeframes.join(', ')
        : 'Auto-detected';
    const notePart = item.note?.trim() ? ` | Trader note: ${item.note.trim()}` : '';
    turns.push({
      role: 'user',
      parts: [
        {
          text: `[Previous Chart Upload #${idx + 1} at ${item.timestamp}] Timeframes: ${tfSummary}${notePart}. Please analyze XAU/USD Exness chart(s) for 0.01 micro-lot trade.`,
        },
      ],
    });
    turns.push({
      role: 'model',
      parts: [{ text: item.markdown }],
    });
  });

  return turns;
}

export interface FileValidationResult {
  accepted: Array<{ name: string; type: string; size: number }>;
  error: string | null;
}

/**
 * Validates incoming image files against MIME type, file size, and the max-3 chart limit.
 */
export function validateIncomingImages(
  files: Array<{ name: string; type: string; size: number }>,
  currentCount: number,
  maxCharts = MAX_CHARTS,
  maxBytes = MAX_IMAGE_BYTES
): FileValidationResult {
  if (files.length === 0) {
    return { accepted: [], error: null };
  }

  const slotsLeft = Math.max(0, maxCharts - currentCount);
  if (slotsLeft === 0) {
    return {
      accepted: [],
      error: `Maximum ${maxCharts} chart screenshots allowed per analysis. Remove one to add another.`,
    };
  }

  const accepted: Array<{ name: string; type: string; size: number }> = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) {
      errors.push(`"${file.name || 'File'}" is not an image. Only PNG, JPG, or WebP screenshots are supported.`);
      continue;
    }
    if (file.size > maxBytes) {
      errors.push(`"${file.name || 'Image'}" exceeds the 10 MB size limit.`);
      continue;
    }
    if (accepted.length >= slotsLeft) {
      errors.push(`Only ${maxCharts} charts can be analyzed at once. Extra screenshots were skipped.`);
      break;
    }
    accepted.push(file);
  }

  return {
    accepted,
    error: errors.length > 0 ? errors[0] : null,
  };
}

/**
 * Strips the data URL prefix (`data:image/png;base64,`) to obtain raw base64 bytes.
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
}

/**
 * Formats byte count into a clean human-readable string (e.g. "245 KB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
