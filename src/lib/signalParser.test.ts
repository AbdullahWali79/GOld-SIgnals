import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConversationHistory,
  detectSignalType,
  extractBase64FromDataUrl,
  extractPriceLevels,
  formatFileSize,
  validateIncomingImages,
} from './signalParser';

test('detectSignalType accurately identifies BUY, SELL, and WAIT signals', () => {
  assert.equal(
    detectSignalType('### 🟢 Signal: **BUY** (Gold / XAUUSD)\n* **Kya karna hai?** Upar ki trade'),
    'BUY'
  );
  assert.equal(
    detectSignalType('### 🔴 Signal: **SELL** (Gold / XAUUSD)\n* **Kya karna hai?** Neeche ki trade'),
    'SELL'
  );
  assert.equal(
    detectSignalType('### 🟡 Signal: **WAIT** (Gold / XAUUSD)\n* **Kya karna hai?** Abhi intezar'),
    'WAIT'
  );
  assert.equal(detectSignalType('### Signal: buy (XAUUSD)'), 'BUY');
  assert.equal(detectSignalType(''), 'WAIT');
});

test('extractPriceLevels parses Stop Loss, TP1, and TP2 from Markdown SL/TP table', () => {
  const sampleMarkdown = `
### 🟢 Signal: **BUY** (Gold / XAUUSD)

#### 🎯 Targets & Risk (SL / TP)
| Level | Price | Matlab |
| :--- | :--- | :--- |
| **Stop Loss (SL)** | **$2,642.50** | Yahan pohanchay to loss mein trade band kar dein |
| **Take Profit 1 (TP1)** | **$2,658.00** | Pehla profit target |
| **Take Profit 2 (TP2)** | **$2,666.50** | Doosra bada target |
`;

  const levels = extractPriceLevels(sampleMarkdown);
  assert.deepEqual(levels, {
    stopLoss: '$2,642.50',
    tp1: '$2,658.00',
    tp2: '$2,666.50',
  });
});

test('buildConversationHistory creates alternating user/model turns and caps length', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({
    timestamp: `10:0${i} AM`,
    signalType: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
    markdown: `### Signal #${i + 1}`,
    timeframes: ['5m', '15m'] as Array<'5m' | '15m'>,
    note: i === 9 ? 'TP1 hit' : undefined,
  }));

  const turns = buildConversationHistory(history, 4);
  assert.equal(turns.length, 8); // 4 pairs = 8 messages
  assert.equal(turns[0].role, 'user');
  assert.equal(turns[1].role, 'model');
  assert.match(turns[6].parts[0].text, /Trader note: TP1 hit/);
  assert.equal(turns[7].parts[0].text, '### Signal #10');
});

test('validateIncomingImages enforces max 3 charts, image mime types, and size limit', () => {
  const validFiles = [
    { name: '5m.png', type: 'image/png', size: 120_000 },
    { name: '15m.jpg', type: 'image/jpeg', size: 220_000 },
  ];
  const res1 = validateIncomingImages(validFiles, 0);
  assert.equal(res1.accepted.length, 2);
  assert.equal(res1.error, null);

  // Exceeding 3-chart cap when 2 already staged
  const res2 = validateIncomingImages(validFiles, 2);
  assert.equal(res2.accepted.length, 1);
  assert.match(res2.error ?? '', /Only 3 charts/);

  // Already at max 3
  const res3 = validateIncomingImages(validFiles, 3);
  assert.equal(res3.accepted.length, 0);
  assert.match(res3.error ?? '', /Maximum 3 chart screenshots/);

  // Non-image rejected
  const res4 = validateIncomingImages(
    [{ name: 'notes.pdf', type: 'application/pdf', size: 1000 }],
    0
  );
  assert.equal(res4.accepted.length, 0);
  assert.match(res4.error ?? '', /not an image/);
});

test('extractBase64FromDataUrl and formatFileSize handle inputs cleanly', () => {
  assert.equal(extractBase64FromDataUrl('data:image/png;base64,ABC123=='), 'ABC123==');
  assert.equal(extractBase64FromDataUrl('RAWBASE64'), 'RAWBASE64');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(250 * 1024), '250 KB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
});
