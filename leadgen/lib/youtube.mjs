// YouTube extraction without an API key: search enumeration + per-channel metadata.
import { fetchText, UA } from './net.mjs';

const KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const MOBILE_UA = UA.mobile;

const CLIENTS = [
  { name: 'MWEB', headers: { 'content-type': 'application/json', 'user-agent': MOBILE_UA },
    ctx: { client: { clientName: 'MWEB', clientVersion: '2.20240726.01.00', hl: 'en', gl: 'US' } } },
  { name: 'WEB', headers: { 'content-type': 'application/json', 'user-agent': UA.desktop },
    ctx: { client: { clientName: 'WEB', clientVersion: '2.20240726.00.00', hl: 'en', gl: 'US' } } },
];

const ID_RE = /"browseId":"(UC[\w-]{22})"/g;

export function parseSearchHtml(html) {
  const ids = [];
  for (const m of html.matchAll(ID_RE)) ids.push(m[1]);
  // Channel cards carry an accurate subscriber label; map it when we can.
  const subs = new Map();
  const blocks = html.split('"channelRenderer"').slice(1);
  for (const block of blocks) {
    const slice = block.slice(0, 4000);
    const id = slice.match(/"channelId":"(UC[\w-]{22})"/);
    const s = slice.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/) ||
              slice.match(/"subscriberCountText":\{"runs":\[\{"text":"([^"]+)"/);
    if (id && s && !subs.has(id[1])) subs.set(id[1], s[1]);
  }
  const cont = html.match(/"continuationCommand":\{"token":"([^"]+)"/);
  return { ids: [...new Set(ids)], subs, continuation: cont ? cont[1] : null };
}

export function parseSearchJson(text) {
  const ids = [];
  for (const m of text.matchAll(ID_RE)) ids.push(m[1]);
  const cont = text.match(/"continuationCommand":\{"token":"([^"]+)"/);
  return { ids: [...new Set(ids)], subs: new Map(), continuation: cont ? cont[1] : null };
}

export async function searchPage(query, continuation) {
  if (!continuation) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
    const { text } = await fetchText(url, { timeoutMs: 30000, minGapMs: 90 });
    return parseSearchHtml(text);
  }
  const body = { context: CLIENTS[1].ctx, continuation };
  const { text } = await fetchText(`https://www.youtube.com/youtubei/v1/search?key=${KEY}&prettyPrint=false`, {
    method: 'POST', headers: CLIENTS[1].headers, body: JSON.stringify(body), timeoutMs: 30000, minGapMs: 90,
  });
  return parseSearchJson(text);
}

export function parseCount(text) {
  if (!text) return null;
  const t = String(text).replace(/,/g, '').toLowerCase();
  const m = t.match(/([\d.]+)\s*([kmb])?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const mult = m[2] === 'b' ? 1e9 : m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
  return Math.round(n * mult);
}

export function parseAgoDays(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  const m = t.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mult = { second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 }[unit];
  return Math.round(n * mult * 10) / 10;
}

export function parseChannel(payload, id) {
  let j;
  try { j = JSON.parse(payload); } catch { return null; }
  const meta = j?.metadata?.channelMetadataRenderer || j?.microformat?.microformatDataRenderer || {};
  const title = meta.title || null;
  const description = meta.description || '';
  const vanity = meta.vanityChannelUrl || '';
  const handle = (vanity.match(/@[\w.\-]+/) || [null])[0];

  // Recent-upload recency: channel home only renders that channel's videos.
  const agoDays = [...payload.matchAll(/"publishedTimeText":\{[^}]*?"text":"(\d+[^"]*ago)"/g)]
    .map((m) => parseAgoDays(m[1])).filter((v) => v !== null && v >= 0);
  const recencyDays = agoDays.length ? Math.min(...agoDays) : null;

  const views = [...payload.matchAll(/"viewCountText":\{[^}]*?"text":"([\d.,]+[KMB]? views)"/g)]
    .map((m) => parseCount(m[1])).filter((v) => v !== null && v > 0);
  views.sort((a, b) => a - b);
  const medianViews = views.length ? views[Math.floor(views.length / 2)] : null;

  const links = [...new Set([...description.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)].map((m) => m[0].replace(/[.,;]$/, '')))].slice(0, 12);

  return {
    id, title, handle, description, recencyDays, medianViews,
    videoCountSeen: (payload.match(/"videoRenderer"/g) || []).length,
    links, country: meta.country || null, keywords: meta.keywords || null,
  };
}

export async function channelMeta(id) {
  let lastErr = null;
  for (const c of CLIENTS) {
    try {
      const body = { context: c.ctx, browseId: id };
      const { status, text } = await fetchText(`https://www.youtube.com/youtubei/v1/browse?key=${KEY}&prettyPrint=false`, {
        method: 'POST', headers: c.headers, body: JSON.stringify(body), timeoutMs: 30000, minGapMs: 45,
      });
      if (status !== 200) { lastErr = new Error('status ' + status); continue; }
      const parsed = parseChannel(text, id);
      if (parsed && parsed.title) return { ...parsed, client: c.name };
      lastErr = new Error('unparsed');
    } catch (e) { lastErr = e; }
  }
  return { id, error: lastErr ? lastErr.message : 'unknown' };
}

// About page (mobile web) carries the channel's external links; used only when
// the description held no email and we still want a website to enrich from.
export async function channelAboutLinks(handle) {
  if (!handle) return [];
  try {
    const { text } = await fetchText(`https://www.youtube.com/${handle}/about`, {
      headers: { 'user-agent': MOBILE_UA }, timeoutMs: 30000, minGapMs: 90,
    });
    const out = new Set();
    for (const m of text.matchAll(/"channelExternalLinkViewModel":\{"title":\{"content":"[^"]*"\},"link":\{"content":"(https?:[^"]+)"/g)) out.add(m[1]);
    for (const m of text.matchAll(/"link":\{"content":"(https?:[^"]+)"/g)) out.add(m[1]);
    return [...out].slice(0, 8);
  } catch { return []; }
}
