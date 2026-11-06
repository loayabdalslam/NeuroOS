const fs = require('fs');
const p = 'src/main/qa.ts';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('ACP_PRESETS')) {
  c = c.replace(
    "import type { ProviderConfig } from '@shared/types';",
    "import type { ProviderConfig } from '@shared/types';\nimport { ACP_PRESETS } from '@shared/acpPresets';\nimport { presetToProvider } from '@shared/providers';",
  );

  const insertAfter = `  // Missing agents: report where ACP cannot be used yet.`;
  const block = `  add({
    id: 'ACP-04',
    area: 'acp',
    severity: 'medium',
    status: ACP_PRESETS.length >= 40 && ACP_PRESETS.some((preset) => preset.id === 'acp-codex-acp' && preset.acp?.command === 'npx') ? 'pass' : 'fail',
    title: 'ACP registry presets are available in the provider picker',
    evidence: \`\${ACP_PRESETS.length} presets; codex=\${ACP_PRESETS.find((preset) => preset.id === 'acp-codex-acp')?.install ?? 'missing'}\`,
    repro: 'Settings → Providers → Add provider → ACP agents',
  });

  // Opt-in: download and initialize the official Codex ACP adapter.
  if (process.env.NEURO_QA_CODEX === '1') {
    const codexPreset = ACP_PRESETS.find((preset) => preset.id === 'acp-codex-acp');
    if (codexPreset && codexPreset.acp) {
      const codexBin = path.join(process.env.LOCALAPPDATA ?? '', 'OpenAI', 'Codex', 'bin');
      const codexDirs = fs.existsSync(codexBin)
        ? fs.readdirSync(codexBin).map((entry) => path.join(codexBin, entry)).filter((entry) => fs.statSync(entry).isDirectory())
        : [];
      const provider = presetToProvider(codexPreset);
      provider.id = 'acp-qa-codex';
      provider.acp = {
        ...codexPreset.acp,
        env: { PATH: [...codexDirs, process.env.PATH ?? ''].join(path.delimiter) },
      };
      try {
        kernel.settings.saveProvider(provider);
        const client = await withTimeout(kernel.agent.ensureAcp(provider), 180_000, 'Codex ACP initialize');
        add({
          id: 'ACP-05',
          area: 'acp',
          severity: 'high',
          status: client.agentInfo ? 'pass' : 'warn',
          title: 'Codex via the official ACP adapter',
          evidence: \`agent=\${client.agentInfo?.name ?? 'unknown'} v\${client.agentInfo?.version ?? '?'}\`,
          repro: 'npx -y @agentclientprotocol/codex-acp → initialize',
        });
        client.disconnect();
      } catch (error) {
        add({
          id: 'ACP-05',
          area: 'acp',
          severity: 'high',
          status: 'fail',
          title: 'Codex via the official ACP adapter',
          evidence: (error as Error).message.slice(0, 400),
        });
      } finally {
        kernel.settings.removeProvider('acp-qa-codex');
      }
    }
  }

${insertAfter}`;
  c = c.replace(insertAfter, block);
  fs.writeFileSync(p, c, 'utf8');
  console.log('qa patched', c.includes('ACP-05'));
} else {
  console.log('qa already patched');
}
