import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  it('returns a local stub when Prisma is disabled', async () => {
    const prisma = {
      isEnabled: () => false,
    } as unknown as PrismaService;
    const service = new UsersService(prisma);
    await expect(
      service.upsertFromFirebase({
        uid: 'u1',
        email: 'u1@example.com',
        displayName: 'U1',
      }),
    ).resolves.toEqual({
      id: 'local',
      firebaseUid: 'u1',
      email: 'u1@example.com',
      displayName: 'U1',
    });
  });

  it('upserts by firebaseUid when Prisma is enabled', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'cuid1',
      firebaseUid: 'u1',
      email: 'u1@example.com',
      displayName: 'U1',
    });
    const prisma = {
      isEnabled: () => true,
      user: { upsert },
    } as unknown as PrismaService;
    const service = new UsersService(prisma);
    const result = await service.upsertFromFirebase({
      uid: 'u1',
      email: 'u1@example.com',
      displayName: 'U1',
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { firebaseUid: 'u1' },
      create: {
        firebaseUid: 'u1',
        email: 'u1@example.com',
        displayName: 'U1',
      },
      update: {
        email: 'u1@example.com',
        displayName: 'U1',
      },
    });
    expect(result.id).toBe('cuid1');
  });
});
