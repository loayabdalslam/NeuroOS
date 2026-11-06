import type { BrandMark } from './brandIcons';

/**
 * Marks that are not in the simple-icons dataset (trademark removals or newer
 * products). Drawn by hand as simplified, original marks so the UI still has a
 * distinct identity for every provider and toolkit.
 */
export const CUSTOM_BRANDS: Record<string, BrandMark> = {
  openai: {
    title: 'OpenAI',
    hex: '10A37F',
    path: 'M12 1.8l2.6 4.4 5.1-.5-1.4 4.9 3.9 3.3-4.4 2.7-.4 5.1-4.9-1.5-3.4 3.9-2.7-4.4-5.1.4 1.5-4.9L1.8 12l4.4-2.7.4-5.1 4.9 1.5zm0 3.6L9.8 9l2.2 3.7 3.7-.3-1-3.6zm-4 4.4L4.6 12l3.4 2.2 1.6-2.3zm8 .1l-1.5 2.5 1.6 2.3 3.6-2.3zm-4.2 4.1L9.6 15l1 3.7 2.4-2.7z',
  },
  windows: { title: 'Windows', hex: '0078D4', path: 'M3 3h8.4v8.4H3zM12.6 3H21v8.4h-8.4zM3 12.6h8.4V21H3zM12.6 12.6H21V21h-8.4z' },
  microsoft: { title: 'Microsoft', hex: 'F25022', path: 'M2.6 2.6h8.8v8.8H2.6zM12.6 2.6h8.8v8.8h-8.8zM2.6 12.6h8.8v8.8H2.6zM12.6 12.6h8.8v8.8h-8.8z' },
  slack: {
    title: 'Slack',
    hex: '4A154B',
    path: 'M9.4 2.4a2.4 2.4 0 0 1 2.4 2.4v5.8a2.4 2.4 0 0 1-4.8 0V4.8a2.4 2.4 0 0 1 2.4-2.4zM18.2 9.4a2.4 2.4 0 0 1 0 4.8h-5.8a2.4 2.4 0 0 1 0-4.8zM14.6 21.6a2.4 2.4 0 0 1-2.4-2.4v-5.8a2.4 2.4 0 0 1 4.8 0v5.8a2.4 2.4 0 0 1-2.4 2.4zM5.8 14.6a2.4 2.4 0 0 1 0-4.8h5.8a2.4 2.4 0 0 1 0 4.8z',
  },
  linkedin: {
    title: 'LinkedIn',
    hex: '0A66C2',
    path: 'M4.2 3h15.6A1.2 1.2 0 0 1 21 4.2v15.6a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 19.8V4.2A1.2 1.2 0 0 1 4.2 3zM7.6 9.4h2.2v8H7.6zm1.1-3.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zm3.5 3.4h2.1v1.1h.1c.4-.7 1.3-1.3 2.5-1.3 2.2 0 2.9 1.3 2.9 3.5v4.7h-2.2V13c0-1.1-.3-1.8-1.3-1.8-1 0-1.6.7-1.6 1.8v4.4h-2.2z',
  },
  groq: { title: 'Groq', hex: 'F55036', path: 'M14.2 1.8L3.6 14.6h5.8l-2 7.6 11.2-13.4h-5.9z' },
  together: { title: 'Together AI', hex: '0F6FFF', path: 'M2.6 5h18.8v4.4H2.6zM6 10.4h12v4.4H6zM9.4 15.8h5.2V21H9.4z' },
  salesforce: {
    title: 'Salesforce',
    hex: '00A1E0',
    path: 'M9.4 5.2a4.6 4.6 0 0 1 5.8-1.7 4.4 4.4 0 0 1 6.2 3.9 3.9 3.9 0 0 1-1.2 7.6H5.4a4.4 4.4 0 0 1-.9-8.7 4.6 4.6 0 0 1 4.9-1.1z',
  },
  lmstudio: { title: 'LM Studio', hex: '8B5CF6', path: 'M12 2.2l8.4 4.9v9.8L12 21.8l-8.4-4.9V7.1zM12 5l-5.4 3.1v6.8L12 18l5.4-3.1V8.1zM12 8.2l2.6 1.5v3.6L12 14.8l-2.6-1.5V9.7z' },
  composio: {
    title: 'Composio',
    hex: '6C5CE7',
    path: 'M12 2.4a9.6 9.6 0 1 0 8.5 14.1l-3.2-1.9a5.9 5.9 0 1 1 .1-5.3l3.2-1.9A9.6 9.6 0 0 0 12 2.4zm0 2.6c1.4 0 2.7.5 3.7 1.4l-2 3.5a3.3 3.3 0 0 0-4.4 3.2l-2 3.5A5.9 5.9 0 0 1 12 5z',
  },
  neuro: {
    title: 'Neuro OS',
    hex: '5686FE',
    path: 'M12 2.2l1.4 2.5 2.8-.5-.5 2.8L18.2 8l-2.5 1.4.5 2.8-2.8-.5L12 14.2l-1.4-2.5-2.8.5.5-2.8L5.8 8l2.5-1.4-.5-2.8 2.8.5zM12 17.4a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z',
  },
};

export function allBrands(base: Record<string, BrandMark>): Record<string, BrandMark> {
  return { ...base, ...CUSTOM_BRANDS };
}

/** Toolkit slug → brand key, used by the Composio integrations panel. */
export const TOOLKIT_BRAND: Record<string, string> = {
  gmail: 'gmail',
  google_drive: 'googledrive',
  googledrive: 'googledrive',
  google_sheets: 'googlesheets',
  googlesheets: 'googlesheets',
  googlecalendar: 'googlecalendar',
  google_calendar: 'googlecalendar',
  github: 'github',
  git_hub: 'github',
  slack: 'slack',
  notion: 'notion',
  discord: 'discord',
  linear: 'linear',
  jira: 'jira',
  trello: 'trello',
  asana: 'asana',
  stripe: 'stripe',
  hubspot: 'hubspot',
  salesforce: 'salesforce',
  telegram: 'telegram',
  whatsapp: 'whatsapp',
  linkedin: 'linkedin',
  youtube: 'youtube',
  figma: 'figma',
  vercel: 'vercel',
  supabase: 'supabase',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  docker: 'docker',
  dropbox: 'dropbox',
  zoom: 'zoom',
  spotify: 'spotify',
  browser: 'globe',
  webhook: 'zap',
};
