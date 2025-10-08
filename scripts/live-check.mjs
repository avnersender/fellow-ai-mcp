#!/usr/bin/env node

import { PassThrough } from 'node:stream';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { FELLOW_SUBDOMAIN, FELLOW_API_KEY, NODE_ENV } = process.env;

if (!FELLOW_SUBDOMAIN || !FELLOW_API_KEY) {
  console.error('Set FELLOW_SUBDOMAIN and FELLOW_API_KEY before running live-check.');
  process.exit(1);
}

const distPath = resolve(process.cwd(), 'dist', 'server.js');

try {
  await access(distPath);
} catch {
  console.error('dist/server.js not found. Run `npm run build` first.');
  process.exit(1);
}

if (NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

const { server } = await import(pathToFileURL(distPath).href);

class LocalReadBuffer {
  constructor() {
    this.buffer = undefined;
  }

  append(chunk) {
    this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
  }

  readMessage() {
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

function serializeMessage(message) {
  return JSON.stringify(message) + '\n';
}

class MemoryClientTransport {
  constructor(readable, writable) {
    this.readable = readable;
    this.writable = writable;
    this.readBuffer = new LocalReadBuffer();
    this.onmessage = undefined;
    this.onerror = undefined;
    this.onclose = undefined;
    this.sessionId = undefined;
  }

  async start() {
    this.readable.on('data', (chunk) => {
      this.readBuffer.append(chunk);
      this.processReadBuffer();
    });
    this.readable.on('error', (err) => {
      this.onerror?.(err);
    });
  }

  processReadBuffer() {
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

  async close() {
    this.readable.removeAllListeners();
    this.readBuffer.clear();
    this.onclose?.();
  }

  async send(message) {
    const payload = serializeMessage(message);
    if (!this.writable.write(payload)) {
      await new Promise((resolve) => {
        this.writable.once('drain', resolve);
      });
    }
  }
}

async function main() {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();
  const serverTransport = new StdioServerTransport(clientToServer, serverToClient);

  await server.connect(serverTransport);

  const clientTransport = new MemoryClientTransport(serverToClient, clientToServer);
  const client = new Client({ name: 'live-check-client', version: '0.0.1' });

  try {
    await client.connect(clientTransport);

    const tools = await client.listTools();
    console.log('Tools:', tools.tools.map((tool) => tool.name).join(', '));

    const me = await client.callTool({ name: 'get_me', arguments: {} });
    console.log('Authenticated user:', me.structuredContent?.name ?? me.structuredContent);

    const notesResponse = await client.callTool({
      name: 'list_notes',
      arguments: { page_size: 3, max_pages: 1 },
    });
    console.log('Fetched notes count:', notesResponse.structuredContent?.count);

    const templates = await client.listResourceTemplates();
    console.log('Resource templates:', templates.resourceTemplates.map((tpl) => tpl.name).join(', '));

    const firstNote = notesResponse.structuredContent?.notes?.[0];
    const firstNoteId = firstNote?.id ?? firstNote?.guid;
    if (firstNoteId) {
      try {
        const resource = await client.readResource({ uri: `fellow://note/${firstNoteId}` });
        console.log(
          'Sample note title snippet:',
          resource.contents?.[0]?.text ? resource.contents[0].text.slice(0, 120) : 'No text available'
        );
      } catch (error) {
        console.warn(`Unable to read note resource (${firstNoteId}): ${error.message}`);
      }
    } else {
      console.log('No notes available to sample.');
    }
  } finally {
    await client.close();
    await server.close();
    await serverTransport.close();
  }
}

main().catch((err) => {
  console.error('Live check failed:', err.message);
  process.exitCode = 1;
});
