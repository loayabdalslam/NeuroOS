const fs = require('fs');
const p = 'src/renderer/src/surfaces/Settings.tsx';
let c = fs.readFileSync(p, 'utf8');

const start = c.indexOf('function ProviderModal({');
const endMarker = '\nfunction AgentModal(';
const end = c.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('ProviderModal range not found');
let block = c.slice(start, end);

block = block.replace(
  '  if (!open) return null;\n  if (step === \'configure\' && !draft) return null;',
  '  if (!open) return null;\n  if (step === \'configure\' && !draft) return null;\n  const model = (draft ?? presetToProvider(PROVIDER_PRESETS[0])) as ProviderConfig;',
);
block = block.replace(/\bdraft\./g, 'model.');
block = block.replace(/\.\.\.draft\b/g, '...model');
block = block.replace("invoke('providers.probeDraft', draft)", "invoke('providers.probeDraft', model)");

c = c.slice(0, start) + block + c.slice(end);
fs.writeFileSync(p, c, 'utf8');
console.log('provider modal nullable fixed');
