const fs = require('fs');

// 1. asset protocol must keep the hostname (wallpapers/…)
let m = fs.readFileSync('src/main/index.ts', 'utf8');
const oldRel = "const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\\/+/, '');";
if (m.includes(oldRel)) {
  m = m.replace(
    oldRel,
    "const parsed = new URL(request.url);\n      const rel = decodeURIComponent(parsed.hostname + parsed.pathname).replace(/^\\/+/, '');",
  );
  fs.writeFileSync('src/main/index.ts', m, 'utf8');
  console.log('protocol fixed');
} else {
  console.log('protocol already patched', m.includes('parsed.hostname'));
}

// 2. story fit + pacing
let s = fs.readFileSync('src/renderer/src/onboarding/StoryIntro.tsx', 'utf8');
s = s.replace('const availableH = height - padding * 2;', 'const availableH = height - padding * 3.1;');
s = s.replace('Math.max(current, 2)), 3400)', 'Math.max(current, 2)), 3000)');
s = s.replace('    }, 20);', '    }, 18);');
fs.writeFileSync('src/renderer/src/onboarding/StoryIntro.tsx', s, 'utf8');

// 3. quote/date css
let c = fs.readFileSync('src/renderer/src/styles/story.css', 'utf8');
if (!c.includes('.story__quote { overflow: visible')) {
  c += `\n.story__quote { overflow: visible; max-height: none; }\n.story__date { left: 2%; bottom: -34px; }\n`;
  fs.writeFileSync('src/renderer/src/styles/story.css', c, 'utf8');
}

// 4. probe quote length inside the selftest
let idx = fs.readFileSync('src/main/index.ts', 'utf8');
if (!idx.includes('story quote')) {
  const anchor = "  const storySkip = await win.webContents\n";
  const probe = `  const storyQuote = await win.webContents
    .executeJavaScript(
      \`JSON.stringify({ chars: document.querySelector('.story__quote')?.textContent?.trim().length ?? 0, scroll: document.querySelector('.story__quote')?.scrollHeight ?? 0, client: document.querySelector('.story__quote')?.clientHeight ?? 0, persona: document.querySelector('.story__name')?.textContent?.trim() ?? '' })\`,
    )
    .catch((error) => String(error));
  log.info('selftest', \`story quote \${storyQuote}\`);
${anchor}`;
  if (idx.includes(anchor)) {
    idx = idx.replace(anchor, probe);
    fs.writeFileSync('src/main/index.ts', idx, 'utf8');
    console.log('probe added');
  } else {
    console.log('probe anchor missing');
  }
}
