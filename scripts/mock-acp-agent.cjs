#!/usr/bin/env node
/* Minimal ACP v1 agent used by the Neuro OS QA harness. */
const readline = require('node:readline');

const rl = readline.createInterface({ input: process.stdin });
const send = (payload) => process.stdout.write(JSON.stringify(payload) + '\n');

rl.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: 1,
        agentCapabilities: { promptCapabilities: { embeddedContext: true } },
        agentInfo: { name: 'mock-acp', title: 'Mock ACP Agent', version: '1.0.0' },
      },
    });
    return;
  }
  if (message.method === 'session/new') {
    send({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'mock-session-1' } });
    return;
  }
  if (message.method === 'session/prompt') {
    const sessionId = message.params?.sessionId ?? 'mock-session-1';
    const chunks = ['MOCK_', 'ACP_', 'OK'];
    chunks.forEach((text, index) => {
      setTimeout(() => {
        send({
          jsonrpc: '2.0',
          method: 'session/update',
          params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } },
        });
      }, 60 * (index + 1));
    });
    setTimeout(() => send({ jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } }), 260);
    return;
  }
  if (message.method === 'session/cancel') {
    send({ jsonrpc: '2.0', id: message.id, result: {} });
  }
});
