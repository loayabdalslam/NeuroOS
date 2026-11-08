const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace("  const [modelMenu, setModelMenu] = useState(false);", "  const [modelMenu, setModelMenu] = useState(false);\n  const [providerMenu, setProviderMenu] = useState(false);");

const anchor = `  const agentItems: MenuItem[] = (settings?.agents ?? []).map((item) => ({`;
const insert = `  const providerItems: MenuItem[] = providers
    .filter((item) => item.enabled)
    .map((item) => ({
      label: item.name,
      icon: 'cpu',
      hint: \`\${item.models.length} models\`,
      onClick: () => {
        if (!activeId) return;
        const keep = item.models.some((model) => model.id === active?.model) ? active?.model : item.models[0]?.id;
        void useChatStore.getState().setActiveMeta({ providerId: item.id, model: keep ?? '' });
      },
    }));
  if (!providerItems.length) {
    providerItems.push({ label: 'Connect a provider…', icon: 'plug', onClick: () => navigate('settings') });
  }
  const modelLabel = provider?.models.find((model) => model.id === active?.model)?.label ?? active?.model?.split('/').pop() ?? t('chat.model');

${anchor}`;
if (!c.includes('const providerItems')) c = c.replace(anchor, insert);

const headerModel = `            <div style={{ position: 'relative' }}>
              <Button variant="outline" size="sm" icon="cpu" onClick={() => setModelMenu(true)}>
                {active?.model?.split('/').pop() ?? t('chat.model')}
                <Icon name="chevron-down" size={11} />
              </Button>
              {modelMenu ? <Menu items={modelItems} onClose={() => setModelMenu(false)} align="right" width={300} /> : null}
            </div>
`;
if (!c.includes(headerModel)) console.log('header model block anchor missing');
c = c.replace(headerModel, '');

const oldFooter = `              <IconButton icon="paperclip" label={t('chat.attach')} onClick={() => void invoke('system.pickFiles', { multiple: true })} />
              <span className="composer__agent">`;
const newFooter = `              <IconButton icon="paperclip" label={t('chat.attach')} onClick={() => void invoke('system.pickFiles', { multiple: true })} />
              <div className="composer__selectors">
                <div className="composer__selectWrap">
                  <button type="button" className="composer__select" onClick={() => setProviderMenu(true)}>
                    <span className="composer__selectDot" style={{ background: provider?.color ?? 'var(--n-text-4)' }} />
                    <span className="truncate">{provider?.name ?? 'Provider'}</span>
                    <Icon name="chevron-down" size={10} />
                  </button>
                  {providerMenu ? <Menu items={providerItems} onClose={() => setProviderMenu(false)} width={230} /> : null}
                </div>
                <div className="composer__selectWrap">
                  <button type="button" className="composer__select" onClick={() => setModelMenu(true)}>
                    <Icon name="cpu" size={12} />
                    <span className="truncate">{modelLabel}</span>
                    <Icon name="chevron-down" size={10} />
                  </button>
                  {modelMenu ? <Menu items={modelItems} onClose={() => setModelMenu(false)} width={300} /> : null}
                </div>
              </div>
              <span className="composer__agent">`;
if (!c.includes(oldFooter)) console.log('composer footer anchor missing');
c = c.replace(oldFooter, newFooter);

fs.writeFileSync(p, c, 'utf8');
console.log('composer selectors added', c.includes('composer__selectors'), c.includes('providerItems'));
