const fs = require('fs');

const types = `
export type BrainNodeKind =
  | 'app'
  | 'page'
  | 'action'
  | 'person'
  | 'site'
  | 'tool'
  | 'workflow'
  | 'topic'
  | 'memory';

export interface BrainNode {
  id: string;
  kind: BrainNodeKind;
  label: string;
  detail?: string;
  surface?: string;
  tags: string[];
  weight: number;
  salience: number;
  at: string;
  lastAt: string;
}

export interface BrainEdge {
  id: string;
  from: string;
  to: string;
  relation: 'used' | 'visited' | 'interacted' | 'mentioned' | 'sent_to' | 'published' | 'ran' | 'related';
  weight: number;
  at: string;
  lastAt: string;
}

export interface BrainEventRecord {
  id: string;
  kind: string;
  label: string;
  surface?: string;
  app?: string;
  detail?: string;
  at: string;
  nodeId?: string;
}

export interface BrainHit {
  node: BrainNode;
  score: number;
  why: string;
  related: { label: string; relation: string }[];
}

export interface BrainProfile {
  topApps: { label: string; count: number }[];
  topActions: { label: string; count: number }[];
  topTopics: { label: string; count: number }[];
  collaborators: { label: string; count: number }[];
  sites: { label: string; count: number }[];
  hours: number[];
  totalEvents: number;
  firstAt?: string;
}

export interface BrainStats {
  nodes: number;
  edges: number;
  events: number;
  today: number;
  recording: boolean;
  indexed: number;
  storageBytes: number;
  firstAt?: string;
}

export interface BrainCaptureInput {
  kind: string;
  label: string;
  surface?: string;
  app?: string;
  detail?: string;
  tags?: string[];
  meta?: Record<string, string | number | boolean>;
}

export interface BrainAnswer {
  text: string;
  hits: BrainHit[];
}

export interface BrainGraph {
  nodes: BrainNode[];
  edges: BrainEdge[];
}
`;
fs.appendFileSync('src/shared/types.ts', types, 'utf8');
console.log('brain types appended');
