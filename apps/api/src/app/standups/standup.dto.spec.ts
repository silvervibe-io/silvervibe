import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { UpsertStandupEntryDto } from './standup.dto';

describe('UpsertStandupEntryDto validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: UpsertStandupEntryDto,
    data: '',
  };

  it('accepts a submit body that includes answers', async () => {
    const value = await pipe.transform(
      {
        yesterday: 'Shipped the draft',
        today: 'Review the summary',
        blockers: '',
        status: 'SUBMITTED',
        answers: {
          blockers: {
            text: 'Need a review',
            helpFrom: 'Ada',
            replyNeeded: 'today',
          },
        },
      },
      metadata,
    );

    expect(value.answers?.['blockers']?.text).toBe('Need a review');
    expect(value.answers?.['blockers']?.replyNeeded).toBe('today');
  });
});
