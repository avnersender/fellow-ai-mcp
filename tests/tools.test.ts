import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('axios', () => {
  const createMock = vi.fn();
  return {
    default: { create: createMock },
    create: createMock,
  };
});

let serverModule: typeof import('../server.ts');
let requestMock: ReturnType<typeof vi.fn>;
let axiosCreateMock: any;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  process.env.NODE_ENV = 'test';
  process.env.FELLOW_SUBDOMAIN = 'stub';
  process.env.FELLOW_API_KEY = 'stub';

  const axiosModule = await import('axios');
  axiosCreateMock = axiosModule.create;

  requestMock = vi.fn();
  axiosCreateMock.mockReturnValue({ request: requestMock });

  serverModule = await import('../server.ts');
});

function getTool(name: string) {
  return (serverModule.server as any)._registeredTools[name];
}

describe('listNotes tool', () => {
  test('sends Fellow contract fields when provided', async () => {
    const tool = getTool('listNotes');
    const response = { notes: { data: [{ id: 'n1' }], page_info: { cursor: null } } };

    requestMock.mockResolvedValueOnce({ data: response });

    const result = await tool.callback({
      filters: { event_guid: 'evt-123' },
      include: { content_markdown: true, event_attendees: true },
      pagination: { page_size: 25, cursor: null },
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'post',
      url: '/notes',
      data: {
        filters: { event_guid: 'evt-123' },
        include: { content_markdown: true, event_attendees: true },
        pagination: { cursor: undefined, page_size: 25 },
      },
    });
    expect(result.structuredContent).toEqual(response);
  });

  test('omits include when falsey flags are passed', async () => {
    const tool = getTool('listNotes');
    const response = { notes: { data: [] } };

    requestMock.mockResolvedValueOnce({ data: response });

    const result = await tool.callback({ include: { content_markdown: false } });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'post',
      url: '/notes',
      data: {},
    });
    expect(result.structuredContent).toEqual(response);
  });
});

describe('listRecordings tool', () => {
  test('sends optional transcript flag and pagination', async () => {
    const tool = getTool('listRecordings');
    const response = { recordings: { data: [{ id: 'r1' }] } };

    requestMock.mockResolvedValueOnce({ data: response });

    const result = await tool.callback({
      include: { transcript: true },
      pagination: { page_size: 10 },
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'post',
      url: '/recordings',
      data: {
        include: { transcript: true },
        pagination: { cursor: undefined, page_size: 10 },
      },
    });
    expect(result.structuredContent).toEqual(response);
  });

  test('omits transcript when disabled', async () => {
    const tool = getTool('listRecordings');
    const response = { recordings: { data: [] } };

    requestMock.mockResolvedValueOnce({ data: response });

    const result = await tool.callback({ include: { transcript: false } });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'post',
      url: '/recordings',
      data: {},
    });
    expect(result.structuredContent).toEqual(response);
  });
});

describe('getNote tool', () => {
  test('fetches note via RESTful endpoint', async () => {
    const tool = getTool('getNote');
    const payload = { note: { id: 'note-1', title: 'Note One' } };
    requestMock.mockResolvedValueOnce({ data: payload });

    const result = await tool.callback({ note_id: 'note-1' });

    expect(requestMock).toHaveBeenCalledWith({ method: 'get', url: '/note/note-1', data: undefined });
    expect(result.structuredContent).toEqual(payload.note);
  });

  test('throws when note missing', async () => {
    const tool = getTool('getNote');
    requestMock.mockResolvedValueOnce({ data: {} });

    await expect(tool.callback({ note_id: 'missing' })).rejects.toThrow('Note missing not found');
  });
});

describe('getRecording tool', () => {
  test('retrieves recordings via RESTful endpoint', async () => {
    const tool = getTool('getRecording');
    const payload = { recording: { id: 'rec-1', title: 'Recording One' } };
    requestMock.mockResolvedValueOnce({ data: payload });

    const result = await tool.callback({ recording_id: 'rec-1' });

    expect(requestMock).toHaveBeenCalledWith({ method: 'get', url: '/recording/rec-1', data: undefined });
    expect(result.structuredContent).toEqual(payload.recording);
  });

  test('throws when recording missing', async () => {
    const tool = getTool('getRecording');
    requestMock.mockResolvedValueOnce({ data: {} });

    await expect(tool.callback({ recording_id: 'rec-x' })).rejects.toThrow('Recording rec-x not found');
  });
});
