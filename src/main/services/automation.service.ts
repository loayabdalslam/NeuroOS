import vm from 'node:vm';
import type {
  MailMessage,
  NodeTypeSpec,
  PortName,
  RunStatus,
  RunStep,
  ToastPayload,
  Workflow,
  WorkflowNode,
  WorkflowRun,
} from '@shared/types';
import { JsonStore, Paths } from '../core/store';
import { log } from '../core/ipc';
import { newId, nowIso, truncate } from '../core/util';
import type { AgentService } from './agent.service';
import type { CompositionService } from './composition.service';
import type { MailService } from './mail.service';
import type { SettingsService } from './settings.service';
import type { ToolRegistry } from './tools';
import { parseJsonTemplate, renderTemplate } from './templating';

interface Item {
  text: string;
  json: Record<string, unknown>;
}

interface AutomationState {
  workflows: Workflow[];
  runs: WorkflowRun[];
}

const DEFAULT_STATE: AutomationState = { workflows: [], runs: [] };
const MAX_STEPS = 200;

export interface AutomationDeps {
  agent: AgentService;
  tools: ToolRegistry;
  mail: MailService;
  compositions: CompositionService;
  settings: SettingsService;
  hooks: { toast: (toast: ToastPayload) => void; navigate: (surface: string, params?: Record<string, string>) => void };
  emit: (event: { runId: string; workflowId: string; status: RunStatus; nodeId?: string; nodeStatus?: RunStatus; message?: string }) => void;
}

/**
 * A small n8n-style workflow engine.
 *
 * Triggers, agents, tools, HTTP, code, conditions, delays, mail and agent
 * compositions are nodes; edges route one item through the graph. Runs are
 * persisted with per-node status and durations, and stream progress to the UI.
 */
export class AutomationService {
  private store: JsonStore<AutomationState>;
  private deps: AutomationDeps;
  private cancelled = new Set<string>();
  private running = new Set<string>();
  private scheduleState = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(deps: AutomationDeps) {
    this.deps = deps;
    this.store = new JsonStore<AutomationState>(Paths.stateFile('automation'), DEFAULT_STATE, (error) =>
      log.error('automation', 'persist failed', error),
    );
  }

  init(): void {
    this.seed();
    this.timer = setInterval(() => this.tickSchedule(), 20_000);
    log.info('automation', `${this.store.get().workflows.length} workflows`);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /* ------------------------------ metadata ------------------------------ */

  nodeTypes(): NodeTypeSpec[] {
    const settings = this.deps.settings.public();
    const agentOptions = settings.agents.map((agent) => ({ value: agent.id, label: agent.name }));
    const compositionOptions = this.deps.compositions.list().map((composition) => ({ value: composition.id, label: composition.name }));
    const toolOptions = this.deps.tools.list().map((tool) => ({ value: tool.name, label: tool.name }));

    return [
      {
        type: 'trigger.manual',
        label: 'Manual trigger',
        category: 'trigger',
        icon: 'play',
        description: 'Runs when you press Run.',
        fields: [],
        outputs: ['main'],
      },
      {
        type: 'trigger.schedule',
        label: 'Schedule',
        category: 'trigger',
        icon: 'clock',
        description: 'Runs on an interval or every day at a time.',
        fields: [
          { key: 'mode', label: 'Mode', kind: 'select', options: [{ value: 'interval', label: 'Every N minutes' }, { value: 'daily', label: 'Daily at' }], default: 'interval' },
          { key: 'minutes', label: 'Minutes', kind: 'number', default: 60 },
          { key: 'time', label: 'Daily time (HH:MM)', kind: 'text', placeholder: '09:00' },
        ],
        outputs: ['main'],
      },
      {
        type: 'trigger.mail',
        label: 'Mail received',
        category: 'trigger',
        icon: 'inbox',
        description: 'Fires when this node receives a message.',
        fields: [
          { key: 'fromContains', label: 'From contains', kind: 'text', placeholder: 'alice' },
          { key: 'subjectContains', label: 'Subject contains', kind: 'text', placeholder: 'invoice' },
        ],
        outputs: ['main'],
      },
      {
        type: 'trigger.fs',
        label: 'File changed',
        category: 'trigger',
        icon: 'folder',
        description: 'Fires when a file in the workspace changes.',
        fields: [{ key: 'pathContains', label: 'Path contains', kind: 'text', placeholder: 'notes/' }],
        outputs: ['main'],
      },
      {
        type: 'agent.run',
        label: 'Run agent',
        category: 'agent',
        icon: 'brain',
        description: 'Sends a prompt to an agent and returns its answer.',
        fields: [
          { key: 'agentId', label: 'Agent', kind: 'select', options: agentOptions, default: 'neuro' },
          { key: 'prompt', label: 'Prompt', kind: 'textarea', placeholder: 'Summarise this for me:\n{{input}}' },
          { key: 'maxSteps', label: 'Max tool steps', kind: 'number', default: 3 },
        ],
        outputs: ['main'],
      },
      {
        type: 'composition.run',
        label: 'Run composition',
        category: 'agent',
        icon: 'workflow',
        description: 'Runs a multi-agent composition and returns the final text.',
        fields: [
          { key: 'compositionId', label: 'Composition', kind: 'select', options: compositionOptions },
          { key: 'input', label: 'Input', kind: 'textarea', placeholder: '{{input}}' },
        ],
        outputs: ['main'],
      },
      {
        type: 'tool.call',
        label: 'Call tool',
        category: 'action',
        icon: 'wrench',
        description: 'Invokes any registered tool (policy applies).',
        fields: [
          { key: 'tool', label: 'Tool', kind: 'select', options: toolOptions, default: 'system.info' },
          { key: 'args', label: 'Arguments (JSON)', kind: 'code', placeholder: '{"path": "{{input}}"}' },
        ],
        outputs: ['main'],
      },
      {
        type: 'http.request',
        label: 'HTTP request',
        category: 'action',
        icon: 'globe',
        description: 'Calls an HTTP endpoint.',
        fields: [
          { key: 'url', label: 'URL', kind: 'text', placeholder: 'https://api.example.com/…' },
          { key: 'method', label: 'Method', kind: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'].map((value) => ({ value, label: value })), default: 'GET' },
          { key: 'headers', label: 'Headers (JSON)', kind: 'code', placeholder: '{"authorization": "Bearer …"}' },
          { key: 'body', label: 'Body', kind: 'textarea' },
        ],
        outputs: ['main'],
      },
      {
        type: 'transform.code',
        label: 'Transform',
        category: 'action',
        icon: 'code',
        description: 'Runs JavaScript with `input` and `json` in scope.',
        fields: [{ key: 'code', label: 'Code', kind: 'code', placeholder: 'return input.toUpperCase();' }],
        outputs: ['main'],
      },
      {
        type: 'condition.if',
        label: 'If / else',
        category: 'logic',
        icon: 'route',
        description: 'Branches the workflow on a JavaScript expression.',
        fields: [{ key: 'expression', label: 'Expression', kind: 'text', placeholder: 'json.ok === true' }],
        outputs: ['true', 'false'],
      },
      {
        type: 'delay.wait',
        label: 'Wait',
        category: 'logic',
        icon: 'clock',
        description: 'Pauses the run for a number of milliseconds.',
        fields: [{ key: 'ms', label: 'Milliseconds', kind: 'number', default: 1000 }],
        outputs: ['main'],
      },
      {
        type: 'mail.send',
        label: 'Send mail',
        category: 'action',
        icon: 'send',
        description: 'Sends a decentralized mail message to a known peer.',
        fields: [
          { key: 'to', label: 'To (address)', kind: 'text', placeholder: 'alice@…' },
          { key: 'subject', label: 'Subject', kind: 'text', placeholder: 'Daily brief' },
          { key: 'body', label: 'Body', kind: 'textarea', placeholder: '{{input}}' },
        ],
        outputs: ['main'],
      },
      {
        type: 'notify.toast',
        label: 'Notify',
        category: 'action',
        icon: 'zap',
        description: 'Shows a toast notification.',
        fields: [
          { key: 'title', label: 'Title', kind: 'text', default: 'Workflow finished' },
          { key: 'message', label: 'Message', kind: 'textarea', placeholder: '{{input}}' },
        ],
        outputs: ['main'],
      },
    ];
  }

  /* ------------------------------ CRUD ---------------------------------- */

  list(): Workflow[] {
    return [...this.store.get().workflows].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  get(id: string): Workflow {
    const workflow = this.store.get().workflows.find((item) => item.id === id);
    if (!workflow) throw new Error('Workflow not found');
    return workflow;
  }

  save(workflow: Workflow): Workflow[] {
    const workflows = [...this.store.get().workflows];
    const index = workflows.findIndex((item) => item.id === workflow.id);
    const next = { ...workflow, updatedAt: nowIso() };
    if (index >= 0) workflows[index] = next;
    else workflows.push(next);
    this.store.set({ workflows });
    return this.list();
  }

  remove(id: string): Workflow[] {
    this.store.set({ workflows: this.store.get().workflows.filter((item) => item.id !== id) });
    return this.list();
  }

  runs(workflowId?: string): WorkflowRun[] {
    return this.store.get().runs.filter((run) => !workflowId || run.workflowId === workflowId).slice(0, 60);
  }

  /* ------------------------------- runs --------------------------------- */

  async run(id: string, trigger = 'manual', input = ''): Promise<{ runId: string }> {
    const workflow = this.get(id);
    if (this.running.has(id)) throw new Error('This workflow is already running');
    const run: WorkflowRun = {
      id: newId('run'),
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      startedAt: nowIso(),
      trigger,
      steps: [],
    };
    this.running.add(id);
    this.persistRun(run);
    this.deps.emit({ runId: run.id, workflowId: workflow.id, status: 'running', message: `Triggered by ${trigger}` });
    void this.execute(workflow, run, input);
    return { runId: run.id };
  }

  cancel(runId: string): void {
    this.cancelled.add(runId);
  }

  private async execute(workflow: Workflow, run: WorkflowRun, input: string): Promise<void> {
    const byId = new Map(workflow.nodes.map((node) => [node.id, node]));
    const triggers = workflow.nodes.filter((node) => node.type.startsWith('trigger.'));
    const starts = triggers.length
      ? triggers
      : workflow.nodes.filter((node) => !workflow.edges.some((edge) => edge.to === node.id));
    const queue: { node: WorkflowNode; item: Item; port: PortName }[] = starts.map((node) => ({
      node,
      item: { text: input, json: {} },
      port: 'main',
    }));
    const visited = new Set<string>();
    let processed = 0;

    try {
      while (queue.length) {
        if (this.cancelled.has(run.id)) throw new Error('cancelled');
        if (processed++ > MAX_STEPS) throw new Error('Step limit reached (cycle?)');
        const { node, item } = queue.shift()!;
        const visitKey = `${node.id}:${item.text.length}:${JSON.stringify(item.json).slice(0, 60)}`;
        if (visited.has(visitKey)) continue;
        visited.add(visitKey);

        const step: RunStep = { nodeId: node.id, name: node.name, type: node.type, status: 'running', startedAt: nowIso() };
        run.steps.push(step);
        this.deps.emit({ runId: run.id, workflowId: workflow.id, status: 'running', nodeId: node.id, nodeStatus: 'running' });
        const started = Date.now();
        try {
          const result = await this.runNode(workflow, run, node, item);
          step.status = 'ok';
          step.output = truncate(result.item.text, 4000);
          step.durationMs = Date.now() - started;
          this.deps.emit({ runId: run.id, workflowId: workflow.id, status: 'running', nodeId: node.id, nodeStatus: 'ok', message: step.output.slice(0, 300) });

          const port = result.port ?? 'main';
          for (const edge of workflow.edges.filter((edge) => edge.from === node.id && edge.fromPort === port)) {
            const target = byId.get(edge.to);
            if (target) queue.push({ node: target, item: result.item, port });
          }
        } catch (error) {
          step.status = 'error';
          step.error = (error as Error).message;
          step.durationMs = Date.now() - started;
          this.deps.emit({ runId: run.id, workflowId: workflow.id, status: 'running', nodeId: node.id, nodeStatus: 'error', message: step.error });
          throw error;
        }
        this.persistRun(run);
      }
      run.status = 'ok';
    } catch (error) {
      run.status = (error as Error).message === 'cancelled' ? 'cancelled' : 'error';
      run.error = (error as Error).message;
    } finally {
      run.endedAt = nowIso();
      this.running.delete(workflow.id);
      this.cancelled.delete(run.id);
      this.persistRun(run);
      this.deps.emit({ runId: run.id, workflowId: workflow.id, status: run.status, message: run.error });
      log.info('automation', `run ${run.id} finished: ${run.status}`);
    }
  }

  private async runNode(
    workflow: Workflow,
    run: WorkflowRun,
    node: WorkflowNode,
    item: Item,
  ): Promise<{ item: Item; port?: PortName }> {
    const config = node.config ?? {};
    const vars = { input: item.text, previous: item.text, item: item.json, json: item.json, now: nowIso(), workflow: workflow.name };
    void run;

    switch (node.type) {
      case 'trigger.manual':
      case 'trigger.schedule':
      case 'trigger.mail':
      case 'trigger.fs':
        return { item };

      case 'agent.run': {
        const prompt = renderTemplate(String(config.prompt ?? '{{input}}'), vars);
        if (!prompt.trim()) throw new Error('Agent prompt is empty');
        const result = await this.deps.agent.runOnce({
          prompt,
          agentId: String(config.agentId || 'neuro'),
          maxSteps: Number(config.maxSteps ?? 3),
        });
        return { item: { text: result.text, json: { text: result.text, tools: result.tools } } };
      }

      case 'composition.run': {
        const compositionId = String(config.compositionId ?? '');
        if (!compositionId) throw new Error('No composition selected');
        const output = await this.deps.compositions.runInline(compositionId, renderTemplate(String(config.input ?? '{{input}}'), vars));
        return { item: { text: output, json: { text: output } } };
      }

      case 'tool.call': {
        const tool = String(config.tool ?? '');
        if (!tool) throw new Error('No tool selected');
        const args = typeof config.args === 'string' && config.args.trim()
          ? parseJsonTemplate(String(config.args), vars)
          : (config.args as Record<string, unknown>) ?? {};
        const result = await this.deps.tools.invoke(tool, args);
        return { item: { text: result.output ?? '', json: { ok: result.status === 'ok', output: result.output, data: result.data } } };
      }

      case 'http.request': {
        const url = renderTemplate(String(config.url ?? ''), vars);
        if (!/^https?:\/\//i.test(url)) throw new Error('HTTP node needs an http(s) URL');
        const method = String(config.method ?? 'GET').toUpperCase();
        const headers = config.headers ? parseJsonTemplate(String(config.headers), vars) : {};
        const response = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...(headers as Record<string, string>) },
          body: method === 'GET' || method === 'HEAD' ? undefined : renderTemplate(String(config.body ?? ''), vars),
          signal: AbortSignal.timeout(30_000),
        });
        const text = await response.text();
        return { item: { text, json: { status: response.status, ok: response.ok, body: text.slice(0, 8000) } } };
      }

      case 'transform.code': {
        const code = String(config.code ?? '');
        const context = vm.createContext({ input: item.text, json: item.json, console: { log: () => {} } });
        const result = vm.runInContext(`(function(){${code}\n})()`, context, { timeout: 3000 });
        if (typeof result === 'string') return { item: { text: result, json: { text: result } } };
        if (result && typeof result === 'object') {
          const json = result as Record<string, unknown>;
          return { item: { text: json.text ? String(json.text) : JSON.stringify(result), json } };
        }
        return { item: { text: String(result ?? ''), json: { text: String(result ?? '') } } };
      }

      case 'condition.if': {
        const expression = String(config.expression ?? 'true');
        const context = vm.createContext({ input: item.text, json: item.json, text: item.text });
        const truthy = Boolean(vm.runInContext(`(function(){return (${expression});})()`, context, { timeout: 2000 }));
        return { item, port: truthy ? 'true' : 'false' };
      }

      case 'delay.wait': {
        const ms = Math.max(0, Math.min(60_000, Number(config.ms ?? 1000)));
        await new Promise((resolve) => setTimeout(resolve, ms));
        return { item };
      }

      case 'mail.send': {
        const to = renderTemplate(String(config.to ?? ''), vars);
        const subject = renderTemplate(String(config.subject ?? ''), vars);
        const body = renderTemplate(String(config.body ?? '{{input}}'), vars);
        const sent = await this.deps.mail.send({ to, subject, body });
        return { item: { text: `Sent ${sent.id} to ${to} (${sent.delivery})`, json: { id: sent.id, delivery: sent.delivery } } };
      }

      case 'notify.toast': {
        this.deps.hooks.toast({
          title: renderTemplate(String(config.title ?? 'Workflow'), vars),
          message: truncate(renderTemplate(String(config.message ?? ''), vars), 400),
          kind: 'success',
        });
        return { item };
      }

      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  /* ----------------------------- triggers ------------------------------- */

  notifyMail(message: MailMessage): void {
    for (const workflow of this.store.get().workflows.filter((item) => item.enabled)) {
      for (const node of workflow.nodes.filter((item) => item.type === 'trigger.mail')) {
        const fromFilter = String(node.config.fromContains ?? '').toLowerCase();
        const subjectFilter = String(node.config.subjectContains ?? '').toLowerCase();
        if (fromFilter && !message.from.address.toLowerCase().includes(fromFilter)) continue;
        if (subjectFilter && !message.subject.toLowerCase().includes(subjectFilter)) continue;
        void this.run(workflow.id, 'mail', `${message.subject}\n\n${message.body}`).catch((error) => log.warn('automation', 'mail trigger failed', error));
        break;
      }
    }
  }

  notifyFs(payload: { root: string; path: string }): void {
    for (const workflow of this.store.get().workflows.filter((item) => item.enabled)) {
      for (const node of workflow.nodes.filter((item) => item.type === 'trigger.fs')) {
        const filter = String(node.config.pathContains ?? '').toLowerCase();
        if (filter && !payload.path.toLowerCase().includes(filter)) continue;
        void this.run(workflow.id, 'file-change', payload.path).catch((error) => log.warn('automation', 'fs trigger failed', error));
        break;
      }
    }
  }

  private tickSchedule(): void {
    const now = new Date();
    for (const workflow of this.store.get().workflows.filter((item) => item.enabled)) {
      for (const node of workflow.nodes.filter((item) => item.type === 'trigger.schedule')) {
        const key = node.id;
        const last = this.scheduleState.get(key) ?? 0;
        const mode = String(node.config.mode ?? 'interval');
        let due = false;
        if (mode === 'interval') {
          const minutes = Math.max(1, Number(node.config.minutes ?? 60));
          due = Date.now() - last >= minutes * 60_000;
        } else {
          const time = String(node.config.time ?? '09:00');
          const [hours, mins] = time.split(':').map(Number);
          const sameDay = new Date(last).toDateString() === now.toDateString();
          if (now.getHours() === hours && now.getMinutes() === mins && !sameDay) due = true;
        }
        if (due) {
          this.scheduleState.set(key, Date.now());
          void this.run(workflow.id, 'schedule', 'Scheduled run').catch((error) => log.warn('automation', 'schedule failed', error));
        }
      }
    }
  }

  /* ------------------------------ internals ----------------------------- */

  private persistRun(run: WorkflowRun): void {
    const runs = [run, ...this.store.get().runs.filter((item) => item.id !== run.id)].slice(0, 100);
    this.store.set({ runs });
  }

  private seed(): void {
    if (this.store.get().workflows.length) return;
    const makeNode = (type: WorkflowNode['type'], name: string, x: number, y: number, config: Record<string, unknown>): WorkflowNode => ({
      id: newId('node'),
      type,
      name,
      x,
      y,
      config,
    });
    const makeEdge = (from: WorkflowNode, to: WorkflowNode, fromPort: PortName = 'main') => ({
      id: newId('edge'),
      from: from.id,
      fromPort,
      to: to.id,
    });

    const schedule = makeNode('trigger.schedule', 'Every hour', 60, 90, { mode: 'interval', minutes: 60 });
    const agent = makeNode('agent.run', 'System brief', 320, 90, {
      agentId: 'neuro',
      prompt: 'Give me a one-paragraph status brief of this machine: CPU, memory, workspace files, and anything that needs attention.',
      maxSteps: 2,
    });
    const notify = makeNode('notify.toast', 'Notify me', 600, 90, { title: 'Hourly system brief', message: '{{input}}' });
    const brief: Workflow = {
      id: newId('flow'),
      name: 'Hourly system brief',
      description: 'Runs an agent every hour and surfaces the result as a notification.',
      nodes: [schedule, agent, notify],
      edges: [makeEdge(schedule, agent), makeEdge(agent, notify)],
      enabled: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const mailTrigger = makeNode('trigger.mail', 'New mail', 60, 90, {});
    const triage = makeNode('agent.run', 'Classify', 320, 90, {
      agentId: 'neuro',
      prompt: 'Classify this email as urgent / normal / spam in one word, then one sentence of reasoning.\n\n{{input}}',
      maxSteps: 1,
    });
    const check = makeNode('condition.if', 'Urgent?', 600, 90, { expression: 'json.text.toLowerCase().startsWith("urgent")' });
    const alert = makeNode('notify.toast', 'Alert', 880, 30, { title: 'Urgent mail', message: '{{input}}' });
    const quiet = makeNode('transform.code', 'Archive note', 880, 170, { code: 'return "Logged: " + input.slice(0, 120);' });
    const triageFlow: Workflow = {
      id: newId('flow'),
      name: 'Mail triage',
      description: 'Reads incoming mail, asks an agent to classify it, and alerts only for urgent messages.',
      nodes: [mailTrigger, triage, check, alert, quiet],
      edges: [makeEdge(mailTrigger, triage), makeEdge(triage, check), makeEdge(check, alert, 'true'), makeEdge(check, quiet, 'false')],
      enabled: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.store.set({ workflows: [brief, triageFlow] });
  }
}
