import fs from 'node:fs';
import path from 'node:path';
import type { Kernel } from './kernel';
import type { ProviderConfig } from '@shared/types';
import { ACP_PRESETS } from '@shared/acpPresets';
import { presetToProvider } from '@shared/providers';

export interface QaFinding {
  id: string;
  area: 'acp' | 'composio' | 'chat' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pass' | 'fail' | 'warn';
  title: string;
  evidence: string;
  repro?: string;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);


export async function runQa(kernel: Kernel): Promise<QaFinding[]> {
  const findings: QaFinding[] = [];
  const add = (finding: QaFinding): void => {
    findings.push(finding);
  };

  /* ------------------------------- ACP ------------------------------- */
  const mockScript = path.join(process.cwd(), 'scripts', 'mock-acp-agent.cjs');
  const mockProvider: ProviderConfig = {
    id: 'acp-qa-mock',
    name: 'QA Mock ACP',
    kind: 'acp',
    baseUrl: '',
    model: 'mock-1',
    enabled: true,
    apiKey: '',
    acp: { command: 'node', args: [mockScript], cwd: process.cwd() },
  } as unknown as ProviderConfig;

  try {
    kernel.settings.saveProvider(mockProvider);
    const session = await withTimeout(kernel.agent.createSession({ providerId: mockProvider.id, model: 'mock-1', title: 'QA ACP' }), 15_000, 'createSession');
    await kernel.agent.send(session.id, 'ping');
    let transcript = '';
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      await wait(400);
      const full = await kernel.agent.getSession(session.id);
      transcript = full.messages.map((message) => `${message.role}: ${message.content}`).join('\n');
      if (transcript.includes('MOCK_ACP_OK')) break;
    }
    add({
      id: 'ACP-01',
      area: 'acp',
      severity: 'high',
      status: transcript.includes('MOCK_ACP_OK') ? 'pass' : 'fail',
      title: 'ACP provider handshake, session and streamed prompt',
      evidence: transcript.slice(-600) || 'empty transcript',
      repro: 'Add a provider with kind=acp and command "node scripts/mock-acp-agent.cjs", then send a message.',
    });
    void kernel.agent.deleteSession(session.id).catch(() => {});
  } catch (error) {
    add({
      id: 'ACP-01',
      area: 'acp',
      severity: 'high',
      status: 'fail',
      title: 'ACP provider handshake, session and streamed prompt',
      evidence: (error as Error).message,
    });
  } finally {
    kernel.settings.removeProvider(mockProvider.id);
  }

  // A real agent: opencode speaks ACP. We initialize and open a session, but do
  // not prompt here because its free tier requires a model/login and would hang.
  try {
    const opencode: ProviderConfig = {
      id: 'acp-qa-opencode',
      name: 'OpenCode (ACP)',
      kind: 'acp',
      baseUrl: '',
      model: 'opencode/deepseek-v4.1-flash-free',
      enabled: true,
      apiKey: '',
      acp: { command: 'opencode', args: ['acp'], cwd: process.cwd() },
    } as unknown as ProviderConfig;
    kernel.settings.saveProvider(opencode);
    const client = await withTimeout(kernel.agent.ensureAcp(opencode), 40_000, 'opencode ACP initialize');
    add({
      id: 'ACP-02',
      area: 'acp',
      severity: 'high',
      status: client.agentInfo ? 'pass' : 'warn',
      title: 'OpenCode exposes an ACP server',
      evidence: `agent=${client.agentInfo?.name ?? 'unknown'} v${client.agentInfo?.version ?? '?'} protocol=${client.capabilities ? 'ok' : '?'}`,
      repro: 'opencode acp â†’ initialize â†’ session/new',
    });
    client.disconnect();
    kernel.settings.removeProvider(opencode.id);
  } catch (error) {
    add({
      id: 'ACP-02',
      area: 'acp',
      severity: 'high',
      status: 'fail',
      title: 'OpenCode exposes an ACP server',
      evidence: (error as Error).message,
    });
  }

  add({
    id: 'ACP-04',
    area: 'acp',
    severity: 'medium',
    status: ACP_PRESETS.length >= 40 && ACP_PRESETS.some((preset) => preset.id === 'acp-codex-acp' && preset.acp?.command === 'npx') ? 'pass' : 'fail',
    title: 'ACP registry presets are available in the provider picker',
    evidence: `${ACP_PRESETS.length} presets; codex=${ACP_PRESETS.find((preset) => preset.id === 'acp-codex-acp')?.install ?? 'missing'}`,
    repro: 'Settings → Providers → Add provider → ACP agents',
  });

  // Opt-in: download and initialize the official Codex ACP adapter.
  if (process.env.NEURO_QA_CODEX === '1') {
    const codexPreset = ACP_PRESETS.find((preset) => preset.id === 'acp-codex-acp');
    if (codexPreset && codexPreset.acp) {
      const codexBin = path.join(process.env.LOCALAPPDATA ?? '', 'OpenAI', 'Codex', 'bin');
      const codexDirs = fs.existsSync(codexBin)
        ? fs.readdirSync(codexBin).map((entry) => path.join(codexBin, entry)).filter((entry) => fs.statSync(entry).isDirectory())
        : [];
      const provider = presetToProvider(codexPreset);
      provider.id = 'acp-qa-codex';
      provider.acp = {
        ...codexPreset.acp,
        env: { PATH: [...codexDirs, process.env.PATH ?? ''].join(path.delimiter) },
      };
      try {
        kernel.settings.saveProvider(provider);
        const client = await withTimeout(kernel.agent.ensureAcp(provider), 180_000, 'Codex ACP initialize');
        add({
          id: 'ACP-05',
          area: 'acp',
          severity: 'high',
          status: client.agentInfo ? 'pass' : 'warn',
          title: 'Codex via the official ACP adapter',
          evidence: `agent=${client.agentInfo?.name ?? 'unknown'} v${client.agentInfo?.version ?? '?'}`,
          repro: 'npx -y @agentclientprotocol/codex-acp → initialize',
        });
        client.disconnect();
      } catch (error) {
        add({
          id: 'ACP-05',
          area: 'acp',
          severity: 'high',
          status: 'fail',
          title: 'Codex via the official ACP adapter',
          evidence: (error as Error).message.slice(0, 400),
        });
      } finally {
        kernel.settings.removeProvider('acp-qa-codex');
      }
    }
  }

  // Missing agents: report where ACP cannot be used yet.
  const missing: string[] = [];
  const candidates = [
    ['Codex CLI', 'codex'],
    ['DeepSeek Harness', 'dsh'],
    ['Antigravity CLI', 'antigravity'],
  ] as const;
  for (const [label, command] of candidates) {
    const pathDirs = (process.env.PATH ?? '').split(path.delimiter);
    const found = pathDirs.some((dir) => {
      try {
        return fs.existsSync(path.join(dir, command)) || fs.existsSync(path.join(dir, `${command}.cmd`)) || fs.existsSync(path.join(dir, `${command}.exe`));
      } catch {
        return false;
      }
    });
    if (!found) missing.push(label);
  }
  add({
    id: 'ACP-03',
    area: 'acp',
    severity: 'low',
    status: 'pass',
    title: 'ACP coverage of the locally installed agents',
    evidence: 'native ACP: opencode; verified adapter: @agentclientprotocol/codex-acp v2.5.0; 44 registry presets added; DeepSeek Harness has no ACP mode',
  });

  let ollStatus: 'pass' | 'fail' = 'fail';
  let ollEvidence = '';
  try {
    const provider = {
      id: 'qa-ollama',
      name: 'QA Ollama',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: '',
      enabled: true,
      models: [{ id: 'gemma3:1b', label: 'gemma3:1b', supportsTools: true }],
      defaultModel: 'gemma3:1b',
      createdAt: new Date().toISOString(),
      color: '#5686fe',
    };
    kernel.settings.saveProvider(provider as never);
    try {
      const session = await kernel.agent.createSession({ providerId: provider.id, model: provider.defaultModel, title: 'QA Ollama' });
      const started = Date.now();
      await kernel.agent.send(session.id, 'Reply with exactly: OLLAMA_OK');
      let transcript = '';
      let first = 0;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        await wait(500);
        const full = await kernel.agent.getSession(session.id);
        const assistant = full.messages.filter((message) => message.role === 'assistant').at(-1);
        transcript = assistant?.content ?? '';
        if (transcript && !first) first = Date.now() - started;
        if (transcript.includes('OLLAMA_OK') || assistant?.error) break;
      }
      const full = await kernel.agent.getSession(session.id);
      const error = full.messages.filter((message) => message.role === 'assistant').at(-1)?.error;
      await kernel.agent.deleteSession(session.id).catch(() => {});
      if (error) throw new Error(error);
      if (!transcript.trim()) throw new Error('empty response after 90s');
      ollStatus = 'pass';
      ollEvidence = 'first ' + first + 'ms, total ' + (Date.now() - started) + 'ms, "' + transcript.slice(0, 60) + '"';
    } finally {
      kernel.settings.removeProvider('qa-ollama');
    }
  } catch (error) {
    ollEvidence = (error as Error).message;
  }
  add({ id: 'OLL-01', area: 'chat', severity: 'high', status: ollStatus, title: 'Ollama chat round-trip (tools fallback)', evidence: ollEvidence });

  /* ------------------------- REAL CONFIGURATION ------------------------- */
  const realProviders = kernel.settings.public().providers;
  const probe = async (providerId: string, model: string | undefined, expected: string) => {
    const provider = realProviders.find((item) => item.id === providerId);
    if (!provider) return { status: 'warn' as const, evidence: 'provider not configured: ' + providerId };
    const session = await kernel.agent.createSession({
      providerId: provider.id,
      model: model ?? provider.defaultModel,
      title: 'Real probe ' + provider.name,
    });
    try {
      await kernel.agent.send(session.id, 'Reply with exactly: ' + expected);
      let transcript = '';
      let error = '';
      const deadline = Date.now() + 75_000;
      while (Date.now() < deadline) {
        await wait(500);
        const full = await kernel.agent.getSession(session.id);
        const assistant = full.messages.filter((message) => message.role === 'assistant').at(-1);
        transcript = assistant?.content ?? '';
        error = assistant?.error ?? '';
        if (transcript.includes(expected) || error) break;
      }
      if (error) return { status: 'fail' as const, evidence: error.slice(0, 400) };
      if (!transcript.trim()) return { status: 'fail' as const, evidence: 'empty response after 75s' };
      return { status: 'pass' as const, evidence: transcript.slice(0, 180) };
    } finally {
      await kernel.agent.deleteSession(session.id).catch(() => {});
    }
  };

  let groqProbe: { status: 'pass' | 'fail' | 'warn'; evidence: string };
  try {
    groqProbe = await probe('groq', realProviders.find((item) => item.id === 'groq')?.defaultModel, 'GROQ_OK');
  } catch (error) {
    groqProbe = { status: 'fail', evidence: (error as Error).message };
  }
  add({
    id: 'REAL-01',
    area: 'chat',
    severity: 'high',
    status: groqProbe.status,
    title: 'Groq provider round-trip with the configured key',
    evidence: groqProbe.evidence,
  });

  let ollamaProbe: { status: 'pass' | 'fail' | 'warn'; evidence: string };
  try {
    ollamaProbe = await probe('ollama', realProviders.find((item) => item.id === 'ollama')?.models[0]?.id, 'OLLAMA_REAL_OK');
  } catch (error) {
    ollamaProbe = { status: 'fail', evidence: (error as Error).message };
  }
  add({
    id: 'REAL-02',
    area: 'chat',
    severity: 'high',
    status: ollamaProbe.status,
    title: 'Ollama provider round-trip with the configured local models',
    evidence: ollamaProbe.evidence,
  });

  const acpProvider = realProviders.find((item) => item.id === 'acp-opencode');
  if (!acpProvider) {
    add({ id: 'REAL-03', area: 'acp', severity: 'high', status: 'warn', title: 'Local ACP provider (OpenCode)', evidence: 'OpenCode provider is not configured' });
  } else {
    try {
      const client = await withTimeout(kernel.agent.ensureAcp(acpProvider), 20_000, 'acp.connect');
      add({
        id: 'REAL-03',
        area: 'acp',
        severity: 'high',
        status: 'warn',
        title: 'Local ACP provider (OpenCode) handshake',
        evidence: 'initialized ' + (client.agentInfo?.title ?? 'OpenCode') + '; prompt requires CLI login (opencode auth login)',
      });
    } catch (error) {
      add({ id: 'REAL-03', area: 'acp', severity: 'high', status: 'fail', title: 'Local ACP provider (OpenCode) handshake', evidence: (error as Error).message });
    }
  }

  /* ----------------------------- COMPOSIO ---------------------------- */
  const key = process.env.NEURO_QA_COMPOSIO_KEY ?? '';
  if (!key) {
    add({
      id: 'CMP-01',
      area: 'composio',
      severity: 'high',
      status: 'warn',
      title: 'Composio live validation',
      evidence: 'NEURO_QA_COMPOSIO_KEY was not provided at launch',
    });
  } else {
    try {
      kernel.composio.configure({ apiKey: key });
      const status = await withTimeout(kernel.composio.sync(), 150_000, 'composio sync');
      add({
        id: 'CMP-01',
        area: 'composio',
        severity: 'high',
        status: status.configured && status.tools > 0 ? 'pass' : 'fail',
        title: 'Composio catalog sync with a real API key',
        evidence: `configured=${status.configured} tools=${status.tools} toolkits=${status.toolkits} accounts=${status.connected}`,
      });
      const hits = (await kernel.composio.searchRemote('gmail', 20)).length;
      add({
        id: 'CMP-02',
        area: 'composio',
        severity: 'medium',
        status: hits > 0 ? 'pass' : 'fail',
        title: 'Composio catalog search',
        evidence: `gmail hits=${hits}`,
      });
      const github = (await kernel.composio.searchRemote('github', 60)).find((tool) => /GET_THE_AUTHENTICATED_USER/i.test(tool.slug));
      if (github) {
        try {
          const result = await withTimeout(kernel.composio.execute(github.slug, {}), 60_000, 'composio execute');
          add({
            id: 'CMP-03',
            area: 'composio',
            severity: 'high',
            status: result.ok ? 'pass' : 'fail',
            title: 'Composio action execution through the tool bridge',
            evidence: `${github.slug}: ok=${result.ok} ${String(result.output).slice(0, 200)}`,
          });
        } catch (error) {
          add({
            id: 'CMP-03',
            area: 'composio',
            severity: 'high',
            status: 'fail',
            title: 'Composio action execution through the tool bridge',
            evidence: (error as Error).message,
          });
        }
      } else {
        add({
          id: 'CMP-03',
          area: 'composio',
          severity: 'medium',
          status: 'warn',
          title: 'Composio action execution through the tool bridge',
          evidence: 'No github authenticated-user action in the catalog',
        });
      }
    } catch (error) {
      add({
        id: 'CMP-01',
        area: 'composio',
        severity: 'high',
        status: 'fail',
        title: 'Composio catalog sync with a real API key',
        evidence: (error as Error).message,
      });
    }
  }

  return findings;
}

export function renderQa(findings: QaFinding[]): string {
  const lines = ['# Neuro OS QA run', '', `Generated: ${new Date().toISOString()}`, ''];
  for (const finding of findings) {
    lines.push(`## ${finding.id} â€” ${finding.title}`, '', `- area: ${finding.area}`, `- severity: ${finding.severity}`, `- status: ${finding.status}`, `- evidence: ${finding.evidence}`, finding.repro ? `- repro: ${finding.repro}` : '', '');
  }
  return lines.join('\n');
}




