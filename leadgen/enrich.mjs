// Stage 2: fetch each channel's metadata, pull emails out of the description,
// and score fit. Resumable: appends to data/enriched.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { channelMeta } from './lib/youtube.mjs';
import { extractEmails } from './lib/emails.mjs';
import { scoreChannel } from './lib/score.mjs';
import { limiter } from './lib/net.mjs';

const CONC = Number(process.env.CONC || 10);
const DATA = path.resolve('data');
const channelsFile = path.join(DATA, 'channels.jsonl');
const outFile = path.join(DATA, 'enriched.jsonl');

const channels = fs.readFileSync(channelsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const done = new Set();
if (fs.existsSync(outFile)) {
  for (const line of fs.readFileSync(outFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).id); } catch { /* skip */ }
  }
}
const todo = channels.filter((c) => !done.has(c.id));
console.log(`channels ${channels.length} · done ${done.size} · todo ${todo.length} · conc ${CONC}`);

const out = fs.createWriteStream(outFile, { flags: 'a' });
const limit = limiter(CONC);
let i = 0, emails = 0, errors = 0;
const t0 = Date.now();

await Promise.all(todo.map((c) => limit(async () => {
  const meta = await channelMeta(c.id);
  i++;
  const description = meta.description || '';
  const found = extractEmails(`${description}\n${meta.title || ''}`);
  if (meta.error) errors++;
  if (found.length) emails++;
  const { fitScore, matched, negatives } = scoreChannel({
    segment: c.segment, title: meta.title, description, hasEmail: found.length > 0, recencyDays: meta.recencyDays,
  });
  out.write(JSON.stringify({
    id: c.id,
    handle: meta.handle || null,
    title: meta.title || null,
    description: description.slice(0, 1200),
    emails: found,
    links: meta.links || [],
    recencyDays: meta.recencyDays ?? null,
    medianViews: meta.medianViews ?? null,
    segment: c.segment,
    segmentLabel: c.label,
    query: c.query,
    subsText: c.subsText || null,
    fitScore, matched, negatives,
    error: meta.error || null,
    fetchedAt: new Date().toISOString(),
  }) + '\n');
  if (i % 200 === 0) {
    const per = (Date.now() - t0) / 1000 / i;
    const eta = Math.round((todo.length - i) * per / 60);
    console.log(`${i}/${todo.length} · withEmail ${emails} (${(emails / i * 100).toFixed(1)}%) · ${(1 / per).toFixed(1)}/s · ETA ${eta}m`);
  }
})));

out.end();
console.log(`\nDONE enrich: ${i} processed, ${emails} with email (${(emails / i * 100).toFixed(1)}%), ${errors} errors`);
