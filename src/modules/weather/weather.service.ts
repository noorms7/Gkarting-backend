import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WeatherSnapshot {
  temperatureC: number;
  condition: string;
  description: string;
  icon: string;
  humidity: number;
  windSpeedKph: number;
  isSuitableForRacing: boolean;
  fetchedAt: string;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private cache: { data: WeatherSnapshot; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private config: ConfigService) {}

  async getCurrentWeather(): Promise<WeatherSnapshot> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.data;
    }

    const apiKey = this.config.get('weather.apiKey');
    const baseUrl = this.config.get('weather.baseUrl');
    const lat = this.config.get('googleMaps.trackLatitude');
    const lon = this.config.get('googleMaps.trackLongitude');

    if (!apiKey) {
      // No key configured yet — return a clearly-marked placeholder so the
      // frontend still renders instead of throwing on every request.
      const fallback: WeatherSnapshot = {
        temperatureC: 0,
        condition: 'Unavailable',
        description: 'Weather API key not configured',
        icon: '01d',
        humidity: 0,
        windSpeedKph: 0,
        isSuitableForRacing: true,
        fetchedAt: new Date().toISOString(),
      };
      return fallback;
    }

    try {
      const url = `${baseUrl}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new HttpException(
          `Weather provider returned ${res.status}`,
          502,
        );
      }
      const data: any = await res.json();

      const windSpeedKph = (data.wind?.speed ?? 0) * 3.6;
      const condition: string = data.weather?.[0]?.main ?? 'Unknown';
      const severeConditions = [
        'Thunderstorm',
        'Tornado',
        'Squall',
        'Extreme',
      ];
      const isSuitableForRacing =
        !severeConditions.includes(condition) && windSpeedKph < 45;

      const snapshot: WeatherSnapshot = {
        temperatureC: Math.round(data.main?.temp ?? 0),
        condition,
        description: data.weather?.[0]?.description ?? '',
        icon: data.weather?.[0]?.icon ?? '01d',
        humidity: data.main?.humidity ?? 0,
        windSpeedKph: Math.round(windSpeedKph),
        isSuitableForRacing,
        fetchedAt: new Date().toISOString(),
      };

      this.cache = { data: snapshot, expiresAt: Date.now() + this.CACHE_TTL_MS };
      return snapshot;
    } catch (err) {
      this.logger.error('Failed to fetch weather', err as any);
      // Serve stale cache rather than nothing if the provider hiccups.
      if (this.cache) return this.cache.data;
      throw new HttpException('Weather data temporarily unavailable', 502);
    }
  }
}
