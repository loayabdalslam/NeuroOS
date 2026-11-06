// Email extraction, normalisation and classification. Deliberately conservative:
// a wrong email in a lead list is worse than a missing one.
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}/g;

const FILE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|css|js|mjs|json|xml|pdf|zip|mp4|mp3|webm|woff2?|ttf)$/i;
const PLACEHOLDER = /^(example|test|sample|domain|email|youremail|your\.email|name|user|someone|abc|xyz|foo|bar)$/i;
const BAD_DOMAINS = new Set([
  'example.com', 'example.org', 'domain.com', 'email.com', 'yourdomain.com', 'sentry.io',
  'wixpress.com', 'youtube.com', 'google.com', 'googlemail.co', 'schema.org', 'w3.org',
  'sentry-next.wixpress.com', 'godaddy.com', 'automattic.com', 'wordpress.com', 'squarespace.com',
]);
const NOREPLY = /^(no-?reply|donotreply|do-not-reply|notifications?|mailer-daemon|postmaster|abuse|webmaster)$/i;
const ROLE = /^(info|contact|hello|hi|team|support|help|sales|business|biz|press|media|partnerships?|sponsorships?|marketing|admin|office|inquiries|enquiries|collab|collabs|booking|bookings|promo|pr|advertise|advertising)$/i;

const DISPOSABLE = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com', 'guerrillamail.com',
  'sharklasers.com', 'yopmail.com', 'trashmail.com', 'throwawaymail.com', 'getnada.com',
  'dispostable.com', 'fakeinbox.com', 'maildrop.cc', 'mintemail.com', 'spam4.me', 'mytemp.email',
  'mohmal.com', 'emailondeck.com', 'burnermail.io', 'tempail.com', 'luxusmail.org',
]);

export function normaliseText(raw) {
  if (!raw) return '';
  let t = String(raw);
  try { t = decodeURIComponent(t); } catch { /* keep */ }
  t = t.replace(/\\u0040/g, '@').replace(/\\u002e/g, '.');
  // "name [at] domain [dot] com"
  t = t.replace(/\s*[\[\(\{]\s*(?:at|@)\s*[\]\)\}]\s*/gi, '@');
  t = t.replace(/\s*[\[\(\{]\s*(?:dot|\.)\s*[\]\)\}]\s*/gi, '.');
  t = t.replace(/([A-Za-z0-9._%+\-])\s*@\s*([A-Za-z0-9])/g, '$1@$2');
  t = t.replace(/@\s*([A-Za-z0-9-]+)\s*\.\s*([A-Za-z]{2,})/g, '@$1.$2');
  return t;
}

export function extractEmails(raw, { minLocal = 3 } = {}) {
  const text = normaliseText(raw);
  if (!text) return [];
  const out = new Set();
  for (const m of text.matchAll(EMAIL_RE)) {
    let e = m[0].toLowerCase().replace(/^[.\-]+|[.\-]+$/g, '');
    if (!e.includes('@')) continue;
    const [local, domain] = e.split('@');
    if (!local || !domain) continue;
    if (local.length < minLocal || local.length > 64) continue;
    if (FILENAME_LOCAL(local)) continue;
    if (FILE_EXT.test(domain)) continue;
    if (PLACEHOLDER.test(local)) continue;
    if (BAD_DOMAINS.has(domain)) continue;
    if (NOREPLY.test(local)) continue;
    if (!/^[a-z0-9.-]+\.[a-z]{2,24}$/.test(domain)) continue;
    if (domain.split('.').some((p) => p.length === 0)) continue;
    out.add(`${local}@${domain}`);
  }
  return [...out];
}
const FILENAME_LOCAL = (l) => /\.(png|jpe?g|gif|webp|svg|css|js|json|xml|pdf|zip|mp4|mp3)$/i.test(l);

export function classifyEmail(email) {
  const [local, domain] = email.split('@');
  const role = ROLE.test(local);
  const disposable = DISPOSABLE.has(domain);
  let kind = 'personal';
  if (role) kind = 'role';
  else if (/^(info|contact|hello|team|support|sales|press)/.test(domain)) kind = 'domain-generic';
  const free = /^(gmail|googlemail|outlook|hotmail|live|yahoo|ymail|icloud|me|aol|proton|protonmail|gmx|mail|zoho|yandex|qq|163|126)\./.test(domain + '.');
  return { kind, role, disposable, freeProvider: isFreeProvider(domain), domain };
}

const FREE = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru', 'qq.com', '163.com', '126.com', 'web.de', 'orange.fr', 'free.fr', 'laposte.net', 'seznam.cz', 'naver.com', 'daum.net']);
export const isFreeProvider = (d) => FREE.has(d);

export function dedupeEmails(list) {
  const seen = new Map();
  for (const e of list) if (!seen.has(e)) seen.set(e, e);
  return [...seen.keys()];
}

// domain -> MX validity, cached for the life of the process
const mxCache = new Map();
export async function domainHasMail(domain, dns) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  let result = { ok: false, via: 'none', records: [] };
  try {
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length) result = { ok: true, via: 'mx', records: mx.map((r) => r.exchange).slice(0, 3) };
  } catch { /* fall through */ }
  if (!result.ok) {
    try {
      const a = await dns.resolve4(domain);
      if (a && a.length) result = { ok: true, via: 'a-record', records: a.slice(0, 2) };
    } catch { /* no mail */ }
  }
  mxCache.set(domain, result);
  return result;
}
