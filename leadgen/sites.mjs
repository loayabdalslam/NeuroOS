// Stage 3: for channels with no email in their description, follow their website
// and look for a contact address (mailto links and plain text).
import fs from 'node:fs';
import path from 'node:path';
import { fetchTextSoft, limiter } from './lib/net.mjs';
import { extractEmails, isFreeProvider } from './lib/emails.mjs';
import { channelAboutLinks } from './lib/youtube.mjs';

const CONC = Number(process.env.CONC || 12);
const MIN_SCORE = Number(process.env.MIN_SCORE || 40);
const MAX_CHANNELS = Number(process.env.MAX_CHANNELS || 20000);
const DATA = path.resolve('data');

const enriched = fs.readFileSync(path.join(DATA, 'enriched.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));
const sitesFile = path.join(DATA, 'sites.jsonl');
const done = new Set();
if (fs.existsSync(sitesFile)) {
  for (const line of fs.readFileSync(sitesFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).id); } catch { /* skip */ }
  }
}

const SKIP_HOSTS = /(youtube\.com|youtu\.be|instagram\.com|twitter\.com|x\.com|tiktok\.com|facebook\.com|linkedin\.com|discord\.(gg|com)|twitch\.tv|patreon\.com|github\.com|ko-fi\.com|buymeacoffee\.com|linktr\.ee|beacons\.ai|amazon\.|amzn\.|spotify\.com|apple\.co|music\.apple|google\.com|gumroad\.com|substack\.com|medium\.com|t\.me|whatsapp\.com|paypal\.|stripe\.com|shopify\.com|threads\.net|reddit\.com|bsky\.app|mastodon)/i;

function siteRoot(link) {
  try {
    const u = new URL(link);
    if (SKIP_HOSTS.test(u.hostname)) return null;
    return { origin: u.origin, host: u.hostname.replace(/^www\./, '') };
  } catch { return null; }
}

const CANDIDATES = ['/contact', '/contact-us', '/about', '/about-us', '/support', '/press', '/collaborate', '/business'];

function pickForSite(emails, host) {
  const base = host.split('.').slice(-2).join('.');
  return emails.filter((e) => {
    const d = e.split('@')[1];
    return d === host || d.endsWith('.' + host) || d === base || d.endsWith('.' + base) || isFreeProvider(d);
  });
}

const rssEmailed = new Set();
if (fs.existsSync(path.join(DATA, 'rss.jsonl'))) {
  for (const line of fs.readFileSync(path.join(DATA, 'rss.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); if ((o.emails || []).length) rssEmailed.add(o.id); } catch { /* skip */ }
  }
}

const todo = enriched
  .filter((c) => (!c.emails || c.emails.length === 0) && !done.has(c.id) && !rssEmailed.has(c.id) && (c.fitScore || 0) >= MIN_SCORE)
  .slice(0, MAX_CHANNELS);
console.log(`enriched ${enriched.length} · no-email & score>=${MIN_SCORE}: ${todo.length} · conc ${CONC}`);

const out = fs.createWriteStream(sitesFile, { flags: 'a' });
const limit = limiter(CONC);
let i = 0, hits = 0, noLink = 0;
const t0 = Date.now();

await Promise.all(todo.map((c) => limit(async () => {
  let links = (c.links || []).map(siteRoot).filter(Boolean);
  if (!links.length && c.handle) {
    // The description rarely carries links; the About page does.
    links = (await channelAboutLinks(c.handle)).map(siteRoot).filter(Boolean);
  }
  if (!links.length) { noLink++; i++; return; }
  const target = links[0];
  let found = [];
  let source = null;

  const home = await fetchTextSoft(`https://${target.host}/`, { timeoutMs: 20000, maxBytes: 500000, retries: 1 });
  const homeEmails = pickForSite(extractEmails(home.text || ''), target.host);
  if (homeEmails.length) { found = homeEmails; source = `https://${target.host}/`; }

  if (!found.length) {
    for (const p of CANDIDATES.slice(0, 4)) {
      const url = `${target.origin}${p}`;
      const r = await fetchTextSoft(url, { timeoutMs: 15000, maxBytes: 400000, retries: 0 });
      if (!r.ok || !r.text) continue;
      const es = pickForSite(extractEmails(r.text), target.host);
      if (es.length) { found = es; source = url; break; }
    }
  }

  i++;
  if (found.length) hits++;
  out.write(JSON.stringify({
    id: c.id, site: target.host, emails: [...new Set(found)].slice(0, 4), source,
    checked: new Date().toISOString(),
  }) + '\n');
  if (i % 200 === 0) {
    const per = (Date.now() - t0) / 1000 / i;
    console.log(`${i}/${todo.length} · siteEmail ${hits} (${(hits / i * 100).toFixed(1)}%) · ${(1 / per).toFixed(1)}/s · ETA ${Math.round((todo.length - i) * per / 60)}m`);
  }
})));

out.end();
console.log(`\nDONE sites: ${i} checked, ${hits} with email, ${noLink} had no usable link`);
