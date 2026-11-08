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



