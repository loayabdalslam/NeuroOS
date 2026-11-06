const fs = require('fs');

// README
let r = fs.readFileSync('README.md', 'utf8');
if (!r.includes('Graph Brain')) {
  r = r.replace(
    '- **Neuro Web (decentralized hosting)**',
    '- **Graph Brain** — a local memory graph records every click, navigation, agent turn, mail, site and tool call, indexes it with Orama for instant recall, and feeds relevant memories into the agent. See [docs/BRAIN.md](docs/BRAIN.md).\n- **Neuro Web (decentralized hosting)**',
  );
  r = r.replace('[Neuro Web](docs/WEB.md) ·', '[Neuro Web](docs/WEB.md) · [Brain](docs/BRAIN.md) ·');
  r = r.replace(
    '- **a second node publishes, resolves and serves a `.neuro` site end to end**',
    '- **the brain records real clicks, recalls them and answers a memory question**\n- **a second node publishes, resolves and serves a `.neuro` site end to end**',
  );
  fs.writeFileSync('README.md', r, 'utf8');
  console.log('readme patched');
} else {
  console.log('readme already');
}

// selftest: tool assertion
let c = fs.readFileSync('src/main/index.ts', 'utf8');
if (!c.includes('brainTool')) {
  c = c.replace('  const brainStats = kernel.brain.stats();', "  const brainTool = await kernel.tools.invoke('brain.recall', { query: 'settings' });\n  const brainStats = kernel.brain.stats();");
  c = c.replace('`brain: nodes=', '`brain tool=${brainTool.status} brain: nodes=');
  fs.writeFileSync('src/main/index.ts', c, 'utf8');
  console.log('brain tool test added');
} else {
  console.log('brain tool test exists');
}
