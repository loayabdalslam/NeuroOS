const fs = require('fs');

// A. chat.send fails fast without a provider
let p = 'src/main/services/agent.service.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "    const provider = settings.providers.find((p) => p.id === session.providerId);\n    const agent = settings.agents.find((a) => a.id === session.agentId) ?? settings.agents[0];",
  "    const provider = settings.providers.find((p) => p.id === session.providerId);\n    if (!provider) throw new Error('No provider is connected. Add one in Settings → Providers, then send again.');\n    if (provider.enabled === false) throw new Error(`${provider.name} is disabled. Enable it in Settings → Providers.`);\n    const agent = settings.agents.find((a) => a.id === session.agentId) ?? settings.agents[0];",
);
// model + auth hint in ACP turns
c = c.replace(
  "    if (!client.currentSession) {\n      await client.newSession(this.deps.settings.public().workspaceRoot || this.deps.cwd());\n    }",
  "    if (!client.currentSession) {\n      await client.newSession(this.deps.settings.public().workspaceRoot || this.deps.cwd());\n    }\n    if (provider.model && provider.model !== 'acp:auto') {\n      await client.setModel(provider.model);\n    }",
);
c = c.replace(
  "      if (!controller.signal.aborted) {\n        assistant.error = (error as Error).message;\n        this.deps.emit({ type: 'error', sessionId, message: (error as Error).message });",
  "      if (!controller.signal.aborted) {\n        const message = (error as Error).message;\n        const hint = /timed out/i.test(message)\n          ? ` The agent did not finish in time${client.authMethods.length ? ' and advertises authentication: ' + client.authMethods.map((method) => method.name).join(', ') : ''}. Sign in with the agent CLI, then retry.`\n          : '';\n        assistant.error = message + hint;\n        this.deps.emit({ type: 'error', sessionId, message: message + hint });",
);
fs.writeFileSync(p, c, 'utf8');

// B. brain.capture falls back to title
p = 'src/main/services/brain.service.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "      const label = (input.label ?? '').trim().slice(0, 120);",
  "      const label = String(input.label ?? (input as { title?: string }).title ?? '').trim().slice(0, 120);",
);
fs.writeFileSync(p, c, 'utf8');

// C. AcpClient authMethods + setModel
p = 'src/main/services/providers/acpClient.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "  public capabilities: AcpInitializeResult['agentCapabilities'] = {};",
  "  public capabilities: AcpInitializeResult['agentCapabilities'] = {};\n  public authMethods: NonNullable<AcpInitializeResult['authMethods']> = [];",
);
c = c.replace(
  "    this.agentInfo = result.agentInfo ?? null;\n    this.capabilities = result.agentCapabilities ?? {};",
  "    this.agentInfo = result.agentInfo ?? null;\n    this.capabilities = result.agentCapabilities ?? {};\n    this.authMethods = result.authMethods ?? [];",
);
c = c.replace(
  "  cancel(): void {",
  `  async setModel(modelId: string): Promise<void> {
    if (!this.sessionId || !modelId) return;
    try {
      await this.request('session/set_model', { sessionId: this.sessionId, modelId });
    } catch (error) {
      log.debug('acp', \`set_model failed: \${(error as Error).message}\`);
    }
  }

  cancel(): void {`,
);
fs.writeFileSync(p, c, 'utf8');
console.log('agent/brain/acp patched');
