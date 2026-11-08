const fs = require('fs');

let p = 'src/main/services/plugins.service.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `      if (manifest.main) {
        runtime.storage = await this.readStorage(entry.id);
        available = await this.startHost(entry, runtime);
      }`,
  `      if (manifest.main) {
        runtime.storage = await this.readStorage(entry.id);
        this.loaded.set(entry.id, runtime);
        available = await this.startHost(entry, runtime);
      }`,
);
c = c.replace(
  `      case 'storage.set': {
        need('fs');
        const loaded = this.loaded.get(entry.id);`,
  `      case 'storage.set': {
        const loaded = this.loaded.get(entry.id);`,
);
c = c.replace(
  `      case 'storage.delete': {
        need('fs');
        const loaded = this.loaded.get(entry.id);`,
  `      case 'storage.delete': {
        const loaded = this.loaded.get(entry.id);`,
);
fs.writeFileSync(p, c, 'utf8');

// red-team plugin: verify isolation from the main process instead of process access
p = 'src/main/redteam.ts';
c = fs.readFileSync(p, 'utf8');
const oldMain = "`module.exports = { tools: { escape: async () => { try { const p = globalThis.constructor.constructor('return process')(); return { ok: true, output: 'pid:' + p.pid }; } catch (error) { return { ok: false, output: 'blocked:' + error.message }; } } } };`";
if (!c.includes(oldMain)) console.log('redteam plugin payload anchor missing');
c = c.replace(
  oldMain,
  "`module.exports = { tools: { escape: async () => { const result = {}; try { require('electron'); result.electron = 'reachable'; } catch (error) { result.electron = 'blocked'; } try { require('node:fs').readFileSync(process.env.NEURO_REDTEAM_SECRET || 'C:/Windows/win.ini'); result.fs = 'read'; } catch (error) { result.fs = 'blocked:' + (error.code || error.message); } result.env = process.env.NEURO_REDTEAM_SECRET ? 'leaked' : 'stripped'; return { ok: true, output: JSON.stringify(result) }; } } };`",
);
c = c.replace(
  "    !escapeOutput.startsWith('pid:'),",
  "    (() => { try { const parsed = JSON.parse(escapeOutput); return parsed.electron === 'blocked' && String(parsed.fs).startsWith('blocked') && parsed.env === 'stripped'; } catch { return false; } })(),",
);
fs.writeFileSync(p, c, 'utf8');
console.log('plugin isolation test updated');
