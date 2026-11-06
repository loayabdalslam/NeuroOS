export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function relativeTime(iso: string, locale = 'en'): string {
  const date = new Date(iso).getTime();
  if (!Number.isFinite(date)) return '';
  const diff = Date.now() - date;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function clockTime(date: Date, use24h: boolean): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24h,
  });
}

export function fullDate(date: Date, locale = 'en'): string {
  return date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function basename(target: string): string {
  const parts = target.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? target;
}

export function dirname(target: string): string {
  const idx = Math.max(target.lastIndexOf('\\'), target.lastIndexOf('/'));
  return idx > 0 ? target.slice(0, idx) : target;
}

export function extname(target: string): string {
  const base = basename(target);
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx + 1).toLowerCase() : '';
}

export const LANGUAGE_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  python: '#3776ab',
  rust: '#dea584',
  go: '#00add8',
  java: '#b07219',
  json: '#a78bfa',
  markdown: '#8b949e',
  css: '#563d7c',
  scss: '#c6538c',
  html: '#e34c26',
  shell: '#89e051',
  powershell: '#5391fe',
  yaml: '#cb171e',
  sql: '#e38c00',
  text: '#8b949e',
};

export function languageColor(lang: string): string {
  return LANGUAGE_COLORS[lang] ?? '#8b949e';
}

export function fileIconKind(name: string): string {
  const ext = extname(name);
  if (['ts', 'tsx'].includes(ext)) return 'ts';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'js';
  if (ext === 'json') return 'json';
  if (['md', 'mdx'].includes(ext)) return 'md';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return 'img';
  if (['ps1', 'sh', 'bat', 'cmd'].includes(ext)) return 'shell';
  if (['py'].includes(ext)) return 'py';
  if (['css', 'scss', 'less'].includes(ext)) return 'css';
  if (['html', 'htm'].includes(ext)) return 'html';
  return 'file';
}

export function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}
