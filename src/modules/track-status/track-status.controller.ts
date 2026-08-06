import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, WeekDay } from '@prisma/client';
import { TrackStatusService } from './track-status.service';
import {
  CreateBlockedDateDto,
  UpdateBusinessHourDto,
  UpdateTrackStatusDto,
} from './dto/track-status.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('Track Status')
@Controller()
export class TrackStatusController {
  constructor(private trackStatusService: TrackStatusService) {}

  @Public()
  @Get('track-status')
  getPublicStatus() {
    return this.trackStatusService.getPublicStatus();
  }

  @Public()
  @Get('business-hours')
  getBusinessHours() {
    return this.trackStatusService.getBusinessHours();
  }

  // ---------------- Admin ----------------

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/track-status')
  updateStatus(
    @Body() dto: UpdateTrackStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackStatusService.adminUpdateStatus(dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/track-status/clear-override')
  clearOverride(@CurrentUser() user: AuthenticatedUser) {
    return this.trackStatusService.clearOverride(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/business-hours/:day')
  updateBusinessHour(
    @Param('day') day: WeekDay,
    @Body() dto: UpdateBusinessHourDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackStatusService.updateBusinessHour(day, dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/blocked-dates')
  getBlockedDates() {
    return this.trackStatusService.getBlockedDates();
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/blocked-dates')
  addBlockedDate(
    @Body() dto: CreateBlockedDateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackStatusService.addBlockedDate(dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('admin/blocked-dates/:id')
  removeBlockedDate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trackStatusService.removeBlockedDate(id, user.id);
  }
}
