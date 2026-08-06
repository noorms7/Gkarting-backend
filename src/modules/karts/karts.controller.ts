import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KartStatus, Role } from '@prisma/client';
import { KartsService } from './karts.service';
import { CreateKartDto, UpdateKartDto } from './dto/kart.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('Karts')
@Controller()
export class KartsController {
  constructor(private kartsService: KartsService) {}

  @Public()
  @Get('karts')
  findAll(@Query('status') status?: KartStatus) {
    return this.kartsService.findAll(status);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/karts/:id')
  findOne(@Param('id') id: string) {
    return this.kartsService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/karts')
  create(@Body() dto: CreateKartDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kartsService.create(dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/karts/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateKartDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kartsService.update(id, dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/karts/:id/status')
  setStatus(
    @Param('id') id: string,
    @Body('status') status: KartStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kartsService.setStatus(id, status, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('admin/karts/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.kartsService.remove(id, user.id);
  }
}
