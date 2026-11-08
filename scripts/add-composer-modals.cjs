const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "import { Button, EmptyState, IconButton, Menu, Spinner, type MenuItem } from '../components/ui';",
  "import { Button, EmptyState, IconButton, Menu, Modal, Spinner, type MenuItem } from '../components/ui';",
);

c = c.replace("  const [providerMenu, setProviderMenu] = useState(false);", "  const [providerModal, setProviderModal] = useState(false);\n  const [modelModal, setModelModal] = useState(false);\n  const [attaching, setAttaching] = useState(false);");

c = c.replace(
  "  const enabledTools = agent?.tools === 'all' || !agent ? tools : tools.filter((tool) => agent.tools.includes(tool.name));",
  `  const enabledTools = agent?.tools === 'all' || !agent ? tools : tools.filter((tool) => agent.tools.includes(tool.name));
  const attachments = useChatStore((s) => s.attachments) ?? [];
  const setAttachments = useChatStore((s) => s.setAttachments);
  const pushToast = useAppStore((s) => s.pushToast);
  const toolModels = (provider?.models ?? []).filter((model) => model.supportsTools !== false);`,
);

// image picker
c = c.replace(
  "  const send = async (): Promise<void> => {",
  `  const attachImages = async (): Promise<void> => {
    setAttaching(true);
    try {
      const picked = await invoke('system.pickFiles', { multiple: true });
      const next = [...(attachments ?? [])];
      for (const path of picked.paths) {
        try {
          const data = await invoke('system.readDataUrl', { path });
          next.push({ id: 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'image', label: data.name, path, mime: data.mime, size: data.size, dataUrl: data.dataUrl });
        } catch (error) {
          pushToast({ title: 'Could not attach image', message: (error as Error).message, kind: 'error' });
        }
      }
      setAttachments(next.slice(0, 4));
    } finally {
      setAttaching(false);
    }
  };

  const send = async (): Promise<void> => {`,
);

// provider/model pills open modals
c = c.replace(
  '<button type="button" className="composer__select" onClick={() => setProviderMenu(true)}>',
  '<button type="button" className="composer__select" onClick={() => setProviderModal(true)}>',
);
c = c.replace(
  '<button type="button" className="composer__select" onClick={() => setModelMenu(true)}>',
  '<button type="button" className="composer__select" onClick={() => setModelModal(true)}>',
);
c = c.replace("                  {providerMenu ? <Menu items={providerItems} onClose={() => setProviderMenu(false)} width={230} /> : null}\n", '');
c = c.replace("                  {modelMenu ? <Menu items={modelItems} onClose={() => setModelMenu(false)} width={300} /> : null}\n", '');

// paperclip -> attachImages
c = c.replace(
  "<IconButton icon=\"paperclip\" label={t('chat.attach')} onClick={() => void invoke('system.pickFiles', { multiple: true })} />",
  `<IconButton icon={attaching ? 'loader' : 'paperclip'} label={t('chat.attach')} onClick={() => void attachImages()} />
              {attachments.length ? (
                <div className="composer__attachments">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="composer__attachment">
                      {attachment.dataUrl ? <img src={attachment.dataUrl} alt={attachment.label} /> : <Icon name="file" size={14} />}
                      <button type="button" aria-label="Remove attachment" onClick={() => setAttachments(attachments.filter((item) => item.id !== attachment.id))}>
                        <Icon name="x" size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}`,
);

// attach previews above the textarea
const textareaAnchor = '            <textarea\n              ref={composerRef}';
if (!c.includes('composer__attachmentsAbove')) {
  c = c.replace(
    textareaAnchor,
    `            {attachments.length ? (
              <div className="composer__attachmentsAbove">
                {attachments.map((attachment) => (
                  <span key={attachment.id} className="composer__attachmentChip">
                    {attachment.dataUrl ? <img src={attachment.dataUrl} alt={attachment.label} /> : <Icon name="file" size={12} />}
                    <span className="truncate">{attachment.label}</span>
                    <button type="button" onClick={() => setAttachments(attachments.filter((item) => item.id !== attachment.id))} aria-label="Remove attachment">
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
${textareaAnchor}`,
  );
}

// send disabled only when neither text nor images
c = c.replace(
  "                  disabled={!draft.trim() || !active}",
  "                  disabled={(!draft.trim() && !attachments.length) || !active}",
);

// modals before closing the chat container
const endAnchor = '      </section>\n    </div>\n  );\n}';
if (!c.includes('Provider chooser')) {
  c = c.replace(
    endAnchor,
    `      </section>

      <Modal
        open={providerModal}
        onClose={() => setProviderModal(false)}
        title="Providers"
        description="Choose the provider for this conversation. Keys stay in the OS keychain."
        width={520}
        footer={
          <>
            <Button onClick={() => setProviderModal(false)}>Close</Button>
            <Button
              variant="primary"
              icon="settings"
              onClick={() => {
                setProviderModal(false);
                navigate('settings');
              }}
            >
              Manage providers
            </Button>
          </>
        }
      >
        <div className="providerChooser">
          {providers.length ? (
            providers.map((item) => (
              <button
                key={item.id}
                type="button"
                className="providerChoice"
                data-active={item.id === provider?.id}
                onClick={() => {
                  const model = item.models.find((entry) => entry.id === active?.model)?.id ?? item.models.find((entry) => entry.supportsTools !== false)?.id ?? item.models[0]?.id ?? '';
                  void useChatStore.getState().setActiveMeta({ providerId: item.id, model });
                  setProviderModal(false);
                }}
              >
                <span className="composer__selectDot" style={{ background: item.color ?? 'var(--n-accent)' }} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="small strong">{item.name}</span>
                  <span className="tiny faint" style={{ display: 'block' }}>
                    {item.kind} · {item.models.length} models · {item.enabled ? 'enabled' : 'disabled'}
                  </span>
                </span>
                {item.id === provider?.id ? <Icon name="check" size={13} /> : null}
              </button>
            ))
          ) : (
            <span className="tiny faint">No providers yet. Open Settings → Providers to add one.</span>
          )}
        </div>
      </Modal>

      <Modal
        open={modelModal}
        onClose={() => setModelModal(false)}
        title="Models with tool calling"
        description={provider ? ${JSON.stringify('Only models that can call the 46 Neuro tools are listed.')} : undefined}
        width={520}
      >
        <div className="providerChooser">
          {toolModels.length ? (
            toolModels.map((model) => (
              <button
                key={model.id}
                type="button"
                className="providerChoice"
                data-active={model.id === active?.model}
                onClick={() => {
                  void useChatStore.getState().setActiveMeta({ model: model.id });
                  setModelModal(false);
                }}
              >
                <Icon name="cpu" size={15} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="small strong">{model.label}</span>
                  <span className="tiny faint" style={{ display: 'block' }}>
                    {model.id}{model.contextWindow ? ' · ' + Math.round(model.contextWindow / 1000) + 'k context' : ''}
                    {model.supportsVision ? ' · vision' : ''}
                  </span>
                </span>
                {model.id === active?.model ? <Icon name="check" size={13} /> : null}
              </button>
            ))
          ) : (
            <span className="tiny faint">This provider has no tool-capable models. Add one in Settings → Providers.</span>
          )}
        </div>
      </Modal>
    </div>
  );
}`,
  );
}

fs.writeFileSync(p, c, 'utf8');
console.log('composer modals + image picker added');
