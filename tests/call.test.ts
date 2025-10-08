import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('axios', () => {
  const createMock = vi.fn();
  return {
    default: { create: createMock },
    create: createMock,
  };
});

let call: typeof import('../server.ts').call;
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

  ({ call } = await import('../server.ts'));
});

describe('call helper', () => {
  test('returns data on success', async () => {
    requestMock.mockResolvedValueOnce({ data: { ok: true } });

    const result = await call<{ ok: boolean }>({ method: 'get', url: '/notes' });

    expect(result).toEqual({ ok: true });
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith({ method: 'get', url: '/notes', data: undefined });
  });

  test('retries on 429 and eventually succeeds', async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const rateLimitError: any = new Error('rate limited');
    rateLimitError.response = { status: 429 };
    requestMock.mockRejectedValueOnce(rateLimitError);
    requestMock.mockResolvedValueOnce({ data: { ok: true } });

    try {
      const promise = call<{ ok: boolean }>({ method: 'post', url: '/notes', data: {} });
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;

      expect(result).toEqual({ ok: true });
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  test('throws after exhausting retries on server errors', async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const serverError: any = new Error('service unavailable');
    serverError.response = { status: 503 };
    requestMock.mockRejectedValue(serverError);

    try {
      const promise = call({ method: 'get', url: '/notes' });
      const expectation = expect(promise).rejects.toThrow('Upstream unavailable after retries');
      await vi.runAllTimersAsync();
      await expectation;

      expect(requestMock).toHaveBeenCalledTimes(4);
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
