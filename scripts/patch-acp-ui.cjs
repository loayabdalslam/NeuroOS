const fs = require('fs');

/* 1. ProviderPreset gains ACP/install metadata */
let p = 'src/shared/providers.ts';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('installKind')) {
  c = c.replace(
    `  local?: boolean;
  description: string;
  badge?: string;
}`,
    `  local?: boolean;
  description: string;
  badge?: string;
  /** ACP launch recipe (kind === 'acp'). */
  acp?: { command: string; args: string[] };
  /** How to obtain the agent: npx/uvx command or a binary archive URL. */
  install?: string;
  installKind?: string;
  official?: boolean;
  source?: string;
  note?: string;
}`,
  );
  c = c.replace(
    `    defaultModel: preset.models[0]?.id ?? '',
    createdAt: new Date().toISOString(),
    color: preset.color,
  };
}`,
    `    defaultModel: preset.models[0]?.id ?? '',
    createdAt: new Date().toISOString(),
    color: preset.color,
    ...(preset.acp ? { acp: preset.acp } : {}),
  };
}`,
  );
  c = c.replace(
    "export const providerPreset = (id: string): ProviderPreset | undefined => PROVIDER_PRESETS.find((p) => p.id === id);",
    `import { ACP_PRESETS } from './acpPresets';

export const providerPreset = (id: string): ProviderPreset | undefined =>
  PROVIDER_PRESETS.find((p) => p.id === id) ?? ACP_PRESETS.find((p) => p.id === id);`,
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('providers.ts updated');
} else {
  console.log('providers.ts already has ACP fields');
}

/* 2. Settings provider picker: curated ACP + full registry */
p = 'src/renderer/src/surfaces/Settings.tsx';
c = fs.readFileSync(p, 'utf8');
if (c.includes('ACP_PRESETS')) {
  console.log('settings already patched');
} else {
  c = c.replace(
    "import { PROVIDER_PRESETS",
    "import { ACP_PRESETS, ACP_CURATED } from '@shared/acpPresets';\nimport { PROVIDER_PRESETS",
  );
  c = c.replace(
    "  const [step, setStep] = useState<'pick' | 'configure'>(provider ? 'configure' : 'pick');",
    "  const [step, setStep] = useState<'pick' | 'configure'>(provider ? 'configure' : 'pick');\n  const [showAllAcp, setShowAllAcp] = useState(false);",
  );

  const block = [
    '          <div className="settings__providerSection">',
    '            <span className="tiny faint uppercase">{\'ACP agents · \' + ACP_PRESETS.length}</span>',
    '            <span className="tiny faint">official registry · stdio</span>',
    '          </div>',
    '          {ACP_PRESETS.filter((preset) => showAllAcp || ACP_CURATED.some((item) => item.id === preset.id)).map((preset) => (',
    '            <button',
    '              key={preset.id}',
    '              type="button"',
    '              className="providerPick"',
    '              onClick={() => {',
    '                setDraft(presetToProvider(preset));',
    '                setModelsText(preset.models.map((model) => model.id).join(\', \'));',
    '                setStep(\'configure\');',
    '              }}',
    '            >',
    '              <span className="providerPick__logo">',
    '                <BrandIcon brand={preset.brand} size={22} />',
    '              </span>',
    '              <div style={{ minWidth: 0 }}>',
    '                <div className="row" style={{ gap: 6 }}>',
    '                  <span className="small strong">{preset.name}</span>',
    '                  <span className="n-badge n-badge--accent">ACP</span>',
    '                </div>',
    '                <div className="tiny faint">{preset.description}</div>',
    '                {preset.install ? <div className="tiny faint mono truncate">{preset.install}</div> : null}',
    '              </div>',
    '            </button>',
    '          ))}',
    '          <button type="button" className="providerPick" onClick={() => setShowAllAcp((value) => !value)}>',
    '            <span className="providerPick__logo">',
    '              <Icon name="plus" size={18} />',
    '            </span>',
    '            <div style={{ minWidth: 0 }}>',
    '              <div className="small strong">{showAllAcp ? \'Show curated ACP agents\' : \'Browse all \' + ACP_PRESETS.length + \' ACP agents\'}</div>',
    '              <div className="tiny faint">Curated selection from the Agent Client Protocol registry</div>',
    '            </div>',
    '          </button>',
    '          {pluginProviders.map((entry) => (',
  ].join('\n');

  c = c.replace('          {pluginProviders.map((entry) => (', block);
  fs.writeFileSync(p, c, 'utf8');
  console.log('settings picker patched', c.includes('showAllAcp'));
}
