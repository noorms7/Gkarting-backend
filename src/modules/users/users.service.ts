import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private publicProfile(user: any) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.publicProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone: dto.phone, NOT: { id: userId } },
      });
      if (existing) {
        throw new ConflictException(
          'This phone number is already used by another account',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    await this.audit.log({
      actorId: userId,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
    });

    return this.publicProfile(user);
  }

  async setAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return this.publicProfile(user);
  }

  // ------------------------------------------------------------
  // ADMIN — customer management
  // ------------------------------------------------------------

  async adminFindAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    role?: Role;
  }) {
    const { skip = 0, take = 25, search, role } = params;
    const where = {
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          _count: { select: { bookings: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async adminFindOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { package: true },
        },
        reviews: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async adminSetActive(id: string, isActive: boolean, actorId: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });

    await this.audit.log({
      actorId,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: id,
    });

    return this.publicProfile(user);
  }

  async adminSetRole(id: string, role: Role, actorId: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    await this.audit.log({
      actorId,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: id,
      metadata: { newRole: role },
    });

    return this.publicProfile(user);
  }
}
