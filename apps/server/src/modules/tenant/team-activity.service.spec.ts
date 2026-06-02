// TeamActivityService 单元测试 — 活动分页查询 + 过滤
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { TeamActivityService } from './team-activity.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  teamActivity: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('TeamActivityService', () => {
  let service: TeamActivityService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamActivityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<TeamActivityService>(TeamActivityService);
  });

  // ── getActivities ─────────────────────────────────────────────────

  describe('getActivities', () => {
    it('should return paginated list with defaults (page=1, page_size=20)', async () => {
      const rows = [
        { id: 'a1', action: 'user.invited', user: { id: 'u1', name: 'Alice' } },
        { id: 'a2', action: 'user.joined', user: { id: 'u2', name: 'Bob' } },
      ];
      mockPrisma.teamActivity.findMany.mockResolvedValue(rows);
      mockPrisma.teamActivity.count.mockResolvedValue(2);

      const result = await service.getActivities('t1', {});

      expect(result.list).toEqual(rows);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(20);
      // skip = (1-1)*20 = 0, take = 20
      expect(mockPrisma.teamActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1' },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
      // findMany 与 count 共用同一个 where
      expect(mockPrisma.teamActivity.count).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
      });
    });

    it('should apply userId and action startsWith filters with custom paging', async () => {
      mockPrisma.teamActivity.findMany.mockResolvedValue([]);
      mockPrisma.teamActivity.count.mockResolvedValue(0);

      const result = await service.getActivities('t1', {
        page: 3,
        page_size: 5,
        action: 'user',
        userId: 'u-actor',
      });

      expect(result.page).toBe(3);
      expect(result.page_size).toBe(5);
      // skip = (3-1)*5 = 10, take = 5
      expect(mockPrisma.teamActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 't1',
            action: { startsWith: 'user' },
            userId: 'u-actor',
          },
          skip: 10,
          take: 5,
        }),
      );
      // count 也必须应用相同 where
      expect(mockPrisma.teamActivity.count).toHaveBeenCalledWith({
        where: {
          tenantId: 't1',
          action: { startsWith: 'user' },
          userId: 'u-actor',
        },
      });
    });
  });
});
