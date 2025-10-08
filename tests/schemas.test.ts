import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

process.env.NODE_ENV = 'test';
process.env.FELLOW_SUBDOMAIN = process.env.FELLOW_SUBDOMAIN ?? 'stub';
process.env.FELLOW_API_KEY = process.env.FELLOW_API_KEY ?? 'stub';

let serverModule: any;

beforeAll(async () => {
  serverModule = await import('../server.ts');
});

describe('tool input schemas', () => {
  test('list_notes applies defaults and accepts minimal input', () => {
    const schema = z.object(serverModule.listNotesInputSchema);
    const parsed = schema.parse({});

    expect(parsed.include_content_markdown).toBe(false);
    expect(parsed.include_event_attendees).toBe(false);
    expect(parsed.page_size).toBe(20);
    expect(parsed.max_pages).toBe(3);
    expect(parsed.filters).toBeUndefined();
  });

  test('list_notes rejects out-of-range pagination', () => {
    const schema = z.object(serverModule.listNotesInputSchema);
    const result = schema.safeParse({ page_size: 0, max_pages: 25 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'page_size')).toBe(true);
    }
  });

  test('list_recordings mirrors pagination validation', () => {
    const schema = z.object(serverModule.listRecordingsInputSchema);
    const ok = schema.safeParse({});
    expect(ok.success).toBe(true);

    const bad = schema.safeParse({ page_size: 100 });
    expect(bad.success).toBe(false);
  });

  test('get_note enforces a note id', () => {
    const schema = z.object(serverModule.getNoteInputSchema);

    expect(schema.safeParse({ note_id: 'abc-123' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
