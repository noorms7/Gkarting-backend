import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Weather')
@Controller('weather')
export class WeatherController {
  constructor(private weatherService: WeatherService) {}

  @Public()
  @Get('current')
  getCurrent() {
    return this.weatherService.getCurrentWeather();
  }
}
