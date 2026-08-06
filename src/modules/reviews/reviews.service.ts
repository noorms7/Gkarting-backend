import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto, RejectReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async findApproved() {
    return this.prisma.review.findMany({
      where: { status: ReviewStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        booking: { include: { package: true } },
      },
    });
  }

  async create(userId: string, dto: CreateReviewDto) {
    if (dto.bookingId) {
      const existing = await this.prisma.review.findUnique({
        where: { bookingId: dto.bookingId },
      });
      if (existing) {
        throw new ConflictException(
          'A review already exists for this booking',
        );
      }
    }

    const review = await this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        userId,
        bookingId: dto.bookingId,
        status: ReviewStatus.PENDING,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'REVIEW_SUBMITTED',
      entityType: 'Review',
      entityId: review.id,
    });

    return {
      ...review,
      message: 'Thanks — your review is pending approval.',
    };
  }

  async adminFindAll(status?: ReviewStatus) {
    return this.prisma.review.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async approve(id: string, actorId: string) {
    const review = await this.getOrThrow(id);
    const updated = await this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.APPROVED },
    });

    await this.notifications.create(
      review.userId,
      NotificationType.REVIEW_APPROVED,
      'Review published',
      'Your review is now live on the GKarting site. Thanks for racing with us!',
    );
    await this.audit.log({
      actorId,
      action: 'REVIEW_APPROVED',
      entityType: 'Review',
      entityId: id,
    });
    return updated;
  }

  async reject(id: string, dto: RejectReviewDto, actorId: string) {
    const review = await this.getOrThrow(id);
    const updated = await this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.REJECTED, rejectReason: dto.reason },
    });

    await this.notifications.create(
      review.userId,
      NotificationType.REVIEW_REJECTED,
      'Review not published',
      dto.reason
        ? `Your review wasn't published: ${dto.reason}`
        : "Your review wasn't published.",
    );
    await this.audit.log({
      actorId,
      action: 'REVIEW_REJECTED',
      entityType: 'Review',
      entityId: id,
      metadata: { reason: dto.reason },
    });
    return updated;
  }

  async remove(id: string, actorId: string) {
    await this.getOrThrow(id);
    await this.prisma.review.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'REVIEW_DELETED',
      entityType: 'Review',
      entityId: id,
    });
    return { message: 'Review deleted' };
  }

  private async getOrThrow(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }
}
