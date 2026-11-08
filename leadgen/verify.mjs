// Stage 4: merge, choose the best address per channel, verify the domain can
// actually receive mail (MX / A record), and emit the final lead set.
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import { classifyEmail, domainHasMail } from './lib/emails.mjs';
import { tierOf } from './lib/score.mjs';
import { limiter } from './lib/net.mjs';

const DATA = path.resolve('data');
const read = (f) => fs.existsSync(path.join(DATA, f))
  ? fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : [];

const enriched = read('enriched.jsonl');
const siteMap = new Map(read('sites.jsonl').map((s) => [s.id, s]));
const rssMap = new Map(read('rss.jsonl').map((s) => [s.id, s]));

// Preference: own-domain address over free mailbox, non-role over role, non-disposable.
function rankEmail(e) {
  const c = classifyEmail(e);
  let s = 0;
  if (!c.disposable) s += 20; else s -= 50;
  if (c.freeProvider) s += 4; else s += 8;
  if (!c.role) s += 6;
  if (/^(business|biz|contact|info|hello|collab|partnerships?|sponsorships?|press|media|inquiries)/.test(e.split('@')[0])) s += 10;
  return s;
}

const leads = [];
const seenChannel = new Set();
for (const c of enriched) {
  if (!c.id || seenChannel.has(c.id)) continue;
  seenChannel.add(c.id);
  const site = siteMap.get(c.id);
  const rss = rssMap.get(c.id);
  const fromDescription = c.emails || [];
  const pool = [...new Set([...fromDescription, ...((rss && rss.emails) || []), ...((site && site.emails) || [])])].filter(Boolean);
  if (!pool.length) continue;
  pool.sort((a, b) => rankEmail(b) - rankEmail(a));
  const primary = pool[0];
  const cls = classifyEmail(primary);
  const score = Math.max(0, Math.min(100, (c.fitScore || 0) + (cls.disposable ? -40 : 0)));
  const source = fromDescription.includes(primary)
    ? 'channel description'
    : ((rss && (rss.emails || []).includes(primary)) ? 'video description' : 'linked website');
  leads.push({
    channelId: c.id,
    channel: c.title || '(unknown)',
    handle: c.handle || '',
    url: c.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${c.id}`,
    email: primary,
    altEmails: pool.slice(1).join('; '),
    emailKind: cls.kind,
    freeProvider: cls.freeProvider ? 'yes' : 'no',
    source,
    segment: c.segment,
    segmentLabel: c.segmentLabel,
    subsText: c.subsText || '',
    medianViews: c.medianViews ?? null,
    recencyDays: c.recencyDays ?? null,
    fitScore: score,
    tier: tierOf(score, true),
    matched: (c.matched || []).join(', '),
    description: (c.description || '').replace(/\s+/g, ' ').slice(0, 280),
  });
}

console.log(`leads with an address: ${leads.length} · unique domains: ${new Set(leads.map((l) => l.email.split('@')[1])).size}`);

const limit = limiter(12);
const domainResults = new Map();
const domains = [...new Set(leads.map((l) => l.email.split('@')[1]))];
let checked = 0;
await Promise.all(domains.map((d) => limit(async () => {
  const r = await domainHasMail(d, dns);
  domainResults.set(d, r);
  checked++;
  if (checked % 200 === 0) console.log(`  mx ${checked}/${domains.length}`);
})));

for (const l of leads) {
  const r = domainResults.get(l.email.split('@')[1]) || { ok: false, via: 'none' };
  l.domainAcceptsMail = r.ok ? 'yes' : 'no';
  l.mxVia = r.via;
  l.verified = r.ok ? 'verified-domain' : 'unverified';
}

// Tier recompute: an unverified domain cannot be a tier-A lead.
for (const l of leads) {
  if (l.domainAcceptsMail === 'no') l.tier = 'C';
  else l.tier = tierOf(l.fitScore, true);
}

leads.sort((a, b) => b.fitScore - a.fitScore || (a.channel || '').localeCompare(b.channel || ''));

// Duplicate-address detection (one address across several channels is common for networks).
const byEmail = new Map();
for (const l of leads) byEmail.set(l.email, (byEmail.get(l.email) || 0) + 1);
for (const l of leads) l.sharedEmail = (byEmail.get(l.email) || 0) > 1 ? 'yes' : '';

const stats = {
  generatedAt: new Date().toISOString(),
  channelsEnriched: enriched.length,
  channelsWithEmail: leads.length,
  verifiedDomain: leads.filter((l) => l.verified === 'verified-domain').length,
  deadDomain: leads.filter((l) => l.domainAcceptsMail === 'no').length,
  tierA: leads.filter((l) => l.tier === 'A').length,
  tierB: leads.filter((l) => l.tier === 'B').length,
  tierC: leads.filter((l) => l.tier === 'C').length,
  bySegment: Object.fromEntries(Object.entries(leads.reduce((a, l) => {
    a[l.segment] = (a[l.segment] || 0) + 1; return a;
  }, {})).sort((a, b) => b[1] - a[1])),
  byEmailKind: Object.fromEntries(Object.entries(leads.reduce((a, l) => {
    a[l.emailKind] = (a[l.emailKind] || 0) + 1; return a;
  }, {}))),
  bySource: Object.fromEntries(Object.entries(leads.reduce((a, l) => {
    a[l.source] = (a[l.source] || 0) + 1; return a;
  }, {}))),
};

fs.writeFileSync(path.join(DATA, 'leads.json'), JSON.stringify({ stats, leads }, null, 1));
fs.writeFileSync(path.join(DATA, 'stats.json'), JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));
