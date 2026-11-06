// Stage 1: enumerate candidate channels from niche search queries.
import fs from 'node:fs';
import path from 'node:path';
import { allQueries } from './lib/segments.mjs';
import { searchPage } from './lib/youtube.mjs';
import { limiter } from './lib/net.mjs';

const PAGES = Number(process.env.PAGES || 3);        // 1 search + (PAGES-1) continuations
const QUERY_CONCURRENCY = Number(process.env.QC || 4);
const DATA = path.resolve('data');
fs.mkdirSync(DATA, { recursive: true });

const channelsFile = path.join(DATA, 'channels.jsonl');
const seen = new Set();
const subs = new Map();
if (fs.existsSync(channelsFile)) {
  for (const line of fs.readFileSync(channelsFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); seen.add(o.id); if (o.subsText) subs.set(o.id, o.subsText); } catch { /* skip */ }
  }
}
console.log(`resume: ${seen.size} channels already known`);

const out = fs.createWriteStream(channelsFile, { flags: 'a' });
const limit = limiter(QUERY_CONCURRENCY);
const queries = allQueries();
console.log(`queries: ${queries.length}, pages each: ${PAGES}`);

let added = 0, done = 0, errors = 0;
const startedAt = Date.now();

function write(rec) {
  if (seen.has(rec.id)) return false;
  seen.add(rec.id);
  out.write(JSON.stringify(rec) + '\n');
  added++;
  return true;
}

await Promise.all(queries.map(({ q, segment, weight, label }) => limit(async () => {
  let continuation = null;
  for (let page = 0; page < PAGES; page++) {
    try {
      const res = await searchPage(q, continuation);
      for (const id of res.ids) {
        write({ id, segment, weight, label, query: q, foundAt: new Date().toISOString(), subsText: res.subs.get(id) || null });
      }
      continuation = res.continuation;
      if (!continuation) break;
    } catch (e) {
      errors++;
      if (errors <= 10) console.warn(`  ! ${q} p${page}: ${e.message}`);
      break;
    }
  }
  done++;
  if (done % 25 === 0) {
    const rate = done / ((Date.now() - startedAt) / 1000);
    console.log(`${done}/${queries.length} queries · +${added} channels · ${rate.toFixed(1)} q/s · ${seen.size} total`);
  }
})));

out.end();
console.log(`\nDONE harvest: ${added} new channels, ${seen.size} total, ${errors} query errors`);
