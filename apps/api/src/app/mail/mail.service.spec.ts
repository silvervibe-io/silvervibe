import { MailService } from './mail.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('MailService', () => {
  const previous = new Map<string, string | undefined>();

  function setEnv(key: string, value: string | undefined): void {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  afterEach(() => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    previous.clear();
    sendMock.mockReset();
  });

  it('reports not configured when RESEND_API_KEY is missing', async () => {
    setEnv('RESEND_API_KEY', undefined);
    const mail = new MailService();
    expect(mail.isConfigured()).toBe(false);
    await expect(
      mail.sendTeamInvite({
        to: 'a@example.com',
        teamName: 'Alpha',
        acceptUrl: 'http://localhost:4201/invite/tok',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      }),
    ).resolves.toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends invite mail when Resend is configured', async () => {
    setEnv('RESEND_API_KEY', 're_test');
    setEnv('EMAIL_FROM', 'VibeStandup <invites@silvervibe.io>');
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    const mail = new MailService();
    expect(mail.isConfigured()).toBe(true);
    await expect(
      mail.sendTeamInvite({
        to: 'a@example.com',
        teamName: 'Alpha <Team>',
        acceptUrl: 'http://localhost:4201/invite/tok',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      }),
    ).resolves.toBe(true);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'VibeStandup <invites@silvervibe.io>',
        to: ['a@example.com'],
        subject: "You're invited to Alpha <Team> on VibeStandup",
      }),
    );
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain('Alpha &lt;Team&gt;');
    expect(html).toContain('http://localhost:4201/invite/tok');
  });

  it('returns false when Resend reports an error', async () => {
    setEnv('RESEND_API_KEY', 're_test');
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'boom', name: 'validation_error' },
    });
    const mail = new MailService();
    await expect(
      mail.send({
        to: 'a@example.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
        text: 'Hi',
      }),
    ).resolves.toBe(false);
  });
});
