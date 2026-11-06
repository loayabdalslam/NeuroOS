const fs = require('fs');

const dup = "import { useT } from '../lib/i18n';\nimport { useT } from '../lib/i18n';";
for (const file of [
  'src/renderer/src/onboarding/StoryIntro.tsx',
  'src/renderer/src/onboarding/WelcomeMotion.tsx',
  'src/renderer/src/surfaces/Brain.tsx',
  'src/renderer/src/surfaces/Sites.tsx',
  'src/renderer/src/surfaces/ComposioPanel.tsx',
]) {
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes(dup)) c = c.replace(dup, "import { useT } from '../lib/i18n';");
  fs.writeFileSync(file, c, 'utf8');
}

let w = fs.readFileSync('src/renderer/src/onboarding/WelcomeMotion.tsx', 'utf8');
w = w.replace(
  "const TRAITS = ['local-first', 'bring your own model', 'keychain secrets', 'offline memory', 'signed plugins'];",
  "const TRAITS = ['welcome.t1', 'welcome.t2', 'welcome.t3', 'welcome.t4', 'welcome.t5'];",
);
w = w.replace(
  "const CAPS = [\n  { icon: 'message', label: 'agents' },\n  { icon: 'wrench', label: 'tools' },\n  { icon: 'mail', label: 'p2p mail' },\n  { icon: 'network', label: 'neuro web' },\n  { icon: 'brain', label: 'memory' },\n  { icon: 'plug', label: 'composio' },\n];",
  "const CAPS = [\n  { icon: 'message', key: 'welcome.c1' },\n  { icon: 'wrench', key: 'welcome.c2' },\n  { icon: 'mail', key: 'welcome.c3' },\n  { icon: 'network', key: 'welcome.c4' },\n  { icon: 'brain', key: 'welcome.c5' },\n  { icon: 'plug', key: 'welcome.c6' },\n];",
);
w = w.replace('<Icon name="check" size={10} /> {trait}', '<Icon name="check" size={10} /> {t(trait)}');
w = w.replace(
  "          <span key={cap.label} className=\"wmCap\">\n            <Icon name={cap.icon} size={11} /> {cap.key === 'c2' ? `${tools || 50} ${t('welcome.c2')}` : t(`welcome.${cap.key}`)}\n          </span>",
  "          <span key={cap.key} className=\"wmCap\">\n            <Icon name={cap.icon} size={11} /> {cap.key === 'welcome.c2' ? `${tools || 50} ${t('welcome.c2')}` : t(cap.key)}\n          </span>",
);
fs.writeFileSync('src/renderer/src/onboarding/WelcomeMotion.tsx', w, 'utf8');

let b = fs.readFileSync('src/renderer/src/surfaces/Brain.tsx', 'utf8');
b = b.replace('Wipe\n        </Button>', "{t('brain.wipe')}\n        </Button>");
b = b.replace('>\n            Wipe\n', ">\n            {t('brain.wipe')}\n");
fs.writeFileSync('src/renderer/src/surfaces/Brain.tsx', b, 'utf8');
console.log('cleanup done');

// show remaining raw Wipe for debugging
const m = b.match(/Wipe/g);
console.log('remaining raw Wipe occurrences:', m ? m.length : 0);
