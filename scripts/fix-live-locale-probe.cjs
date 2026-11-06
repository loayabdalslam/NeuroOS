const fs = require('fs');

let idx = fs.readFileSync('src/main/index.ts', 'utf8');
const start = idx.indexOf('    if (i === 0) {');
const endMarker = '      await wait(700);\n    }';
const end = idx.indexOf(endMarker, start);
if (start > -1 && end > -1) {
  const endPos = end + endMarker.length;
  const block = `    if (i === 0) {
      const pickLanguage = async (label: string): Promise<string> =>
        win.webContents
          .executeJavaScript(
            \`(() => { const card = [...document.querySelectorAll('.langcard')].find((element) => element.textContent?.includes(\${JSON.stringify(label)})); if (!card) return 'missing'; card.click(); return 'clicked'; })()\`,
          )
          .catch((error) => String(error));
      const pickedArabic = await pickLanguage('العربية');
      await wait(800);
      await screenshot('01c-onboarding-arabic');
      const liveLocale = await win.webContents
        .executeJavaScript(
          \`JSON.stringify({ dir: document.documentElement.dir, lang: document.documentElement.lang, heading: document.querySelector('.onboard__title')?.textContent?.trim() ?? '', next: document.querySelector('.onboard__footRight .n-btn--primary')?.textContent?.trim() ?? '' })\`,
        )
        .catch((error) => String(error));
      log.info('selftest', \`live locale: \${pickedArabic} \${liveLocale}\`);
      await pickLanguage('English');
      await wait(700);
    }`;
  idx = idx.slice(0, start) + block + idx.slice(endPos);
  fs.writeFileSync('src/main/index.ts', idx, 'utf8');
  console.log('live locale probe fixed');
} else {
  console.log('probe block not found');
}

let css = fs.readFileSync('src/renderer/src/styles/story.css', 'utf8');
if (!css.includes('white-space: pre-line;\n  margin: 0;')) {
  css = css.replace('.story__title {\n  margin: 0;', '.story__title {\n  white-space: pre-line;\n  margin: 0;');
  fs.writeFileSync('src/renderer/src/styles/story.css', css, 'utf8');
  console.log('title pre-line');
}
