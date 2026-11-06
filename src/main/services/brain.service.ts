import fs from 'node:fs';
import { create, insert, remove, search, count } from '@orama/orama';
import type {
  BrainAnswer,
  BrainCaptureInput,
  BrainEdge,
  BrainEventRecord,
  BrainGraph,
  BrainHit,
  BrainNode,
  BrainNodeKind,
  BrainProfile,
  BrainStats,
} from '@shared/types';
import { JsonStore } from '../core/store';
import { log } from '../core/ipc';

interface BrainState {
  nodes: BrainNode[];
  edges: BrainEdge[];
  events: BrainEventRecord[];
  recording: boolean;
  createdAt: string;
}

const DEFAULT_STATE: BrainState = { nodes: [], edges: [], events: [], recording: true, createdAt: '' };
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'into', 'about', 'have', 'http', 'https', 'www']);
const MAX_NODES = 4000;
const MAX_EVENTS = 6000;

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    .slice(0, 6);
}

function recency(at: string): number {
  const age = (Date.now() - new Date(at).getTime()) / 86_400_000;
  return Math.max(0, 1 - age / 45);
}

/**
 * Graph brain.
 *
 * Every UI action, navigation, agent turn and system event is aggregated into a
 * small knowledge graph (nodes + weighted relations) and indexed with Orama for
 * instant recall. Nothing leaves the machine.
 */
export class BrainService {
  private store: JsonStore<BrainState>;
  private db = create({
    schema: { text: 'string', kind: 'string', surface: 'string', tags: 'string[]' } as const,
  });
  private emitTimer?: ReturnType<typeof setTimeout>;
  private lastKey = '';
  private lastAt = 0;
  private onEvent?: (payload: { kind: string; stats?: BrainStats; node?: BrainNode }) => void;
  private dataFile: string;

  constructor(options: { dataFile: string; onEvent?: (payload: { kind: string; stats?: BrainStats; node?: BrainNode }) => void }) {
    this.store = new JsonStore<BrainState>(options.dataFile, DEFAULT_STATE);
    this.dataFile = options.dataFile;
    this.onEvent = options.onEvent;
    if (!this.store.get().createdAt) this.store.set({ createdAt: new Date().toISOString() });
  }

  start(): void {
    for (const node of this.store.get().nodes) this.index(node);
    this.emit();
    log.info('brain', `${this.store.get().nodes.length} nodes Â· ${this.store.get().edges.length} edges Â· ${this.store.get().events.length} events`);
  }

  dispose(): void {
    if (this.emitTimer) clearTimeout(this.emitTimer);
  }

  private index(node: BrainNode): void {
    try {
      remove(this.db, node.id);
    } catch {
      /* not indexed yet */
    }
    try {
      insert(this.db, {
        id: node.id,
        text: `${node.label} ${node.detail ?? ''} ${node.kind} ${node.surface ?? ''}`,
        kind: node.kind,
        surface: node.surface ?? '',
        tags: node.tags,
      });
    } catch (error) {
      log.debug('brain', `index failed ${node.id}: ${(error as Error).message}`);
    }
  }

  private unindex(id: string): void {
    try {
      remove(this.db, id);
    } catch {
      /* ignore */
    }
  }

  private scheduleEmit(node?: BrainNode): void {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = undefined;
      this.onEvent?.({ kind: 'change', stats: this.stats(), node });
    }, 500);
  }

  private emit(): void {
    this.onEvent?.({ kind: 'change', stats: this.stats() });
  }

  stats(): BrainStats {
    const state = this.store.get();
    const today = new Date().toISOString().slice(0, 10);
    let bytes = 0;
    try {
      bytes = fs.statSync(this.dataFile).size;
    } catch {
      bytes = 0;
    }
    return {
      nodes: state.nodes.length,
      edges: state.edges.length,
      events: state.events.length,
      today: state.events.filter((event) => event.at.slice(0, 10) === today).length,
      recording: state.recording,
      indexed: count(this.db),
      storageBytes: bytes || JSON.stringify(state).length,
      firstAt: state.events[0]?.at ?? state.createdAt,
    };
  }

  private upsertNode(kind: BrainNodeKind, label: string, patch: Partial<BrainNode> = {}): BrainNode {
    const id = `${kind}:${slug(label)}`;
    const state = this.store.get();
    const existing = state.nodes.find((node) => node.id === id);
    const now = new Date().toISOString();
    if (existing) {
      existing.weight += 1;
      existing.lastAt = now;
      if (patch.detail) existing.detail = patch.detail;
      if (patch.surface) existing.surface = patch.surface;
      if (patch.tags) existing.tags = [...new Set([...existing.tags, ...patch.tags])].slice(0, 10);
      existing.salience = Math.min(1, 0.2 + Math.log1p(existing.weight) * 0.28 + recency(now) * 0.22);
      this.store.set({ nodes: state.nodes });
      this.index(existing);
      this.scheduleEmit(existing);
      return existing;
    }
    const node: BrainNode = {
      id,
      kind,
      label,
      detail: patch.detail,
      surface: patch.surface,
      tags: patch.tags ?? tokens(`${label} ${patch.detail ?? ''}`),
      weight: 1,
      salience: 0.34,
      at: now,
      lastAt: now,
    };
    this.store.set({ nodes: [...state.nodes, node] });
    this.index(node);
    this.scheduleEmit(node);
    return node;
  }

  private link(from: string, to: string, relation: BrainEdge['relation']): void {
    if (from === to) return;
    const state = this.store.get();
    const id = `${from}->${to}:${relation}`;
    const existing = state.edges.find((edge) => edge.id === id);
    const now = new Date().toISOString();
    if (existing) {
      existing.weight += 1;
      existing.lastAt = now;
    } else {
      state.edges.push({ id, from, to, relation, weight: 1, at: now, lastAt: now });
    }
    this.store.set({ edges: state.edges });
  }

  capture(inputs: BrainCaptureInput[]): { recorded: number } {
    if (!this.store.get().recording || !inputs.length) return { recorded: 0 };
    let recorded = 0;
    for (const input of inputs) {
      const label = (input.label ?? '').trim().slice(0, 120);
      if (!label) continue;
      const key = `${input.kind}:${label}`;
      const now = Date.now();
      if (key === this.lastKey && now - this.lastAt < 900) continue;
      this.lastKey = key;
      this.lastAt = now;
      try {
        this.recordOne(input, label);
        recorded += 1;
      } catch (error) {
        log.debug('brain', `capture failed: ${(error as Error).message}`);
      }
    }
    if (recorded) this.prune();
    return { recorded };
  }

  private recordOne(input: BrainCaptureInput, label: string): void {
    const surface = input.surface;
    const page = surface ? this.upsertNode('page', `${surface} page`, { surface, tags: [surface] }) : undefined;
    const app = input.app ? this.upsertNode('app', input.app, { tags: [input.app] }) : undefined;
    if (page && app) this.link(app.id, page.id, 'visited');

    let node: BrainNode;
    switch (input.kind) {
      case 'app':
        node = this.upsertNode('app', label, { surface, tags: input.tags });
        break;
      case 'navigate':
        node = this.upsertNode('page', label, { surface, tags: input.tags });
        break;
      case 'mail': {
        const address = label.replace(/^mail\s*[Â·:]\s*/i, '');
        node = this.upsertNode('person', address, { detail: input.detail, tags: ['mail', ...(input.tags ?? [])] });
        this.link(page?.id ?? app?.id ?? node.id, node.id, 'sent_to');
        break;
      }
      case 'site':
        node = this.upsertNode('site', label, { detail: input.detail, tags: ['site', ...(input.tags ?? [])] });
        this.link(app?.id ?? page?.id ?? node.id, node.id, 'published');
        break;
      case 'tool':
        node = this.upsertNode('tool', label, { detail: input.detail, tags: ['tool', ...(input.tags ?? [])] });
        this.link(app?.id ?? page?.id ?? node.id, node.id, 'ran');
        break;
      case 'workflow':
        node = this.upsertNode('workflow', label, { detail: input.detail, tags: ['automation', ...(input.tags ?? [])] });
        this.link(app?.id ?? page?.id ?? node.id, node.id, 'ran');
        break;
      case 'memory':
        node = this.upsertNode('memory', label.slice(0, 90), { detail: input.detail, tags: ['memory', ...(input.tags ?? [])] });
        break;
      case 'topic':
        node = this.upsertNode('topic', label, { tags: input.tags ?? tokens(label) });
        break;
      default:
        node = this.upsertNode('action', label, { surface, detail: input.detail, tags: input.tags });
        if (page) this.link(page.id, node.id, 'interacted');
        if (app) this.link(app.id, node.id, 'used');
        break;
    }

    if (input.detail && node.kind !== 'memory') node.detail = input.detail.slice(0, 200);
    const events = this.store.get().events;
    events.push({
      id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind: input.kind,
      label,
      surface,
      app: input.app,
      detail: input.detail,
      at: new Date().toISOString(),
      nodeId: node.id,
    });
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    this.store.set({ events });
  }

  private prune(): void {
    const state = this.store.get();
    if (state.nodes.length <= MAX_NODES) return;
    const keep = [...state.nodes].sort((a, b) => b.salience - a.salience).slice(0, Math.floor(MAX_NODES * 0.9));
    const keepIds = new Set(keep.map((node) => node.id));
    const removed = state.nodes.filter((node) => !keepIds.has(node.id));
    for (const node of removed) this.unindex(node.id);
    this.store.set({
      nodes: keep,
      edges: state.edges.filter((edge) => keepIds.has(edge.from) && keepIds.has(edge.to)),
    });
  }

  graph(limit = 140): BrainGraph {
    const state = this.store.get();
    const nodes = [...state.nodes].sort((a, b) => b.salience - a.salience).slice(0, limit);
    const ids = new Set(nodes.map((node) => node.id));
    return { nodes, edges: state.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
  }

  timeline(limit = 60): BrainEventRecord[] {
    return [...this.store.get().events].reverse().slice(0, limit);
  }

  recall(query: string, limit = 10): BrainHit[] {
    const term = query.trim();
    if (!term) {
      return [...this.store.get().nodes]
        .sort((a, b) => b.salience - a.salience)
        .slice(0, limit)
        .map((node) => ({ node, score: node.salience, why: 'most relevant memory', related: [] }));
    }
    const result = search(this.db, { term, limit: limit * 2, tolerance: 1, properties: ['text', 'tags'], boost: { text: 2, tags: 2.5 } }) as {
      hits: { id: string; score: number }[];
    };
    const state = this.store.get();
    const byId = new Map(state.nodes.map((node) => [node.id, node]));
    const hits: BrainHit[] = [];
    const seen = new Set<string>();
    for (const hit of result.hits) {
      const node = byId.get(hit.id);
      if (!node || seen.has(node.id)) continue;
      seen.add(node.id);
      const edges = state.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
      const related = edges.slice(0, 4).map((edge) => ({
        label: byId.get(edge.from === node.id ? edge.to : edge.from)?.label ?? 'unknown',
        relation: edge.relation,
      }));
      hits.push({
        node,
        score: hit.score * 0.7 + node.salience * 0.3,
        why: `matched on â€œ${term}â€`,
        related,
      });
      if (hits.length >= limit) break;
    }
    if (hits.length < limit) {
      // Graph expansion: pull strongly related neighbours of the best hits.
      for (const hit of [...hits]) {
        for (const edge of state.edges) {
          if (edge.from !== hit.node.id && edge.to !== hit.node.id) continue;
          const other = byId.get(edge.from === hit.node.id ? edge.to : edge.from);
          if (!other || seen.has(other.id)) continue;
          seen.add(other.id);
          hits.push({ node: other, score: 0.25 * edge.weight * other.salience, why: `connected to ${hit.node.label}`, related: [] });
          if (hits.length >= limit) break;
        }
        if (hits.length >= limit) break;
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  profile(): BrainProfile {
    const state = this.store.get();
    const group = (kind: BrainNodeKind): { label: string; count: number }[] =>
      state.nodes
        .filter((node) => node.kind === kind)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map((node) => ({ label: node.label, count: node.weight }));
    const hours = Array.from({ length: 24 }, () => 0);
    for (const event of state.events) {
      const hour = new Date(event.at).getHours();
      hours[hour] = (hours[hour] ?? 0) + 1;
    }
    const topicCounts = new Map<string, number>();
    for (const node of state.nodes) {
      for (const tag of node.tags) topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
    }
    return {
      topApps: group('app'),
      topActions: group('action'),
      topTopics: [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, count]) => ({ label, count })),
      collaborators: group('person'),
      sites: group('site'),
      hours,
      totalEvents: state.events.length,
      firstAt: state.events[0]?.at ?? state.createdAt,
    };
  }

  ask(query: string): BrainAnswer {
    const clean = query.trim();
    const hits = this.recall(clean, 8);
    const profile = this.profile();
    if (!hits.length) {
      return {
        text: `I don't have anything about â€œ${clean}â€ yet. I've recorded ${profile.totalEvents} actions so far â€” keep using the app and ask me again.`,
        hits: [],
      };
    }
    const top = hits[0];
    const others = hits.slice(1, 5).map((hit) => `${hit.node.label} (${hit.why})`);
    const habit = profile.topApps[0] ? `Your most-used app is ${profile.topApps[0].label} (${profile.topApps[0].count} interactions).` : '';
    const topic = profile.topTopics[0] ? `Frequent topic: ${profile.topTopics[0].label}.` : '';
    const last = new Date(top.node.lastAt);
    const when = Number.isNaN(last.getTime()) ? '' : `Last seen ${last.toLocaleString()}.`;
    const text = `I remember ${hits.length} related memories. Closest: **${top.node.label}** (${top.node.kind}, seen ${top.node.weight}Ã—). ${when} ${habit} ${topic}${
      others.length ? `\n\nAlso related: ${others.join(' Â· ')}` : ''
    }`;
    return { text, hits };
  }

  contextFor(prompt: string): string {
    if (!this.store.get().recording) return '';
    const hits = this.recall(prompt, 6);
    if (!hits.length) return '';
    const profile = this.profile();
    const lines = hits.map((hit) => `- ${hit.node.label} (${hit.node.kind}, ${hit.node.weight}Ã—; ${hit.why})`);
    const apps = profile.topApps.slice(0, 3).map((app) => `${app.label} ${app.count}Ã—`).join(', ');
    return [
      'Long-term memory from this device (use only when relevant, never invent beyond it):',
      ...lines,
      apps ? `Habit: ${apps}.` : '',
      profile.topTopics[0] ? `Frequent topic: ${profile.topTopics[0].label}.` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1400);
  }

  remember(text: string, tags: string[] = []): BrainNode {
    const label = text.trim().slice(0, 90);
    const node = this.upsertNode('memory', label, { detail: text, tags: ['memory', ...tags] });
    this.recordOne({ kind: 'memory', label, detail: text, tags }, label);
    return node;
  }

  forget(id: string): BrainStats {
    const state = this.store.get();
    this.unindex(id);
    this.store.set({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.from !== id && edge.to !== id),
    });
    this.emit();
    return this.stats();
  }

  wipe(): BrainStats {
    this.store.replace({ ...DEFAULT_STATE, createdAt: new Date().toISOString(), recording: this.store.get().recording });
    this.db = create({ schema: { text: 'string', kind: 'string', surface: 'string', tags: 'string[]' } as const });
    this.emit();
    return this.stats();
  }

  setRecording(enabled: boolean): BrainStats {
    this.store.set({ recording: enabled });
    this.emit();
    return this.stats();
  }
}


