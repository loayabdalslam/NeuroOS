const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');

// Auto-fill a model for a session that has none
if (!c.includes('auto-selected')) {
  c = c.replace(
    '  const toolModels = (provider?.models ?? []).filter((model) => model.supportsTools !== false);',
    `  const toolModels = (provider?.models ?? []).filter((model) => model.supportsTools !== false);

  useEffect(() => {
    if (!activeId || !provider) return;
    if (active?.model && provider.models.some((model) => model.id === active.model)) return;
    const fallback = provider.defaultModel || provider.models[0]?.id;
    if (!fallback) return;
    // auto-selected model so the first send always has one
    void useChatStore.getState().setActiveMeta({ providerId: provider.id, model: fallback });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, provider?.id, provider?.defaultModel, active?.model]);`,
  );
}

// Provider choice: create a session when there is none
c = c.replace(
  `                onClick={() => {
                  const model = item.models.find((entry) => entry.id === active?.model)?.id ?? item.models.find((entry) => entry.supportsTools !== false)?.id ?? item.models[0]?.id ?? '';
                  void useChatStore.getState().setActiveMeta({ providerId: item.id, model });
                  setProviderModal(false);
                }}`,
  `                onClick={() => {
                  const model = item.models.find((entry) => entry.id === active?.model)?.id ?? item.models.find((entry) => entry.supportsTools !== false)?.id ?? item.models[0]?.id ?? '';
                  if (!activeId) {
                    void create({ providerId: item.id, model, title: 'New conversation' }).then(() => setProviderModal(false));
                  } else {
                    void useChatStore.getState().setActiveMeta({ providerId: item.id, model });
                    setProviderModal(false);
                  }
                }}`,
);

// Model choice: create a session when there is none
c = c.replace(
  `                onClick={() => {
                  void useChatStore.getState().setActiveMeta({ model: model.id });
                  setModelModal(false);
                }}`,
  `                onClick={() => {
                  if (!activeId) {
                    void create({ providerId: provider?.id, model: model.id, title: 'New conversation' }).then(() => setModelModal(false));
                  } else {
                    void useChatStore.getState().setActiveMeta({ model: model.id });
                    setModelModal(false);
                  }
                }}`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('model selection creates session when needed', c.includes('auto-selected'), c.includes('create({ providerId'));
