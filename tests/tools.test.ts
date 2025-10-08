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

describe('list_notes tool', () => {
  test('aggregates paginated responses', async () => {
    const tool = getTool('list_notes');
    const firstPage = {
      notes: {
        data: [{ id: 'n1' }],
        page_info: { cursor: 'cursor-1' },
      },
    };
    const secondPage = {
      notes: {
        data: [{ id: 'n2' }],
        page_info: { cursor: null },
      },
    };

    requestMock.mockResolvedValueOnce({ data: firstPage });
    requestMock.mockResolvedValueOnce({ data: secondPage });

    vi.useFakeTimers();
    try {
      const promise = tool.callback({
        include_content_markdown: false,
        include_event_attendees: false,
        page_size: 2,
        max_pages: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.structuredContent.count).toBe(2);
      expect(result.structuredContent.notes).toEqual([{ id: 'n1' }, { id: 'n2' }]);
      expect(requestMock).toHaveBeenCalledTimes(2);
      expect(requestMock).toHaveBeenNthCalledWith(1, {
        method: 'post',
        url: '/notes',
        data: {
          include: { content_markdown: false, event_attendees: false },
          filters: undefined,
          pagination: { cursor: undefined, page_size: 2 },
        },
      });
      expect(requestMock).toHaveBeenNthCalledWith(2, {
        method: 'post',
        url: '/notes',
        data: {
          include: { content_markdown: false, event_attendees: false },
          filters: undefined,
          pagination: { cursor: 'cursor-1', page_size: 2 },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test('honors max_pages limit even when cursor continues', async () => {
    const tool = getTool('list_notes');
    const firstPage = {
      notes: {
        data: [{ id: 'n1' }],
        page_info: { cursor: 'cursor-1' },
      },
    };
    const secondPage = {
      notes: {
        data: [{ id: 'n2' }],
        page_info: { cursor: 'cursor-2' },
      },
    };
    const thirdPage = {
      notes: {
        data: [{ id: 'n3' }],
        page_info: { cursor: null },
      },
    };

    requestMock
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: secondPage })
      .mockResolvedValueOnce({ data: thirdPage });

    vi.useFakeTimers();
    try {
      const promise = tool.callback({
        include_content_markdown: false,
        include_event_attendees: false,
        page_size: 1,
        max_pages: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.structuredContent.count).toBe(2);
      expect(result.structuredContent.notes).toEqual([{ id: 'n1' }, { id: 'n2' }]);
      expect(requestMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('propagates upstream errors', async () => {
    const tool = getTool('list_notes');
    const error = new Error('boom');
    requestMock.mockRejectedValue(error);

    await expect(
      tool.callback({
        include_content_markdown: false,
        include_event_attendees: false,
        page_size: 1,
        max_pages: 1,
      })
    ).rejects.toThrow('boom');
  });
});

describe('list_recordings tool', () => {
  test('collects recordings across pages', async () => {
    const tool = getTool('list_recordings');
    const firstPage = {
      recordings: {
        data: [{ id: 'r1' }],
        page_info: { cursor: 'cursor-1' },
      },
    };
    const secondPage = {
      recordings: {
        data: [{ id: 'r2' }],
        page_info: { cursor: null },
      },
    };

    requestMock.mockResolvedValueOnce({ data: firstPage });
    requestMock.mockResolvedValueOnce({ data: secondPage });

    vi.useFakeTimers();
    try {
      const promise = tool.callback({
        include_transcript: true,
        page_size: 2,
        max_pages: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.structuredContent.count).toBe(2);
      expect(result.structuredContent.recordings).toEqual([{ id: 'r1' }, { id: 'r2' }]);
      expect(requestMock).toHaveBeenCalledTimes(2);
      expect(requestMock).toHaveBeenNthCalledWith(1, {
        method: 'post',
        url: '/recordings',
        data: {
          include: { transcript: true },
          filters: undefined,
          pagination: { cursor: undefined, page_size: 2 },
        },
      });
      expect(requestMock).toHaveBeenNthCalledWith(2, {
        method: 'post',
        url: '/recordings',
        data: {
          include: { transcript: true },
          filters: undefined,
          pagination: { cursor: 'cursor-1', page_size: 2 },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
