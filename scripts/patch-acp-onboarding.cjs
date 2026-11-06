const fs = require('fs');
const p = 'src/renderer/src/onboarding/Onboarding.tsx';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('ACP_CURATED')) {
  c = c.replace(
    "import { PROVIDER_PRESETS, presetToProvider, type ProviderPreset } from '@shared/providers';",
    "import { PROVIDER_PRESETS, presetToProvider, type ProviderPreset } from '@shared/providers';\nimport { ACP_CURATED } from '@shared/acpPresets';",
  );

  c = c.replace(
    `    const provider = presetToProvider(preset, apiKey);
    if (baseUrl.trim()) provider.baseUrl = baseUrl.trim();
    return provider;`,
    `    const provider = presetToProvider(preset, apiKey);
    if (preset.kind === 'acp') {
      const parts = baseUrl.trim().split(/\\s+/).filter(Boolean);
      provider.acp = { command: parts[0] ?? preset.acp?.command ?? '', args: parts.slice(1) };
      provider.baseUrl = '';
    } else if (baseUrl.trim()) {
      provider.baseUrl = baseUrl.trim();
    }
    return provider;`,
  );

  c = c.replace(
    "{PROVIDER_PRESETS.filter((item) => item.id !== 'custom').map((item) => (",
    "{[...PROVIDER_PRESETS.filter((item) => item.id !== 'custom'), ...ACP_CURATED].map((item) => (",
  );

  c = c.replace(
    `                      setPreset(item);
                      setBaseUrl(item.baseUrl);`,
    `                      setPreset(item);
                      setBaseUrl(
                        item.kind === 'acp'
                          ? [item.acp?.command ?? '', ...(item.acp?.args ?? [])].filter(Boolean).join(' ')
                          : item.baseUrl,
                      );`,
  );

  c = c.replace(
    `                      <p className="tiny faint" style={{ lineHeight: 1.6 }}>
                        Neuro spawns the process and speaks ACP v1 over stdio — initialize, session/new, session/prompt, fs and
                        terminal bridging, permission mediation.
                      </p>`,
    `                      {preset.install ? (
                        <p className="tiny faint mono" style={{ lineHeight: 1.6 }}>
                          install: {preset.install}
                        </p>
                      ) : null}
                      <p className="tiny faint" style={{ lineHeight: 1.6 }}>
                        Neuro spawns the process and speaks ACP v1 over stdio — initialize, session/new, session/prompt, fs and
                        terminal bridging, permission mediation.
                      </p>`,
  );

  fs.writeFileSync(p, c, 'utf8');
  console.log('onboarding patched', c.includes('ACP_CURATED'));
} else {
  console.log('already patched');
}
