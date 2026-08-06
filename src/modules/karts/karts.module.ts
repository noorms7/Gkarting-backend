import { Module } from '@nestjs/common';
import { KartsService } from './karts.service';
import { KartsController } from './karts.controller';

@Module({
  controllers: [KartsController],
  providers: [KartsService],
  exports: [KartsService],
})
export class KartsModule {}
