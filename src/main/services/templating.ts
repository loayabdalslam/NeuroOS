/** Tiny mustache-style templating used by automations and compositions. */
export function getPath(source: unknown, path: string): unknown {
  if (!path) return source;
  let cursor: unknown = source;
  for (const segment of path.split('.')) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor !== 'object') return undefined;
    const key = segment.replace(/\[(\d+)\]/g, '.$1');
    for (const part of key.split('.')) {
      if (!part) continue;
      cursor = (cursor as Record<string, unknown>)[part];
      if (cursor === undefined) return undefined;
    }
  }
  return cursor;
}

export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w.$[\]]+)\s*\}\}/g, (_match, key: string) => {
    const value = getPath(vars, key);
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  });
}

export function parseJsonTemplate(template: string, vars: Record<string, unknown>): Record<string, unknown> {
  const rendered = renderTemplate(template || '{}', vars);
  try {
    const parsed = JSON.parse(rendered);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
