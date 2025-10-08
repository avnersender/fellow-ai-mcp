import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import { z } from 'zod';

// --------- Config via env ---------
// FELLOW_SUBDOMAIN: e.g. "abc"   -> https://abc.fellow.app
// FELLOW_API_KEY:   your API key    -> sent as X-API-KEY
const SUBDOMAIN = process.env.FELLOW_SUBDOMAIN;
const API_KEY = process.env.FELLOW_API_KEY;

if (!SUBDOMAIN || !API_KEY) {
  // Never console.log on stdio servers; but throwing is fine; the client shows it.
  throw new Error('Set FELLOW_SUBDOMAIN and FELLOW_API_KEY in the environment.');
}

const http = axios.create({
  baseURL: `https://${SUBDOMAIN}.fellow.app/api/v1`,
  headers: { 'X-API-KEY': API_KEY },
  timeout: 15000,
});

// Basic retry for 429/5xx with jitter
export async function call<T>(cfg: { method: 'get' | 'post'; url: string; data?: unknown }): Promise<T> {
  let delay = 300;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await http.request<T>({ method: cfg.method, url: cfg.url, data: cfg.data });
      return res.data;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 429 || (status >= 500 && status <= 599)) {
        await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 200));
        delay *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error('Upstream unavailable after retries');
}

export const server = new McpServer({ name: 'fellow-mcp', version: '1.0.0' });

export const getMeInputSchema = {};

export const listNotesInputSchema = {
  include_content_markdown: z.boolean().default(false),
  include_event_attendees: z.boolean().default(false),
  filters: z
    .object({
      event_guid: z.string().optional(),
      title: z.string().optional(),
      channel_id: z.string().optional(),
      created_at_start: z.string().optional(),
      created_at_end: z.string().optional(),
      updated_at_start: z.string().optional(),
      updated_at_end: z.string().optional(),
    })
    .partial()
    .optional(),
  page_size: z.number().int().min(1).max(50).default(20),
  max_pages: z.number().int().min(1).max(20).default(3),
};

export const getNoteInputSchema = {
  note_id: z.string(),
};

export const listRecordingsInputSchema = {
  include_transcript: z.boolean().default(false),
  filters: z
    .object({
      event_guid: z.string().optional(),
      title: z.string().optional(),
      channel_id: z.string().optional(),
      created_at_start: z.string().optional(),
      created_at_end: z.string().optional(),
      updated_at_start: z.string().optional(),
      updated_at_end: z.string().optional(),
    })
    .partial()
    .optional(),
  page_size: z.number().int().min(1).max(50).default(20),
  max_pages: z.number().int().min(1).max(20).default(2),
};

async function fetchNoteById(
  noteId: string,
  options: { includeContentMarkdown?: boolean } = {}
): Promise<any> {
  const body: Record<string, unknown> = {
    filters: { ids: [noteId] },
    pagination: { page_size: 1 },
  };

  if (options.includeContentMarkdown) {
    body.include = { content_markdown: true };
  }

  const payload = await call<any>({ method: 'post', url: '/notes', data: body });
  const notes = payload?.notes?.data ?? payload?.data ?? [];
  const note = notes.find((n: any) => n?.id === noteId) ?? notes[0];
  if (!note) {
    throw new Error(`Note ${noteId} not found`);
  }
  return note;
}

// --------- Tools ---------

server.registerTool(
  'get_me',
  {
    title: 'Get authenticated user',
    description: 'Calls GET /me to verify auth and fetch your Fellow identity',
    inputSchema: {},
  },
  async () => {
    const me = await call<any>({ method: 'get', url: '/me' });
    return { content: [{ type: 'text', text: JSON.stringify(me, null, 2) }], structuredContent: me };
  }
);

server.registerTool(
  'list_notes',
  {
    title: 'List notes',
    description: 'POST /notes with optional filters. Returns paginated notes; set max_pages to control pagination.',
    inputSchema: listNotesInputSchema,
  },
  async ({ include_content_markdown, include_event_attendees, filters, page_size, max_pages }) => {
    let cursor: string | null = null;
    const collected: any[] = [];
    for (let i = 0; i < max_pages; i++) {
      const body: Record<string, unknown> = {
        include: {
          content_markdown: include_content_markdown,
          event_attendees: include_event_attendees,
        },
        filters: filters || undefined,
        pagination: { cursor: cursor ?? undefined, page_size },
      };
      const page = await call<any>({ method: 'post', url: '/notes', data: body });
      const batch = page?.notes?.data ?? page?.data ?? [];
      collected.push(...batch);
      cursor = page?.notes?.page_info?.cursor ?? page?.page_info?.cursor ?? null;
      if (!cursor) break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    const out = { count: collected.length, notes: collected };
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out };
  }
);

server.registerTool(
  'get_note',
  {
    title: 'Get a note by id',
    description: 'GET /notes/{id}',
    inputSchema: getNoteInputSchema,
  },
  async ({ note_id }) => {
    const note = await fetchNoteById(note_id, { includeContentMarkdown: true });
    return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }], structuredContent: note };
  }
);

server.registerTool(
  'list_recordings',
  {
    title: 'List recordings',
    description: 'POST /recordings with optional filters/transcript include; paginates like notes.',
    inputSchema: listRecordingsInputSchema,
  },
  async ({ include_transcript, filters, page_size, max_pages }) => {
    let cursor: string | null = null;
    const collected: any[] = [];
    for (let i = 0; i < max_pages; i++) {
      const body: Record<string, unknown> = {
        include: { transcript: include_transcript },
        filters: filters || undefined,
        pagination: { cursor: cursor ?? undefined, page_size },
      };
      const page = await call<any>({ method: 'post', url: '/recordings', data: body });
      const batch = page?.recordings?.data ?? page?.data ?? [];
      collected.push(...batch);
      cursor = page?.recordings?.page_info?.cursor ?? page?.page_info?.cursor ?? null;
      if (!cursor) break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    const out = { count: collected.length, recordings: collected };
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out };
  }
);

// --------- Resource templates ---------
server.registerResource(
  'fellow-note',
  new ResourceTemplate('fellow://note/{id}', { list: undefined }),
  { title: 'Fellow Note', description: 'Fetch a note by id as an MCP resource' },
  async (uri, { id }) => {
    const noteId = Array.isArray(id) ? id[0] : id;
    if (!noteId) {
      throw new Error('Missing note id');
    }
    const note = await fetchNoteById(noteId, { includeContentMarkdown: true });
    const text =
      typeof note?.content_markdown === 'string' && note.content_markdown.length > 0
        ? note.content_markdown
        : JSON.stringify(note, null, 2);
    return { contents: [{ uri: uri.href, text }] };
  }
);

// --------- Start (stdio) ---------
if (process.env.NODE_ENV !== 'test') {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
