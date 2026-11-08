const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('const chooseModel')) {
  c = c.replace(
    '  const modelChoices = toolModels.length ? toolModels : (provider?.models ?? []);',
    `  const modelChoices = toolModels.length ? toolModels : (provider?.models ?? []);

  const chooseModel = async (modelId: string, providerId?: string): Promise<void> => {
    const state = useChatStore.getState();
    if (!state.activeId) {
      await create({ providerId: providerId ?? provider?.id, model: modelId });
      return;
    }
    const updated = await invoke('chat.patch', {
      id: state.activeId,
      ...(providerId ? { providerId } : {}),
      model: modelId,
    });
    useChatStore.setState({
      active: state.active ? { ...state.active, ...updated } : null,
      sessions: state.sessions.map((session) => (session.id === updated.id ? { ...session, ...updated } : session)),
    });
  };`,
  );
}

// provider choice uses chooseModel
c = c.replace(
  `                  if (!activeId) {
                    void create({ providerId: item.id, model }).then(() => setProviderModal(false));
                  } else {
                    void useChatStore.getState().setActiveMeta({ providerId: item.id, model });
                    setProviderModal(false);
                  }`,
  `                  void chooseModel(model, item.id).then(() => setProviderModal(false));`,
);

// model choice uses chooseModel
c = c.replace(
  `                  if (!activeId) {
                    void create({ providerId: provider?.id, model: model.id }).then(() => setModelModal(false));
                  } else {
                    void useChatStore.getState().setActiveMeta({ model: model.id });
                    setModelModal(false);
                  }`,
  `                  void chooseModel(model.id, provider?.id).then(() => setModelModal(false));`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('chooseModel wired', c.includes('const chooseModel'), c.includes('void chooseModel'));
