/* Neuro OS plugin host â€” runs a plugin in a separate, permission-restricted Node process. */
const path = require('node:path');

let api = null;
let exportsObject = null;
const pending = new Map();
let nextId = 1;

const call = (method, args) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    process.send({ type: 'api', id, method, args });
  });

process.on('message', async (message) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'apiResult') {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.ok) entry.resolve(message.value);
    else entry.reject(new Error(message.error || 'plugin api failed'));
    return;
  }
  if (message.type === 'init') {
    try {
      const storage = { ...(message.storage ?? {}) };
      const permissions = new Set(message.permissions ?? []);
      api = {
        apiVersion: 1,
        manifest: message.manifest,
        log: (...args) => void call('log', args),
        storage: {
          get: (key) => storage[key],
          set: (key, value) => {
            storage[key] = value;
            void call('storage.set', [key, value]);
          },
          delete: (key) => {
            delete storage[key];
            void call('storage.delete', key);
          },
          all: () => ({ ...storage }),
        },
        fs: permissions.has('fs')
          ? {
              readFile: (file) => call('fs.readFile', file),
              writeFile: (file, content) => call('fs.writeFile', [file, content]),
              list: (dir) => call('fs.list', dir),
              exists: (file) => call('fs.exists', file),
              stat: (file) => call('fs.stat', file),
            }
          : undefined,
        shell: permissions.has('shell') ? { exec: (command) => call('shell.exec', command) } : undefined,
        net: permissions.has('net') ? { fetch: (url, init) => call('net.fetch', [url, init]) } : undefined,
        ui: permissions.has('ui')
          ? {
              toast: (title, text) => call('ui.toast', [title, text]),
              navigate: (surface, params) => call('ui.navigate', [surface, params]),
            }
          : undefined,
        mail: permissions.has('mail') ? { send: (input) => call('mail.send', input) } : undefined,
        agents: permissions.has('agents') ? { run: (prompt, agentId) => call('agents.run', [prompt, agentId]) } : undefined,
      };
      process.chdir(message.cwd || path.dirname(message.mainPath));
      globalThis.neuro = api;
      exportsObject = require(message.mainPath);
      const tools = exportsObject?.tools ?? {};
      const commands = exportsObject?.commands ?? {};
      process.send({
        type: 'ready',
        tools: Object.keys(tools).filter((key) => typeof tools[key] === 'function'),
        commands: Object.keys(commands).filter((key) => typeof commands[key] === 'function'),
      });
    } catch (error) {
      process.send({ type: 'initError', error: String(error?.stack || error) });
    }
    return;
  }
  if (message.type === 'invoke') {
    try {
      const handler = exportsObject?.tools?.[message.handler] ?? exportsObject?.[message.handler];
      if (typeof handler !== 'function') throw new Error(`missing tool handler: ${message.handler}`);
      const result = await handler(message.args, message.ctx);
      process.send({ type: 'result', id: message.id, ok: true, value: result });
    } catch (error) {
      process.send({ type: 'result', id: message.id, ok: false, error: String(error?.message || error) });
    }
    return;
  }
  if (message.type === 'command') {
    try {
      const handler = exportsObject?.commands?.[message.command] ?? exportsObject?.[message.command];
      if (typeof handler !== 'function') throw new Error(`missing command: ${message.command}`);
      const result = await handler(message.ctx);
      process.send({ type: 'result', id: message.id, ok: true, value: result });
    } catch (error) {
      process.send({ type: 'result', id: message.id, ok: false, error: String(error?.message || error) });
    }
    return;
  }
  if (message.type === 'shutdown') {
    process.exit(0);
  }
});

process.on('uncaughtException', (error) => {
  try {
    process.send({ type: 'log', level: 'error', message: `uncaught: ${error?.stack || error}` });
  } catch {
    /* parent gone */
  }
});
process.on('unhandledRejection', (error) => {
  try {
    process.send({ type: 'log', level: 'error', message: `unhandled: ${error?.stack || error}` });
  } catch {
    /* parent gone */
  }
});

