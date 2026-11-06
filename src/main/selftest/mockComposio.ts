import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Minimal Composio REST v3.1 stand-in for the QA harness. It implements the
 * exact endpoints and response shapes the service consumes, so the integration
 * is verified end to end without a real API key or network.
 */
export interface MockComposio {
  url: string;
  close: () => Promise<void>;
}

const TOOLS = [
  {
    slug: 'GITHUB_CREATE_ISSUE',
    name: 'Create GitHub issue',
    description: 'Create an issue in a repository.',
    toolkit: { slug: 'github', name: 'GitHub' },
    input_parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['owner', 'repo', 'title'],
      additionalProperties: false,
    },
  },
  {
    slug: 'GMAIL_SEND_EMAIL',
    name: 'Send email',
    description: 'Send an email through Gmail.',
    toolkit: { slug: 'gmail', name: 'Gmail' },
    input_parameters: {
      type: 'object',
      properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    slug: 'SLACK_SEND_MESSAGE',
    name: 'Send Slack message',
    description: 'Post a message to a Slack channel.',
    toolkit: { slug: 'slack', name: 'Slack' },
    input_parameters: {
      type: 'object',
      properties: { channel: { type: 'string' }, text: { type: 'string' } },
      additionalProperties: false,
    },
  },
];

const TOOLKITS = [
  { slug: 'github', name: 'GitHub', description: 'Code, issues and pull requests.', logo: '' },
  { slug: 'gmail', name: 'Gmail', description: 'Email for humans.', logo: '' },
  { slug: 'slack', name: 'Slack', description: 'Team chat.', logo: '' },
];

export async function startMockComposio(): Promise<MockComposio> {
  const executed: string[] = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const send = (status: number, body: unknown): void => {
      const payload = JSON.stringify(body);
      response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), connection: 'close' });
      response.end(payload);
    };
    if (!request.headers['x-api-key']) return send(401, { error: { message: 'missing x-api-key' } });

    if (request.method === 'GET' && url.pathname.endsWith('/tools')) {
      const page = Number(url.searchParams.get('page') ?? '1');
      return send(200, { items: page === 1 ? TOOLS : [], total: TOOLS.length, page });
    }
    if (request.method === 'GET' && url.pathname.endsWith('/toolkits')) {
      return send(200, { items: TOOLKITS });
    }
    if (request.method === 'GET' && url.pathname.endsWith('/connected_accounts')) {
      return send(200, {
        items: [{ id: 'ca_selftest_1', toolkit: { slug: 'github', name: 'GitHub' }, status: 'ACTIVE', alias: 'selftest' }],
      });
    }
    if (request.method === 'GET' && url.pathname.endsWith('/auth_configs')) {
      const toolkit = url.searchParams.get('toolkit_slug') ?? 'github';
      return send(200, { items: [{ id: `ac_${toolkit}`, toolkit: { slug: toolkit, name: toolkit } }] });
    }
    if (request.method === 'POST' && url.pathname.endsWith('/connected_accounts/link')) {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => send(200, { redirect_url: 'https://app.composio.dev/link/selftest', connected_account_id: 'ca_selftest_1' }));
      return;
    }
    const execute = url.pathname.match(/\/tools\/execute\/([^/]+)$/);
    if (request.method === 'POST' && execute) {
      const slug = decodeURIComponent(execute[1]);
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        let parsed: { user_id?: string; arguments?: Record<string, unknown> } = {};
        try {
          parsed = JSON.parse(body || '{}');
        } catch {
          /* ignore */
        }
        executed.push(slug);
        send(200, {
          successful: true,
          data: { slug, executed: true, userId: parsed.user_id, arguments: parsed.arguments ?? {}, total: executed.length },
        });
      });
      return;
    }
    send(404, { error: { message: `unknown route ${url.pathname}` } });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/api/v3.1`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
