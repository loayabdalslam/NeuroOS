import type { Composition, CompositionRun, CompositionStep } from '@shared/types';
import { JsonStore, Paths } from '../core/store';
import { log } from '../core/ipc';
import { newId, nowIso } from '../core/util';
import type { AgentService } from './agent.service';
import { renderTemplate } from './templating';

interface CompositionState {
  compositions: Composition[];
  runs: CompositionRun[];
}

const DEFAULT_STATE: CompositionState = { compositions: [], runs: [] };

/**
 * Agent compositions: a named pipeline of agent steps where each step receives
 * the original input plus the previous step's output. Compositions are runnable
 * on their own and from automations (`composition.run`).
 */
export class CompositionService {
  private store: JsonStore<CompositionState>;
  private cancelled = new Set<string>();
  private agent: AgentService;
  private emit: (event: { runId: string; compositionId: string; status: CompositionRun['status']; stepId?: string; output?: string }) => void;

  constructor(deps: {
    agent: AgentService;
    emit: (event: { runId: string; compositionId: string; status: CompositionRun['status']; stepId?: string; output?: string }) => void;
  }) {
    this.agent = deps.agent;
    this.emit = deps.emit;
    this.store = new JsonStore<CompositionState>(Paths.stateFile('compositions'), DEFAULT_STATE, (error) =>
      log.error('composer', 'persist failed', error),
    );
  }

  init(): void {
    if (this.store.get().compositions.length) return;
    const now = nowIso();
    const composition: Composition = {
      id: newId('comp'),
      name: 'Research → Draft → Review',
      description: 'Three agents in sequence: gather sources, write the draft, then edit it against a rubric.',
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          id: newId('step'),
          name: 'Gather sources',
          agentId: 'researcher',
          prompt: 'Research this topic and return a dense bullet list of verified facts with URLs:\n\n{{input}}',
          usePrevious: false,
        },
        {
          id: newId('step'),
          name: 'Draft',
          agentId: 'architect',
          prompt: 'Using these research notes, write a tight 400-word brief with headings.\n\nOriginal request:\n{{input}}\n\nNotes:\n{{previous}}',
          usePrevious: true,
        },
        {
          id: newId('step'),
          name: 'Edit',
          agentId: 'neuro',
          prompt: 'Edit this draft for clarity and accuracy. Return the improved final text only.\n\nDraft:\n{{previous}}',
          usePrevious: true,
        },
      ],
    };
    this.store.set({ compositions: [composition] });
  }

  list(): Composition[] {
    return [...this.store.get().compositions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  save(composition: Composition): Composition[] {
    const compositions = [...this.store.get().compositions];
    const index = compositions.findIndex((item) => item.id === composition.id);
    const next = { ...composition, updatedAt: nowIso() };
    if (index >= 0) compositions[index] = next;
    else compositions.push(next);
    this.store.set({ compositions });
    return this.list();
  }

  remove(id: string): Composition[] {
    this.store.set({ compositions: this.store.get().compositions.filter((item) => item.id !== id) });
    return this.list();
  }

  runs(compositionId?: string): CompositionRun[] {
    const runs = this.store.get().runs.filter((run) => !compositionId || run.compositionId === compositionId);
    return runs.slice(0, 50);
  }

  cancel(runId: string): void {
    this.cancelled.add(runId);
  }

  async run(id: string, input: string): Promise<{ runId: string }> {
    const composition = this.store.get().compositions.find((item) => item.id === id);
    if (!composition) throw new Error('Composition not found');
    const run: CompositionRun = {
      id: newId('crun'),
      compositionId: composition.id,
      compositionName: composition.name,
      status: 'running',
      startedAt: nowIso(),
      steps: composition.steps.map((step) => ({ stepId: step.id, name: step.name, status: 'queued' as const, output: '' })),
    };
    this.persistRun(run);
    void this.execute(composition, run, input);
    return { runId: run.id };
  }

  /** Run a composition to completion and return its final text (used by automations). */
  async runInline(id: string, input: string): Promise<string> {
    const composition = this.store.get().compositions.find((item) => item.id === id);
    if (!composition) throw new Error(`Composition not found: ${id}`);
    let previous = '';
    for (const step of composition.steps) {
      const prompt = renderTemplate(step.prompt, { input, previous: step.usePrevious ? previous : '', step: step.name });
      const result = await this.agent.runOnce({ prompt, agentId: step.agentId, maxSteps: 4 });
      previous = result.text;
    }
    return previous;
  }

  private async execute(composition: Composition, run: CompositionRun, input: string): Promise<void> {
    let previous = '';
    try {
      for (const [index, step] of composition.steps.entries()) {
        if (this.cancelled.has(run.id)) throw new Error('cancelled');
        const record = run.steps[index];
        record.status = 'running';
        this.emit({ runId: run.id, compositionId: composition.id, status: 'running', stepId: step.id });
        this.persistRun(run);
        const prompt = renderTemplate(step.prompt, {
          input,
          previous: step.usePrevious ? previous : '',
          step: step.name,
        });
        const result = await this.agent.runOnce({ prompt, agentId: step.agentId, maxSteps: 4 });
        record.output = result.text;
        record.status = 'ok';
        previous = result.text;
        this.emit({ runId: run.id, compositionId: composition.id, status: 'running', stepId: step.id, output: result.text });
        this.persistRun(run);
      }
      run.status = 'ok';
    } catch (error) {
      run.status = (error as Error).message === 'cancelled' ? 'cancelled' : 'error';
      const active = run.steps.find((step) => step.status === 'running');
      if (active) {
        active.status = run.status;
        active.error = (error as Error).message;
      }
    } finally {
      run.endedAt = nowIso();
      this.persistRun(run);
      this.emit({ runId: run.id, compositionId: composition.id, status: run.status });
      this.cancelled.delete(run.id);
    }
  }

  private persistRun(run: CompositionRun): void {
    const runs = [run, ...this.store.get().runs.filter((item) => item.id !== run.id)].slice(0, 100);
    this.store.set({ runs });
  }

  stepSummary(step: CompositionStep, agents: { id: string; name: string }[]): string {
    const agent = agents.find((item) => item.id === step.agentId);
    return `${step.name} · ${agent?.name ?? step.agentId}`;
  }
}
