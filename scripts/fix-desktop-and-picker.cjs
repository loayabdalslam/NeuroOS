const fs = require('fs');

// 1) Scope the desktop/lockscreen photo overlay (this was darkening every themed wallpaper)
const p1 = 'src/renderer/src/styles/audit.css';
let a = fs.readFileSync(p1, 'utf8');
const oldRule = `.desktop { background-image: linear-gradient(180deg, rgba(5,6,11,.25), rgba(5,6,11,.55)), var(--n-wallpaper-image, none) !important; background-size: cover !important; background-position: center !important; }
.lockscreen { background-image: linear-gradient(180deg, rgba(5,6,11,.35), rgba(5,6,11,.7)), var(--n-wallpaper-image, none) !important; background-size: cover !important; background-position: center !important; }`;
const newRule = `:root[data-wallpaper^='photo:'] .desktop { background-image: linear-gradient(180deg, rgba(5,6,11,.18), rgba(5,6,11,.45)), var(--n-wallpaper-image, none) !important; background-size: cover !important; background-position: center !important; }
:root[data-theme='light'][data-wallpaper^='photo:'] .desktop { background-image: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.4)), var(--n-wallpaper-image, none) !important; }
:root[data-wallpaper^='photo:'] .lockscreen { background-image: linear-gradient(180deg, rgba(5,6,11,.3), rgba(5,6,11,.65)), var(--n-wallpaper-image, none) !important; background-size: cover !important; background-position: center !important; }`;
if (!a.includes(oldRule)) console.log('desktop overlay anchor missing');
a = a.replace(oldRule, newRule);
fs.writeFileSync(p1, a, 'utf8');
console.log('desktop overlay scoped');

// 2) Settings: Add provider opens the preset picker (currently it jumps straight to DeepSeek)
const p2 = 'src/renderer/src/surfaces/Settings.tsx';
let s = fs.readFileSync(p2, 'utf8');
s = s.replace(
  "const [providerModal, setProviderModal] = useState<ProviderConfig | null>(null);",
  "const [providerModal, setProviderModal] = useState<ProviderConfig | null>(null);\n  const [providerPicker, setProviderPicker] = useState(false);",
);
s = s.replaceAll(
  'onClick={() => setProviderModal(presetToProvider(PROVIDER_PRESETS[0]))}',
  'onClick={() => { setProviderModal(null); setProviderPicker(true); }}',
);
s = s.replace(
  "<ProviderModal provider={providerModal} onClose={() => setProviderModal(null)} pluginProviders={pluginProviders} />",
  "<ProviderModal provider={providerModal} open={providerModal !== null || providerPicker} onClose={() => { setProviderModal(null); setProviderPicker(false); }} pluginProviders={pluginProviders} />",
);
s = s.replace(
  `function ProviderModal({
  provider,
  onClose,
  pluginProviders,
}: {
  provider: ProviderConfig | null;
  onClose: () => void;
  pluginProviders: PluginProviderEntry[];
}): JSX.Element | null {`,
  `function ProviderModal({
  provider,
  open,
  onClose,
  pluginProviders,
}: {
  provider: ProviderConfig | null;
  open: boolean;
  onClose: () => void;
  pluginProviders: PluginProviderEntry[];
}): JSX.Element | null {`,
);
s = s.replace(
  "  useEffect(() => {\n    setDraft(provider);\n    setModelsText(provider?.models.map((model) => model.id).join(', ') ?? '');\n    setProbe(null);\n    setStep(provider ? 'configure' : 'pick');\n  }, [provider]);\n\n  if (!provider || !draft) return null;",
  "  useEffect(() => {\n    setDraft(provider);\n    setModelsText(provider?.models.map((model) => model.id).join(', ') ?? '');\n    setProbe(null);\n    setStep(provider ? 'configure' : 'pick');\n  }, [provider]);\n\n  if (!open) return null;\n  if (step === 'configure' && !draft) return null;",
);
// draft is nullable in picker mode: guard the configure-only usages
s = s.replace(
  "      title={step === 'pick' ? 'Add a provider' : `Configure ${draft.name}`}",
  "      title={step === 'pick' ? 'Add a provider' : `Configure ${draft?.name ?? ''}`}",
);
s = s.replace(
  "    const next: ProviderConfig = {\n      ...draft,",
  "    if (!draft) return;\n    const next: ProviderConfig = {\n      ...draft,",
);
fs.writeFileSync(p2, s, 'utf8');
console.log('settings picker patched', s.includes('providerPicker'), s.includes('open={providerModal'));
