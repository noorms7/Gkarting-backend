import { Injectable } from '@nestjs/common';
import { WeekDay } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WeatherService } from '../weather/weather.service';
import {
  CreateBlockedDateDto,
  UpdateBusinessHourDto,
  UpdateTrackStatusDto,
} from './dto/track-status.dto';

const DAY_ORDER: WeekDay[] = [
  WeekDay.SUNDAY,
  WeekDay.MONDAY,
  WeekDay.TUESDAY,
  WeekDay.WEDNESDAY,
  WeekDay.THURSDAY,
  WeekDay.FRIDAY,
  WeekDay.SATURDAY,
];

@Injectable()
export class TrackStatusService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private weather: WeatherService,
  ) {}

  /** Ensures the singleton row exists, returns it. */
  private async getOrCreateStatusRow() {
    const existing = await this.prisma.trackStatus.findFirst();
    if (existing) return existing;
    return this.prisma.trackStatus.create({ data: {} });
  }

  async getBusinessHours() {
    const hours = await this.prisma.businessHour.findMany();
    return hours.sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
    );
  }

  async updateBusinessHour(
    day: WeekDay,
    dto: UpdateBusinessHourDto,
    actorId: string,
  ) {
    const hour = await this.prisma.businessHour.upsert({
      where: { day },
      update: dto,
      create: { day, ...dto },
    });
    await this.audit.log({
      actorId,
      action: 'BUSINESS_HOURS_UPDATED',
      entityType: 'BusinessHour',
      entityId: hour.id,
      metadata: { day, ...dto },
    });
    return hour;
  }

  async getBlockedDates() {
    return this.prisma.blockedDate.findMany({ orderBy: { date: 'asc' } });
  }

  async addBlockedDate(dto: CreateBlockedDateDto, actorId: string) {
    const blocked = await this.prisma.blockedDate.create({
      data: { ...dto, date: new Date(dto.date) },
    });
    await this.audit.log({
      actorId,
      action: 'BLOCKED_DATE_ADDED',
      entityType: 'BlockedDate',
      entityId: blocked.id,
      metadata: dto,
    });
    return blocked;
  }

  async removeBlockedDate(id: string, actorId: string) {
    await this.prisma.blockedDate.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'BLOCKED_DATE_REMOVED',
      entityType: 'BlockedDate',
      entityId: id,
    });
    return { message: 'Blocked date removed' };
  }

  async adminUpdateStatus(dto: UpdateTrackStatusDto, actorId: string) {
    const current = await this.getOrCreateStatusRow();
    const status = await this.prisma.trackStatus.update({
      where: { id: current.id },
      data: {
        ...dto,
        scheduledReopenAt: dto.scheduledReopenAt
          ? new Date(dto.scheduledReopenAt)
          : undefined,
        overrideActive: true,
        updatedById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      action: 'TRACK_STATUS_CHANGED',
      entityType: 'TrackStatus',
      entityId: status.id,
      metadata: dto,
    });
    return status;
  }

  async clearOverride(actorId: string) {
    const current = await this.getOrCreateStatusRow();
    const status = await this.prisma.trackStatus.update({
      where: { id: current.id },
      data: { overrideActive: false, updatedById: actorId },
    });
    await this.audit.log({
      actorId,
      action: 'TRACK_STATUS_OVERRIDE_CLEARED',
      entityType: 'TrackStatus',
      entityId: status.id,
    });
    return status;
  }

  /**
   * Public, homepage-facing snapshot combining the admin-controlled
   * operational status with live weather. Weather never overrides the
   * admin's manual status — it's advisory only, matching the spec:
   * "the track status itself is controlled by the administrator."
   */
  async getPublicStatus() {
    const [status, weather] = await Promise.all([
      this.getOrCreateStatusRow(),
      this.weather.getCurrentWeather(),
    ]);

    return {
      operationalStatus: status.operationalStatus,
      customMessage: status.customMessage,
      overrideActive: status.overrideActive,
      scheduledReopenAt: status.scheduledReopenAt,
      updatedAt: status.updatedAt,
      weather,
      weatherAdvisory: !weather.isSuitableForRacing
        ? 'Track temporarily unavailable due to weather conditions.'
        : null,
    };
  }
}
