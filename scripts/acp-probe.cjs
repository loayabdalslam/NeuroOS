const { spawn } = require('node:child_process');
const fs = require('node:fs');

const candidates = [
  { name: 'opencode', command: 'opencode', args: ['acp'] },
  { name: 'opencode-exe', command: 'C:\\Users\\acer\\AppData\\Roaming\\npm\\node_modules\\.opencode-ai-r4H2EwU4\\node_modules\\opencode-windows-x64\\bin\\opencode.exe', args: ['acp'] },
];

const run = (candidate) =>
  new Promise((resolve) => {
    const child = spawn(candidate.command, candidate.args, {
      cwd: process.cwd(),
      shell: true,
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    });
    let buffer = '';
    let stderr = '';
    let initialized = false;
    let session = '';
    let prompted = false;
    const timer = setTimeout(() => {
      child.kill();
      resolve({ name: candidate.name, ok: false, stage: prompted ? 'prompt-timeout' : initialized ? 'session/prompt' : 'initialize', stderr: stderr.slice(-1200), buffer: buffer.slice(-1200) });
    }, 35000);

    const send = (payload) => child.stdin.write(JSON.stringify(payload) + '\n');

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 1) {
          if (msg.error) {
            clearTimeout(timer);
            child.kill();
            return resolve({ name: candidate.name, ok: false, stage: 'initialize', error: msg.error, stderr: stderr.slice(-800) });
          }
          initialized = true;
          send({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd: process.cwd(), mcpServers: [] } });
        } else if (msg.id === 2) {
          if (msg.error) {
            clearTimeout(timer);
            child.kill();
            return resolve({ name: candidate.name, ok: false, stage: 'session/new', error: msg.error, init: true });
          }
          session = msg.result.sessionId;
          prompted = true;
          send({ jsonrpc: '2.0', id: 3, method: 'session/prompt', params: { sessionId: session, prompt: [{ type: 'text', text: 'Reply with exactly: NEURO_ACP_OK' }] } });
        } else if (msg.id === 3) {
          clearTimeout(timer);
          resolve({
            name: candidate.name,
            ok: !msg.error,
            stage: 'done',
            stopReason: msg.result?.stopReason,
            initInfo: undefined,
            stderr: stderr.slice(-600),
            notifications: buffer.slice(-400),
          });
          child.kill();
        }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ name: candidate.name, ok: false, stage: 'spawn', error: String(error) });
    });
    child.on('exit', (code) => {
      if (!prompted) {
        clearTimeout(timer);
        resolve({ name: candidate.name, ok: false, stage: 'exit', code, stderr: stderr.slice(-1000) });
      }
    });

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
        clientInfo: { name: 'neuro-os-qa', title: 'Neuro OS QA', version: '1.0.0' },
      },
    });
  });

(async () => {
  const results = [];
  for (const candidate of candidates) results.push(await run(candidate));
  fs.writeFileSync('acp-probe.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
})();
