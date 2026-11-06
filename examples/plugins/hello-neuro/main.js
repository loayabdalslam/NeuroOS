/**
 * Hello Neuro — the reference plugin.
 *
 * The manifest declares what this plugin contributes; this file exports the
 * handlers. `neuro` is the permissioned host API: capabilities you did not
 * declare are `undefined` rather than silently allowed.
 */

module.exports = {
  tools: {
    async projectStats(args, ctx) {
      if (!neuro.fs) return { ok: false, output: 'This plugin needs the "fs" permission.' };
      const root = args.path || ctx.workspaceRoot;
      const byExtension = {};
      let files = 0;
      let bytes = 0;

      const walk = async (dir, depth) => {
        if (depth > 4) return;
        for (const name of await neuro.fs.list(dir)) {
          if (name.startsWith('.') || name === 'node_modules' || name === 'out') continue;
          const full = dir.replace(/[\\/]+$/, '') + '/' + name;
          const info = await neuro.fs.stat(full).catch(() => null);
          if (!info) continue;
          if (info.isDirectory) {
            await walk(full, depth + 1);
            continue;
          }
          files += 1;
          bytes += info.size;
          const extension = name.includes('.') ? name.split('.').pop() : 'none';
          byExtension[extension] = (byExtension[extension] || 0) + 1;
        }
      };

      await walk(root, 0);
      const summary = Object.entries(byExtension)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([extension, count]) => `${extension}: ${count}`)
        .join(' · ');

      return { ok: true, output: `${files} files · ${(bytes / 1024).toFixed(1)} KB\n${summary}`, data: { files, bytes, byExtension } };
    },

    async greet(args) {
      neuro.log('greet invoked for', args.name);
      return { ok: true, output: `Hello ${args.name} — from a third-party plugin.` };
    },
  },

  commands: {
    async say_hello() {
      if (neuro.ui) neuro.ui.toast('Hello from hello-neuro', 'The plugin host is working.');
      return `Hello at ${new Date().toISOString()}`;
    },
  },
};
