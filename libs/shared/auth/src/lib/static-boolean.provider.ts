import {
  EvaluationContext,
  JsonValue,
  Logger,
  Provider,
  ResolutionDetails,
} from '@openfeature/web-sdk';

export class StaticBooleanProvider implements Provider {
  readonly metadata = { name: 'silvervibe-static-web' };
  readonly runsOn = 'client' as const;

  constructor(private readonly flags: Record<string, boolean>) {}

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    _context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<boolean> {
    return {
      value: this.flags[flagKey] ?? defaultValue,
      reason: 'STATIC',
    };
  }

  resolveStringEvaluation(
    _flagKey: string,
    defaultValue: string,
    _context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<string> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }

  resolveNumberEvaluation(
    _flagKey: string,
    defaultValue: number,
    _context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<number> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }

  resolveObjectEvaluation<U extends JsonValue>(
    _flagKey: string,
    defaultValue: U,
    _context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<U> {
    return { value: defaultValue, reason: 'DEFAULT' };
  }
}
