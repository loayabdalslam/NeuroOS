// Small dependency-free HTTP layer: concurrency limit, retries, per-host pacing.
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export const UA = { desktop: DESKTOP, mobile: MOBILE };

export function limiter(max) {
  let active = 0;
  const queue = [];
  const pump = () => {
    if (active >= max || queue.length === 0) return;
    const job = queue.shift();
    active++;
    job.fn().then(job.resolve, job.reject).finally(() => { active--; pump(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); pump(); });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Per-host minimum interval so a burst never looks like an attack.
const lastHit = new Map();
function hostKey(url) { try { return new URL(url).host; } catch { return 'invalid'; } }
async function pace(url, minGapMs) {
  if (!minGapMs) return;
  const key = hostKey(url);
  const now = Date.now();
  const prev = lastHit.get(key) || 0;
  const wait = prev + minGapMs - now;
  lastHit.set(key, now + Math.max(0, wait));
  if (wait > 0) await sleep(wait + Math.random() * 40);
}

export async function fetchText(url, opts = {}) {
  const {
    headers = {}, method = 'GET', body, timeoutMs = 30000,
    retries = 3, minGapMs = 120, maxBytes = 0, allowStatuses = [],
  } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      await pace(url, minGapMs);
      const res = await fetch(url, {
        method,
        headers: { 'user-agent': DESKTOP, 'accept-language': 'en-US,en;q=0.9', ...headers },
        body, signal: ac.signal, redirect: 'follow',
      });
      if (res.status === 429) {
        const ra = Number(res.headers.get('retry-after') || 0);
        throw Object.assign(new Error('HTTP 429'), { retry: true, status: 429, after: ra * 1000 });
      }
      if (res.status >= 500 || res.status === 403) {
        throw Object.assign(new Error('HTTP ' + res.status), { retry: true, status: res.status });
      }
      let text = await res.text();
      if (maxBytes && text.length > maxBytes) text = text.slice(0, maxBytes);
      if (!res.ok && !allowStatuses.includes(res.status)) {
        return { status: res.status, text, ok: false, headers: res.headers };
      }
      return { status: res.status, text, ok: res.ok, headers: res.headers };
    } catch (err) {
      lastErr = err;
      const retryable = err.retry || err.name === 'AbortError' || /fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(err.message || '');
      if (attempt === retries || !retryable) break;
      const backoff = err.after || Math.min(30000, 700 * 2 ** attempt + Math.random() * 500);
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchTextSoft(url, opts) {
  try { return await fetchText(url, opts); } catch (e) { return { status: 0, text: '', ok: false, error: e.message }; }
}
