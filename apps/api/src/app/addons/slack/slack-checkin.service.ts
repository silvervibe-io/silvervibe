import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AddonConnectionStatus, AddonProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StandupsService } from '../../standups/standups.service';
import { verifySlackSignature } from './slack-signing';

type SlackCommandPayload = {
  team_id?: string;
  user_id?: string;
  trigger_id?: string;
  channel_id?: string;
  text?: string;
  response_url?: string;
};

type ModalMeta = {
  workspaceId: string;
  teamId: string;
  slackTeamId: string;
  slackUserId: string;
};

@Injectable()
export class SlackCheckinService {
  private readonly logger = new Logger(SlackCheckinService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => StandupsService))
    private readonly standups: StandupsService,
  ) {}

  private signingSecret(): string | undefined {
    return process.env['SLACK_SIGNING_SECRET']?.trim() || undefined;
  }

  assertSignedRequest(input: {
    signatureHeader: string | undefined;
    timestampHeader: string | undefined;
    rawBody: Buffer | undefined;
  }): void {
    const secret = this.signingSecret();
    if (!secret) {
      throw new UnauthorizedException('SLACK_SIGNING_SECRET is not configured');
    }
    if (!input.rawBody || input.rawBody.length === 0) {
      throw new UnauthorizedException('Missing raw body for Slack signature');
    }
    const ok = verifySlackSignature({
      signingSecret: secret,
      signatureHeader: input.signatureHeader,
      timestampHeader: input.timestampHeader,
      rawBody: input.rawBody,
    });
    if (!ok) {
      throw new UnauthorizedException('Invalid Slack signature');
    }
  }

  async handleCommand(
    body: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const payload = body as SlackCommandPayload;
    const slackTeamId = payload.team_id?.trim();
    const slackUserId = payload.user_id?.trim();
    const triggerId = payload.trigger_id?.trim();
    if (!slackTeamId || !slackUserId || !triggerId) {
      return this.ephemeral('Missing Slack team, user, or trigger id.');
    }

    const connection = await this.findConnection(slackTeamId);
    if (!connection) {
      return this.ephemeral(
        'This Slack workspace is not connected to Silvervibe. Ask a workspace admin to Connect Slack.',
      );
    }

    const resolved = await this.resolveUser({
      slackTeamId,
      slackUserId,
      workspaceId: connection.workspaceId,
      botToken: connection.secretsRef ?? '',
    });
    if (!resolved.ok) {
      return this.ephemeral(resolved.message);
    }

    const teams = await this.prisma.teamMember.findMany({
      where: {
        userId: resolved.userId,
        team: { workspaceId: connection.workspaceId },
      },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (teams.length === 0) {
      return this.ephemeral(
        'You are not a member of any VibeStandup team in this workspace.',
      );
    }

    const requested = payload.text?.trim();
    let teamId = teams[0]!.team.id;
    if (requested) {
      const match = teams.find(
        (row) =>
          row.team.name.toLowerCase() === requested.toLowerCase() ||
          row.team.id === requested,
      );
      if (!match) {
        const names = teams.map((row) => row.team.name).join(', ');
        return this.ephemeral(
          `Unknown team "${requested}". Your teams: ${names}`,
        );
      }
      teamId = match.team.id;
    } else if (teams.length > 1) {
      const names = teams.map((row) => `\`${row.team.name}\``).join(', ');
      return this.ephemeral(
        `You are on multiple teams. Run \`/standup <team>\` with one of: ${names}`,
      );
    }

    const meta: ModalMeta = {
      workspaceId: connection.workspaceId,
      teamId,
      slackTeamId,
      slackUserId,
    };

    try {
      await this.openStandupModal({
        botToken: connection.secretsRef ?? '',
        triggerId,
        meta,
        teamName: teams.find((row) => row.team.id === teamId)?.team.name ?? '',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to open standup modal: ${message}`);
      return this.ephemeral(
        'Could not open the standup form. Reinstall Slack with updated scopes, then try again.',
      );
    }

    return { response_type: 'ephemeral', text: 'Opening your standup…' };
  }

  async handleInteraction(
    payloadJson: string,
  ): Promise<Record<string, unknown> | ''> {
    let payload: {
      type?: string;
      user?: { id?: string };
      team?: { id?: string };
      view?: {
        private_metadata?: string;
        state?: {
          values?: Record<string, Record<string, { value?: string | null }>>;
        };
      };
    };
    try {
      payload = JSON.parse(payloadJson) as typeof payload;
    } catch {
      throw new BadRequestException('Invalid Slack interaction payload');
    }

    if (payload.type !== 'view_submission') {
      return '';
    }

    const metaRaw = payload.view?.private_metadata;
    if (!metaRaw) {
      throw new BadRequestException('Missing modal metadata');
    }
    let meta: ModalMeta;
    try {
      meta = JSON.parse(metaRaw) as ModalMeta;
    } catch {
      throw new BadRequestException('Invalid modal metadata');
    }

    const values = payload.view?.state?.values ?? {};
    const yesterday =
      values['yesterday_block']?.['yesterday_input']?.value?.trim() ?? '';
    const today = values['today_block']?.['today_input']?.value?.trim() ?? '';
    const blockers =
      values['blockers_block']?.['blockers_input']?.value?.trim() ?? '';

    if (!yesterday || !today) {
      return {
        response_action: 'errors',
        errors: {
          yesterday_block: !yesterday ? 'Required' : undefined,
          today_block: !today ? 'Required' : undefined,
        },
      };
    }

    const connection = await this.findConnection(meta.slackTeamId);
    if (!connection) {
      return {
        response_action: 'errors',
        errors: {
          today_block: 'Slack is no longer connected for this workspace.',
        },
      };
    }

    const resolved = await this.resolveUser({
      slackTeamId: meta.slackTeamId,
      slackUserId: meta.slackUserId,
      workspaceId: meta.workspaceId,
      botToken: connection.secretsRef ?? '',
    });
    if (!resolved.ok) {
      return {
        response_action: 'errors',
        errors: { today_block: resolved.message },
      };
    }

    try {
      await this.standups.upsertForMember(
        meta.teamId,
        resolved.userId,
        {
          yesterday,
          today,
          blockers,
          status: 'SUBMITTED',
        },
        undefined,
        'slack',
      );
    } catch (err: unknown) {
      const message =
        err instanceof BadRequestException
          ? String(err.message)
          : err instanceof Error
            ? err.message
            : 'Could not save standup';
      return {
        response_action: 'errors',
        errors: {
          today_block: message.startsWith('standup.')
            ? 'Standup is not open right now.'
            : message,
        },
      };
    }

    return { response_action: 'clear' };
  }

  private ephemeral(text: string): Record<string, unknown> {
    return { response_type: 'ephemeral', text };
  }

  private async findConnection(slackTeamId: string) {
    return this.prisma.addonConnection.findFirst({
      where: {
        provider: AddonProvider.SLACK,
        status: AddonConnectionStatus.CONNECTED,
        externalId: slackTeamId,
      },
      select: {
        workspaceId: true,
        secretsRef: true,
        externalId: true,
      },
    });
  }

  private async resolveUser(input: {
    slackTeamId: string;
    slackUserId: string;
    workspaceId: string;
    botToken: string;
  }): Promise<
    | { ok: true; userId: string }
    | { ok: false; message: string; userId?: undefined }
  > {
    const linked = await this.prisma.slackUserLink.findUnique({
      where: {
        slackTeamId_slackUserId: {
          slackTeamId: input.slackTeamId,
          slackUserId: input.slackUserId,
        },
      },
    });
    if (linked) {
      return { ok: true, userId: linked.userId };
    }

    const email = await this.fetchSlackUserEmail(
      input.botToken,
      input.slackUserId,
    );
    if (!email) {
      return {
        ok: false,
        message:
          'Could not read your Slack email. Ask a workspace admin to ensure the bot has users:read.email, and that your Slack profile email is visible.',
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return {
        ok: false,
        message: `No Silvervibe account matches Slack email ${email}. Sign in on the web first, then retry.`,
      };
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: user.id,
        },
      },
    });
    if (!membership) {
      return {
        ok: false,
        message: 'Your Silvervibe account is not a member of this workspace.',
      };
    }

    await this.prisma.slackUserLink.upsert({
      where: {
        slackTeamId_slackUserId: {
          slackTeamId: input.slackTeamId,
          slackUserId: input.slackUserId,
        },
      },
      create: {
        slackTeamId: input.slackTeamId,
        slackUserId: input.slackUserId,
        userId: user.id,
        email,
      },
      update: { userId: user.id, email },
    });

    return { ok: true, userId: user.id };
  }

  private async fetchSlackUserEmail(
    botToken: string,
    slackUserId: string,
  ): Promise<string | null> {
    if (!botToken.startsWith('xoxb-')) {
      return null;
    }
    const url = new URL('https://slack.com/api/users.info');
    url.searchParams.set('user', slackUserId);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = (await res.json()) as {
      ok?: boolean;
      user?: { profile?: { email?: string } };
      error?: string;
    };
    if (!data.ok) {
      this.logger.warn(`users.info failed: ${data.error ?? res.status}`);
      return null;
    }
    const email = data.user?.profile?.email?.trim();
    return email || null;
  }

  private async openStandupModal(input: {
    botToken: string;
    triggerId: string;
    meta: ModalMeta;
    teamName: string;
  }): Promise<void> {
    if (!input.botToken.startsWith('xoxb-')) {
      throw new Error('Bot token required to open modal');
    }
    const view = {
      type: 'modal',
      callback_id: 'standup_submit',
      private_metadata: JSON.stringify(input.meta),
      title: { type: 'plain_text', text: 'Daily standup' },
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${input.teamName || 'Team'}* — answers sync to Silvervibe (same as the web form).`,
          },
        },
        {
          type: 'input',
          block_id: 'yesterday_block',
          label: { type: 'plain_text', text: 'Yesterday' },
          element: {
            type: 'plain_text_input',
            action_id: 'yesterday_input',
            multiline: true,
          },
        },
        {
          type: 'input',
          block_id: 'today_block',
          label: { type: 'plain_text', text: 'Today' },
          element: {
            type: 'plain_text_input',
            action_id: 'today_input',
            multiline: true,
          },
        },
        {
          type: 'input',
          block_id: 'blockers_block',
          optional: true,
          label: { type: 'plain_text', text: 'Blockers' },
          element: {
            type: 'plain_text_input',
            action_id: 'blockers_input',
            multiline: true,
          },
        },
      ],
    };

    const res = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ trigger_id: input.triggerId, view }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!data.ok) {
      throw new Error(data.error ?? `views.open HTTP ${res.status}`);
    }
  }
}
