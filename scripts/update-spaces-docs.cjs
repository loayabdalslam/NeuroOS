const fs = require('fs');
let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Spaces interaction pass')) {
  b += [
    '',
    '## Spaces interaction pass',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| Selecting a space looked like nothing happened: under 980 CSS px the master-detail layout stacked the detail panel below the grid, often outside the viewport, so the click only changed hidden state. | The layout keeps the detail panel beside the grid down to 980 px (300 px aside, 220 px cards) and turns it into a slide-over drawer below 760 px. The panel scrolls into view on selection. |',
    '| A space card had no “open” action; double-click and the detail panel now open the space workspace (patching workspaceRoot when the space has a folder). | `openSpace()` + primary Open button + double-click + tooltip. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
console.log('spaces docs updated');
