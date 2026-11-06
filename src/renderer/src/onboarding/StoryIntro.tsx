import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { useT } from '../lib/i18n';
import { useAppStore } from '../state/store';
import { LOUAY_ART } from './louayArt';

const QUOTE_AR = [
  'Ù‡Ø°Ø§ Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ ØªÙ… Ø§Ù„Ø¹Ù…Ù„ Ø¹Ù„ÙŠÙ‡ ÙÙŠ Ø§Ù„Ø®Ø§Ù…Ø³ Ù…Ù† Ù†ÙˆÙÙ…Ø¨Ø± .. ØªØ°ÙƒØ± Ø¯Ø§Ø¦Ù…Ø§Ù‹ Ø§Ù„Ø®Ø§Ù…Ø³ Ù…Ù† Ù†ÙˆÙÙ…Ø¨Ø±ØŒ Ù‡Ø°Ø§ Ø§Ù„ÙŠÙˆÙ… Ø§Ù„Ø°ÙŠ Ø§Ø³ØªÙŠÙ‚Ø¸Øª ÙÙŠÙ‡ Ø¥Ù„Ù‰ Ø§Ù„Ø¹Ø§Ù„Ù… ÙˆÙ‚Ø±Ø±Øª Ø£Ù† Ø£Ù†ÙÙ‘Ø° Ø£ÙƒØ¨Ø± Ù…Ø´Ø±ÙˆØ¹ ÙÙŠ Ø¹Ø§Ù„Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§: Ù†Ø¸Ø§Ù… ØªØ´ØºÙŠÙ„ Neuro OS.',
  'ØªØ°ÙƒÙ‘Ø± Ø§Ø³Ù…ÙŠ Ø¬ÙŠØ¯Ø§Ù‹ØŒ Ø£Ù†Ø§ Ù„Ø¤ÙŠ Ø¹Ø¨Ø¯ Ø§Ù„Ø³Ù„Ø§Ù… .. ÙŠÙ…ÙƒÙ†Ùƒ Ù…Ù†Ø§Ø¯Ø§ØªÙŠ Ø§Ø¨Ù† Ø¹Ø¨Ø¯ Ø§Ù„Ø³Ù„Ø§Ù…ØŒ Ù„ÙŠØ±Ù‚Ø¯ Ø¨Ø³Ù„Ø§Ù… Ø£ÙŠÙ†Ù…Ø§ ÙƒØ§Ù†ØŒ Ù„ÙŠØ±Ù‰ Ø§Ø¨Ù†Ù‡ ÙÙŠ Ø£Ø¹Ø§Ù„ÙŠ Ø§Ù„Ù†Ø¬ÙˆÙ….',
].join('\n\n');

const QUOTE_EN = [
  'This project was built on the fifth of November. Always remember the fifth of November — the day I woke up to the world and decided to build the biggest project in technology: an operating system called Neuro OS.',
  'Remember my name well: I am Louay Abdel Salam. You may call me the son of Abdel Salam — may he rest in peace wherever he is, watching his son rise among the stars.',
].join('\n\n');

const PLATE = '#f2f3f5';

const ART_COLORS = (() => {
  const binary = atob(LOUAY_ART.colors);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
})();

function colorAt(cell: number): string {
  const value = (ART_COLORS[cell * 2] << 8) | ART_COLORS[cell * 2 + 1];
  const r = ((value >> 8) & 0xf) * 17;
  const g = ((value >> 4) & 0xf) * 17;
  const b = (value & 0xf) * 17;
  return `rgb(${r},${g},${b})`;
}

export function StoryIntro({ onDone, replay = false }: { onDone: () => void; replay?: boolean }): JSX.Element {
  const t = useT();
  const locale = useAppStore((s) => s.settings?.locale ?? 'en');
  const arabic = locale.startsWith('ar');
  const text = arabic ? QUOTE_AR : QUOTE_EN;
  const textRef = useRef(text);
  const names = arabic ? ['Ù„Ø¤ÙŠ Ø¹Ø¨Ø¯ Ø§Ù„Ø³Ù„Ø§Ù…', t('story.son')] : ['Louay Abdel Salam', t('story.son')];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState(0);

  // One single streaming pass, driven by elapsed time so background throttling
  // can never restart it or stretch it into a second run.
  useEffect(() => {
    const body = textRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setTyped(body);
      setPhase(3);
      return;
    }
    setPhase(1);
    const started = performance.now() + 900;
    const timer = setInterval(() => {
      const elapsed = Math.max(0, performance.now() - started);
      const index = Math.min(body.length, Math.floor(elapsed / 18));
      setTyped(body.slice(0, index));
      if (index >= body.length) {
        clearInterval(timer);
        setPhase(3);
      }
    }, 30);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const draw = (): void => {
      const width = canvas.clientWidth || 620;
      const height = canvas.clientHeight || 560;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const padding = Math.max(10, Math.min(22, width * 0.035));
      const availableW = width - padding * 2;
      const availableH = height - padding * 3.1;
      const cellW = Math.min(availableW / LOUAY_ART.cols, availableH / (LOUAY_ART.rows * 1.62));
      const cellH = cellW * 1.62;
      const artW = cellW * LOUAY_ART.cols;
      const artH = cellH * LOUAY_ART.rows;
      const offsetX = (width - artW) / 2;
      const offsetY = (height - artH) / 2;

      // portrait plate
      context.save();
      context.fillStyle = PLATE;
      context.shadowColor = 'rgba(0, 0, 0, 0.45)';
      context.shadowBlur = 34;
      context.shadowOffsetY = 12;
      context.beginPath();
      const radius = 10;
      const px = offsetX - padding * 0.55;
      const py = offsetY - padding * 0.55;
      const pw = artW + padding * 1.1;
      const ph = artH + padding * 1.1;
      context.moveTo(px + radius, py);
      context.arcTo(px + pw, py, px + pw, py + ph, radius);
      context.arcTo(px + pw, py + ph, px, py + ph, radius);
      context.arcTo(px, py + ph, px, py, radius);
      context.arcTo(px, py, px + pw, py, radius);
      context.closePath();
      context.fill();
      context.restore();

      context.font = `${cellH.toFixed(2)}px "Cascadia Mono", "Consolas", "Courier New", monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      let cell = 0;
      for (let row = 0; row < LOUAY_ART.rows; row += 1) {
        const line = LOUAY_ART.chars[row] ?? '';
        for (let col = 0; col < LOUAY_ART.cols; col += 1) {
          const char = line[col] ?? ' ';
          if (char !== ' ') {
            context.fillStyle = colorAt(cell);
            context.fillText(char, offsetX + col * cellW + cellW / 2, offsetY + row * cellH + cellH / 2);
          }
          cell += 1;
        }
      }

      // thin frame line
      context.strokeStyle = 'rgba(20, 20, 24, 0.25)';
      context.lineWidth = 1;
      context.strokeRect(offsetX - padding * 0.55 + 0.5, offsetY - padding * 0.55 + 0.5, artW + padding * 1.1, artH + padding * 1.1);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="story" dir={arabic ? 'rtl' : 'ltr'}>
      <div className="story__grain" aria-hidden />
      <div className="story__vignette" aria-hidden />
      <div className="story__bar story__bar--top" aria-hidden />
      <div className="story__bar story__bar--bottom" aria-hidden />

      <div className="story__stage">
        <section className="story__portraitWrap">
          <svg className="story__orbits" viewBox="0 0 600 600" aria-hidden>
            <circle cx="300" cy="300" r="250" className="story__orbit story__orbit--1" />
            <circle cx="300" cy="300" r="204" className="story__orbit story__orbit--2" />
            <ellipse cx="300" cy="300" rx="292" ry="116" className="story__orbit story__orbit--3" />
            <circle cx="550" cy="300" r="3.2" className="story__star" />
            <circle cx="50" cy="300" r="2.4" className="story__star" />
            <circle cx="300" cy="96" r="2.6" className="story__star" />
          </svg>
          <canvas ref={canvasRef} className="story__portrait" />
          <div className="story__scan" aria-hidden />
          <div className="story__date" data-visible={phase >= 1}>
            <span className="story__dateValue">05.11</span>
            <span className="story__dateLabel">{t('story.date')}</span>
          </div>
        </section>

        <section className="story__copy">
          <div className="story__eyebrow">
            <BrandMark size={18} animated />
            <span>{t('story.eyebrow')}</span>
          </div>
          <h1 className="story__title" data-visible={phase >= 1}>
            {t('story.title')}
          </h1>
          <p className="story__quote">
            {typed || '\u00A0'}
            <span className="story__caret" data-hidden={phase >= 3} />
          </p>
          <div className="story__name" data-visible={phase >= 3}>
            <span className="story__nameMain">{names[0]}</span>
            <span className="story__nameSub">{names[1]}</span>
          </div>
          <div className="story__actions" data-visible={phase >= 3}>
            <button type="button" className="n-btn n-btn--primary story__start" onClick={onDone}>
              {t('story.start')}
            </button>
            <button type="button" className="story__skip" onClick={onDone}>
              {t('story.skip')}
            </button>
          </div>
          <div className="story__hint tiny" data-visible={phase < 3}>
            {replay ? t('story.replay') : t('story.hint')}
          </div>
        </section>
      </div>

      <button type="button" className="story__skipCorner" onClick={onDone} aria-label="Skip story">
        {t('story.skip')}
      </button>
    </div>
  );
}

