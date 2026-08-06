import { Injectable } from '@nestjs/common';
import { BookingStatus, KartStatus, MessageStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /** Powers the admin dashboard's overview cards. */
  async getOverview() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [
      todayBookings,
      pendingBookings,
      totalKarts,
      availableKarts,
      occupiedKarts,
      pendingReviews,
      openMessages,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { date: { gte: today, lt: tomorrow } },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING },
      }),
      this.prisma.kart.count(),
      this.prisma.kart.count({ where: { status: KartStatus.AVAILABLE } }),
      this.prisma.kart.count({
        where: { status: { in: [KartStatus.RESERVED, KartStatus.MAINTENANCE, KartStatus.BROKEN] } },
      }),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      this.prisma.contactMessage.count({ where: { status: MessageStatus.OPEN } }),
      this.prisma.booking.aggregate({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          date: { gte: today, lt: tomorrow },
        },
        _sum: { totalPrice: true },
      }),
    ]);

    return {
      todayBookings,
      pendingBookings,
      totalKarts,
      availableKarts,
      occupiedKarts,
      pendingReviews,
      openMessages,
      todayRevenue: Number(revenueAgg._sum.totalPrice ?? 0),
    };
  }

  async getRevenue(params: { from?: string; to?: string }) {
    const from = params.from ? new Date(params.from) : new Date(0);
    const to = params.to ? new Date(params.to) : new Date();

    const bookings = await this.prisma.booking.findMany({
      where: {
        date: { gte: from, lte: to },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      select: { date: true, totalPrice: true },
      orderBy: { date: 'asc' },
    });

    const byDate = new Map<string, number>();
    for (const b of bookings) {
      const key = b.date.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(b.totalPrice));
    }

    const series = Array.from(byDate.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));
    const total = series.reduce((sum, s) => sum + s.revenue, 0);

    return { total, series };
  }

  async getMostBookedHours() {
    const bookings = await this.prisma.booking.findMany({
      where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
      select: { startTime: true },
    });
    const counts = new Map<string, number>();
    for (const b of bookings) {
      const hour = b.startTime.split(':')[0] + ':00';
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getMostPopularPackages() {
    const grouped = await this.prisma.booking.groupBy({
      by: ['packageId'],
      where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
      _count: { packageId: true },
    });
    const packages = await this.prisma.pricingPackage.findMany({
      where: { id: { in: grouped.map((g) => g.packageId) } },
    });
    return grouped
      .map((g) => ({
        package: packages.find((p) => p.id === g.packageId),
        bookings: g._count.packageId,
      }))
      .sort((a, b) => b.bookings - a.bookings);
  }
}
