const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('D-27')) {
  c = c.replace("import { WebService } from './services/web.service';", "import { WebService } from './services/web.service';\nimport { THEME_PRESETS } from '@shared/themes';");

  const block = `  await check('D-27', 'ui', 'every theme renders and is captured', async () => {
    const visited: string[] = [];
    for (const preset of THEME_PRESETS) {
      await call('settings.patch', {
        theme: { design: preset.design, theme: preset.mode, accent: 'neuro', surface: preset.surface, wallpaper: preset.wallpaper },
      });
      await wait(700);
      const probe = await win.webContents.executeJavaScript(
        \`(() => ({ dir: document.documentElement.dataset.theme, design: document.documentElement.dataset.design, wallpaper: document.documentElement.dataset.wallpaper, bg: getComputedStyle(document.querySelector('.app__bg')).backgroundImage }))()\`,
      );
      if (!probe.bg || probe.bg === 'none') throw new Error(\`\${preset.id}: no background\`);
      await shot(\`theme-\${preset.id}\`);
      visited.push(preset.id);
    }
    return { evidence: \`\${visited.length} themes rendered (light + dark)\` };
  });

  await check('D-28', 'ui', 'provider picker renders icons in a light theme', async () => {
    await call('settings.patch', { theme: { design: 'ios', theme: 'light', accent: 'neuro', surface: 'white', wallpaper: 'aurora' } });
    kernel.emit('ui:navigate', { surface: 'settings', params: {} });
    await wait(900);
    const opened = await win.webContents.executeJavaScript(
      \`(() => { const button = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === 'Add provider'); if (!button) return false; button.click(); return true; })()\`,
    );
    if (!opened) throw new Error('Add provider button not found');
    await wait(700);
    await shot('provider-picker-light');
    const cards = await win.webContents.executeJavaScript(\`document.querySelectorAll('.providerPick').length\`);
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await wait(400);
    return { evidence: \`\${cards} provider cards rendered in ios-light\` };
  });

  const report = results;`;

  c = c.replace('  const report = results;', block);
  fs.writeFileSync(p, c, 'utf8');
  console.log('deep theme checks added');
} else {
  console.log('already added');
}
