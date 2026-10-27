import { AiService } from './ai.service';

describe('AiService', () => {
  const originalFetch = global.fetch;
  const envKeys = ['PUBLIC_AI_URL', 'AI_STANDUP_SUMMARY'] as const;
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      previous[key] = process.env[key];
    }
    process.env['PUBLIC_AI_URL'] = 'http://ai.test';
    process.env['AI_STANDUP_SUMMARY'] = 'true';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const key of envKeys) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('returns markdown from the AI service', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ markdown: '## Team standup\n\n- done' }),
    }) as unknown as typeof fetch;

    const service = new AiService();
    const markdown = await service.summarizeStandup({
      teamName: 'Alpha',
      entryDate: '2026-10-27',
      entries: [{ displayName: 'Ada', today: 'ship' }],
    });

    expect(markdown).toContain('Team standup');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ai.test/graphs/standup-summary',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns null when AI_STANDUP_SUMMARY is not opted in', async () => {
    delete process.env['AI_STANDUP_SUMMARY'];
    global.fetch = jest.fn() as unknown as typeof fetch;

    const service = new AiService();
    await expect(
      service.summarizeStandup({
        teamName: 'Alpha',
        entryDate: '2026-10-27',
        entries: [],
      }),
    ).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null when the AI request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));

    const service = new AiService();
    await expect(
      service.summarizeStandup({
        teamName: 'Alpha',
        entryDate: '2026-10-27',
        entries: [{ displayName: 'Ada', today: 'ship' }],
      }),
    ).resolves.toBeNull();
  });
});
