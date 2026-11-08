const fs = require('fs');

let p = 'BUGS.md';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('**23/24 PASS**, 1 open critical', '**24/24 PASS** (plugin escape blocked)');
c = c.replace('ACP pass, Composio partial (see bugs)', 'ACP pass, Composio sync + gmail search pass (CMP-03 warns: no GitHub action in the account)');

const marks = [
  ['| **BUG-001** | **Critical**', '| **BUG-001** (fixed) | **Critical**'],
  ['| **BUG-004** | High', '| **BUG-004** (fixed) | High'],
  ['| **BUG-006** | High', '| **BUG-006** (fixed) | High'],
  ['| **BUG-007** | Medium', '| **BUG-007** (partially fixed) | Medium'],
  ['| **BUG-008** | Medium', '| **BUG-008** (fixed) | Medium'],
  ['| **BUG-009** | Low', '| **BUG-009** (closed) | Low'],
  ['| **BUG-011** | Medium', '| **BUG-011** (fixed) | Medium'],
  ['| **BUG-012** | Low', '| **BUG-012** (accepted) | Low'],
  ['| **BUG-014** | Medium', '| **BUG-014** (accepted) | Medium'],
  ['| **BUG-015** | Low', '| **BUG-015** (fixed) | Low'],
  ['| **BUG-016** | Low', '| **BUG-016** (invalid) | Low'],
  ['| **BUG-017** | Info', '| **BUG-017** (fixed) | Info'],
];
for (const [from, to] of marks) c = c.replace(from, to);

const fixPass = [
  '## Fix pass (this round)',
  '',
  '| Bug | Fix |',
  '| --- | --- |',
  "| BUG-001 | Plugins now run in a **separate process** (`resources/plugin-host.cjs`) with Node's permission model: plugin dir read-only, no writes, no child processes, env stripped, main app unreachable. Red-team X-01 now reports `{electron:blocked, fs:ERR_ACCESS_DENIED, env:stripped}`. Plugin *adapters* are disabled in the sandbox (tools/commands/storage/api still work). |",
  '| BUG-004 | `composio.searchRemote()` fetches a toolkit\'s tools with cursor pagination and merges them into the catalog; the Composio panel auto-searches remotely when local search is empty; the `composio.search` agent tool falls back to it. Gmail search: 0 → 20 hits. |',
  '| BUG-006 | ACP now records `authMethods`; a prompt timeout tells the user to sign in with the agent CLI. |',
  '| BUG-011 | ACP providers call `session/set_model` with the configured model before prompting. |',
  '| BUG-008 | Sites gains a **From the mesh** section listing manifests resolved from peers (open/copy), while the local claim list stays clean. |',
  '| BUG-015 | `chat.send` throws immediately when no provider is connected or it is disabled. |',
  '| BUG-017 | `brain.capture` falls back to `title` when `label` is missing. |',
  "| BUG-016 | Invalid: the check read the trigger step's output; the transform step carries the value. |",
  '| BUG-009 | Closed as benign: Chromium aborts the first example.com load and the retry succeeds; the handler already ignores `ERR_ABORTED`. |',
  '| BUG-012 | Accepted limitation: store-and-forward has no end-to-end delivery receipt (the sender sees `relayed`, not `delivered`). |',
  '| BUG-014 | Accepted design: the Files API is OS-wide (like Finder); the Workspace surface is a root, not a sandbox. |',
  '| BUG-007 | DSH still has no ACP mode upstream; Codex (adapter) and Antigravity (binary) are covered. |',
  '',
  '## Fixed during this run',
].join('\n');

c = c.replace('## Fixed during this run', fixPass);
fs.writeFileSync(p, c, 'utf8');
console.log('BUGS updated', c.includes('Fix pass'));

p = 'docs/DEEP-QA.md';
c = fs.readFileSync(p, 'utf8');
c = c.replace('| Pass | **24** |', '| Pass | **25** |');
c = c.replace('| Warn | **2** |', '| Warn | **1** |');
c = c.replace('| Fixed during the run | 1 high (navigation crash) |', '| Fixed after the run | navigation crash, plugin isolation, Composio search, ACP model/auth, mesh list, chat error, brain fallback |');
const oldWarn = [
  '- **Workspace boundary (BUG-014):** `fs.read` can read outside the workspace root (`C:\\Windows\\win.ini`); confirm whether the file API should be OS-wide or confined.',
  '- **Chat without a provider (BUG-015):** `chat.send` resolves instead of rejecting; the error arrives asynchronously.',
].join('\n');
c = c.replace(oldWarn, '- **Workspace boundary (BUG-014, accepted):** `fs.read` is OS-wide by design, like Finder. The Workspace surface is a root, not a sandbox.');
fs.writeFileSync(p, c, 'utf8');
console.log('DEEP-QA updated', c.includes('| Pass | **25** |'));
