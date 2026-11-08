const fs = require('fs');

let raw = fs.readFileSync('package.json', 'utf8').replace(/^\uFEFF/, '');
const pkg = JSON.parse(raw);
pkg.description = 'Neuro OS — an AI-native desktop operating environment built on the DeepSeek Harness design language.';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Packaging & fullscreen')) {
  b += [
    '',
    '## Packaging & fullscreen',
    '',
    '| Feature | Behaviour |',
    '| --- | --- |',
    '| GitHub Actions | `.github/workflows/build.yml` builds Windows (NSIS + portable) and Linux (AppImage, deb, rpm) on manual dispatch or a `v*` tag, uploads artifacts and publishes a GitHub Release on tags. Linux installs `rpm`/`libarchive-tools`; code signing is disabled for CI. |',
    '| Linux targets | `package.json` now declares `linux.target = AppImage, deb, rpm` with the 512×512 brand icon and `npm run dist:linux`. |',
    '| Fullscreen | **F11** toggles fullscreen in the main window, **Escape** exits; `window.toggleFullscreen` IPC is available and `window:state` broadcasts `fullscreen`. D-41 verifies enter/leave. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
let d = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
d = d.replace('| Checks | **39** |', '| Checks | **40** |').replace('| Pass | **37** |', '| Pass | **38** |');
fs.writeFileSync('docs/DEEP-QA.md', d, 'utf8');
console.log('packaging docs updated');
