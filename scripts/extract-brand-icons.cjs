const fs = require('fs');
const si = require('C:\\Work\\Research\\AGI\\Neuro Os\\node_modules\\simple-icons');

// Brand icons we actually use: model providers, OS design languages, Composio toolkits.
const wanted = {
  openai: 'openai',
  anthropic: 'anthropic',
  googlegemini: 'googlegemini',
  deepseek: 'deepseek',
  ollama: 'ollama',
  groq: 'groq',
  mistralai: 'mistralai',
  x: 'x',
  openrouter: 'openrouter',
  together: 'together',
  alibabacloud: 'alibabacloud',
  huggingface: 'huggingface',
  microsoft: 'microsoft',
  windows: 'windows',
  ubuntu: 'ubuntu',
  apple: 'apple',
  linux: 'linux',
  github: 'github',
  slack: 'slack',
  notion: 'notion',
  gmail: 'gmail',
  googledrive: 'googledrive',
  googlesheets: 'googlesheets',
  googlecalendar: 'googlecalendar',
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
  postgresql: 'postgresql',
  docker: 'docker',
  dropbox: 'dropbox',
  zoom: 'zoom',
  spotify: 'spotify',
  composio: 'composio',
};

const out = {};
for (const [key, slug] of Object.entries(wanted)) {
  const icon = si[`si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`] || si[slug];
  if (icon) {
    out[key] = { title: icon.title, hex: icon.hex, path: icon.path };
  } else {
    console.log('MISSING', key, slug);
  }
}

const header = `/**
 * Original brand marks, extracted from the simple-icons dataset (CC0 1.0).
 * Brand names and logos are trademarks of their respective owners.
 * Regenerate with scripts/extract-brand-icons.cjs.
 */
export interface BrandMark { title: string; hex: string; path: string }

export const BRAND_ICONS: Record<string, BrandMark> = ${JSON.stringify(out, null, 2)};
`;
fs.writeFileSync('C:\\Work\\Research\\AGI\\Neuro Os\\src\\renderer\\src\\components\\brandIcons.ts', header, 'utf8');
console.log('wrote', Object.keys(out).length, 'brand icons');
