const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');
if (c.includes('const attachImages =')) {
  console.log('already');
  process.exit(0);
}
const anchor = '  return (\n    <div className="chat">';
const fn = `  const attachImages = async (): Promise<void> => {
    setAttaching(true);
    try {
      const picked = await invoke('system.pickFiles', { multiple: true });
      const next = [...attachments];
      for (const path of picked.paths) {
        try {
          const data = await invoke('system.readDataUrl', { path });
          next.push({
            id: 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            kind: 'image',
            label: data.name,
            path,
            mime: data.mime,
            size: data.size,
            dataUrl: data.dataUrl,
          });
        } catch (error) {
          pushToast({ title: 'Could not attach image', message: (error as Error).message, kind: 'error' });
        }
      }
      setAttachments(next.slice(0, 4));
    } finally {
      setAttaching(false);
    }
  };

${anchor}`;
c = c.replace(anchor, fn);
fs.writeFileSync(p, c, 'utf8');
console.log('attachImages added', c.includes('const attachImages'));
