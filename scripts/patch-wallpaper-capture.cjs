const fs = require('fs');

let idx = fs.readFileSync('src/main/index.ts', 'utf8');
const old = `  router?.emit('ui:navigate', { surface: 'desktop', params: {} });
  await wait(1600);
  await screenshot('26-wallpaper');`;
const neu = `  router?.emit('ui:navigate', { surface: 'desktop', params: {} });
  await wait(900);
  await win.webContents
    .executeJavaScript(
      \`(() => { document.querySelector('.startScrim')?.click(); [...document.querySelectorAll('.oswindow__close')].forEach((button) => button.click()); return 'cleared'; })()\`,
    )
    .catch(() => {});
  await wait(1400);
  await screenshot('26-wallpaper');`;
if (idx.includes(old)) {
  idx = idx.replace(old, neu);
  fs.writeFileSync('src/main/index.ts', idx, 'utf8');
  console.log('wallpaper capture cleaned');
} else {
  console.log('wallpaper anchor missing');
}

let css = fs.readFileSync('src/renderer/src/styles/audit.css', 'utf8');
if (!css.includes('.app__bg')) {
  css += `
/* ambient wallpaper behind the shell */
.app__bg {
  background-image: linear-gradient(180deg, rgba(6, 7, 12, 0.55), rgba(6, 7, 12, 0.8)), var(--n-wallpaper-image, none) !important;
  background-size: cover !important;
  background-position: center !important;
  filter: blur(22px) brightness(0.6) saturate(1.15);
  transform: scale(1.06);
}
`;
  fs.writeFileSync('src/renderer/src/styles/audit.css', css, 'utf8');
  console.log('app backdrop added');
}
