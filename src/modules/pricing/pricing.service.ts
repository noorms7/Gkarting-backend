import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePricingPackageDto,
  UpdatePricingPackageDto,
} from './dto/pricing.dto';

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAllActive() {
    return this.prisma.pricingPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async adminFindAll() {
    return this.prisma.pricingPackage.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const pkg = await this.prisma.pricingPackage.findUnique({
      where: { id },
    });
    if (!pkg) throw new NotFoundException('Pricing package not found');
    return pkg;
  }

  async create(dto: CreatePricingPackageDto, actorId: string) {
    const pkg = await this.prisma.pricingPackage.create({ data: dto });
    await this.audit.log({
      actorId,
      action: 'PRICING_PACKAGE_CREATED',
      entityType: 'PricingPackage',
      entityId: pkg.id,
    });
    return pkg;
  }

  async update(id: string, dto: UpdatePricingPackageDto, actorId: string) {
    await this.findOne(id);
    const pkg = await this.prisma.pricingPackage.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      actorId,
      action: 'PRICING_PACKAGE_UPDATED',
      entityType: 'PricingPackage',
      entityId: id,
      metadata: dto,
    });
    return pkg;
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    // Soft-remove: keep historical bookings intact, just hide from storefront.
    const pkg = await this.prisma.pricingPackage.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      actorId,
      action: 'PRICING_PACKAGE_DEACTIVATED',
      entityType: 'PricingPackage',
      entityId: id,
    });
    return pkg;
  }
}
