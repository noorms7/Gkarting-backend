import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KartStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateKartDto, UpdateKartDto } from './dto/kart.dto';

@Injectable()
export class KartsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(status?: KartStatus) {
    return this.prisma.kart.findMany({
      where: status ? { status } : undefined,
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const kart = await this.prisma.kart.findUnique({ where: { id } });
    if (!kart) throw new NotFoundException('Kart not found');
    return kart;
  }

  async create(dto: CreateKartDto, actorId: string) {
    const existing = await this.prisma.kart.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException('Kart code already in use');

    const kart = await this.prisma.kart.create({ data: dto });

    await this.audit.log({
      actorId,
      action: 'KART_CREATED',
      entityType: 'Kart',
      entityId: kart.id,
    });
    return kart;
  }

  async update(id: string, dto: UpdateKartDto, actorId: string) {
    await this.findOne(id);
    const kart = await this.prisma.kart.update({ where: { id }, data: dto });

    await this.audit.log({
      actorId,
      action: 'KART_UPDATED',
      entityType: 'Kart',
      entityId: id,
      metadata: dto,
    });
    return kart;
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.kart.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: 'KART_DELETED',
      entityType: 'Kart',
      entityId: id,
    });
    return { message: 'Kart deleted' };
  }

  async setStatus(id: string, status: KartStatus, actorId: string) {
    await this.findOne(id);
    const kart = await this.prisma.kart.update({
      where: { id },
      data: {
        status,
        lastServiceAt: status === KartStatus.AVAILABLE ? new Date() : undefined,
      },
    });

    await this.audit.log({
      actorId,
      action: 'KART_STATUS_CHANGED',
      entityType: 'Kart',
      entityId: id,
      metadata: { status },
    });
    return kart;
  }

  /** Number of karts physically available for assignment (used by bookings). */
  async countAvailable(): Promise<number> {
    return this.prisma.kart.count({ where: { status: KartStatus.AVAILABLE } });
  }

  async getAvailableKartIds(limit: number): Promise<string[]> {
    const karts = await this.prisma.kart.findMany({
      where: { status: KartStatus.AVAILABLE },
      take: limit,
      select: { id: true },
    });
    return karts.map((k) => k.id);
  }
}
