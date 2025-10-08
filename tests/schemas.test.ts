import { beforeAll, describe, expect, test } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.FELLOW_SUBDOMAIN = process.env.FELLOW_SUBDOMAIN ?? 'stub';
process.env.FELLOW_API_KEY = process.env.FELLOW_API_KEY ?? 'stub';

let serverModule: any;

beforeAll(async () => {
  serverModule = await import('../server.ts');
});

describe('tool input schemas', () => {
  test('listNotes applies pagination defaults inside optional object', () => {
    const parsed = serverModule.listNotesInputSchema.parse({ pagination: {} });

    expect(parsed.pagination?.page_size).toBe(20);
    expect(parsed.pagination?.cursor).toBeUndefined();
  });

  test('listNotes rejects unknown properties', () => {
    const result = serverModule.listNotesInputSchema.safeParse({ foo: 'bar' });

    expect(result.success).toBe(false);
  });

  test('listRecordings validates pagination bounds', () => {
    const ok = serverModule.listRecordingsInputSchema.safeParse({ pagination: { page_size: 5 } });
    expect(ok.success).toBe(true);

    const bad = serverModule.listRecordingsInputSchema.safeParse({ pagination: { page_size: 500 } });
    expect(bad.success).toBe(false);
  });

  test('getNote and getRecording enforce required ids', () => {
    expect(serverModule.getNoteInputSchema.safeParse({ note_id: 'abc-123' }).success).toBe(true);
    expect(serverModule.getNoteInputSchema.safeParse({}).success).toBe(false);

    expect(serverModule.getRecordingInputSchema.safeParse({ recording_id: 'rec-1' }).success).toBe(true);
    expect(serverModule.getRecordingInputSchema.safeParse({}).success).toBe(false);
  });
});
