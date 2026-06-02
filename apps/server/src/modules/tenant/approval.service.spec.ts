// ApprovalService 单元测试 — workflow 创建 / 提交 / 通过 / 驳回
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  approvalWorkflow: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  approvalRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  approvalStep: {
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  teamActivity: { create: jest.fn() },
};

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ApprovalService>(ApprovalService);
  });

  // ── createWorkflow ────────────────────────────────────────────────

  describe('createWorkflow', () => {
    it('should persist a workflow with steps JSON', async () => {
      const steps = [
        { order: 1, roleId: 'r-manager', requiredCount: 1 },
        { order: 2, roleId: 'r-admin', requiredCount: 1 },
      ];
      mockPrisma.approvalWorkflow.create.mockImplementation(async ({ data }: any) => ({
        id: 'wf-1',
        ...data,
      }));

      const result = await service.createWorkflow('t1', {
        name: '内容发布',
        resourceType: 'material',
        steps,
      });

      expect(result.id).toBe('wf-1');
      expect(mockPrisma.approvalWorkflow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 't1',
            name: '内容发布',
            resourceType: 'material',
            steps,
          }),
        }),
      );
    });
  });

  // ── submitRequest ─────────────────────────────────────────────────

  describe('submitRequest', () => {
    it('should create a pending request with N steps from workflow', async () => {
      mockPrisma.approvalWorkflow.findFirst.mockResolvedValue({
        id: 'wf-1',
        steps: [
          { order: 1, roleId: 'r-a', requiredCount: 1 },
          { order: 2, roleId: 'r-b', requiredCount: 1 },
        ],
      });
      mockPrisma.approvalRequest.create.mockImplementation(async ({ data }: any) => ({
        id: 'req-1',
        tenantId: data.tenantId,
        workflowId: data.workflowId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        submitterId: data.submitterId,
        status: 'pending',
        steps: { create: data.steps.create },
      }));
      mockPrisma.teamActivity.create.mockResolvedValue({});

      const result = await service.submitRequest('t1', 'u-sub', {
        resourceType: 'material',
        resourceId: 'mat-1',
      });

      expect(result.id).toBe('req-1');
      // 验证根据 workflow 的 steps 数量生成对应步骤, status 全为 pending
      const createCall = mockPrisma.approvalRequest.create.mock.calls[0][0];
      expect(createCall.data.steps.create).toHaveLength(2);
      expect(createCall.data.steps.create[0]).toEqual({
        stepOrder: 1,
        approverId: '',
        status: 'pending',
      });
      // 团队活动记录被创建
      expect(mockPrisma.teamActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'material.submitted',
            targetType: 'approval_request',
            targetId: 'req-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException when no matching workflow', async () => {
      mockPrisma.approvalWorkflow.findFirst.mockResolvedValue(null);

      await expect(
        service.submitRequest('t1', 'u-sub', {
          resourceType: 'material',
          resourceId: 'mat-x',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
    });
  });

  // ── rejectRequest ─────────────────────────────────────────────────

  describe('rejectRequest', () => {
    it('should mark all pending steps rejected and request rejected', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        tenantId: 't1',
        resourceType: 'material',
        status: 'pending',
        steps: [
          { id: 's1', status: 'pending' },
          { id: 's2', status: 'pending' },
        ],
      });
      mockPrisma.approvalStep.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.approvalRequest.update.mockResolvedValue({});
      mockPrisma.teamActivity.create.mockResolvedValue({});

      const result = await service.rejectRequest('req-1', 'u-app', '不符合规范');

      expect(result.rejected).toBe(true);
      // 一次性 updateMany 所有 pending 步骤为 rejected
      expect(mockPrisma.approvalStep.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: 'req-1', status: 'pending', request: { tenantId: 't1' } },
          data: expect.objectContaining({
            approverId: 'u-app',
            status: 'rejected',
            comment: '不符合规范',
          }),
        }),
      );
      // request 状态置为 rejected
      expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1', tenantId: 't1' },
          data: expect.objectContaining({ status: 'rejected' }),
        }),
      );
    });

    it('should throw BadRequestException when request already resolved', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
        steps: [],
      });

      await expect(
        service.rejectRequest('req-1', 'u-app', 'late'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.approvalStep.updateMany).not.toHaveBeenCalled();
    });
  });
});
