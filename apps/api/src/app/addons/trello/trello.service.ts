import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AddonConnectionStatus,
  AddonProvider,
  WorkspaceRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { TOOL_KEYS } from '@silvervibe/shared/feature-flags';
import { VerifiedUser } from '../../auth/firebase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { AddonStatusDto } from '../addon-status.dto';
import type { MentionIssue } from '../mention-issue';
import { TrelloConnectionDto, TrelloOAuthStartDto } from './trello.dto';

type TrelloSecret = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type TrelloMetadata = {
  accountLogin?: string;
  oauthNonce?: string;
  oauthExp?: number;
  oauthUserId?: string;
  codeVerifier?: string;
};

type OAuthStatePayload = {
  workspaceId: string;
  userId: string;
  exp: number;
  nonce: string;
};

type TokenJson = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

type TrelloCard = {
  name?: string;
  url?: string;
  shortLink?: string;
  closed?: boolean;
};

type TrelloMember = { username?: string };

const STATE_TTL_MS = 15 * 60 * 1000;
const OAUTH_SCOPES = 'read:member:trello read:board:trello offline_access';
const AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const API = 'https://api.trello.com/1';

function storedMetadata(meta: TrelloMetadata): TrelloMetadata {
  return JSON.parse(JSON.stringify(meta)) as TrelloMetadata;
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

@Injectable()
export class TrelloService {
  private readonly logger = new Logger(TrelloService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  status(): AddonStatusDto {
    return { name: 'trello', status: 'ready' };
  }

  private ensureDb(): void {
    if (!this.prisma.isEnabled()) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured; Neon is required for Trello connections',
      );
    }
  }

  private clientId(): string | undefined {
    return process.env['TRELLO_CLIENT_ID']?.trim() || undefined;
  }

  private clientSecret(): string | undefined {
    return process.env['TRELLO_CLIENT_SECRET']?.trim() || undefined;
  }

  oauthConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret());
  }

  private requireOAuthConfigured(): { clientId: string; clientSecret: string } {
    const clientId = this.clientId();
    const clientSecret = this.clientSecret();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Trello OAuth is not configured (TRELLO_CLIENT_ID / TRELLO_CLIENT_SECRET)',
      );
    }
    return { clientId, clientSecret };
  }

  private publicApiBase(): string {
    const fromEnv = process.env['PUBLIC_API_URL']?.trim();
    if (fromEnv) {
      return fromEnv.replace(/\/$/, '');
    }
    const port = process.env['PORT'] || process.env['API_PORT'] || '3000';
    return `http://localhost:${port}/api`;
  }

  redirectUri(): string {
    const override = process.env['TRELLO_REDIRECT_URI']?.trim();
    if (override) {
      return override;
    }
    return `${this.publicApiBase()}/addons/trello/oauth/callback`;
  }

  private standupAppOrigin(): string {
    return (
      process.env['PUBLIC_STANDUP_URL']?.trim().replace(/\/$/, '') ||
      'http://localhost:4201'
    );
  }

  workspaceRedirect(result: 'connected' | 'error', detail?: unknown): string {
    const url = new URL('/app/workspace', `${this.standupAppOrigin()}/`);
    url.searchParams.set('trello', result);
    const detailText = this.asSingleString(detail);
    if (detailText) {
      url.searchParams.set('trelloDetail', detailText.slice(0, 120));
    }
    return url.toString();
  }

  private asSingleString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      const trimmed = value[0].trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  }

  private async requireWorkspaceAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException('Workspace admin required');
    }
  }

  private asMetadata(raw: unknown): TrelloMetadata {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const obj = raw as Record<string, unknown>;
    const str = (key: string): string | undefined => {
      const value = obj[key];
      return typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined;
    };
    const num = (key: string): number | undefined => {
      const value = obj[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
    };
    return {
      accountLogin: str('accountLogin'),
      oauthNonce: str('oauthNonce'),
      oauthExp: num('oauthExp'),
      oauthUserId: str('oauthUserId'),
      codeVerifier: str('codeVerifier'),
    };
  }

  private encodeOAuthState(payload: OAuthStatePayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private async consumeOAuthState(state: string): Promise<OAuthStatePayload> {
    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw new BadRequestException('Invalid OAuth state payload');
    }
    if (
      typeof payload.workspaceId !== 'string' ||
      !payload.workspaceId.trim() ||
      typeof payload.userId !== 'string' ||
      !payload.userId.trim() ||
      typeof payload.nonce !== 'string' ||
      !payload.nonce.trim() ||
      typeof payload.exp !== 'number'
    ) {
      throw new BadRequestException('Invalid OAuth state fields');
    }
    if (Date.now() > payload.exp) {
      throw new BadRequestException('OAuth state expired');
    }
    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: payload.workspaceId,
          provider: AddonProvider.TRELLO,
        },
      },
    });
    if (!connection || connection.status !== AddonConnectionStatus.PENDING) {
      throw new BadRequestException('OAuth install is not pending');
    }
    const meta = this.asMetadata(connection.metadataJson);
    if (
      !meta.oauthNonce ||
      meta.oauthNonce !== payload.nonce ||
      meta.oauthUserId !== payload.userId ||
      !meta.codeVerifier
    ) {
      throw new BadRequestException('OAuth state nonce mismatch');
    }
    if (typeof meta.oauthExp === 'number' && Date.now() > meta.oauthExp) {
      throw new BadRequestException('OAuth state expired');
    }
    return {
      workspaceId: payload.workspaceId.trim(),
      userId: payload.userId.trim(),
      exp: payload.exp,
      nonce: payload.nonce.trim(),
    };
  }

  async getConnection(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<TrelloConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    const [connection, tool] = await Promise.all([
      this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId,
            provider: AddonProvider.TRELLO,
          },
        },
      }),
      this.prisma.workspaceTool.findUnique({
        where: {
          workspaceId_toolKey: {
            workspaceId,
            toolKey: TOOL_KEYS.addonsTrello,
          },
        },
      }),
    ]);
    const meta = this.asMetadata(connection?.metadataJson);
    return {
      status: (connection?.status ??
        AddonConnectionStatus.DISCONNECTED) as TrelloConnectionDto['status'],
      configured: Boolean(connection?.secretsRef?.trim()),
      accountLogin: meta.accountLogin ?? null,
      toolEnabled: tool?.enabled ?? false,
      oauthAvailable: this.oauthConfigured(),
    };
  }

  async startOAuth(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<TrelloOAuthStartDto> {
    this.ensureDb();
    const { clientId } = this.requireOAuthConfigured();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + STATE_TTL_MS;
    const { verifier, challenge } = pkcePair();
    const state = this.encodeOAuthState({ workspaceId, userId, exp, nonce });
    await this.prisma.addonConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.TRELLO,
        },
      },
      create: {
        workspaceId,
        provider: AddonProvider.TRELLO,
        status: AddonConnectionStatus.PENDING,
        metadataJson: storedMetadata({
          oauthNonce: nonce,
          oauthExp: exp,
          oauthUserId: userId,
          codeVerifier: verifier,
        }),
      },
      update: {
        status: AddonConnectionStatus.PENDING,
        metadataJson: storedMetadata({
          oauthNonce: nonce,
          oauthExp: exp,
          oauthUserId: userId,
          codeVerifier: verifier,
        }),
      },
    });
    const params = new URLSearchParams({
      client_id: clientId,
      scope: OAUTH_SCOPES,
      redirect_uri: this.redirectUri(),
      state,
      response_type: 'code',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return { authorizeUrl: `${AUTHORIZE_URL}?${params.toString()}` };
  }

  async completeOAuthCallback(
    code: unknown,
    state: unknown,
    errorFromProvider: unknown,
  ): Promise<string> {
    const errorText = this.asSingleString(errorFromProvider);
    if (errorText) {
      this.logger.warn(`Trello OAuth denied: ${errorText}`);
      return this.workspaceRedirect('error', errorText);
    }
    const codeText = this.asSingleString(code);
    const stateText = this.asSingleString(state);
    if (!codeText || !stateText) {
      return this.workspaceRedirect('error', 'missing_code_or_state');
    }
    try {
      this.ensureDb();
      const { clientId, clientSecret } = this.requireOAuthConfigured();
      const payload = await this.consumeOAuthState(stateText);
      await this.requireWorkspaceAdmin(payload.workspaceId, payload.userId);
      const pending = await this.prisma.addonConnection.findUnique({
        where: {
          workspaceId_provider: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.TRELLO,
          },
        },
      });
      const verifier = this.asMetadata(pending?.metadataJson).codeVerifier;
      if (!verifier) {
        return this.workspaceRedirect('error', 'missing_code_verifier');
      }
      const tokenJson = await this.exchangeToken({
        clientId,
        clientSecret,
        grantType: 'authorization_code',
        code: codeText,
        codeVerifier: verifier,
      });
      if (!tokenJson.access_token) {
        return this.workspaceRedirect(
          'error',
          tokenJson.error ?? 'token_exchange_failed',
        );
      }
      const accountLogin = await this.fetchUsername(tokenJson.access_token);
      const expiresAt =
        typeof tokenJson.expires_in === 'number'
          ? Date.now() + tokenJson.expires_in * 1000
          : undefined;
      const secretsRef = JSON.stringify({
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt,
      } satisfies TrelloSecret);
      await this.prisma.$transaction([
        this.prisma.addonConnection.upsert({
          where: {
            workspaceId_provider: {
              workspaceId: payload.workspaceId,
              provider: AddonProvider.TRELLO,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            provider: AddonProvider.TRELLO,
            status: AddonConnectionStatus.CONNECTED,
            secretsRef,
            externalId: accountLogin ?? null,
            metadataJson: storedMetadata({ accountLogin }),
          },
          update: {
            status: AddonConnectionStatus.CONNECTED,
            secretsRef,
            externalId: accountLogin ?? null,
            metadataJson: storedMetadata({ accountLogin }),
          },
        }),
        this.prisma.workspaceTool.upsert({
          where: {
            workspaceId_toolKey: {
              workspaceId: payload.workspaceId,
              toolKey: TOOL_KEYS.addonsTrello,
            },
          },
          create: {
            workspaceId: payload.workspaceId,
            toolKey: TOOL_KEYS.addonsTrello,
            enabled: true,
          },
          update: { enabled: true },
        }),
      ]);
      return this.workspaceRedirect('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Trello OAuth callback error: ${message}`);
      return this.workspaceRedirect('error', 'callback_failed');
    }
  }

  async disconnect(
    workspaceId: string,
    user: VerifiedUser,
  ): Promise<TrelloConnectionDto> {
    this.ensureDb();
    const userId = (await this.users.upsertFromFirebase(user)).id;
    await this.requireWorkspaceAdmin(workspaceId, userId);
    const existing = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.TRELLO,
        },
      },
    });
    if (existing) {
      await this.prisma.addonConnection.update({
        where: { id: existing.id },
        data: {
          status: AddonConnectionStatus.DISCONNECTED,
          secretsRef: null,
          externalId: null,
          metadataJson: {},
        },
      });
    }
    return this.getConnection(workspaceId, user);
  }

  async searchMentionIssues(
    workspaceId: string,
    query: string,
  ): Promise<MentionIssue[]> {
    const text = query.replace(/\s+/g, ' ').trim();
    if (text.length < 2) {
      return [];
    }
    return this.mentionIssues(workspaceId, async (token) => {
      const page = await this.apiGet<{ cards?: TrelloCard[] }>(
        token,
        `/search?query=${encodeURIComponent(text)}&modelTypes=cards&cards_limit=8&card_fields=name,url,shortLink,closed`,
      );
      return this.toMentions(page?.cards ?? []).slice(0, 8);
    });
  }

  async recentMentionIssues(workspaceId: string): Promise<MentionIssue[]> {
    return this.mentionIssues(workspaceId, async (token) => {
      const cards = await this.apiGet<TrelloCard[]>(
        token,
        '/members/me/cards?filter=open&fields=name,url,shortLink,closed&limit=8',
      );
      return this.toMentions(cards ?? []).slice(0, 8);
    });
  }

  private toMentions(cards: TrelloCard[]): MentionIssue[] {
    const out: MentionIssue[] = [];
    for (const card of cards) {
      const title = card.name?.trim();
      const key = card.shortLink?.trim();
      const url = card.url?.trim();
      if (!title || !key || !url?.startsWith('https://') || card.closed) {
        continue;
      }
      out.push({ provider: 'trello', key, title, url });
    }
    return out;
  }

  private async mentionIssues(
    workspaceId: string,
    load: (token: string) => Promise<MentionIssue[]>,
  ): Promise<MentionIssue[]> {
    if (!this.prisma.isEnabled()) {
      return [];
    }
    const tool = await this.prisma.workspaceTool.findUnique({
      where: {
        workspaceId_toolKey: {
          workspaceId,
          toolKey: TOOL_KEYS.addonsTrello,
        },
      },
    });
    if (!tool?.enabled) {
      return [];
    }
    const token = await this.accessToken(workspaceId);
    if (!token) {
      return [];
    }
    try {
      return await load(token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Trello mention search failed: ${message}`);
      return [];
    }
  }

  private async accessToken(workspaceId: string): Promise<string | null> {
    const connection = await this.prisma.addonConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: AddonProvider.TRELLO,
        },
      },
    });
    if (
      !connection ||
      connection.status !== AddonConnectionStatus.CONNECTED ||
      !connection.secretsRef?.trim()
    ) {
      return null;
    }
    let secret: TrelloSecret;
    try {
      secret = JSON.parse(connection.secretsRef) as TrelloSecret;
    } catch {
      return null;
    }
    if (!secret.accessToken) {
      return null;
    }
    if (
      typeof secret.expiresAt !== 'number' ||
      secret.expiresAt - Date.now() > 60_000
    ) {
      return secret.accessToken;
    }
    if (!secret.refreshToken || !this.oauthConfigured()) {
      return null;
    }
    const { clientId, clientSecret } = this.requireOAuthConfigured();
    const refreshed = await this.exchangeToken({
      clientId,
      clientSecret,
      grantType: 'refresh_token',
      refreshToken: secret.refreshToken,
    });
    if (!refreshed.access_token) {
      return null;
    }
    const next: TrelloSecret = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? secret.refreshToken,
      expiresAt:
        typeof refreshed.expires_in === 'number'
          ? Date.now() + refreshed.expires_in * 1000
          : undefined,
    };
    await this.prisma.addonConnection.update({
      where: { id: connection.id },
      data: { secretsRef: JSON.stringify(next) },
    });
    return next.accessToken;
  }

  private async fetchUsername(token: string): Promise<string | undefined> {
    const me = await this.apiGet<TrelloMember>(
      token,
      '/members/me?fields=username',
    );
    const name = me?.username?.trim();
    return name || undefined;
  }

  private async apiGet<T>(token: string, path: string): Promise<T | null> {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  }

  private async exchangeToken(opts: {
    clientId: string;
    clientSecret: string;
    grantType: 'authorization_code' | 'refresh_token';
    code?: string;
    codeVerifier?: string;
    refreshToken?: string;
  }): Promise<TokenJson> {
    const body: Record<string, string> = {
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: opts.grantType,
    };
    if (opts.grantType === 'authorization_code') {
      body['redirect_uri'] = this.redirectUri();
      if (opts.code) {
        body['code'] = opts.code;
      }
      if (opts.codeVerifier) {
        body['code_verifier'] = opts.codeVerifier;
      }
    }
    if (opts.refreshToken) {
      body['refresh_token'] = opts.refreshToken;
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as TokenJson;
    if (!res.ok || !json.access_token) {
      return { error: json.error || 'token_exchange_failed' };
    }
    return json;
  }
}
