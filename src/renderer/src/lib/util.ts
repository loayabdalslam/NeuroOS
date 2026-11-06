let counter = 0;

export function newId(prefix = ''): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix ? `${prefix}_` : ''}${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function ensureHttp(input: string): string {
  const url = input.trim();
  if (!url) return '';
  if (/^[a-z]+:\/\//i.test(url)) return url;
  if (/^[\w-]+(\.[\w-]+)+/.test(url)) return `https://${url}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
}

export function isUrlLike(input: string): boolean {
  return /^[a-z]+:\/\//i.test(input) || /^[\w-]+(\.[\w-]+)+[^\s]*$/.test(input);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
}
