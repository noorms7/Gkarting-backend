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
import { Role } from '@prisma/client';
import { PricingService } from './pricing.service';
import {
  CreatePricingPackageDto,
  UpdatePricingPackageDto,
} from './dto/pricing.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('Pricing')
@Controller()
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Public()
  @Get('pricing')
  findAllActive() {
    return this.pricingService.findAllActive();
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/pricing')
  adminFindAll() {
    return this.pricingService.adminFindAll();
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/pricing')
  create(
    @Body() dto: CreatePricingPackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pricingService.create(dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/pricing/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePricingPackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pricingService.update(id, dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('admin/pricing/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pricingService.remove(id, user.id);
  }
}
