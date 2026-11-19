import { extractBase64FromDataUrl } from './signalParser';
import type { StagedImage } from './signalParser';

/**
 * Renders a crisp, realistic Exness-style XAU/USD 5m chart PNG with candlestick price action,
 * horizontal Support/Resistance lines (blue/yellow/Week), and a Multi-TF Table v9 overlay.
 * Allows instant testing of the full staging + Gemini analysis pipeline without hunting for a file.
 */
export function createSampleXauChart(): StagedImage {
  const width = 1120;
  const height = 640;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Chart background (Exness dark theme)
  ctx.fillStyle = '#131722';
  ctx.fillRect(0, 0, width, height);

  // Subtle price grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let y = 70; y < height - 50; y += 64) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(width - 96, y);
    ctx.stroke();
  }
  for (let x = 90; x < width - 96; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 48);
    ctx.lineTo(x, height - 48);
    ctx.stroke();
  }

  // Header ticker overlay
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('XAUUSDm · 5m · Exness (Gold Spot / US Dollar)', 28, 34);
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('O 2648.40  H 2655.90  L 2647.10  C 2654.60 (+0.24%)', 460, 34);

  // Price mapping: 2636.00 (bottom) -> 2668.00 (top)
  const minPrice = 2636;
  const maxPrice = 2668;
  const chartTop = 58;
  const chartBottom = height - 58;
  const priceToY = (price: number) =>
    chartBottom - ((price - minPrice) / (maxPrice - minPrice)) * (chartBottom - chartTop);

  // Right price axis labels
  ctx.fillStyle = '#8B95A7';
  ctx.font = '12px monospace';
  for (let p = 2640; p <= 2664; p += 4) {
    const y = priceToY(p);
    ctx.fillText(`${p}.00`, width - 84, y + 4);
  }

  // Horizontal Support / Resistance lines (Week High / Yellow Resistance / Blue Support)
  const levels = [
    { price: 2664.0, color: '#F59E0B', label: 'Week Resistance 2664.00', dash: [6, 4] },
    { price: 2656.5, color: '#EAB308', label: 'Intraday Resistance 2656.50', dash: [] },
    { price: 2646.0, color: '#3B82F6', label: 'Key Blue Support 2646.00', dash: [] },
  ];

  levels.forEach((lvl) => {
    const y = priceToY(lvl.price);
    ctx.save();
    ctx.strokeStyle = lvl.color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(lvl.dash);
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(width - 96, y);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = lvl.color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(lvl.label, 32, y - 6);
  });

  // Synthetic realistic bullish pullback-and-breakout candles
  const candles: Array<[number, number, number, number]> = [
    [2647.5, 2649.0, 2645.8, 2646.8],
    [2646.8, 2648.2, 2645.2, 2646.2],
    [2646.2, 2647.4, 2644.1, 2646.9], // rejection wick at blue support
    [2646.9, 2650.2, 2646.4, 2649.6],
    [2649.6, 2651.5, 2648.5, 2650.8],
    [2650.8, 2652.1, 2649.4, 2650.1],
    [2650.1, 2651.0, 2647.6, 2648.3],
    [2648.3, 2649.5, 2645.9, 2649.1], // second support bounce
    [2649.1, 2652.8, 2648.8, 2652.2],
    [2652.2, 2654.4, 2651.6, 2653.8],
    [2653.8, 2655.6, 2652.5, 2653.1],
    [2653.1, 2654.0, 2650.8, 2651.4],
    [2651.4, 2653.2, 2650.9, 2652.9],
    [2652.9, 2655.4, 2652.4, 2654.8],
    [2654.8, 2656.2, 2653.9, 2654.1],
    [2654.1, 2655.8, 2653.0, 2655.4],
    [2655.4, 2657.8, 2654.9, 2657.1], // breakout push
    [2657.1, 2658.2, 2655.8, 2656.3], // retest
    [2656.3, 2659.4, 2655.9, 2658.9], // continuation bullish close
  ];

  const startX = 76;
  const candleGap = 36;
  const bodyWidth = 18;

  candles.forEach(([open, high, low, close], i) => {
    const x = startX + i * candleGap;
    const bullish = close >= open;
    const color = bullish ? '#10B981' : '#EF4444';

    const yHigh = priceToY(high);
    const yLow = priceToY(low);
    const yOpen = priceToY(open);
    const yClose = priceToY(close);

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();

    // Body
    ctx.fillStyle = color;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));
    ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
  });

  // Current live price tag on right axis
  const currentY = priceToY(2658.9);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(width - 92, currentY - 11, 82, 22);
  ctx.fillStyle = '#07130E';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('2658.90', width - 85, currentY + 4);

  // Multi-TF Table v9 overlay (top-right inside chart)
  const tableX = width - 315;
  const tableY = 64;
  const tableW = 205;
  const tableH = 196;

  ctx.fillStyle = 'rgba(15, 20, 30, 0.92)';
  ctx.fillRect(tableX, tableY, tableW, tableH);
  ctx.strokeStyle = 'rgba(212, 168, 67, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(tableX, tableY, tableW, tableH);

  ctx.fillStyle = '#E5BE5C';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('Multi-TF Table v9', tableX + 12, tableY + 22);

  const tfRows = [
    ['1D', 'BULL', 'RSI 61'],
    ['4H', 'BULL', 'RSI 59'],
    ['1H', 'BULL', 'RSI 63'],
    ['15m', 'BULL', 'RSI 64'],
    ['5m', 'BULL', 'RSI 66'],
    ['1m', 'BULL', 'RSI 58'],
  ];

  tfRows.forEach(([tf, bias, rsi], idx) => {
    const rowY = tableY + 48 + idx * 24;
    ctx.fillStyle = '#CBD5E1';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(tf, tableX + 12, rowY);

    ctx.fillStyle = '#10B981';
    ctx.fillText(bias, tableX + 68, rowY);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px monospace';
    ctx.fillText(rsi, tableX + 132, rowY);
  });

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = extractBase64FromDataUrl(dataUrl);

  return {
    id: `sample-${Date.now()}`,
    name: 'Exness_XAUUSD_5m_Sample.png',
    mimeType: 'image/png',
    dataUrl,
    base64,
    sizeBytes: Math.round((base64.length * 3) / 4),
    timeframe: '5m',
  };
}
