const fs = require('fs');

let o = fs.readFileSync('src/renderer/src/onboarding/Onboarding.tsx', 'utf8');
if (!o.includes('WelcomeTicker')) {
  o = o.replace(
    "import { Button, Spinner } from '../components/ui';",
    "import { Button, Spinner } from '../components/ui';\nimport { WelcomeTicker, WelcomePanel } from './WelcomeMotion';",
  );

  const factsStart = o.indexOf("          {step === 'welcome' ? (\n            <div className=\"onboard__facts\">");
  const factsEnd = o.indexOf('          ) : null}', factsStart);
  if (factsStart > -1 && factsEnd > -1) {
    const end = factsEnd + '          ) : null}'.length;
    o = o.slice(0, factsStart) + "          {step === 'welcome' ? <WelcomeTicker /> : null}" + o.slice(end);
    console.log('facts replaced');
  } else {
    console.log('facts block not found');
  }

  const cardStart = o.indexOf("          {step === 'welcome' ? (\n            <div className=\"onboard__welcomeCard\">");
  const cardEnd = o.indexOf('          ) : null}', cardStart);
  if (cardStart > -1 && cardEnd > -1) {
    const end = cardEnd + '          ) : null}'.length;
    o = o.slice(0, cardStart) + "          {step === 'welcome' ? <WelcomePanel /> : null}" + o.slice(end);
    console.log('welcome card replaced');
  } else {
    console.log('welcome card block not found');
  }

  fs.writeFileSync('src/renderer/src/onboarding/Onboarding.tsx', o, 'utf8');
} else {
  console.log('already patched');
}

let m = fs.readFileSync('src/renderer/src/main.tsx', 'utf8');
if (!m.includes('welcome-motion.css')) {
  m = m.replace("import './styles/story.css';", "import './styles/story.css';\nimport './styles/welcome-motion.css';");
  fs.writeFileSync('src/renderer/src/main.tsx', m, 'utf8');
  console.log('css imported');
}
