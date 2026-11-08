const fs = require('fs');
const p = 'src/main/qa.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "  await check('OLL-01', 'chat', 'Ollama chat round-trip (tools fallback)', async () => {",
  "  let ollStatus: 'pass' | 'fail' = 'fail';\n  let ollEvidence = '';\n  try {",
);
c = c.replace(
  "      return { evidence: 'first ' + first + 'ms, total ' + (Date.now() - started) + 'ms, \"' + transcript.slice(0, 60) + '\"' };",
  "      ollStatus = 'pass';\n      ollEvidence = 'first ' + first + 'ms, total ' + (Date.now() - started) + 'ms, \"' + transcript.slice(0, 60) + '\"';",
);
c = c.replace(
  "    } finally {\n      kernel.settings.removeProvider('qa-ollama');\n    }\n  });",
  "    } finally {\n      kernel.settings.removeProvider('qa-ollama');\n    }\n  } catch (error) {\n    ollEvidence = (error as Error).message;\n  }\n  add({ id: 'OLL-01', area: 'chat', severity: 'high', status: ollStatus, title: 'Ollama chat round-trip (tools fallback)', evidence: ollEvidence });",
);
fs.writeFileSync(p, c, 'utf8');
console.log('OLL-01 converted', c.includes("let ollStatus"), !c.includes("await check('OLL-01'"));
