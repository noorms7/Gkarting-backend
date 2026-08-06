import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { UpdateSiteSettingsDto } from './dto/settings.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Public()
  @Get('settings')
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Public()
  @Get('maps/config')
  getMapsConfig() {
    return this.settingsService.getMapsConfig();
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/settings')
  adminGetSettings() {
    return this.settingsService.adminGetSettings();
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/settings')
  update(
    @Body() dto: UpdateSiteSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.update(dto, user.id);
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/settings/logo')
  @UseInterceptors(FileInterceptor('file'))
  updateLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateLogo(file.buffer, user.id);
  }
}
