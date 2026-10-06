import {
  EvaluationContext,
  JsonValue,
  Logger,
  Provider,
  ResolutionDetails,
} from '@openfeature/server-sdk';

/** Local defaults when GrowthBook keys are not configured. */
export class StaticBooleanProvider implements Provider {
  readonly metadata = { name: 'silvervibe-static' };
  readonly runsOn = 'server' as const;

  constructor(private readonly flags: Record<string, boolean>) {}

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    _context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<boolean>> {
    return {
      value: this.flags[flagKey] ?? defaultValue,
      reason: 'STATIC',
    };
  }

  async resolveStringEvaluation(
    _flagKey: string,
    defaultValue: string,
  ): Promise<ResolutionDetails<string>> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }

  async resolveNumberEvaluation(
    _flagKey: string,
    defaultValue: number,
  ): Promise<ResolutionDetails<number>> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }

  async resolveObjectEvaluation<U extends JsonValue>(
    _flagKey: string,
    defaultValue: U,
  ): Promise<ResolutionDetails<U>> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }
}
