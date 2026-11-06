const fs = require('fs');
const p = 'src/shared/types.ts';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('SiteManifest')) {
  c += `
export interface SiteFileInfo {
  path: string;
  hash: string;
  size: number;
  type: string;
}

export interface SiteManifest {
  version: 1;
  id: string;
  domain: string;
  title: string;
  description: string;
  nodeId: string;
  publicKey: string;
  publishedAt: string;
  updatedAt: string;
  entry: string;
  files: SiteFileInfo[];
  signature: string;
}

export interface WebPeer {
  nodeId: string;
  host: string;
  port: number;
  name: string;
  lastSeen: string;
  source: 'lan' | 'manual' | 'gossip';
}

export interface WebStats {
  sites: number;
  peers: number;
  online: number;
  hits: number;
  bytes: number;
  port: number;
  nodeId: string;
  gateway: string;
  publicKey: string;
}

export interface WebPublishFile {
  path: string;
  data: string;
}

export interface WebPublishResult {
  ok: boolean;
  manifest?: SiteManifest;
  error?: string;
}
`;
  fs.writeFileSync(p, c, 'utf8');
  console.log('web types appended');
} else {
  console.log('web types already present');
}
