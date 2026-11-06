const fs = require('fs');
const p = 'src/shared/providers.ts';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('brand: string;')) c = c.replace('  color: string;', '  color: string;\n  brand: string;');
const map = {
  deepseek: 'deepseek',
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'googlegemini',
  ollama: 'ollama',
  openrouter: 'openrouter',
  xai: 'x',
  groq: 'groq',
  mistral: 'mistralai',
  qwen: 'alibabacloud',
  together: 'together',
  lmstudio: 'lmstudio',
  acp: 'bot',
  custom: 'plug',
};
for (const [id, brand] of Object.entries(map)) {
  const re = new RegExp(`(id: '${id}',)(\\s*\\n\\s*name:)`);
  if (re.test(c)) {
    c = c.replace(re, `$1\n    brand: '${brand}',$2`);
  } else {
    console.log('no match', id);
  }
}
fs.writeFileSync(p, c, 'utf8');
console.log('providers patched');
