const fs = require('fs');
let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Model selection pass')) {
  b += [
    '',
    '## Model selection pass',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| Choosing a model could appear to do nothing: the click only patched an existing session, the dialog was filtered to tool-capable models, and a session with an empty model still showed “no model”. | The picker falls back to all provider models, creates a session if none exists, patches the session directly and updates the store, offers Refresh models (discoverModels + save), and the header/pill fall back to the provider default model. Verified by D-34 (fallback list) and D-35 (pill “Pick Me”, header pick-me). |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
let d = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
d = d.replace('| Checks | **34** |', '| Checks | **35** |').replace('| Pass | **32** |', '| Pass | **33** |');
fs.writeFileSync('docs/DEEP-QA.md', d, 'utf8');
console.log('docs updated');
