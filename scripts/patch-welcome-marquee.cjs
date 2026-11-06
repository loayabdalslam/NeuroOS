const fs = require('fs');

let w = fs.readFileSync('src/renderer/src/onboarding/WelcomeMotion.tsx', 'utf8');

// dynamic tool count in the capability chips
w = w.replace(
  "const CAPS = [\n  { icon: 'message', label: 'agents' },\n  { icon: 'wrench', label: '50 tools' },\n  { icon: 'mail', label: 'p2p mail' },\n  { icon: 'network', label: 'neuro web' },\n  { icon: 'brain', label: 'memory' },\n  { icon: 'plug', label: 'composio' },\n];",
  "const CAPS = [\n  { icon: 'message', label: 'agents' },\n  { icon: 'wrench', label: 'tools' },\n  { icon: 'mail', label: 'p2p mail' },\n  { icon: 'network', label: 'neuro web' },\n  { icon: 'brain', label: 'memory' },\n  { icon: 'plug', label: 'composio' },\n];",
);
w = w.replace(
  "        {CAPS.map((cap) => (\n          <span key={cap.label} className=\"wmCap\">\n            <Icon name={cap.icon} size={11} /> {cap.label}\n          </span>\n        ))}",
  "        {CAPS.map((cap) => (\n          <span key={cap.label} className=\"wmCap\">\n            <Icon name={cap.icon} size={11} /> {cap.label === 'tools' ? `${tools || 50} tools` : cap.label}\n          </span>\n        ))}",
);

// marquee of every feature name
if (!w.includes('wmMarquee')) {
  w = w.replace(
    "      <div className=\"wmTicker__traits\">\n        {TRAITS.map((trait) => (\n          <span key={trait} className=\"wmTicker__trait\">\n            <Icon name=\"check\" size={10} /> {trait}\n          </span>\n        ))}\n      </div>",
    `      <div className="wmTicker__traits">
        {TRAITS.map((trait) => (
          <span key={trait} className="wmTicker__trait">
            <Icon name="check" size={10} /> {trait}
          </span>
        ))}
      </div>
      <div className="wmMarquee" aria-hidden>
        <div className="wmMarquee__track">
          {[0, 1].map((copy) => (
            <span key={copy} className="wmMarquee__group">
              {[...OS_APPS.map((app) => app.name), 'p2p mail', 'neuro web', 'graph brain', 'automation', 'composio', 'plugins', 'themes', '14 languages', 'approvals', 'ACP'].map(
                (label) => (
                  <span key={\`\${copy}-\${label}\`} className="wmMarquee__item">
                    <i />
                    {label}
                  </span>
                ),
              )}
            </span>
          ))}
        </div>
      </div>`,
  );
  fs.writeFileSync('src/renderer/src/onboarding/WelcomeMotion.tsx', w, 'utf8');
  console.log('marquee added');
} else {
  fs.writeFileSync('src/renderer/src/onboarding/WelcomeMotion.tsx', w, 'utf8');
  console.log('marquee exists');
}

let c = fs.readFileSync('src/renderer/src/styles/welcome-motion.css', 'utf8');
if (!c.includes('.wmMarquee')) {
  c += `
/* all-features ribbon */
.wmMarquee {
  position: relative;
  overflow: hidden;
  margin-top: 4px;
  padding: 2px 0;
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
}
.wmMarquee__track {
  display: flex;
  width: max-content;
  animation: wm-marquee 42s linear infinite;
}
.wmMarquee__group {
  display: flex;
  gap: 14px;
  padding-right: 14px;
}
.wmMarquee__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 9.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--n-text-4);
  white-space: nowrap;
}
.wmMarquee__item i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--n-accent);
  opacity: 0.7;
}
@keyframes wm-marquee {
  to { transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .wmMarquee__track { animation: none; flex-wrap: wrap; }
}
`;
  fs.writeFileSync('src/renderer/src/styles/welcome-motion.css', c, 'utf8');
  console.log('marquee css added');
}
