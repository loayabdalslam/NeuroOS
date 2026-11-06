const fs = require('fs');

// dock overflow fix
let css = fs.readFileSync('src/renderer/src/styles/audit.css', 'utf8');
if (!css.includes('flex: 1 1 auto')) {
  css += `
/* Sidebar height discipline: the top group scrolls, the footer stays visible. */
.dock {
  overflow: hidden;
}
.dock__group {
  flex: 1 1 auto;
  min-height: 0;
}
.dock__group--bottom {
  flex: none;
}
.dock__spacer {
  flex: 0 0 6px;
  min-height: 0;
}
.dock:not(.is-collapsed) .dock__item {
  flex: none;
}
`;
  fs.writeFileSync('src/renderer/src/styles/audit.css', css, 'utf8');
  console.log('dock overflow fixed');
}

// browser address placeholder + size formatting
let b = fs.readFileSync('src/renderer/src/surfaces/Browser.tsx', 'utf8');
if (!b.includes('homeRef')) {
  b = b.replace('  const activeRef = useRef(activeId);', '  const activeRef = useRef(activeId);\n  const homeRef = useRef(homeOpen);\n\n  useEffect(() => {\n    homeRef.current = homeOpen;\n  }, [homeOpen]);');
  b = b.replace("      if (tabId === activeRef.current) setAddress(url);\n      if (ready.current.has(tabId)) navigateSync();", "      if (tabId === activeRef.current && !homeRef.current) setAddress(url);\n      if (ready.current.has(tabId)) navigateSync();");
  b = b.replace("          <button type=\"button\" data-active={mode === 'dweb'} onClick={() => { setMode('dweb'); setHomeOpen(true); setAddress(''); }} title=\"Decentralized Neuro Web\">", "          <button type=\"button\" data-active={mode === 'dweb'} onClick={() => { setMode('dweb'); setHomeOpen(true); setAddress(''); homeRef.current = true; }} title=\"Decentralized Neuro Web\">");
  b = b.replace("<div><span>{((webStats?.bytes ?? 0) / 1024 / 1024).toFixed(1)}</span><label>MB hosted</label></div>", "<div><span>{formatSize(webStats?.bytes ?? 0)}</span><label>hosted</label></div>");
  b = b.replace('export function BrowserSurface', `function formatSize(bytes: number): string {\n  if (bytes < 1024) return String(bytes);\n  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'K';\n  return (bytes / 1024 / 1024).toFixed(1) + 'M';\n}\n\nexport function BrowserSurface`);
  fs.writeFileSync('src/renderer/src/surfaces/Browser.tsx', b, 'utf8');
  console.log('browser fixes applied');
}
