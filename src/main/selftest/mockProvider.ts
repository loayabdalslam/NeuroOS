import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A deterministic OpenAI-compatible endpoint used by the design/QA harness.
 * It exercises the real provider adapter, streaming parser, tool loop and
 * persistence — without needing an external API key in CI.
 */
export interface MockProvider {
  url: string;
  close: () => Promise<void>;
}

const TOOL_TURN = [
  {
    id: 'chatcmpl-mock-1',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              index: 0,
              id: 'call_mock_1',
              type: 'function',
              function: { name: 'system.info', arguments: '' },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  },
  {
    id: 'chatcmpl-mock-1',
    choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{}' } }] }, finish_reason: null }],
  },
  { id: 'chatcmpl-mock-1', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
];

const TEXT = [
  'Your machine reports **16 cores**, **15.7 GB** of RAM and a **NVIDIA GeForce** GPU. ',
  'The kernel is healthy: the shell, file bus and tool registry are all online, and the demo ',
  'workspace is mounted at `Neuro Demo`.\n\n',
  'Next, I can profile the workspace, run the health script, or draft a plan — say the word.',
];

export async function startMockProvider(): Promise<MockProvider> {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(404).end();
      return;
    }
    if (req.url.includes('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'neuro-sandbox', object: 'model' }] }));
      return;
    }
    if (!req.url.includes('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let hasToolResult = false;
      try {
        const parsed = JSON.parse(body) as { messages?: { role: string }[] };
        hasToolResult = Boolean(parsed.messages?.some((message) => message.role === 'tool'));
      } catch {
        hasToolResult = false;
      }

      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });

      if (!hasToolResult) {
        for (const chunk of TOOL_TURN) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      let index = 0;
      const timer = setInterval(() => {
        if (index >= TEXT.length) {
          clearInterval(timer);
          res.write(
            `data: ${JSON.stringify({
              id: 'chatcmpl-mock-2',
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
              usage: { prompt_tokens: 812, completion_tokens: 64, total_tokens: 876 },
            })}\n\n`,
          );
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        res.write(
          `data: ${JSON.stringify({
            id: 'chatcmpl-mock-2',
            choices: [{ index: 0, delta: { content: TEXT[index] }, finish_reason: null }],
          })}\n\n`,
        );
        index += 1;
      }, 120);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
