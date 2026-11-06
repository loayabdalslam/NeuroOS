const fs = require('fs');
function patch(file, pairs) {
  let c = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    if (!c.includes(from)) console.log('missing in', file, ':', from.slice(0, 60));
    c = c.split(from).join(to);
  }
  fs.writeFileSync(file, c, 'utf8');
}
patch('src/renderer/src/components/TitleBar.tsx', [["icon=\"pin\" label={t('anchor.title')}", "icon=\"anchor\" label={t('anchor.title')}"]]);
patch('src/renderer/src/components/Taskbar.tsx', [
  ["{ label: t('settings.anchor'), icon: 'pin',", "{ label: t('settings.anchor'), icon: 'anchor',"],
  ["<Icon name=\"pin\" size={14} />", "<Icon name=\"anchor\" size={15} />"],
]);
patch('src/renderer/src/components/Dock.tsx', [["<Icon name=\"pin\" size={17} />", "<Icon name=\"anchor\" size={18} />"]]);
console.log('anchor icons patched');
