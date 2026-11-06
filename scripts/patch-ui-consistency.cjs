const fs = require('fs');

// ---------- Automation: move the run log into the inspector ----------
let a = fs.readFileSync('src/renderer/src/surfaces/Automation.tsx', 'utf8');
if (!a.includes('auto__runBox')) {
  const block = a.match(/          \{run \? \(\n            <div className="auto__runPanel">[\s\S]*?\n          \) : null\}\n/);
  if (block) {
    const moved = block[0]
      .replace('          {run ? (', '        {run ? (')
      .replace('            <div className="auto__runPanel">', '          <div className="auto__runBox">')
      .replace('          ) : null}\n', '        ) : null}\n');
    a = a.replace(block[0], '');
    a = a.replace('      <aside className="auto__inspector">\n', `      <aside className="auto__inspector">\n${moved}\n`);
    fs.writeFileSync('src/renderer/src/surfaces/Automation.tsx', a, 'utf8');
    console.log('automation run log moved');
  } else {
    console.log('automation block not matched');
  }
}

// ---------- Dock: real text when expanded ----------
let d = fs.readFileSync('src/renderer/src/components/Dock.tsx', 'utf8');
if (!d.includes('dock__profile')) {
  d = d.replace(
    `        <button
          type="button"
          className="dock__avatar"`,
    `        <button
          type="button"
          className="dock__item dock__profile"`,
  );
  d = d.replace(
    `          {(profile?.name || 'N').slice(0, 1).toUpperCase()}
        </button>`,
    `          <span className="dock__avatar">{(profile?.name || 'N').slice(0, 1).toUpperCase()}</span>
          <span className="dock__label">{profile?.name || 'Profile'}</span>
        </button>`,
  );
  d = d.replace(
    `        <button type="button" className="dock__collapse" data-tip={collapsed ? 'Expand' : 'Collapse'} data-tip-side="right" onClick={toggleDock}>
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={13} />
        </button>`,
    `        <button type="button" className="dock__item dock__collapse" data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} data-tip-side="right" onClick={toggleDock}>
          <span className="dock__icon">
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
          </span>
          <span className="dock__label">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
        </button>`,
  );
  fs.writeFileSync('src/renderer/src/components/Dock.tsx', d, 'utf8');
  console.log('dock labels added');
}

// default to the collapsed rail so expanding is an explicit action
let s = fs.readFileSync('src/renderer/src/state/store.ts', 'utf8');
if (s.includes('dockCollapsed: false,')) {
  s = s.replace('dockCollapsed: false,', 'dockCollapsed: true,');
  fs.writeFileSync('src/renderer/src/state/store.ts', s, 'utf8');
  console.log('dock default collapsed');
}
