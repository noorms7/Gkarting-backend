import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingStatus, Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import {
  CancelBookingDto,
  CheckAvailabilityDto,
  CreateBookingDto,
  RescheduleBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('Bookings')
@Controller()
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Public()
  @Post('bookings/check-availability')
  checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.bookingsService.checkAvailability(dto);
  }

  @ApiBearerAuth()
  @Post('bookings')
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Get('bookings/me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findForUser(user.id);
  }

  @ApiBearerAuth()
  @Get('bookings/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findOneForUser(id, user.id);
  }

  @ApiBearerAuth()
  @Patch('bookings/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.cancel(id, user.id, false, dto);
  }

  @ApiBearerAuth()
  @Patch('bookings/:id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.reschedule(id, user.id, false, dto);
  }

  // ---------------- Admin ----------------

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/bookings')
  adminFindAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: BookingStatus,
    @Query('date') date?: string,
    @Query('search') search?: string,
  ) {
    return this.bookingsService.adminFindAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      status,
      date,
      search,
    });
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/bookings/:id')
  adminFindOne(@Param('id') id: string) {
    return this.bookingsService.adminFindOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/bookings/:id/status')
  adminUpdateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.adminUpdateStatus(id, dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/bookings/:id/cancel')
  adminCancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.cancel(id, user.id, true, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/bookings/:id/reschedule')
  adminReschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.reschedule(id, user.id, true, dto);
  }
}
