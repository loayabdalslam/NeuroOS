const fs = require('fs');
const p = 'src/renderer/src/surfaces/Spaces.tsx';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('const openSpace')) {
  c = c.replace(
    '  const removeSpace = async (id: string): Promise<void> => {',
    `  const openSpace = (space: Space): void => {
    if (space.path) {
      void useAppStore.getState().patchSettings({ workspaceRoot: space.path });
    }
    navigate('workspace');
  };

  const removeSpace = async (id: string): Promise<void> => {`,
  );

  c = c.replace(
    `                data-active={space.id === selected?.id}
                onClick={() => setSelectedId(space.id)}
              >`,
    `                data-active={space.id === selected?.id}
                onClick={() => setSelectedId(space.id)}
                onDoubleClick={() => openSpace(space)}
                title="Click to preview · double-click to open its workspace"
              >`,
  );

  c = c.replace(
    `            <div className="spaceDetail__actions">
              <Button variant="outline" size="sm" icon="message" onClick={() => navigate('chat', {}, { forceNew: true })}>`,
    `            <div className="spaceDetail__actions">
              <Button variant="primary" size="sm" icon="external-link" onClick={() => openSpace(selected)}>
                Open
              </Button>
              <Button variant="outline" size="sm" icon="message" onClick={() => navigate('chat', {}, { forceNew: true })}>`,
  );

  c = c.replace(
    '  const spaceSessions = sessions.filter((session) => session.spaceId === selected?.id);',
    `  const spaceSessions = sessions.filter((session) => session.spaceId === selected?.id);

  useEffect(() => {
    if (!selectedId) return;
    const detail = document.querySelector('.spaceDetail');
    if (detail && window.innerWidth < 980) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);`,
  );

  fs.writeFileSync(p, c, 'utf8');
  console.log('space open behaviour added');
} else {
  console.log('already patched');
}
