import { POSITIVE, NEGATIVE, SEGMENTS } from './segments.mjs';

function hits(text, list) {
  const t = (text || '').toLowerCase();
  const found = [];
  for (const [kw, w] of list) {
    if (w >= 3 ? t.includes(kw) : t.includes(kw)) found.push([kw, w]);
  }
  return found;
}

export function scoreChannel({ segment, title, description, hasEmail, recencyDays }) {
  const seg = SEGMENTS[segment] || { weight: 0.4 };
  const text = `${title || ''}\n${description || ''}`;
  const pos = hits(text, POSITIVE);
  const neg = hits(text, NEGATIVE);
  const posScore = Math.min(45, pos.reduce((a, [, w]) => a + w, 0));
  const negScore = Math.min(60, neg.reduce((a, [, w]) => a + w * 1.6, 0));
  let score = seg.weight * 40 + posScore - negScore;
  if (hasEmail) score += 12;
  if (recencyDays !== null && recencyDays !== undefined) {
    if (recencyDays <= 45) score += 10;
    else if (recencyDays <= 120) score += 6;
    else if (recencyDays <= 365) score += 2;
    else score -= 8;
  } else score -= 3;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    fitScore: score,
    matched: pos.map(([k]) => k).slice(0, 10),
    negatives: neg.map(([k]) => k).slice(0, 5),
  };
}

export function tierOf(score, hasEmail) {
  if (!hasEmail) return 'C';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  return 'C';
}
