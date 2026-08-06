import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(dto: CreateCouponDto, actorId: string) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) throw new ConflictException('Coupon code already exists');

    const coupon = await this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });

    await this.audit.log({
      actorId,
      action: 'COUPON_CREATED',
      entityType: 'Coupon',
      entityId: coupon.id,
    });
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto, actorId: string) {
    await this.findOne(id);
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
    await this.audit.log({
      actorId,
      action: 'COUPON_UPDATED',
      entityType: 'Coupon',
      entityId: id,
      metadata: dto,
    });
    return coupon;
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      actorId,
      action: 'COUPON_DEACTIVATED',
      entityType: 'Coupon',
      entityId: id,
    });
    return { message: 'Coupon deactivated' };
  }

  /**
   * Validates a coupon code against usage limits and validity window, and
   * returns the discount amount to apply to a given subtotal. Used by the
   * booking engine at checkout time — never trust a discount the client
   * computed itself.
   */
  async validateAndComputeDiscount(
    code: string,
    subtotal: number,
  ): Promise<{ couponId: string; discountAmount: number }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or inactive coupon code');
    }
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      throw new BadRequestException('This coupon is not active yet');
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      throw new BadRequestException('This coupon has expired');
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    const discountAmount =
      coupon.type === CouponType.PERCENTAGE
        ? (subtotal * Number(coupon.value)) / 100
        : Math.min(Number(coupon.value), subtotal);

    return { couponId: coupon.id, discountAmount };
  }

  async incrementUsage(couponId: string) {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }
}
