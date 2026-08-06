import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateSiteSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
    private cloudinary: CloudinaryService,
  ) {}

  private async getOrCreate() {
    const existing = await this.prisma.siteSettings.findFirst();
    if (existing) return existing;
    return this.prisma.siteSettings.create({ data: {} });
  }

  async getPublicSettings() {
    const settings = await this.getOrCreate();
    return {
      businessName: settings.businessName,
      logoUrl: settings.logoUrl,
      phone: settings.phone,
      email: settings.email,
      whatsapp: settings.whatsapp,
      instagramUrl: settings.instagramUrl,
      facebookUrl: settings.facebookUrl,
      address: settings.address,
      latitude: settings.latitude,
      longitude: settings.longitude,
    };
  }

  async adminGetSettings() {
    return this.getOrCreate();
  }

  async update(dto: UpdateSiteSettingsDto, actorId: string) {
    const current = await this.getOrCreate();
    const settings = await this.prisma.siteSettings.update({
      where: { id: current.id },
      data: dto,
    });
    await this.audit.log({
      actorId,
      action: 'SITE_SETTINGS_UPDATED',
      entityType: 'SiteSettings',
      entityId: settings.id,
      metadata: dto,
    });
    return settings;
  }

  async updateLogo(buffer: Buffer, actorId: string) {
    const result = await this.cloudinary.uploadBuffer(buffer, 'branding');
    return this.update({ logoUrl: result.secure_url }, actorId);
  }

  /**
   * Google Maps config exposed to the frontend. Only the browser-key +
   * coordinates are returned — the API key here should be restricted
   * (HTTP referrer) at the Google Cloud Console level, never the same
   * key used for server-side geocoding/places calls.
   */
  async getMapsConfig() {
    const settings = await this.getOrCreate();
    return {
      apiKey: this.config.get('googleMaps.apiKey'),
      latitude: settings.latitude ?? this.config.get('googleMaps.trackLatitude'),
      longitude: settings.longitude ?? this.config.get('googleMaps.trackLongitude'),
      address: settings.address,
    };
  }
}
