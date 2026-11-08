const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  '  const toolModels = (provider?.models ?? []).filter((model) => model.supportsTools !== false);',
  '  const toolModels = (provider?.models ?? []).filter((model) => model.supportsTools !== false);\n  const modelChoices = toolModels.length ? toolModels : (provider?.models ?? []);',
);

if (!c.includes('const refreshModels')) {
  c = c.replace(
    '  const attachImages = async (): Promise<void> => {',
    `  const refreshModels = async (): Promise<void> => {
    const current = useAppStore.getState().settings;
    if (!provider || !current) return;
    try {
      const discovered = await invoke('providers.discoverModels', {
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey ?? '',
      });
      if (!discovered.length) throw new Error('The provider returned no models.');
      const next = await invoke('providers.save', {
        ...provider,
        models: discovered,
        defaultModel: discovered[0].id,
      });
      useAppStore.getState().setSettings({ ...current, providers: next });
      pushToast({ title: 'Models refreshed', message: discovered.length + ' models from ' + provider.name, kind: 'success' });
    } catch (error) {
      pushToast({ title: 'Could not refresh models', message: (error as Error).message, kind: 'error' });
    }
  };

  const attachImages = async (): Promise<void> => {`,
  );
}

c = c.replace(
  '        title="Models with tool calling"\n        description={provider ? "Only models that can call the 46 Neuro tools are listed." : undefined}\n        width={520}\n      >',
  `        title={toolModels.length ? 'Models with tool calling' : 'Models'}
        description={provider ? (toolModels.length ? 'Only models that can call the 46 Neuro tools are listed.' : 'No tool-capable models are declared for this provider — showing all of its models.') : 'Choose a provider first.'}
        width={520}
        footer={
          <>
            <Button onClick={() => setModelModal(false)}>Close</Button>
            <Button icon="rotate-ccw" onClick={() => void refreshModels()} disabled={!provider}>
              Refresh models
            </Button>
            <Button
              variant="primary"
              icon="settings"
              onClick={() => {
                setModelModal(false);
                navigate('settings');
              }}
            >
              Manage providers
            </Button>
          </>
        }
      >`,
);

c = c.replace(
  '          {toolModels.length ? (\n            toolModels.map((model) => (',
  '          {modelChoices.length ? (\n            modelChoices.map((model) => (',
);
c = c.replace(
  "            <span className=\"tiny faint\">This provider has no tool-capable models. Add one in Settings → Providers.</span>",
  "            <span className=\"tiny faint\">This provider has no models yet. Use Refresh models, or add one in Settings → Providers.</span>",
);

fs.writeFileSync(p, c, 'utf8');
console.log('model picker fallback + refresh added', c.includes('modelChoices'), c.includes('refreshModels'));
