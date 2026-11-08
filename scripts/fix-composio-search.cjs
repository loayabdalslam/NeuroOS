const fs = require('fs');

// 1) service: remote toolkit search + merge
let p = 'src/main/services/composio.service.ts';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('async searchRemote(')) {
  c = c.replace(
    '  tools(input?: { query?: string; toolkit?: string }): ComposioTool[] {',
    `  async searchRemote(queryInput: string, limit = 24): Promise<ComposioTool[]> {
    const query = queryInput.trim().toLowerCase();
    if (!query) return [];
    const toolkits = await this.toolkits();
    const matches = toolkits
      .filter((toolkit) => toolkit.slug.includes(query) || toolkit.name.toLowerCase().includes(query) || (toolkit.description ?? '').toLowerCase().includes(query))
      .slice(0, 4);
    const collected = new Map<string, StoredTool>();
    for (const toolkit of matches) {
      try {
        const payload = await this.request<unknown>(\`/tools?toolkit_slug=\${encodeURIComponent(toolkit.slug)}&limit=100\`);
        for (const row of this.items<Record<string, unknown>>(payload)) {
          const normalized = this.normalizeTool(row);
          if (normalized) collected.set(normalized.slug, normalized);
        }
      } catch (error) {
        this.lastError = (error as Error).message;
      }
    }
    if (collected.size) {
      const catalog = [...this.store.get().catalog];
      const bySlug = new Map(catalog.map((tool) => [tool.slug, tool]));
      for (const tool of collected.values()) bySlug.set(tool.slug, tool);
      this.store.set({ catalog: [...bySlug.values()] });
      this.emit();
    }
    const local = this.tools({ query });
    if (local.length) return local.slice(0, limit);
    return [...collected.values()]
      .map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        toolkit: tool.toolkit,
        toolkitName: tool.toolkitName,
        parameters: tool.parameters,
        enabled: this.store.get().enabled.includes(tool.slug),
      }))
      .slice(0, limit);
  }

  tools(input?: { query?: string; toolkit?: string }): ComposioTool[] {`,
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('composio.searchRemote added');
}

// 2) IPC contract + handler
p = 'src/shared/ipc.ts';
c = fs.readFileSync(p, 'utf8');
if (!c.includes("'composio.search'")) {
  c = c.replace(
    "  'composio.tools': { params: { query?: string; toolkit?: string } | void; result: ComposioTool[] };",
    "  'composio.tools': { params: { query?: string; toolkit?: string } | void; result: ComposioTool[] };\n  'composio.search': { params: { query: string; limit?: number }; result: ComposioTool[] };",
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('ipc type added');
}
p = 'src/main/ipcHandlers.ts';
c = fs.readFileSync(p, 'utf8');
if (!c.includes("'composio.search'")) {
  c = c.replace(
    "    'composio.tools': (params) => kernel.composio.tools(params ?? undefined),",
    "    'composio.tools': (params) => kernel.composio.tools(params ?? undefined),\n    'composio.search': ({ query, limit }) => kernel.composio.searchRemote(query, limit ?? 24),",
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('ipc handler added');
}

// 3) agent tool falls back to a remote search
p = 'src/main/services/composio.service.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "      const results = this.tools({ query, toolkit }).slice(0, limit);",
  "      let results = this.tools({ query, toolkit }).slice(0, limit);\n      if (!results.length && query) {\n        results = (await this.searchRemote(query, limit)).slice(0, limit);\n      }",
);
fs.writeFileSync(p, c, 'utf8');
console.log('agent tool fallback added');
