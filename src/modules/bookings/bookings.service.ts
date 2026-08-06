import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';
import { KartsService } from '../karts/karts.service';
import {
  CancelBookingDto,
  CheckAvailabilityDto,
  CreateBookingDto,
  RescheduleBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private mail: MailService,
    private notifications: NotificationsService,
    private coupons: CouponsService,
    private karts: KartsService,
  ) {}

  // ------------------------------------------------------------
  // AVAILABILITY ENGINE
  // ------------------------------------------------------------

  /**
   * Checks a requested slot against: business hours for that weekday,
   * whole-day/partial blocked dates, the live track status, total kart
   * fleet capacity, and every other CONFIRMED/PENDING booking whose time
   * range overlaps the request. Returns a plain result object rather than
   * throwing, so the same logic powers both the "check availability"
   * endpoint (which should just report unavailable) and booking creation
   * (which throws on failure).
   */
  async checkAvailability(dto: CheckAvailabilityDto): Promise<{
    available: boolean;
    reason?: string;
  }> {
    const date = new Date(dto.date);
    const requestStart = timeToMinutes(dto.startTime);
    const requestEnd = requestStart + dto.durationMins;

    // 1. Business hours
    const dayName = DAY_NAMES[date.getUTCDay()];
    const businessHour = await this.prisma.businessHour.findUnique({
      where: { day: dayName as any },
    });
    if (businessHour && !businessHour.isOpen) {
      return { available: false, reason: 'The track is closed on this day.' };
    }
    if (businessHour) {
      const openMins = timeToMinutes(businessHour.openTime);
      const closeMins = timeToMinutes(businessHour.closeTime);
      if (requestStart < openMins || requestEnd > closeMins) {
        return {
          available: false,
          reason: `The track is only open ${businessHour.openTime}-${businessHour.closeTime} on this day.`,
        };
      }
    }

    // 2. Blocked dates (maintenance, private events, holidays)
    const blocked = await this.prisma.blockedDate.findMany({
      where: { date: { equals: date } },
    });
    for (const b of blocked) {
      if (b.wholeDay) {
        return {
          available: false,
          reason: b.reason || 'The track is unavailable on this date.',
        };
      }
      if (b.startTime && b.endTime) {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        if (requestStart < bEnd && requestEnd > bStart) {
          return {
            available: false,
            reason:
              b.reason ||
              `The track is unavailable from ${b.startTime} to ${b.endTime} on this date.`,
          };
        }
      }
    }

    // 3. Live admin-controlled track status
    const trackStatus = await this.prisma.trackStatus.findFirst();
    if (trackStatus?.overrideActive && trackStatus.operationalStatus !== 'OPEN') {
      return {
        available: false,
        reason:
          trackStatus.customMessage ||
          'The track is currently closed. Please check back later.',
      };
    }

    // 4. Kart fleet capacity vs overlapping bookings
    const totalAvailableKarts = await this.karts.countAvailable();
    if (dto.kartsCount > totalAvailableKarts) {
      return {
        available: false,
        reason: `Only ${totalAvailableKarts} kart(s) are currently available.`,
      };
    }

    const sameDayBookings = await this.prisma.booking.findMany({
      where: {
        date: { equals: date },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      select: { startTime: true, durationMins: true, kartsCount: true },
    });

    let overlappingKarts = 0;
    for (const b of sameDayBookings) {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = bStart + b.durationMins;
      const overlaps = requestStart < bEnd && requestEnd > bStart;
      if (overlaps) overlappingKarts += b.kartsCount;
    }

    if (overlappingKarts + dto.kartsCount > totalAvailableKarts) {
      return {
        available: false,
        reason: 'This time slot is unavailable.',
      };
    }

    return { available: true };
  }

  private async generateBookingRef(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = Math.floor(100000 + Math.random() * 900000);
      const ref = `GK-${year}-${suffix}`;
      const exists = await this.prisma.booking.findUnique({
        where: { bookingRef: ref },
      });
      if (!exists) return ref;
    }
    // Extremely unlikely fallback
    return `GK-${year}-${Date.now()}`;
  }

  // ------------------------------------------------------------
  // CREATE
  // ------------------------------------------------------------

  async create(userId: string, dto: CreateBookingDto) {
    if (dto.paymentMethod === PaymentMethod.WISH_MONEY) {
      throw new BadRequestException(
        'Wish Money payments are coming soon — please choose Cash or Online Card for now.',
      );
    }

    const availability = await this.checkAvailability({
      date: dto.date,
      startTime: dto.startTime,
      durationMins: 0, // set below once package is loaded
      kartsCount: dto.kartsCount,
    });
    // durationMins depends on the package, so load it first and re-check
    // with the real duration before trusting the availability result.
    const pkg = await this.prisma.pricingPackage.findUnique({
      where: { id: dto.packageId },
    });
    if (!pkg || !pkg.isActive) {
      throw new BadRequestException('Selected package is not available');
    }
    if (dto.kartsCount > pkg.maxKarts) {
      throw new BadRequestException(
        `This package allows a maximum of ${pkg.maxKarts} kart(s)`,
      );
    }

    const finalAvailability = await this.checkAvailability({
      date: dto.date,
      startTime: dto.startTime,
      durationMins: pkg.durationMins,
      kartsCount: dto.kartsCount,
    });
    if (!finalAvailability.available) {
      throw new BadRequestException(
        finalAvailability.reason || 'This time slot is unavailable.',
      );
    }

    let totalPrice = Number(pkg.basePrice);
    let discountAmount = 0;
    let couponId: string | undefined;

    if (dto.couponCode) {
      const result = await this.coupons.validateAndComputeDiscount(
        dto.couponCode,
        totalPrice,
      );
      couponId = result.couponId;
      discountAmount = result.discountAmount;
      totalPrice = Math.max(0, totalPrice - discountAmount);
    }

    const kartIds = await this.karts.getAvailableKartIds(dto.kartsCount);
    if (kartIds.length < dto.kartsCount) {
      throw new BadRequestException(
        'Not enough karts available for this booking',
      );
    }

    const bookingRef = await this.generateBookingRef();

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingRef,
          date: new Date(dto.date),
          startTime: dto.startTime,
          durationMins: pkg.durationMins,
          kartsCount: dto.kartsCount,
          specialNotes: dto.specialNotes,
          status: BookingStatus.CONFIRMED,
          paymentMethod: dto.paymentMethod,
          paymentStatus: PaymentStatus.UNPAID,
          totalPrice,
          discountAmount,
          userId,
          packageId: pkg.id,
          couponId,
          karts: {
            create: kartIds.map((kartId, i) => ({
              kartId,
              riderName: dto.riderNames?.[i],
            })),
          },
        },
        include: { package: true, karts: { include: { kart: true } } },
      });
      return created;
    });

    if (couponId) {
      await this.coupons.incrementUsage(couponId);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    await this.mail.sendBookingConfirmationEmail(
      user!.email,
      user!.firstName,
      {
        bookingRef: booking.bookingRef,
        date: dto.date,
        startTime: dto.startTime,
        durationMins: booking.durationMins,
        kartsCount: booking.kartsCount,
        packageName: booking.package.name,
        totalPrice: `$${Number(booking.totalPrice).toFixed(2)}`,
      },
    );

    await this.notifications.create(
      userId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking confirmed',
      `Your booking ${booking.bookingRef} on ${dto.date} at ${dto.startTime} is confirmed.`,
    );

    await this.audit.log({
      actorId: userId,
      action: 'BOOKING_CREATED',
      entityType: 'Booking',
      entityId: booking.id,
      metadata: { bookingRef: booking.bookingRef },
    });

    return booking;
  }

  // ------------------------------------------------------------
  // READ
  // ------------------------------------------------------------

  async findForUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: { package: true, karts: { include: { kart: true } }, review: true },
    });
  }

  async findOneForUser(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { package: true, karts: { include: { kart: true } } },
    });
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  async adminFindAll(params: {
    skip?: number;
    take?: number;
    status?: BookingStatus;
    date?: string;
    search?: string;
  }) {
    const { skip = 0, take = 25, status, date, search } = params;
    const where = {
      ...(status ? { status } : {}),
      ...(date ? { date: new Date(date) } : {}),
      ...(search
        ? {
            OR: [
              { bookingRef: { contains: search, mode: 'insensitive' as const } },
              {
                user: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' as const } },
                      { lastName: { contains: search, mode: 'insensitive' as const } },
                      { email: { contains: search, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        include: {
          package: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async adminFindOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        package: true,
        user: true,
        karts: { include: { kart: true } },
        coupon: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // ------------------------------------------------------------
  // CANCEL
  // ------------------------------------------------------------

  async cancel(
    id: string,
    userId: string,
    isAdmin: boolean,
    dto: CancelBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!isAdmin && booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
      },
    });

    await this.mail.sendBookingCancellationEmail(
      booking.user.email,
      booking.user.firstName,
      booking.bookingRef,
    );

    await this.notifications.create(
      booking.userId,
      NotificationType.BOOKING_CANCELLED,
      'Booking cancelled',
      `Your booking ${booking.bookingRef} has been cancelled.`,
    );

    await this.audit.log({
      actorId: isAdmin ? userId : booking.userId,
      action: 'BOOKING_CANCELLED',
      entityType: 'Booking',
      entityId: id,
      metadata: { reason: dto.reason },
    });

    return updated;
  }

  // ------------------------------------------------------------
  // RESCHEDULE
  // ------------------------------------------------------------

  async reschedule(
    id: string,
    userId: string,
    isAdmin: boolean,
    dto: RescheduleBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!isAdmin && booking.userId !== userId) {
      throw new ForbiddenException('You can only reschedule your own bookings');
    }
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only active bookings can be rescheduled');
    }

    const availability = await this.checkAvailability({
      date: dto.date,
      startTime: dto.startTime,
      durationMins: booking.durationMins,
      kartsCount: booking.kartsCount,
    });
    if (!availability.available) {
      throw new BadRequestException(
        availability.reason || 'This time slot is unavailable.',
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { date: new Date(dto.date), startTime: dto.startTime },
      include: { package: true, user: true },
    });

    await this.mail.sendBookingConfirmationEmail(
      updated.user.email,
      updated.user.firstName,
      {
        bookingRef: updated.bookingRef,
        date: dto.date,
        startTime: dto.startTime,
        durationMins: updated.durationMins,
        kartsCount: updated.kartsCount,
        packageName: updated.package.name,
        totalPrice: `$${Number(updated.totalPrice).toFixed(2)}`,
      },
    );

    await this.notifications.create(
      updated.userId,
      NotificationType.BOOKING_CONFIRMED,
      'Booking rescheduled',
      `Your booking ${updated.bookingRef} was moved to ${dto.date} at ${dto.startTime}.`,
    );

    await this.audit.log({
      actorId: isAdmin ? userId : booking.userId,
      action: 'BOOKING_RESCHEDULED',
      entityType: 'Booking',
      entityId: id,
      metadata: { date: dto.date, startTime: dto.startTime },
    });

    return updated;
  }

  // ------------------------------------------------------------
  // ADMIN — status management (approve/reject/complete/no-show)
  // ------------------------------------------------------------

  async adminUpdateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    actorId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: dto.status as BookingStatus,
        ...(dto.status === 'CANCELLED'
          ? { cancelledAt: new Date(), cancelReason: dto.reason }
          : {}),
      },
    });

    if (dto.status === 'CANCELLED') {
      await this.mail.sendBookingCancellationEmail(
        booking.user.email,
        booking.user.firstName,
        booking.bookingRef,
      );
      await this.notifications.create(
        booking.userId,
        NotificationType.BOOKING_CANCELLED,
        'Booking cancelled',
        `Your booking ${booking.bookingRef} has been cancelled by our team.${dto.reason ? ` Reason: ${dto.reason}` : ''}`,
      );
    }

    await this.audit.log({
      actorId,
      action: 'BOOKING_STATUS_CHANGED',
      entityType: 'Booking',
      entityId: id,
      metadata: { status: dto.status },
    });

    return updated;
  }
}
