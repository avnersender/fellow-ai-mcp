import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

class LocalReadBuffer {
  private buffer?: Buffer;

  append(chunk: Buffer) {
    this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
  }

  readMessage(): unknown | null {
    if (!this.buffer) return null;
    const idx = this.buffer.indexOf('\n');
    if (idx === -1) return null;
    const line = this.buffer.toString('utf8', 0, idx).replace(/\r$/, '');
    this.buffer = this.buffer.subarray(idx + 1);
    return JSON.parse(line);
  }

  clear() {
    this.buffer = undefined;
  }
}

function serializeMessage(message: unknown): string {
  return JSON.stringify(message) + '\n';
}

class MemoryClientTransport {
  onmessage?: (message: unknown) => void;
  onerror?: (error: unknown) => void;
  onclose?: () => void;
  sessionId?: string;

  private readBuffer = new LocalReadBuffer();

  constructor(private readonly readable: PassThrough, private readonly writable: PassThrough) {}

  async start(): Promise<void> {
    this.readable.on('data', (chunk) => {
      this.readBuffer.append(chunk);
      this.processReadBuffer();
    });
    this.readable.on('error', (err) => {
      this.onerror?.(err);
    });
  }

  private processReadBuffer(): void {
    while (true) {
      try {
        const message = this.readBuffer.readMessage();
        if (message === null) break;
        this.onmessage?.(message);
      } catch (err) {
        this.onerror?.(err);
        break;
      }
    }
  }

  async close(): Promise<void> {
    this.readable.removeAllListeners();
    this.readBuffer.clear();
    this.onclose?.();
  }

  async send(message: unknown): Promise<void> {
    const payload = serializeMessage(message);
    if (!this.writable.write(payload)) {
      await new Promise<void>((resolve) => {
        this.writable.once('drain', resolve);
      });
    }
  }
}

vi.mock('axios', () => {
  const createMock = vi.fn();
  return {
    default: { create: createMock },
    create: createMock,
  };
});

let serverModule: typeof import('../server.ts');
let requestMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  process.env.NODE_ENV = 'test';
  process.env.FELLOW_SUBDOMAIN = 'stub';
  process.env.FELLOW_API_KEY = 'stub';

  const axiosModule = await import('axios');
  const axiosCreateMock = axiosModule.create;
  requestMock = vi.fn();
  axiosCreateMock.mockReturnValue({ request: requestMock });

  serverModule = await import('../server.ts');
});

describe('MCP stdio handshake', () => {
  test('initialization, tool call, and resource read succeed', async () => {
    const clientToServer = new PassThrough();
    const serverToClient = new PassThrough();
    const serverTransport = new StdioServerTransport(clientToServer, serverToClient);

    await serverModule.server.connect(serverTransport);

    const clientTransport = new MemoryClientTransport(serverToClient, clientToServer);
    const client = new Client({ name: 'harness-client', version: '0.0.1' });

    await client.connect(clientTransport);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(['get_me', 'get_note', 'list_notes', 'list_recordings']);

    requestMock.mockResolvedValueOnce({ data: { id: 'user-123', name: 'Test User' } });
    const getMeResult = await client.callTool({ name: 'get_me', arguments: {} });
    expect(getMeResult.structuredContent).toEqual({ id: 'user-123', name: 'Test User' });

    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates.map((tpl) => tpl.name)).toEqual(['fellow-note']);

    requestMock.mockResolvedValueOnce({ data: { id: 'note-1', title: 'Note One' } });
    const resource = await client.readResource({ uri: 'fellow://note/note-1' });
    expect(resource.contents[0]?.text).toContain('Note One');

    await client.close();
    await serverModule.server.close();
    await serverTransport.close();
    clientToServer.end();
    serverToClient.end();
  });
});
