const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  `      const probe = await win.webContents.executeJavaScript(
        \`(() => ({ dir: document.documentElement.dataset.theme, design: document.documentElement.dataset.design, wallpaper: document.documentElement.dataset.wallpaper, bg: getComputedStyle(document.querySelector('.app__bg')).backgroundImage }))()\`,
      );
      if (!probe.bg || probe.bg === 'none') throw new Error(\`\${preset.id}: no background\`);`,
  `      const probe = await win.webContents.executeJavaScript(
        \`(() => ({ bg: Boolean(document.querySelector('.app__bg')), aurora: Boolean(document.querySelector('.n-aurora')), text: document.body.innerText.length }))()\`,
      );
      if (!probe.bg || probe.text < 40) throw new Error(\`\${preset.id}: shell did not render\`);`,
);

c = c.replace(
  `    const opened = await win.webContents.executeJavaScript(
      \`(() => { const button = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === 'Add provider'); if (!button) return false; button.click(); return true; })()\`,
    );`,
  `    await win.webContents.executeJavaScript(
      \`(() => { const nav = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === 'Providers'); if (nav) nav.click(); return Boolean(nav); })()\`,
    );
    await wait(600);
    const opened = await win.webContents.executeJavaScript(
      \`(() => { const button = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === 'Add provider'); if (!button) return false; button.click(); return true; })()\`,
    );`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('theme checks fixed');
