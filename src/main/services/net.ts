import { truncate } from '../core/util';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 NeuroOS/1.0';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim();
}

/** DuckDuckGo HTML endpoint — no API key, no tracking. */
export async function webSearch(query: string, limit = 8): Promise<SearchResult[]> {
  const response = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': USER_AGENT,
      accept: 'text/html',
    },
    body: new URLSearchParams({ q: query, kl: 'wt-wt' }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Search failed (HTTP ${response.status})`);
  const html = await response.text();
  const results: SearchResult[] = [];
  const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRegex.exec(html))) snippets.push(stripTags(sm[1]));
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = linkRegex.exec(html)) && results.length < limit) {
    let url = decodeEntities(match[1]);
    const redirect = /uddg=([^&]+)/.exec(url);
    if (redirect) url = decodeURIComponent(redirect[1]);
    if (!/^https?:\/\//.test(url)) continue;
    results.push({ title: stripTags(match[2]), url, snippet: snippets[index] ?? '' });
    index += 1;
  }
  return results;
}

export interface ReadablePage {
  url: string;
  title: string;
  text: string;
  contentType: string;
  status: number;
}

/** Fetch a URL and reduce it to readable text (keeps structure hints). */
export async function readPage(url: string, maxChars = 18_000): Promise<ReadablePage> {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  if (!/html|xml/i.test(contentType)) {
    return { url, title: url, text: truncate(raw, maxChars), contentType, status: response.status };
  }
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? url);
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(raw)?.[1] ?? raw;
  const text = stripTags(
    body
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' '),
  );
  const condensed = text.replace(/(\s*\n\s*)+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
  return { url, title, text: truncate(condensed, maxChars), contentType, status: response.status };
}

export async function httpFetch(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxChars?: number;
}): Promise<{ status: number; headers: Record<string, string>; body: string; contentType: string }> {
  const response = await fetch(input.url, {
    method: input.method ?? 'GET',
    headers: { 'user-agent': USER_AGENT, ...(input.headers ?? {}) },
    body: input.body,
    signal: AbortSignal.timeout(30_000),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const raw = await response.text();
  let body = raw;
  if (/html/i.test(contentType)) body = stripTags(raw);
  return { status: response.status, headers, body: truncate(body, input.maxChars ?? 24_000), contentType };
}
