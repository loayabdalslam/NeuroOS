const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const registry = JSON.parse(fs.readFileSync('resources/acp/registry.json', 'utf8'));
const agents = registry.agents ?? [];

const colors = ['#14b8a6', '#5686fe', '#a78bfa', '#f59e0b', '#ec4899', '#22c55e', '#f472b6', '#38bdf8', '#fb7185', '#eab308'];
const colorFor = (id) => colors[parseInt(crypto.createHash('sha1').update(id).digest('hex').slice(0, 4), 16) % colors.length];

const shellQuote = (value) => (/[\s"]/g.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);

const presets = agents.map((agent) => {
  const distribution = agent.distribution ?? {};
  let command = '';
  let args = [];
  let install = '';
  let installKind = '';
  let note = '';

  if (agent.id === 'opencode' || agent.id === 'opencode-v2') {
    command = 'opencode';
    args = ['acp'];
    install = 'npm i -g opencode-ai';
    installKind = 'npm';
  } else if (distribution.npx) {
    const pkg = distribution.npx.package ?? '';
    command = 'npx';
    args = ['-y', pkg, ...(distribution.npx.args ?? [])];
    install = `npx -y ${pkg}`;
    installKind = 'npx';
  } else if (distribution.uvx) {
    const pkg = distribution.uvx.package ?? '';
    command = 'uvx';
    args = [pkg, ...(distribution.uvx.args ?? [])];
    install = `uvx ${pkg}`;
    installKind = 'uvx';
  } else if (distribution.binary) {
    const win = distribution.binary['windows-x86_64'] ?? distribution.binary['windows-aarch64'];
    if (win) {
      command = win.cmd ?? '';
      args = win.args ?? [];
      install = win.archive ?? '';
      installKind = 'binary';
      note = 'Download the Windows archive, extract it, and point the command at the executable.';
    } else {
      install = 'No Windows build published in the registry.';
      installKind = 'unsupported';
    }
  }

  const website = agent.website ?? agent.repository ?? 'https://agentclientprotocol.com';
  return {
    id: `acp-${agent.id}`,
    name: agent.name,
    kind: 'acp',
    baseUrl: '',
    color: colorFor(agent.id),
    brand: 'bot',
    keyHint: 'no API key â€” sign in with the CLI',
    docs: website,
    description: String(agent.description ?? '').replace(/\\s+/g, ' ').slice(0, 160),
    badge: 'ACP',
    official: true,
    source: agent.repository ?? '',
    install,
    installKind,
    acp: { command, args },
    models: [{ id: 'acp:auto', label: 'Agent default', supportsTools: true }],
    note,
  };
});

const lines = [];
lines.push('/**');
lines.push(' * Generated from the official ACP registry (https://agentclientprotocol.com/get-started/registry)');
lines.push(' * by scripts/generate-acp-presets.cjs. Do not edit by hand.');
lines.push(' *');
lines.push(` * Registry snapshot: ${agents.length} agents.`);
lines.push(' */');
lines.push("import type { ProviderPreset } from './providers';");
lines.push('');
lines.push('export const ACP_PRESETS: ProviderPreset[] = [');
for (const preset of presets) {
  lines.push('  {');
  lines.push(`    id: ${JSON.stringify(preset.id)},`);
  lines.push(`    name: ${JSON.stringify(preset.name)},`);
  lines.push("    kind: 'acp',");
  lines.push("    baseUrl: '',");
  lines.push(`    color: ${JSON.stringify(preset.color)},`);
  lines.push("    brand: 'bot',");
  lines.push(`    keyHint: ${JSON.stringify(preset.keyHint)},`);
  lines.push(`    docs: ${JSON.stringify(preset.docs)},`);
  lines.push(`    description: ${JSON.stringify(preset.description)},`);
  lines.push("    badge: 'ACP',");
  lines.push('    official: true,');
  lines.push(`    source: ${JSON.stringify(preset.source)},`);
  lines.push(`    install: ${JSON.stringify(preset.install)},`);
  lines.push(`    installKind: ${JSON.stringify(preset.installKind)},`);
  if (preset.note) lines.push(`    note: ${JSON.stringify(preset.note)},`);
  lines.push(`    acp: { command: ${JSON.stringify(preset.acp.command)}, args: ${JSON.stringify(preset.acp.args)} },`);
  lines.push("    models: [{ id: 'acp:auto', label: 'Agent default', supportsTools: true }],");
  lines.push('  },');
}
lines.push('];');
lines.push('');
lines.push('export const ACP_CURATED_IDS = [');
lines.push("  'acp-claude-acp', 'acp-codex-acp', 'acp-gemini', 'acp-opencode', 'acp-qwen-code', 'acp-goose', 'acp-cursor', 'acp-github-copilot-cli',");
lines.push('];');
lines.push('');
lines.push('export const ACP_CURATED = ACP_PRESETS.filter((preset) => ACP_CURATED_IDS.includes(preset.id));');
lines.push('');

fs.mkdirSync('src/shared', { recursive: true });
fs.writeFileSync('src/shared/acpPresets.ts', lines.join('\n'), 'utf8');
console.log(`generated ${presets.length} presets`);
console.log(presets.slice(0, 3).map((p) => `${p.id} â†’ ${p.acp.command} ${p.acp.args.join(' ')}`).join('\n'));
console.log(presets.find((p) => p.id === 'acp-codex-acp'));
console.log(presets.find((p) => p.id === 'acp-opencode'));
void shellQuote;
void path;

