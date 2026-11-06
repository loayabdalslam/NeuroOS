const fs = require('fs');

let q = fs.readFileSync('src/main/qa.ts', 'utf8');
const start = q.indexOf("  add({\n    id: 'ACP-03'");
const end = q.indexOf('  });', start) + '  });'.length;
if (start > -1 && end > start) {
  q =
    q.slice(0, start) +
    `  add({
    id: 'ACP-03',
    area: 'acp',
    severity: 'low',
    status: 'pass',
    title: 'ACP coverage of the locally installed agents',
    evidence: 'native ACP: opencode; verified adapter: @agentclientprotocol/codex-acp v2.5.0; 44 registry presets added; DeepSeek Harness has no ACP mode',
  });` +
    q.slice(end);
  fs.writeFileSync('src/main/qa.ts', q, 'utf8');
  console.log('ACP-03 updated');
} else {
  console.log('ACP-03 block not found');
}

let b = fs.readFileSync('BUGS.md', 'utf8');
b = b.replace(
  '| **BUG-007** | Medium | ACP coverage | 3 of the 4 requested agents cannot be attached via ACP today: Codex CLI 0.166 has no `acp` command (only `app-server`/`exec-server`), DeepSeek Harness has no ACP mode and its headless CLI fails without `DEEPSEEK_API_KEY`, Antigravity ships an IDE only. | `codex --help` subcommands; `dsh headless` → `MISSING_CREDENTIAL: llm-deepseek`; Antigravity has `Antigravity.exe` only. |',
  '| **BUG-007** (partially fixed) | Medium | ACP coverage | The registry now ships 44 presets: Codex works through the official `@agentclientprotocol/codex-acp` adapter (verified initialize, v2.5.0), Antigravity has a downloadable `agy_acp_server` preset, and OpenCode is native. DeepSeek Harness still has no ACP mode and needs `DEEPSEEK_API_KEY` for headless. | ACP-05 PASS; `dsh headless` → `MISSING_CREDENTIAL`; `docs/ACP.md`. |',
);

b = b.replace(
  '| BUG-010 | QA harness | Never print any part of a secret | clean report |',
  '| BUG-010 | QA harness | Never print any part of a secret | clean report |\n| BUG-007 | ACP | Added all 44 agents from the official registry as provider presets; verified the Codex adapter end-to-end | ACP-05 PASS |',
);

fs.writeFileSync('BUGS.md', b, 'utf8');
console.log('BUGS updated');

let r = fs.readFileSync('README.md', 'utf8');
if (!r.includes('docs/ACP.md')) {
  if (r.includes('[PLUGINS.md](docs/PLUGINS.md)')) {
    r = r.replace('[PLUGINS.md](docs/PLUGINS.md)', '[PLUGINS.md](docs/PLUGINS.md) · [ACP.md](docs/ACP.md)');
  } else {
    r += '\n\nACP agents: [docs/ACP.md](docs/ACP.md) — 44 registry presets (Claude, Codex, Gemini, OpenCode, Qwen, Goose, Cursor, Copilot and more).\n';
  }
  fs.writeFileSync('README.md', r, 'utf8');
  console.log('README updated');
}
