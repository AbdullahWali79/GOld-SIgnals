import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  buildConversationHistory,
  detectSignalType,
  extractPriceLevels,
  MAX_CHARTS,
  XAU_SYSTEM_INSTRUCTION,
} from './src/lib/signalParser.ts';
import type { ChartTimeframe, HistoryTurnPayload } from './src/lib/signalParser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

interface AnalyzeImageInput {
  mimeType: string;
  data: string;
  timeframe?: ChartTimeframe;
}

interface AnalyzeRequestBody {
  images?: AnalyzeImageInput[];
  history?: HistoryTurnPayload[];
  note?: string;
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add a valid Gemini API key in the Settings > Secrets panel.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function callModel(
  ai: GoogleGenAI,
  model: string,
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  }>
): Promise<string> {
  const config =
    model === PRIMARY_MODEL
      ? {
          systemInstruction: XAU_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        }
      : {
          systemInstruction: XAU_SYSTEM_INSTRUCTION,
        };

  const response = await ai.models.generateContent({
    model,
    contents,
    config,
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error(
      'Gemini returned an empty signal response. Please try again with a clearer chart screenshot.'
    );
  }
  return text;
}

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  }>
): Promise<{ text: string; modelUsed: string }> {
  const attempts = [
    { model: PRIMARY_MODEL, delayBeforeMs: 0 },
    { model: PRIMARY_MODEL, delayBeforeMs: 700 },
    { model: FALLBACK_MODEL, delayBeforeMs: 0 },
  ];

  let lastError: unknown;

  for (const step of attempts) {
    if (step.delayBeforeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, step.delayBeforeMs));
    }

    try {
      const text = await callModel(ai, step.model, contents);
      return { text, modelUsed: step.model };
    } catch (error) {
      lastError = error;
      const errMessage = error instanceof Error ? error.message : String(error);
      const isTransient =
        errMessage.includes('503') ||
        errMessage.includes('500') ||
        errMessage.includes('UNAVAILABLE') ||
        errMessage.includes('fetch failed');

      if (!isTransient) {
        break;
      }
    }
  }

  throw lastError;
}

function extractReadableError(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
      const inner = parsed.error?.message || parsed.message;
      if (inner) return inner;
    } catch {
      // Not valid JSON
    }
  }
  return trimmed;
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = extractReadableError(error instanceof Error ? error.message : String(error));
  const upper = raw.toUpperCase();

  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: raw };
  }
  if (upper.includes('API_KEY_INVALID') || upper.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'Gemini API key is invalid or unauthorized. Please verify your key in Settings > Secrets.',
    };
  }
  if (upper.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit reached on Gemini API. Wait a few seconds and try generating the signal again.',
    };
  }
  if (upper.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      message: 'Requested Gemini model was not found or is unavailable for this API key.',
    };
  }
  if (upper.includes('UNAVAILABLE') || raw.includes('503') || upper.includes('HIGH DEMAND')) {
    return {
      status: 503,
      message: 'Gemini is temporarily busy due to high demand. Please click Generate Signal again in a moment.',
    };
  }

  return {
    status: 502,
    message: raw || 'Failed to analyze chart screenshot with Gemini.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '30mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: PRIMARY_MODEL, fallbackModel: FALLBACK_MODEL });
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const body = (req.body ?? {}) as AnalyzeRequestBody;
      const images = Array.isArray(body.images) ? body.images : [];
      const history = Array.isArray(body.history) ? body.history : [];
      const note = typeof body.note === 'string' ? body.note.trim() : '';

      if (images.length === 0) {
        res.status(400).json({ error: 'Please paste or upload at least 1 XAU/USD chart screenshot.' });
        return;
      }

      if (images.length > MAX_CHARTS) {
        res.status(400).json({ error: `Maximum ${MAX_CHARTS} chart screenshots can be analyzed at once.` });
        return;
      }

      const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      const tfList: string[] = [];

      for (const img of images) {
        if (!img || typeof img.mimeType !== 'string' || !img.mimeType.startsWith('image/') || !img.data) {
          res.status(400).json({ error: 'Invalid image payload. Please upload valid PNG, JPG, or WebP screenshots.' });
          return;
        }
        imageParts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        });
        tfList.push(img.timeframe && img.timeframe !== 'Auto' ? img.timeframe : 'Auto-detect');
      }

      const ai = createGeminiClient();
      const priorTurns = buildConversationHistory(history);

      const promptLines = [
        `User uploaded ${images.length} Exness XAU/USD chart screenshot${images.length > 1 ? 's' : ''} (Timeframe tags: ${tfList.join(', ')}).`,
        'Account context: Exness Gold (XAU/USD), 0.01 micro-lots.',
      ];

      if (history.length > 0) {
        promptLines.push(
          'Consider the previous signal history above to note whether prior TP1/TP2/SL was hit or if market structure reversed.'
        );
      }

      if (note) {
        promptLines.push(`Additional trader note: ${note}`);
      }

      promptLines.push(
        'Provide the trading signal strictly in simple Roman Urdu following the exact required structure and SL/TP table.'
      );

      const contents = [
        ...priorTurns,
        {
          role: 'user' as const,
          parts: [...imageParts, { text: promptLines.join('\n') }],
        },
      ];

      const { text: markdown } = await generateWithRetry(ai, contents);
      const signalType = detectSignalType(markdown);
      const levels = extractPriceLevels(markdown);

      res.json({
        markdown,
        signalType,
        levels,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`XAU/USD Easy Signal Pro listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
