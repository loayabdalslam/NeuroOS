const fs = require('fs');

const apply = (file, pairs) => {
  let c = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (!c.includes(from)) {
      console.log('MISS', file, '::', from.slice(0, 60).replace(/\n/g, ' '));
      continue;
    }
    c = c.replace(from, to);
    n += 1;
  }
  fs.writeFileSync(file, c, 'utf8');
  console.log(file, n, '/', pairs.length);
};

apply('src/main/core/util.ts', [
  [
    `  await fsp.writeFile(tmp, payload, 'utf8');
  await fsp.rename(tmp, file);
}`,
    `  await fsp.writeFile(tmp, payload, 'utf8');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fsp.rename(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!code || !['EPERM', 'EBUSY', 'EACCES'].includes(code) || attempt === 5) {
        await fsp.rm(tmp, { force: true }).catch(() => undefined);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}`,
  ],
  [
    `  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}`,
    `  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!code || !['EPERM', 'EBUSY', 'EACCES'].includes(code) || attempt === 5) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
    }
  }
}`,
  ],
]);

apply('src/main/services/composio.service.ts', [
  [
    `      const collected: StoredTool[] = [];
      for (let page = 1; page <= 4; page += 1) {
        const payload = await this.request<unknown>(\`/tools?limit=100&page=\${page}\`);
        const rows = this.items<Record<string, unknown>>(payload);
        for (const row of rows) {
          const normalized = this.normalizeTool(row);
          if (normalized) collected.push(normalized);
        }
        if (rows.length < 100) break;
      }`,
    `      const collected: StoredTool[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const payload = await this.request<unknown>(\`/tools?limit=100\${cursor ? \`&cursor=\${encodeURIComponent(cursor)}\` : ''}\`);
        const rows = this.items<Record<string, unknown>>(payload);
        for (const row of rows) {
          const normalized = this.normalizeTool(row);
          if (normalized) collected.push(normalized);
        }
        const next = (payload as { next_cursor?: string }).next_cursor;
        if (rows.length < 100 || !next) break;
        cursor = next;
      }`,
  ],
  [
    `    const userId = encodeURIComponent(this.store.get().userId);
    const payload = await this.request<unknown>(\`/connected_accounts?user_ids=\${userId}&limit=100\`);
    const rows = this.items<Record<string, unknown>>(payload);`,
    `    const userId = encodeURIComponent(this.store.get().userId);
    let payload = await this.request<unknown>(\`/connected_accounts?user_ids=\${userId}&limit=100\`);
    let rows = this.items<Record<string, unknown>>(payload);
    if (!rows.length) {
      // Accounts may be owned by a different Composio user (API key scope).
      payload = await this.request<unknown>('/connected_accounts?limit=100');
      rows = this.items<Record<string, unknown>>(payload);
    }`,
  ],
]);

// QA: never print any part of the API key
{
  const p = 'src/main/qa.ts';
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(
    "const mask = (value: string): string => (value ? `${value.slice(0, 4)}…${value.slice(-3)}` : 'unset');",
    "const mask = (value: string): string => (value ? 'set' : 'unset');",
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('mask patched');
}
