import { Injectable, Logger } from '@nestjs/common';

export type StandupSummaryEntryInput = {
  displayName: string;
  yesterday?: string | null;
  today?: string | null;
  blockers?: string | null;
};

export type StandupSummaryRequest = {
  teamName: string;
  entryDate: string;
  entries: StandupSummaryEntryInput[];
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private publicAiBase(): string | undefined {
    const fromEnv = process.env['PUBLIC_AI_URL']?.trim();
    if (!fromEnv) {
      return undefined;
    }
    return fromEnv.replace(/\/$/, '');
  }

  /**
   * Opt-in: set AI_STANDUP_SUMMARY=1|true|on (and PUBLIC_AI_URL).
   * Keeps local submit fast when the AI process is not running.
   */
  isStandupSummaryEnabled(): boolean {
    const flag = process.env['AI_STANDUP_SUMMARY']?.trim().toLowerCase();
    if (flag !== '1' && flag !== 'true' && flag !== 'on' && flag !== 'yes') {
      return false;
    }
    return Boolean(this.publicAiBase());
  }

  /**
   * Calls LangGraph standup-summary. Returns null on any failure so callers
   * can fall back to deterministic markdown.
   */
  async summarizeStandup(
    request: StandupSummaryRequest,
  ): Promise<string | null> {
    if (!this.isStandupSummaryEnabled()) {
      return null;
    }
    const base = this.publicAiBase();
    if (!base) {
      return null;
    }

    const url = `${base}/graphs/standup-summary`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_name: request.teamName,
          entry_date: request.entryDate,
          entries: request.entries.map((entry) => ({
            display_name: entry.displayName,
            yesterday: entry.yesterday ?? null,
            today: entry.today ?? null,
            blockers: entry.blockers ?? null,
          })),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.warn(`Standup summary AI failed (${res.status}) at ${url}`);
        return null;
      }
      const body = (await res.json()) as { markdown?: unknown };
      const markdown =
        typeof body.markdown === 'string' ? body.markdown.trim() : '';
      return markdown || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Standup summary AI error: ${message}`);
      return null;
    }
  }
}
