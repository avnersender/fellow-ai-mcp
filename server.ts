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

const paginationInput = z
  .object({
    cursor: z.union([z.string(), z.null()]).optional(),
    page_size: z.number().int().min(1).max(50).default(20),
  })
  .strict();

const sharedFilters = z
  .object({
    event_guid: z.string().optional(),
    created_at_start: z.string().optional(),
    created_at_end: z.string().optional(),
    updated_at_start: z.string().optional(),
    updated_at_end: z.string().optional(),
    title: z.string().optional(),
    channel_id: z.string().optional(),
  })
  .strict();

export const listNotesInputSchema = z
  .object({
    filters: sharedFilters.optional(),
    include: z
      .object({
        content_markdown: z.boolean().optional(),
        event_attendees: z.boolean().optional(),
      })
      .strict()
      .optional(),
    pagination: paginationInput.optional(),
  })
  .strict();

export const getNoteInputSchema = z
  .object({
    note_id: z.string(),
  })
  .strict();

export const listRecordingsInputSchema = z
  .object({
    filters: sharedFilters.optional(),
    include: z
      .object({
        transcript: z.boolean().optional(),
      })
      .strict()
      .optional(),
    pagination: paginationInput.optional(),
  })
  .strict();

export const getRecordingInputSchema = z
  .object({
    recording_id: z.string(),
  })
  .strict();

const emptyInputSchema = z.object({}).strict();

export const paginationJsonSchema = {
  type: 'object',
  properties: {
    cursor: { type: ['string', 'null'] },
    page_size: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  },
  additionalProperties: false,
} as const;

export const sharedFiltersJsonSchema = {
  type: 'object',
  properties: {
    event_guid: { type: 'string' },
    created_at_start: { type: 'string' },
    created_at_end: { type: 'string' },
    updated_at_start: { type: 'string' },
    updated_at_end: { type: 'string' },
    title: { type: 'string' },
    channel_id: { type: 'string' },
  },
  additionalProperties: false,
} as const;

export const listNotesJsonSchema = {
  type: 'object',
  properties: {
    filters: sharedFiltersJsonSchema,
    include: {
      type: 'object',
      properties: {
        content_markdown: { type: 'boolean' },
        event_attendees: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    pagination: paginationJsonSchema,
  },
  additionalProperties: false,
} as const;

export const listRecordingsJsonSchema = {
  type: 'object',
  properties: {
    filters: sharedFiltersJsonSchema,
    include: {
      type: 'object',
      properties: {
        transcript: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    pagination: paginationJsonSchema,
  },
  additionalProperties: false,
} as const;

export const getNoteJsonSchema = {
  type: 'object',
  properties: {
    note_id: { type: 'string' },
  },
  required: ['note_id'],
  additionalProperties: false,
} as const;

export const getRecordingJsonSchema = {
  type: 'object',
  properties: {
    recording_id: { type: 'string' },
  },
  required: ['recording_id'],
  additionalProperties: false,
} as const;

async function fetchNoteById(noteId: string): Promise<any> {
  const payload = await call<any>({ method: 'get', url: `/note/${encodeURIComponent(noteId)}` });
  const candidate = payload?.note ?? payload?.data ?? payload;
  const note = Array.isArray(candidate) ? candidate[0] : candidate;
  if (
    !note ||
    (typeof note === 'object' && !Array.isArray(note) && Object.keys(note).length === 0)
  ) {
    throw new Error(`Note ${noteId} not found`);
  }
  return note;
}

async function fetchRecordingById(recordingId: string): Promise<any> {
  const payload = await call<any>({ method: 'get', url: `/recording/${encodeURIComponent(recordingId)}` });
  const candidate = payload?.recording ?? payload?.data ?? payload;
  const recording = Array.isArray(candidate) ? candidate[0] : candidate;
  if (
    !recording ||
    (typeof recording === 'object' && !Array.isArray(recording) && Object.keys(recording).length === 0)
  ) {
    throw new Error(`Recording ${recordingId} not found`);
  }
  return recording;
}

function buildNotesBody(input: z.infer<typeof listNotesInputSchema>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.filters) {
    body.filters = input.filters;
  }
  if (input.include) {
    const include: Record<string, boolean> = {};
    if (input.include.content_markdown) include.content_markdown = true;
    if (input.include.event_attendees) include.event_attendees = true;
    if (Object.keys(include).length > 0) {
      body.include = include;
    }
  }
  if (input.pagination) {
    body.pagination = {
      cursor: input.pagination.cursor ?? undefined,
      page_size: input.pagination.page_size ?? 20,
    };
  }
  return body;
}

function buildRecordingsBody(input: z.infer<typeof listRecordingsInputSchema>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.filters) {
    body.filters = input.filters;
  }
  if (input.include?.transcript) {
    body.include = { transcript: true };
  }
  if (input.pagination) {
    body.pagination = {
      cursor: input.pagination.cursor ?? undefined,
      page_size: input.pagination.page_size ?? 20,
    };
  }
  return body;
}

// --------- Tools ---------

server.registerTool(
  'getMe',
  {
    title: 'Get authenticated user',
    description: 'Calls GET /me to verify auth and fetch your Fellow identity.',
    inputSchema: emptyInputSchema.shape,
  },
  async (input) => {
    emptyInputSchema.parse(input ?? {});
    const me = await call<any>({ method: 'get', url: '/me' });
    return { content: [{ type: 'text', text: JSON.stringify(me, null, 2) }], structuredContent: me };
  }
);

server.registerTool(
  'listNotes',
  {
    title: 'List notes',
    description: 'POST /notes with optional filters, includes, and pagination.',
    inputSchema: listNotesInputSchema.shape,
  },
  async (rawInput) => {
    const input = listNotesInputSchema.parse(rawInput ?? {});
    const body = buildNotesBody(input);
    const page = await call<any>({ method: 'post', url: '/notes', data: body });
    return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }], structuredContent: page };
  }
);

server.registerTool(
  'getNote',
  {
    title: 'Get a note by id',
    description: 'GET /note/{note_id}.',
    inputSchema: getNoteInputSchema.shape,
  },
  async (rawInput) => {
    const input = getNoteInputSchema.parse(rawInput ?? {});
    const note = await fetchNoteById(input.note_id);
    return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }], structuredContent: note };
  }
);

server.registerTool(
  'listRecordings',
  {
    title: 'List recordings',
    description: 'POST /recordings with optional filters, transcript include, and pagination.',
    inputSchema: listRecordingsInputSchema.shape,
  },
  async (rawInput) => {
    const input = listRecordingsInputSchema.parse(rawInput ?? {});
    const body = buildRecordingsBody(input);
    const page = await call<any>({ method: 'post', url: '/recordings', data: body });
    return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }], structuredContent: page };
  }
);

server.registerTool(
  'getRecording',
  {
    title: 'Get a recording by id',
    description: 'GET /recording/{recording_id}.',
    inputSchema: getRecordingInputSchema.shape,
  },
  async (rawInput) => {
    const input = getRecordingInputSchema.parse(rawInput ?? {});
    const recording = await fetchRecordingById(input.recording_id);
    return {
      content: [{ type: 'text', text: JSON.stringify(recording, null, 2) }],
      structuredContent: recording,
    };
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
    const note = await fetchNoteById(noteId);
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
