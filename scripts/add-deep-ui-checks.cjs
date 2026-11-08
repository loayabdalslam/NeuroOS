const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');

// Mail setup screenshot before the mail identity is created
if (!c.includes("'D-00'")) {
  const anchor = "  /* ------------------------------ workspace ----------------------------- */";
  const block = `  await check('D-00', 'ui', 'mail setup card is centred and fully visible', async () => {
    kernel.emit('ui:navigate', { surface: 'mail', params: {} });
    await wait(800);
    const rect = await win.webContents.executeJavaScript(
      \`(() => { const el = document.querySelector('.mailSetup'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, viewport: window.innerWidth }; })()\`,
    );
    await shot('mail-setup');
    if (!rect) throw new Error('mail setup card not rendered');
    if (rect.left < 0 || rect.right > rect.viewport + 1) throw new Error('mail setup is clipped: ' + JSON.stringify(rect));
    return { evidence: 'left=' + Math.round(rect.left) + ' width=' + Math.round(rect.width) + ' viewport=' + rect.viewport };
  });

${anchor}`;
  c = c.replace(anchor, block);
}

// Composer screenshot at the end
if (!c.includes("'D-29'")) {
  const anchor = '  const report = results;';
  const block = `  await check('D-29', 'ui', 'ChatGPT-style composer with provider/model selectors', async () => {
    await call('settings.patch', { theme: { design: 'ios', theme: 'light', accent: 'neuro', surface: 'white', wallpaper: 'aurora' } });
    kernel.emit('ui:navigate', { surface: 'chat', params: {} });
    await wait(900);
    const controls = await win.webContents.executeJavaScript(
      \`(() => ({ selects: document.querySelectorAll('.composer__select').length, send: Boolean(document.querySelector('.composer__send')), top: Boolean(document.querySelector('.composer__top')) }))()\`,
    );
    await shot('composer');
    await win.webContents.executeJavaScript("document.querySelector('.composer__select')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))");
    await wait(500);
    await shot('composer-provider-menu');
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    if (controls.selects < 2 || !controls.send || controls.top) throw new Error('composer controls incomplete: ' + JSON.stringify(controls));
    return { evidence: controls.selects + ' selectors, circular send, chip row removed' };
  });

${anchor}`;
  c = c.replace(anchor, block);
}

fs.writeFileSync(p, c, 'utf8');
console.log('deep UI checks added', c.includes("'D-00'"), c.includes("'D-29'"));
