const fs = require('fs');

// A) remember custom model ids on the provider
let p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `    const optimistic = {`,
  `    if (providerId) {
      const app = useAppStore.getState();
      const config = app.settings?.providers.find((entry) => entry.id === providerId);
      if (config && !config.models.some((entry) => entry.id === modelId)) {
        try {
          const next = await invoke('providers.save', {
            ...config,
            models: [...config.models, { id: modelId, label: modelId, supportsTools: true }],
          });
          if (app.settings) app.setSettings({ ...app.settings, providers: next });
        } catch {
          // non-fatal: the session still receives the model id
        }
      }
    }
    const optimistic = {`,
);
fs.writeFileSync(p, c, 'utf8');

// B) validate the session model against the provider before sending
p = 'src/main/services/agent.service.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `    const provider = settings.providers.find((p) => p.id === session.providerId);
    if (!provider) throw new Error('No provider is connected. Add one in Settings â†’ Providers, then send again.');`,
  `    let provider = settings.providers.find((p) => p.id === session.providerId);
    if (!provider) throw new Error('No provider is connected. Add one in Settings → Providers, then send again.');
    if (provider.kind !== 'acp' && provider.models.length && !provider.models.some((model) => model.id === session.model)) {
      const fallback = provider.defaultModel || provider.models[0]?.id;
      if (fallback) {
        session.model = fallback;
        await this.sessions.save(session);
        this.deps.emit({ type: 'status', sessionId: session.id, status: \`Model unavailable — using \${fallback}\` });
      }
    }`,
);
fs.writeFileSync(p, c, 'utf8');

// C) make D-40 click the real New chat button and report what was created
p = 'src/main/deepqa.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `    await win.webContents.executeJavaScript("document.querySelector('button[aria-label=\\"New chat\\"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))");
    await wait(600);`,
  `    const newChatButton = await win.webContents.executeJavaScript(\`(() => { const btn = [...document.querySelectorAll('button')].find((el) => /new chat|new conversation/i.test(el.getAttribute('aria-label') || '')); if (btn) btn.click(); return btn?.getAttribute('aria-label') ?? 'none'; })()\`);
    await wait(700);
    const created = await win.webContents.executeJavaScript(\`(() => ({ title: document.querySelector('.chat__title')?.innerText ?? '', pill: [...document.querySelectorAll('.composer__select')].map((el) => el.innerText.trim()).join(' | ') }))()\`);`,
);
c = c.replace(
  "    if (!content) throw new Error('new conversation did not stream an answer (live=' + live + ')');",
  "    if (!content) throw new Error('new conversation did not stream an answer (live=' + live + ', button=' + newChatButton + ', created=' + JSON.stringify(created) + ')');",
);
fs.writeFileSync(p, c, 'utf8');
console.log('custom model persistence + model fallback + D-40 diagnostics');
