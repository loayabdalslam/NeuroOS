const fs = require('fs');

const registry = JSON.parse(fs.readFileSync('resources/acp/registry.json', 'utf8'));
const agents = registry.agents ?? [];

const winFor = (agent) => agent.distribution?.binary?.['windows-x86_64'] ?? agent.distribution?.binary?.['windows-aarch64'];

const lines = [];
lines.push('# ACP agents in Neuro OS');
lines.push('');
lines.push('Neuro OS speaks the [Agent Client Protocol](https://agentclientprotocol.com) v1 over stdio. Every agent below can be added from');
lines.push('**Settings → Providers → Add provider → ACP agents**, and from the provider step of onboarding (curated subset).');
lines.push('');
lines.push('Source: the official ACP registry (`https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`), snapshot of ' + new Date().toISOString().slice(0, 10) + '.');
lines.push('The registry is curated by the ACP project and only lists agents that support authentication. Community wrappers are included in the registry too — “official” here means “listed in the registry”, not “first-party”.');
lines.push('');
lines.push('## How a preset launches');
lines.push('');
lines.push('- `npx` agents: `npx -y <package> …` — the package is fetched on first launch and cached by npm.');
lines.push('- `uvx` agents: `uvx <package> …` — requires [uv](https://docs.astral.sh/uv/).');
lines.push('- `binary` agents: download the Windows archive, extract it, and point the command at the executable (the preset carries the archive URL).');
lines.push('- Authentication is handled by the agent itself (`/login`, env vars, or its own config). Neuro never stores agent credentials.');
lines.push('');
lines.push('> **Security:** any ACP agent is a local process with your user privileges. Install only agents you trust, and prefer the registry’s official links. Plugins are separate and still run in an in-process VM (see BUG-001).');
lines.push('');
lines.push('## All registry agents (' + agents.length + ')');
lines.push('');
lines.push('| Agent | Registry id | Distribution | Windows | Repository |');
lines.push('| --- | --- | --- | --- | --- |');
for (const agent of agents) {
  const d = agent.distribution ?? {};
  let dist = 'unknown';
  let install = '';
  let win = '—';
  if (d.npx) {
    dist = 'npx';
    install = `npx -y ${d.npx.package}`;
    win = 'npx';
  } else if (d.uvx) {
    dist = 'uvx';
    install = `uvx ${d.uvx.package}`;
    win = 'uv';
  } else if (d.binary) {
    dist = 'binary';
    const w = winFor(agent);
    win = w ? w.cmd : 'no build';
    install = w ? w.archive : '';
  }
  const repo = agent.repository ? `[${agent.repository.replace('https://github.com/', '')}](${agent.repository})` : '—';
  lines.push(`| ${agent.name} | \`${agent.id}\` | ${dist}${install ? `: \`${install}\`` : ''} | ${win} | ${repo} |`);
}
lines.push('');
lines.push('## Curated in onboarding');
lines.push('');
lines.push('`acp-claude-acp`, `acp-codex-acp`, `acp-gemini`, `acp-opencode`, `acp-qwen-code`, `acp-goose`, `acp-cursor`, `acp-github-copilot-cli`.');
lines.push('');
lines.push('## Notes and known gaps');
lines.push('');
lines.push('- **Codex** uses the registry’s `@agentclientprotocol/codex-acp` adapter (Codex CLI itself has no `acp` subcommand). The adapter looks for the `codex` binary on `PATH`; this machine keeps it under `%LOCALAPPDATA%\\OpenAI\\Codex\\bin\\…`, so add that folder to the provider environment or PATH.');
lines.push('- **Gemini CLI** is the registry npx package; Google’s own CLI also exposes `--experimental-acp`.');
lines.push('- **OpenCode** ships `opencode acp` natively; the preset uses the binary command and expects it on `PATH`.');
lines.push('- **DeepSeek Harness** is not in the registry and has no ACP mode; its headless CLI needs `DEEPSEEK_API_KEY`.');
lines.push('- **Antigravity** is listed with a downloadable `agy_acp_server` binary; the IDE itself is not the ACP server.');
lines.push('- Binary presets cannot be verified until downloaded; the provider will report a spawn error with the exact command.');
lines.push('');
lines.push('## Testing status (this machine)');
lines.push('');
lines.push('| Check | Result |');
lines.push('| --- | --- |');
lines.push('| Mock ACP agent (initialize → session → streamed prompt) | PASS |');
lines.push('| OpenCode `opencode acp` initialize | PASS (v1.18.33) |');
lines.push('| OpenCode prompt | blocked: 0 credentials, free model requires login |');
lines.push('| Codex adapter package | resolves on npm; not launched here (Codex binary not on PATH) |');
lines.push('| Gemini / Qwen / Goose / Cursor / Copilot | preset added from registry; not installed on this machine |');
lines.push('| Antigravity | binary preset added; not downloaded |');
lines.push('');

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/ACP.md', lines.join('\n'), 'utf8');
console.log('docs/ACP.md written', agents.length, 'agents');
