const fs = require('fs');
const p = 'src/shared/types.ts';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('ComposioStatus')) {
  c += `
export interface ComposioToolkitInfo {
  slug: string;
  name: string;
  description?: string;
  logo?: string;
  tools: number;
  connected: boolean;
}

export interface ComposioTool {
  slug: string;
  name: string;
  description: string;
  toolkit: string;
  toolkitName: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
}

export interface ComposioAccountInfo {
  id: string;
  toolkit: string;
  status: string;
  alias?: string;
}

export interface ComposioStatus {
  configured: boolean;
  apiKeySet: boolean;
  userId: string;
  baseUrl: string;
  tools: number;
  toolkits: number;
  connected: number;
  enabled: number;
  lastSync?: ISODate;
  error?: string;
}
`;
  fs.writeFileSync(p, c, 'utf8');
  console.log('types appended');
} else {
  console.log('already present');
}
