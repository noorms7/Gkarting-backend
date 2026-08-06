import { Module } from '@nestjs/common';
import { TrackStatusService } from './track-status.service';
import { TrackStatusController } from './track-status.controller';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [WeatherModule],
  controllers: [TrackStatusController],
  providers: [TrackStatusService],
  exports: [TrackStatusService],
})
export class TrackStatusModule {}
