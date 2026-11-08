const fs = require('fs');
const p = 'src/main/qa.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  `  const groqProbe = await probe(
    'groq',
    realProviders.find((item) => item.id === 'groq')?.defaultModel,
    'GROQ_OK',
  );`,
  `  let groqProbe: { status: 'pass' | 'fail' | 'warn'; evidence: string };
  try {
    groqProbe = await probe('groq', realProviders.find((item) => item.id === 'groq')?.defaultModel, 'GROQ_OK');
  } catch (error) {
    groqProbe = { status: 'fail', evidence: (error as Error).message };
  }`,
);

c = c.replace(
  `  const ollamaProbe = await probe(
    'ollama',
    realProviders.find((item) => item.id === 'ollama')?.models[0]?.id,
    'OLLAMA_REAL_OK',
  );`,
  `  let ollamaProbe: { status: 'pass' | 'fail' | 'warn'; evidence: string };
  try {
    ollamaProbe = await probe('ollama', realProviders.find((item) => item.id === 'ollama')?.models[0]?.id, 'OLLAMA_REAL_OK');
  } catch (error) {
    ollamaProbe = { status: 'fail', evidence: (error as Error).message };
  }`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('real probes guarded', c.includes('let groqProbe'), c.includes('let ollamaProbe'));
