import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

type CronRequest = {
  headers: {
    authorization?: string;
    'x-cron-secret'?: string;
  };
};

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env['CRON_SECRET']?.trim();
    if (!expected) {
      throw new UnauthorizedException('CRON_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest<CronRequest>();
    const headerSecret = request.headers['x-cron-secret']?.trim();
    const auth = request.headers.authorization;
    const bearer = auth?.startsWith('Bearer ')
      ? auth.slice('Bearer '.length).trim()
      : '';
    const provided = headerSecret || bearer;

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid cron secret');
    }
    return true;
  }
}
