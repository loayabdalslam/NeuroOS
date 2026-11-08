const fs = require('fs');
const p = 'src/main/services/composio.service.ts';
let c = fs.readFileSync(p, 'utf8');

const oldBlock = `    for (const toolkit of matches) {
      try {
        const payload = await this.request<unknown>(\`/tools?toolkit_slug=\${encodeURIComponent(toolkit.slug)}&limit=100\`);
        for (const row of this.items<Record<string, unknown>>(payload)) {
          const normalized = this.normalizeTool(row);
          if (normalized) collected.set(normalized.slug, normalized);
        }
      } catch (error) {
        this.lastError = (error as Error).message;
      }
    }`;

const newBlock = `    for (const toolkit of matches) {
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        try {
          const payload = await this.request<unknown>(
            \`/tools?toolkit_slug=\${encodeURIComponent(toolkit.slug)}&limit=100\${cursor ? \`&cursor=\${encodeURIComponent(cursor)}\` : ''}\`,
          );
          for (const row of this.items<Record<string, unknown>>(payload)) {
            const normalized = this.normalizeTool(row);
            if (normalized) collected.set(normalized.slug, normalized);
          }
          const next = (payload as { next_cursor?: string }).next_cursor;
          if (!next) break;
          cursor = next;
        } catch (error) {
          this.lastError = (error as Error).message;
          break;
        }
      }
    }`;

if (!c.includes(oldBlock)) {
  console.log('anchor missing');
} else {
  c = c.replace(oldBlock, newBlock);
  fs.writeFileSync(p, c, 'utf8');
  console.log('paginated');
}
