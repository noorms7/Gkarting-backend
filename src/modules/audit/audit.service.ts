import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Fire-and-forget style logging: audit failures should never break the
   * primary request, so errors are caught and logged rather than thrown.
   */
  async log(input: AuditLogInput) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? undefined,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? undefined,
          metadata: input.metadata ?? undefined,
          ipAddress: input.ipAddress,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err as any);
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    entityType?: string;
    actorId?: string;
  }) {
    const { skip = 0, take = 50, entityType, actorId } = params;
    const where = {
      ...(entityType ? { entityType } : {}),
      ...(actorId ? { actorId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, skip, take };
  }
}
